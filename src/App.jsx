import React, { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Moon,
  Plus,
  Sun,
  Trash2,
  Volume2,
  VolumeX
} from "lucide-react";
import StreamPlayer from "./StreamPlayer";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseStream(input) {
  const value = input.trim();
  if (!value) return null;

  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{6,})/i,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{6,})/i,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/i,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{6,})/i
  ];

  for (const pattern of youtubePatterns) {
    const match = value.match(pattern);
    if (match) {
      return {
        id: createId(),
        type: "youtube",
        sourceId: match[1],
        raw: value,
        label: `YouTube · ${match[1]}`
      };
    }
  }

  const twitchVideoMatch = value.match(/twitch\.tv\/videos\/(\d+)/i);
  if (twitchVideoMatch) {
    return {
      id: createId(),
      type: "twitch-video",
      sourceId: twitchVideoMatch[1],
      raw: value,
      label: `Twitch VOD · ${twitchVideoMatch[1]}`
    };
  }

  const twitchChannelMatch = value.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
  if (twitchChannelMatch && twitchChannelMatch[1]?.toLowerCase() !== "videos") {
    return {
      id: createId(),
      type: "twitch-channel",
      sourceId: twitchChannelMatch[1],
      raw: value,
      label: `Twitch · ${twitchChannelMatch[1]}`
    };
  }

  return null;
}

function getGridClasses(count) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count <= 4) return "grid-cols-1 md:grid-cols-2";
  return "grid-cols-1 md:grid-cols-2";
}

function StreamCard({
  stream,
  isActive,
  isFocused,
  onMakeActive,
  onToggleFocus,
  onRemove,
  audioUnlocked
}) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border shadow-sm transition duration-200 hover:-translate-y-0.5 ${
        isFocused
          ? "border-[var(--accent-border)] bg-[var(--card-bg)] ring-2 ring-[var(--accent-soft)]"
          : isActive
          ? "border-[var(--accent-soft)] bg-[var(--card-bg)] ring-1 ring-[var(--accent-soft)]"
          : "border-[var(--card-border)] bg-[var(--card-bg)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] px-4 py-3">
        <button
          onClick={onMakeActive}
          title="Make this the active audio stream"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {isActive && audioUnlocked ? (
            <Volume2 className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
          ) : (
            <VolumeX className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          )}
          <span className="truncate text-sm font-medium text-[var(--text-main)]">
            {stream.label}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFocus}
            className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
            title={isFocused ? "Exit focus mode" : "Focus this stream"}
          >
            {isFocused ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          <a
            href={stream.raw}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
            title="Open original stream"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          <button
            onClick={onRemove}
            className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-red-400"
            title="Remove stream"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="aspect-video bg-black">
        <StreamPlayer
          stream={stream}
          isActive={isActive}
          audioUnlocked={audioUnlocked}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-xs text-[var(--muted)]">
        <span>{stream.type === "youtube" ? "YouTube" : "Twitch"}</span>
        <span>
          {isFocused
            ? "Focused"
            : isActive && audioUnlocked
            ? "Audio active"
            : "Muted"}
        </span>
      </div>
    </article>
  );
}

