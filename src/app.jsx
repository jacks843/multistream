import React, { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Plus,
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
  onRemove
}) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:shadow-lg ${
        isFocused
          ? "border-black ring-2 ring-black/10"
          : isActive
          ? "border-slate-300 ring-1 ring-slate-200"
          : "border-black/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
        <button
          onClick={onMakeActive}
          title="Make this the active audio stream"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {isActive ? (
            <Volume2 className="h-4 w-4 shrink-0" />
          ) : (
            <VolumeX className="h-4 w-4 shrink-0 text-black/45" />
          )}
          <span className="truncate text-sm font-medium">{stream.label}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFocus}
            className="rounded-xl p-2 text-black/60 transition hover:bg-black/5 hover:text-black"
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
            className="rounded-xl p-2 text-black/60 transition hover:bg-black/5 hover:text-black"
            title="Open original stream"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          <button
            onClick={onRemove}
            className="rounded-xl p-2 text-black/60 transition hover:bg-black/5 hover:text-red-600"
            title="Remove stream"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="aspect-video bg-black">
        <StreamPlayer stream={stream} isActive={isActive} />
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-xs text-black/55">
        <span>{stream.type === "youtube" ? "YouTube" : "Twitch"}</span>
        <span>
          {isFocused ? "Focused" : isActive ? "Audio active" : "Muted"}
        </span>
      </div>
    </article>
  );
}

export default function App() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

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

    if (!streams.some((stream) => stream.id === focusedId)) {
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

  const focusedStream = useMemo(
    () => streams.find((stream) => stream.id === focusedId) || null,
    [streams, focusedId]
  );

  const secondaryStreams = useMemo(
    () => streams.filter((stream) => stream.id !== focusedId),
    [streams, focusedId]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[2rem] border border-black/10 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Twitch + YouTube multiview
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Watch multiple livestreams on one page
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
                Click a stream title to switch audio. Use the expand button to make
                one stream the main focus.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span>
                  Streams: <span className="font-semibold">{streams.length}</span>
                </span>
              </div>
              <div className="mt-1">
                Active audio: <span className="font-semibold">{activeId ? "1" : "0"}</span>
              </div>
              <div className="mt-1">
                Focus mode: <span className="font-semibold">{focusedId ? "On" : "Off"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStream()}
              placeholder="Paste a YouTube or Twitch stream URL"
              className="h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-slate-400"
            />
            <button
              onClick={addStream}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-black px-5 font-medium text-white transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add stream
            </button>
            <button
              onClick={clearAll}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear all
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Note:</strong> YouTube and Twitch audio still depend on browser
            autoplay rules, so the first sound change may need a click.
          </div>
        </header>

        {!streams.length && (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <h2 className="text-2xl font-semibold">No streams added yet</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
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
              />
            </div>

            <div className={`grid ${getGridClasses(secondaryStreams.length)} gap-5 content-start`}>
              {secondaryStreams.map((stream) => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  isActive={stream.id === activeId}
                  isFocused={false}
                  onMakeActive={() => setActiveId(stream.id)}
                  onToggleFocus={() => toggleFocus(stream.id)}
                  onRemove={() => removeStream(stream.id)}
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
              />
            ))}
          </main>
        )}
      </div>
    </div>
  );
}