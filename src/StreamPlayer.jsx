import React, { memo, useEffect, useMemo, useRef } from "react";

let youtubeApiPromise;
let twitchApiPromise;

const PLAYER_CACHE = new Map();
const CLEANUP_DELAY_MS = 120000;

function getTwitchParent() {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname || "localhost";
}

function getStreamCacheKey(stream) {
  return `${stream.type}:${stream.sourceId}`;
}

function createHostElement() {
  const host = document.createElement("div");
  host.className = "stream-player-root h-full w-full";
  return host;
}

function loadYouTubeApi() {
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve(window.YT);
    };
  });

  return youtubeApiPromise;
}

function loadTwitchApi() {
  if (twitchApiPromise) return twitchApiPromise;

  twitchApiPromise = new Promise((resolve, reject) => {
    if (window.Twitch?.Player) {
      resolve(window.Twitch);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://player.twitch.tv/js/embed/v1.js"]'
    );

    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://player.twitch.tv/js/embed/v1.js";
      tag.onload = () => resolve(window.Twitch);
      tag.onerror = reject;
      document.body.appendChild(tag);
      return;
    }

    existing.addEventListener("load", () => resolve(window.Twitch), {
      once: true
    });
  });

  return twitchApiPromise;
}

function createCacheEntry(stream) {
  return {
    key: getStreamCacheKey(stream),
    type: stream.type,
    sourceId: stream.sourceId,
    host: createHostElement(),
    player: null,
    ready: false,
    initPromise: null,
    mountCount: 0,
    cleanupTimer: null,
    desiredAudible: false,
    lastAppliedAudible: null
  };
}

function getOrCreateEntry(stream) {
  const key = getStreamCacheKey(stream);

  let entry = PLAYER_CACHE.get(key);
  if (!entry) {
    entry = createCacheEntry(stream);
    PLAYER_CACHE.set(key, entry);
  }

  return entry;
}

function cancelCleanup(entry) {
  if (entry.cleanupTimer) {
    window.clearTimeout(entry.cleanupTimer);
    entry.cleanupTimer = null;
  }
}

function scheduleCleanup(entry) {
  cancelCleanup(entry);

  entry.cleanupTimer = window.setTimeout(() => {
    if (entry.mountCount > 0) return;

    try {
      if (entry.player?.destroy) {
        entry.player.destroy();
      }
    } catch {}

    try {
      entry.host.innerHTML = "";
    } catch {}

    PLAYER_CACHE.delete(entry.key);
  }, CLEANUP_DELAY_MS);
}

function attachHostToContainer(entry, container) {
  if (!container || !entry?.host) return;

  if (entry.host.parentNode === container) {
    return;
  }

  container.innerHTML = "";
  container.appendChild(entry.host);
}

function detachHostFromContainer(entry, container) {
  if (!container || !entry?.host) return;

  if (entry.host.parentNode === container) {
    container.removeChild(entry.host);
  }
}

function applyAudioState(entry) {
  if (!entry?.player || !entry.ready) return;

  const shouldBeAudible = !!entry.desiredAudible;

  if (entry.lastAppliedAudible === shouldBeAudible) {
    return;
  }

  try {
    if (entry.type === "youtube") {
      if (shouldBeAudible) {
        entry.player.unMute?.();
        entry.player.setVolume?.(100);
        entry.player.playVideo?.();
      } else {
        entry.player.mute?.();
      }
    } else {
      entry.player.setMuted?.(!shouldBeAudible);
      if (shouldBeAudible) {
        entry.player.play?.();
      }
    }

    entry.lastAppliedAudible = shouldBeAudible;
  } catch {}
}

async function ensureYouTubePlayer(entry) {
  if (entry.player || entry.initPromise) {
    return entry.initPromise;
  }

  entry.initPromise = (async () => {
    const YT = await loadYouTubeApi();

    entry.host.innerHTML = "";

    const mount = document.createElement("div");
    mount.id = `yt-player-${entry.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    mount.className = "youtube-player h-full w-full";
    entry.host.appendChild(mount);

    await new Promise((resolve) => {
      const player = new YT.Player(mount.id, {
        width: "100%",
        height: "100%",
        videoId: entry.sourceId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            entry.player = event.target;
            entry.ready = true;
            entry.lastAppliedAudible = null;
            applyAudioState(entry);
            resolve();
          }
        }
      });

      entry.player = player;
    });
  })();

  return entry.initPromise;
}

async function ensureTwitchPlayer(entry) {
  if (entry.player || entry.initPromise) {
    return entry.initPromise;
  }

  entry.initPromise = (async () => {
    const Twitch = await loadTwitchApi();

    entry.host.innerHTML = "";

    const mount = document.createElement("div");
    mount.id = `twitch-player-${entry.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    mount.className = "twitch-player h-full w-full";
    entry.host.appendChild(mount);

    const options = {
      width: "100%",
      height: "100%",
      parent: [getTwitchParent()],
      autoplay: true,
      muted: !entry.desiredAudible
    };

    if (entry.type === "twitch-channel") {
      options.channel = entry.sourceId;
    } else {
      options.video = `v${entry.sourceId}`;
    }

    const player = new Twitch.Player(mount.id, options);
    entry.player = player;

    await new Promise((resolve) => {
      const markReady = () => {
        entry.ready = true;
        entry.lastAppliedAudible = null;
        applyAudioState(entry);
        resolve();
      };

      if (typeof player.addEventListener === "function") {
        player.addEventListener(Twitch.Player.READY, markReady);
      } else {
        markReady();
      }
    });
  })();

  return entry.initPromise;
}

function ensurePlayer(entry) {
  if (entry.type === "youtube") {
    return ensureYouTubePlayer(entry);
  }

  return ensureTwitchPlayer(entry);
}

function StreamPlayerInner({ stream, isAudible, audioUnlocked }) {
  const containerRef = useRef(null);
  const cacheKey = useMemo(
    () => getStreamCacheKey(stream),
    [stream.type, stream.sourceId]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const entry = getOrCreateEntry(stream);
    entry.mountCount += 1;
    cancelCleanup(entry);

    attachHostToContainer(entry, container);
    ensurePlayer(entry);

    return () => {
      entry.mountCount = Math.max(0, entry.mountCount - 1);
      detachHostFromContainer(entry, container);
      scheduleCleanup(entry);
    };
  }, [cacheKey, stream]);

  useEffect(() => {
    const entry = PLAYER_CACHE.get(cacheKey);
    if (!entry) return;

    entry.desiredAudible = !!(isAudible && audioUnlocked);
    applyAudioState(entry);
  }, [cacheKey, isAudible, audioUnlocked]);

  return <div ref={containerRef} className="h-full w-full" />;
}

const StreamPlayer = memo(
  StreamPlayerInner,
  (prevProps, nextProps) =>
    prevProps.stream.type === nextProps.stream.type &&
    prevProps.stream.sourceId === nextProps.stream.sourceId &&
    prevProps.isAudible === nextProps.isAudible &&
    prevProps.audioUnlocked === nextProps.audioUnlocked
);

export default StreamPlayer;