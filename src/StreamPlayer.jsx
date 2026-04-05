import React, { useEffect, useRef } from "react";

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

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
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
    if (window.Twitch?.Embed || window.Twitch?.Player) {
      resolve(window.Twitch);
      return;
    }

    const existing = document.querySelector('script[src="https://embed.twitch.tv/embed/v1.js"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://embed.twitch.tv/embed/v1.js";
      tag.onload = () => resolve(window.Twitch);
      tag.onerror = reject;
      document.body.appendChild(tag);
      return;
    }

    existing.addEventListener("load", () => resolve(window.Twitch), { once: true });
  });

  return twitchApiPromise;
}

export default function StreamPlayer({ stream, isActive }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    readyRef.current = false;
    container.innerHTML = "";
    playerRef.current = null;

    async function initYouTube() {
      const YT = await loadYouTubeApi();
      if (cancelled || !containerRef.current) return;

      const mount = document.createElement("div");
      mount.id = `yt-player-${stream.id}`;
      containerRef.current.appendChild(mount);

      playerRef.current = new YT.Player(mount.id, {
        videoId: stream.sourceId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            readyRef.current = true;
            if (isActive) {
              event.target.unMute();
              event.target.setVolume(100);
              event.target.playVideo();
            } else {
              event.target.mute();
            }
          }
        }
      });
    }

    async function initTwitch() {
      const Twitch = await loadTwitchApi();
      if (cancelled || !containerRef.current) return;

      const options = {
        width: "100%",
        height: "100%",
        parent: [getTwitchParent()],
        autoplay: true,
        muted: !isActive
      };

      if (stream.type === "twitch-channel") {
        options.channel = stream.sourceId;
      } else {
        options.video = `v${stream.sourceId}`;
      }

      const embed = new Twitch.Embed(containerRef.current, options);

      embed.addEventListener(Twitch.Embed.VIDEO_READY, () => {
        if (cancelled) return;
        const player = embed.getPlayer();
        playerRef.current = player;
        readyRef.current = true;

        if (isActive) {
          player.setMuted(false);
          try {
            player.play();
          } catch {}
        } else {
          player.setMuted(true);
        }
      });
    }

    if (stream.type === "youtube") {
      initYouTube();
    } else {
      initTwitch();
    }

    return () => {
      cancelled = true;

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
  }, [stream]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;

    try {
      if (stream.type === "youtube") {
        if (isActive) {
          player.unMute?.();
          player.setVolume?.(100);
          player.playVideo?.();
        } else {
          player.mute?.();
        }
      } else {
        player.setMuted?.(!isActive);
        if (isActive) {
          try {
            player.play?.();
          } catch {}
        }
      }
    } catch {}
  }, [isActive, stream.type]);

  return <div ref={containerRef} className="h-full w-full" />;
}