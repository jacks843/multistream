import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  LayoutGrid,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import StreamPlayer from "./StreamPlayer";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function parseStream(input) {
  const value = normalizeUrl(input);
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
      const sourceId = match[1];
      return {
        id: createId(),
        type: "youtube",
        sourceId,
        raw: value,
        label: "YouTube",
        customLabel: "",
        defaultLabel: `YouTube · ${sourceId}`
      };
    }
  }

  const twitchVideoMatch = value.match(/twitch\.tv\/videos\/(\d+)/i);
  if (twitchVideoMatch) {
    const sourceId = twitchVideoMatch[1];
    return {
      id: createId(),
      type: "twitch-video",
      sourceId,
      raw: value,
      label: "Twitch VOD",
      customLabel: "",
      defaultLabel: `Twitch VOD · ${sourceId}`
    };
  }

  const twitchChannelMatch = value.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
  if (twitchChannelMatch && twitchChannelMatch[1]?.toLowerCase() !== "videos") {
    const sourceId = twitchChannelMatch[1];
    return {
      id: createId(),
      type: "twitch-channel",
      sourceId,
      raw: value,
      label: "Twitch",
      customLabel: sourceId,
      defaultLabel: `Twitch · ${sourceId}`
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

function getDisplayLabel(stream) {
  const custom = (stream.customLabel || "").trim();
  if (custom) return custom;
  return stream.defaultLabel || stream.label || "Stream";
}

function moveItem(array, fromIndex, toIndex) {
  const copy = [...array];
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

function encodeShareState(streams, activeId, focusedId) {
  const compactStreams = streams.map((stream) => ({
    t: stream.type,
    s: stream.sourceId,
    r: stream.raw,
    c: stream.customLabel || ""
  }));

  const activeIndex = streams.findIndex((stream) => stream.id === activeId);
  const focusedIndex = streams.findIndex((stream) => stream.id === focusedId);

  const payload = {
    streams: compactStreams,
    activeIndex,
    focusedIndex
  };

  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

function decodeShareState(encoded) {
  try {
    const decoded = JSON.parse(decodeURIComponent(atob(encoded)));

    if (!decoded?.streams || !Array.isArray(decoded.streams)) {
      return null;
    }

    const streams = decoded.streams
      .map((item) => {
        if (!item?.t || !item?.s || !item?.r) return null;

        let defaultLabel = "Stream";

        if (item.t === "youtube") {
          defaultLabel = `YouTube · ${item.s}`;
        } else if (item.t === "twitch-channel") {
          defaultLabel = `Twitch · ${item.s}`;
        } else if (item.t === "twitch-video") {
          defaultLabel = `Twitch VOD · ${item.s}`;
        }

        return {
          id: createId(),
          type: item.t,
          sourceId: item.s,
          raw: item.r,
          label:
            item.t === "youtube"
              ? "YouTube"
              : item.t === "twitch-video"
              ? "Twitch VOD"
              : "Twitch",
          customLabel: item.c || "",
          defaultLabel
        };
      })
      .filter(Boolean);

    if (!streams.length) return null;

    const safeActiveIndex =
      typeof decoded.activeIndex === "number" &&
      decoded.activeIndex >= 0 &&
      decoded.activeIndex < streams.length
        ? decoded.activeIndex
        : 0;

    const safeFocusedIndex =
      typeof decoded.focusedIndex === "number" &&
      decoded.focusedIndex >= 0 &&
      decoded.focusedIndex < streams.length
        ? decoded.focusedIndex
        : 0;

    return {
      streams,
      activeId: streams[safeActiveIndex]?.id || streams[0].id,
      focusedId: streams[safeFocusedIndex]?.id || streams[0].id
    };
  } catch {
    return null;
  }
}

function StreamCard({
  stream,
  index,
  total,
  isActive,
  isFocused,
  onMakeActive,
  onToggleFocus,
  onRemove,
  onMoveLeft,
  onMoveRight,
  onStartEditLabel,
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
            {getDisplayLabel(stream)}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onMoveLeft}
            disabled={index === 0}
            className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-30"
            title="Move earlier"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            onClick={onMoveRight}
            disabled={index === total - 1}
            className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-30"
            title="Move later"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            onClick={onStartEditLabel}
            className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
            title="Rename stream"
          >
            <Pencil className="h-4 w-4" />
          </button>

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
  const sharedFromUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("view");
    if (!encoded) return null;
    return decodeShareState(encoded);
  }, []);

  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("multiview-theme") || "dark";
    } catch {
      return "dark";
    }
  });

  const [streams, setStreams] = useState(() => {
    if (sharedFromUrl?.streams?.length) {
      return sharedFromUrl.streams;
    }

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
              label: "YouTube",
              customLabel: "Lofi Girl",
              defaultLabel: "YouTube · jfKfPfyJRdk"
            }
          ];
    } catch {
      return [
        {
          id: "demo-yt",
          type: "youtube",
          sourceId: "jfKfPfyJRdk",
          raw: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
          label: "YouTube",
          customLabel: "Lofi Girl",
          defaultLabel: "YouTube · jfKfPfyJRdk"
        }
      ];
    }
  });

  const [activeId, setActiveId] = useState(() => {
    if (sharedFromUrl?.activeId) return sharedFromUrl.activeId;

    try {
      return localStorage.getItem("multiview-active-id") || "demo-yt";
    } catch {
      return "demo-yt";
    }
  });

  const [focusedId, setFocusedId] = useState(() => {
    if (sharedFromUrl?.focusedId) return sharedFromUrl.focusedId;

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
      setEditingLabelId(null);
      return;
    }

    if (!streams.some((stream) => stream.id === activeId)) {
      setActiveId(streams[0].id);
    }

    if (focusedId && !streams.some((stream) => stream.id === focusedId)) {
      setFocusedId(streams[0].id);
    }

    if (editingLabelId && !streams.some((stream) => stream.id === editingLabelId)) {
      setEditingLabelId(null);
      setEditingLabelValue("");
    }
  }, [streams, activeId, focusedId, editingLabelId]);

  useEffect(() => {
    if (!successMessage) return;

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  function addStream() {
    setError("");
    setSuccessMessage("");

    const parsed = parseStream(input);

    if (!input.trim()) {
      setError("Paste a Twitch or YouTube URL first.");
      return;
    }

    if (!parsed) {
      setError("That does not look like a valid Twitch or YouTube stream URL.");
      return;
    }

    const duplicate = streams.find(
      (stream) =>
        stream.type === parsed.type &&
        String(stream.sourceId).toLowerCase() ===
          String(parsed.sourceId).toLowerCase()
    );

    if (duplicate) {
      setError(`That stream is already added as "${getDisplayLabel(duplicate)}".`);
      setActiveId(duplicate.id);
      setFocusedId(duplicate.id);
      return;
    }

    setStreams((current) => [...current, parsed]);
    setActiveId(parsed.id);
    setFocusedId(parsed.id);
    setInput("");
    setSuccessMessage("Stream added.");
  }

  function removeStream(id) {
    setStreams((current) => current.filter((stream) => stream.id !== id));
    if (editingLabelId === id) {
      setEditingLabelId(null);
      setEditingLabelValue("");
    }
  }

  function clearAll() {
    setStreams([]);
    setActiveId(null);
    setFocusedId(null);
    setEditingLabelId(null);
    setEditingLabelValue("");
    setSuccessMessage("");
    setError("");
  }

  function toggleFocus(id) {
    setFocusedId((current) => (current === id ? null : id));
  }

  function moveStreamLeft(id) {
    setStreams((current) => {
      const index = current.findIndex((stream) => stream.id === id);
      if (index <= 0) return current;
      return moveItem(current, index, index - 1);
    });
  }

  function moveStreamRight(id) {
    setStreams((current) => {
      const index = current.findIndex((stream) => stream.id === id);
      if (index === -1 || index >= current.length - 1) return current;
      return moveItem(current, index, index + 1);
    });
  }

  function startEditLabel(stream) {
    setEditingLabelId(stream.id);
    setEditingLabelValue(stream.customLabel || "");
  }

  function saveLabel(id) {
    setStreams((current) =>
      current.map((stream) =>
        stream.id === id
          ? {
              ...stream,
              customLabel: editingLabelValue.trim()
            }
          : stream
      )
    );
    setEditingLabelId(null);
    setEditingLabelValue("");
    setSuccessMessage("Label updated.");
  }

  function cancelEditLabel() {
    setEditingLabelId(null);
    setEditingLabelValue("");
  }

  async function copyShareUrl() {
    if (!streams.length) {
      setError("Add at least one stream before creating a share link.");
      return;
    }

    try {
      const encoded = encodeShareState(streams, activeId, focusedId);
      const url = `${window.location.origin}${window.location.pathname}?view=${encoded}`;
      await navigator.clipboard.writeText(url);
      setError("");
      setSuccessMessage("Share link copied.");
    } catch {
      setError("Could not copy the share link.");
    }
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
                Reorder streams, rename them, and share the current view with one link.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <button
                onClick={copyShareUrl}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-4 text-sm font-medium text-[var(--text-main)] transition hover:opacity-90"
              >
                <Copy className="h-4 w-4" />
                Copy share link
              </button>

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
                    Streams:{" "}
                    <span className="font-semibold text-[var(--text-main)]">
                      {streams.length}
                    </span>
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

          {successMessage ? (
            <div className="mt-3 rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm text-[var(--info-text)]">
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4" />
                {successMessage}
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-2xl border border-[var(--note-border)] bg-[var(--note-bg)] px-4 py-3 text-sm text-[var(--note-text)]">
              {error}
            </div>
          ) : null}

          {!audioUnlocked && (
            <div className="mt-3 rounded-2xl border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm text-[var(--info-text)]">
              <strong>Audio locked:</strong> click anywhere on the page, then click a
              stream title to enable sound.
            </div>
          )}

          <div className="mt-3 rounded-2xl border border-[var(--note-border)] bg-[var(--note-bg)] px-4 py-3 text-sm text-[var(--note-text)]">
            <strong>Note:</strong> autoplay with sound is limited by browser rules, so
            streams start muted until the page receives user interaction.
          </div>
        </header>

        {editingLabelId && (
          <div className="mb-5 rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--panel-shadow)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-sm font-medium text-[var(--text-main)]">
                  Rename stream
                </p>
                <p className="text-sm text-[var(--text-soft)]">
                  Leave blank to fall back to the default label.
                </p>
              </div>

              <input
                autoFocus
                value={editingLabelValue}
                onChange={(e) => setEditingLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLabel(editingLabelId);
                  if (e.key === "Escape") cancelEditLabel();
                }}
                placeholder="Enter a custom stream name"
                className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-[var(--text-main)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => saveLabel(editingLabelId)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--button-primary-bg)] px-4 font-medium text-[var(--button-primary-text)] transition hover:opacity-90"
                >
                  <Check className="h-4 w-4" />
                  Save
                </button>
                <button
                  onClick={cancelEditLabel}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-4 font-medium text-[var(--text-main)] transition hover:opacity-90"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {!streams.length && (
          <div className="rounded-[2rem] border border-dashed border-[var(--panel-border)] bg-[var(--panel-bg)] p-12 text-center shadow-[var(--panel-shadow)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-2)]">
              <LinkIcon className="h-6 w-6 text-[var(--muted)]" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">No streams added yet</h2>
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
                index={streams.findIndex((stream) => stream.id === focusedStream.id)}
                total={streams.length}
                isActive={focusedStream.id === activeId}
                isFocused={true}
                onMakeActive={() => setActiveId(focusedStream.id)}
                onToggleFocus={() => toggleFocus(focusedStream.id)}
                onRemove={() => removeStream(focusedStream.id)}
                onMoveLeft={() => moveStreamLeft(focusedStream.id)}
                onMoveRight={() => moveStreamRight(focusedStream.id)}
                onStartEditLabel={() => startEditLabel(focusedStream)}
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
                  index={streams.findIndex((item) => item.id === stream.id)}
                  total={streams.length}
                  isActive={stream.id === activeId}
                  isFocused={false}
                  onMakeActive={() => setActiveId(stream.id)}
                  onToggleFocus={() => toggleFocus(stream.id)}
                  onRemove={() => removeStream(stream.id)}
                  onMoveLeft={() => moveStreamLeft(stream.id)}
                  onMoveRight={() => moveStreamRight(stream.id)}
                  onStartEditLabel={() => startEditLabel(stream)}
                  audioUnlocked={audioUnlocked}
                />
              ))}
            </div>
          </main>
        )}

        {!!streams.length && !focusedStream && (
          <main className={`grid ${getGridClasses(streams.length)} gap-5`}>
            {streams.map((stream, index) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                index={index}
                total={streams.length}
                isActive={stream.id === activeId}
                isFocused={false}
                onMakeActive={() => setActiveId(stream.id)}
                onToggleFocus={() => toggleFocus(stream.id)}
                onRemove={() => removeStream(stream.id)}
                onMoveLeft={() => moveStreamLeft(stream.id)}
                onMoveRight={() => moveStreamRight(stream.id)}
                onStartEditLabel={() => startEditLabel(stream)}
                audioUnlocked={audioUnlocked}
              />
            ))}
          </main>
        )}
      </div>
    </div>
  );
}