export default function App() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("multiview-theme") || "dark";
    } catch {
      return "dark";
    }
  });

  const [streams, setStreams] = useState(() => {
    try {
      const stored = localStorage.getItem("multiview-streams");
      return stored
        ? JSON.parse(stored)
        : [
            {
              id: "demo-yt",
              type: "youtube",
              sourceId: "jfKfPfyJRdk",
              raw: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
              label: "YouTube · Demo stream"
            }
          ];
    } catch {
      return [
        {
          id: "demo-yt",
          type: "youtube",
          sourceId: "jfKfPfyJRdk",
          raw: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
          label: "YouTube · Demo stream"
        }
      ];
    }
  });

  const [activeId, setActiveId] = useState(() => {
    try {
      return localStorage.getItem("multiview-active-id") || "demo-yt";
    } catch {
      return "demo-yt";
    }
  });

  const [focusedId, setFocusedId] = useState(() => {
    try {
      return localStorage.getItem("multiview-focused-id") || "demo-yt";
    } catch {
      return "demo-yt";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("multiview-theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const unlock = () => {
      setAudioUnlocked(true);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("multiview-streams", JSON.stringify(streams));
    } catch {}
  }, [streams]);

  useEffect(() => {
    try {
      if (activeId) {
        localStorage.setItem("multiview-active-id", activeId);
      } else {
        localStorage.removeItem("multiview-active-id");
      }
    } catch {}
  }, [activeId]);

  useEffect(() => {
    try {
      if (focusedId) {
        localStorage.setItem("multiview-focused-id", focusedId);
      } else {
        localStorage.removeItem("multiview-focused-id");
      }
    } catch {}
  }, [focusedId]);

  useEffect(() => {
    if (!streams.length) {
      setActiveId(null);
      setFocusedId(null);
      return;
    }

    if (!streams.some((stream) => stream.id === activeId)) {
      setActiveId(streams[0].id);
    }

    if (focusedId && !streams.some((stream) => stream.id === focusedId)) {
      setFocusedId(streams[0].id);
    }
  }, [streams, activeId, focusedId]);

  function addStream() {
    const parsed = parseStream(input);

    if (!parsed) {
      setError("Paste a valid YouTube or Twitch URL.");
      return;
    }

    setStreams((current) => [...current, parsed]);
    setActiveId(parsed.id);
    setFocusedId(parsed.id);
    setInput("");
    setError("");
  }

  function removeStream(id) {
    setStreams((current) => current.filter((stream) => stream.id !== id));
  }

  function clearAll() {
    setStreams([]);
    setActiveId(null);
    setFocusedId(null);
  }

  function toggleFocus(id) {
    setFocusedId((current) => (current === id ? null : id));
  }

  const focusedStream = useMemo(() => {
    if (!focusedId) return null;
    return streams.find((stream) => stream.id === focusedId) || null;
  }, [streams, focusedId]);

  const secondaryStreams = useMemo(() => {
    if (!focusedId) return streams;
    return streams.filter((stream) => stream.id !== focusedId);
  }, [streams, focusedId]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-[var(--panel-shadow)] backdrop-blur">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
                Twitch + YouTube multiview
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Watch multiple livestreams on one page
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-[var(--text-soft)] sm:text-base">
                Dark by default, built for keeping multiple streams open without the
                page feeling harsh or noisy.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() =>
                  setTheme((current) => (current === "dark" ? "light" : "dark"))
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-4 text-sm font-medium text-[var(--text-main)] transition hover:opacity-90"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4" />
                    Light mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" />
                    Dark mode
                  </>
                )}
              </button>

              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-soft)]">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span>
                    Streams: <span className="font-semibold text-[var(--text-main)]">{streams.length}</span>
                  </span>
                </div>
                <div className="mt-1">
                  Active audio:{" "}
                  <span className="font-semibold text-[var(--text-main)]">
                    {activeId ? "1" : "0"}
                  </span>
                </div>
                <div className="mt-1">
                  Focus mode:{" "}
                  <span className="font-semibold text-[var(--text-main)]">
                    {focusedId ? "On" : "Off"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStream()}
              placeholder="Paste a YouTube or Twitch stream URL"
              className="h-12 flex-1 rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-[var(--text-main)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]"
            />
            <button
              onClick={addStream}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--button-primary-bg)] px-5 font-medium text-[var(--button-primary-text)] transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add stream
            </button>
            <button
              onClick={clearAll}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-5 font-medium text-[var(--text-main)] transition hover:opacity-90"
            >
              Clear all
            </button>
          </div>

          {error ? (
            <p className="mt-3 text-sm text-[var(--danger-text)]">{error}</p>
          ) : null}

          {!audioUnlocked && (
            <div className="mt-5 rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm text-[var(--info-text)]">
              <strong>Audio locked:</strong> click anywhere on the page, then click a
              stream title to enable sound.
            </div>
          )}

          <div className="mt-3 rounded-2xl border border-[var(--note-border)] bg-[var(--note-bg)] px-4 py-3 text-sm text-[var(--note-text)]">
            <strong>Note:</strong> autoplay with sound is limited by browser rules, so
            streams start muted until the page receives user interaction.
          </div>
        </header>

        {!streams.length && (
          <div className="rounded-[2rem] border border-dashed border-[var(--panel-border)] bg-[var(--panel-bg)] p-12 text-center shadow-[var(--panel-shadow)]">
            <h2 className="text-2xl font-semibold">No streams added yet</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--text-soft)]">
              Paste a Twitch or YouTube link above to start building your multiview
              page.
            </p>
          </div>
        )}

        {!!streams.length && focusedStream && (
          <main className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
            <div>
              <StreamCard
                stream={focusedStream}
                isActive={focusedStream.id === activeId}
                isFocused={true}
                onMakeActive={() => setActiveId(focusedStream.id)}
                onToggleFocus={() => toggleFocus(focusedStream.id)}
                onRemove={() => removeStream(focusedStream.id)}
                audioUnlocked={audioUnlocked}
              />
            </div>

            <div
              className={`grid ${getGridClasses(secondaryStreams.length)} gap-5 content-start`}
            >
              {secondaryStreams.map((stream) => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  isActive={stream.id === activeId}
                  isFocused={false}
                  onMakeActive={() => setActiveId(stream.id)}
                  onToggleFocus={() => toggleFocus(stream.id)}
                  onRemove={() => removeStream(stream.id)}
                  audioUnlocked={audioUnlocked}
                />
              ))}
            </div>
          </main>
        )}

        {!!streams.length && !focusedStream && (
          <main className={`grid ${getGridClasses(streams.length)} gap-5`}>
            {streams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                isActive={stream.id === activeId}
                isFocused={false}
                onMakeActive={() => setActiveId(stream.id)}
                onToggleFocus={() => toggleFocus(stream.id)}
                onRemove={() => removeStream(stream.id)}
                audioUnlocked={audioUnlocked}
              />
            ))}
          </main>
        )}
      </div>
    </div>
  );
}