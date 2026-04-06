import React, { memo, useEffect, useRef } from "react";

let youtubeApiPromise;
let twitchApiPromise;

function getTwitchParent() {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname || "localhost";
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

function StreamPlayerInner({ stream, isActive, audioUnlocked }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const lastAudioStateRef = useRef(null);
  const streamKeyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    const streamKey = `${stream.type}:${stream.sourceId}`;

    if (streamKeyRef.current === streamKey && playerRef.current) {
      return;
    }

    streamKeyRef.current = streamKey;
    readyRef.current = false;
    lastAudioStateRef.current = null;

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    playerRef.current = null;

    async function initYouTube() {
      const YT = await loadYouTubeApi();
      if (cancelled || !containerRef.current) return;

      const mount = document.createElement("div");
      mount.id = `yt-player-${stream.id}`;
      mount.className = "youtube-player h-full w-full";
      containerRef.current.appendChild(mount);

      const player = new YT.Player(mount.id, {
        width: "100%",
        height: "100%",
        videoId: stream.sourceId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;

            playerRef.current = event.target;
            readyRef.current = true;
            lastAudioStateRef.current = null;

            const shouldBeAudible = isActive && audioUnlocked;

            try {
              if (shouldBeAudible) {
                event.target.unMute();
                event.target.setVolume(100);
                event.target.playVideo();
              } else {
                event.target.mute();
              }
            } catch {}

            lastAudioStateRef.current = shouldBeAudible;
          }
        }
      });

      playerRef.current = player;
    }

    async function initTwitch() {
      const Twitch = await loadTwitchApi();
      if (cancelled || !containerRef.current) return;

      const mount = document.createElement("div");
      mount.id = `twitch-player-${stream.id}`;
      mount.className = "twitch-player h-full w-full";
      containerRef.current.appendChild(mount);

      const options = {
        width: "100%",
        height: "100%",
        parent: [getTwitchParent()],
        autoplay: true,
        muted: !(isActive && audioUnlocked)
      };

      if (stream.type === "twitch-channel") {
        options.channel = stream.sourceId;
      } else {
        options.video = `v${stream.sourceId}`;
      }

      const player = new Twitch.Player(mount.id, options);
      playerRef.current = player;

      const markReady = () => {
        if (cancelled) return;

        readyRef.current = true;
        lastAudioStateRef.current = null;

        const shouldBeAudible = isActive && audioUnlocked;

        try {
          player.setMuted(!shouldBeAudible);
          if (shouldBeAudible) {
            player.play?.();
          }
        } catch {}

        lastAudioStateRef.current = shouldBeAudible;
      };

      if (typeof player.addEventListener === "function") {
        player.addEventListener(Twitch.Player.READY, markReady);
      } else {
        markReady();
      }
    }

    if (stream.type === "youtube") {
      initYouTube();
    } else {
      initTwitch();
    }

    return () => {
      cancelled = true;
    };
  }, [stream.id, stream.type, stream.sourceId, audioUnlocked, isActive]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;

    const shouldBeAudible = isActive && audioUnlocked;

    if (lastAudioStateRef.current === shouldBeAudible) {
      return;
    }

    try {
      if (stream.type === "youtube") {
        if (shouldBeAudible) {
          player.unMute?.();
          player.setVolume?.(100);
          player.playVideo?.();
        } else {
          player.mute?.();
        }
      } else {
        player.setMuted?.(!shouldBeAudible);
        if (shouldBeAudible) {
          player.play?.();
        }
      }

      lastAudioStateRef.current = shouldBeAudible;
    } catch {}
  }, [isActive, audioUnlocked, stream.type]);

  useEffect(() => {
    return () => {
      try {
        if (stream.type === "youtube" && playerRef.current?.destroy) {
          playerRef.current.destroy();
        }
      } catch {}

      try {
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
      } catch {}
    };
  }, [stream.type]);

  return <div ref={containerRef} className="stream-player-root h-full w-full" />;
}

const StreamPlayer = memo(
  StreamPlayerInner,
  (prevProps, nextProps) =>
    prevProps.stream.id === nextProps.stream.id &&
    prevProps.stream.type === nextProps.stream.type &&
    prevProps.stream.sourceId === nextProps.stream.sourceId &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.audioUnlocked === nextProps.audioUnlocked
);

export default StreamPlayer;