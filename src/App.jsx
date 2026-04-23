import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Columns2,
  Copy,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  Moon,
  Pencil,
  Plus,
  Rows3,
  Sun,
  Trash2,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import StreamPlayer from "./StreamPlayer";


const ResponsiveGridLayout = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 1200, md: 900, sm: 640, xs: 0 };
const COLS = { lg: 12, md: 8, sm: 4, xs: 2 };

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
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

function getDisplayLabel(stream) {
  const custom = (stream.customLabel || "").trim();
  if (custom) return custom;
  return stream.defaultLabel || stream.label || "Stream";
}

function encodeShareState(streams, focusedId, audibleIds, layoutMode, layouts) {
  const compactStreams = streams.map((stream) => ({
    t: stream.type,
    s: stream.sourceId,
    r: stream.raw,
    c: stream.customLabel || ""
  }));

  const focusedIndex = streams.findIndex((stream) => stream.id === focusedId);
  const audibleIndices = streams
    .map((stream, index) => (audibleIds.includes(stream.id) ? index : -1))
    .filter((index) => index !== -1);

  const payload = {
    streams: compactStreams,
    focusedIndex,
    audibleIndices,
    layoutMode,
    layouts
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

        if (item.t === "youtube") defaultLabel = `YouTube · ${item.s}`;
        else if (item.t === "twitch-channel") defaultLabel = `Twitch · ${item.s}`;
        else if (item.t === "twitch-video") defaultLabel = `Twitch VOD · ${item.s}`;

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

    const safeFocusedIndex =
      typeof decoded.focusedIndex === "number" &&
      decoded.focusedIndex >= 0 &&
      decoded.focusedIndex < streams.length
        ? decoded.focusedIndex
        : 0;

    const audibleIds = Array.isArray(decoded.audibleIndices)
      ? decoded.audibleIndices
          .filter(
            (index) =>
              typeof index === "number" && index >= 0 && index < streams.length
          )
          .map((index) => streams[index].id)
      : [];

    const layoutMode =
      decoded.layoutMode === "resizable" ||
      decoded.layoutMode === "side-by-side" ||
      decoded.layoutMode === "stacked"
        ? decoded.layoutMode
        : "resizable";

    return {
      streams,
      focusedId: streams[safeFocusedIndex]?.id || streams[0].id,
      audibleIds,
      layoutMode,
      layouts: decoded.layouts || null
    };
  } catch {
    return null;
  }
}

function buildBaseLayout(streams, layoutMode) {
  if (!streams.length) {
    return { lg: [], md: [], sm: [], xs: [] };
  }

  const presets = {
    resizable: {
      lg: streams.map((stream, index) => ({
        i: stream.id,
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 4,
        w: 6,
        h: 4
      })),
      md: streams.map((stream, index) => ({
        i: stream.id,
        x: (index % 2) * 4,
        y: Math.floor(index / 2) * 4,
        w: 4,
        h: 4
      })),
      sm: streams.map((stream, index) => ({
        i: stream.id,
        x: 0,
        y: index * 4,
        w: 4,
        h: 4
      })),
      xs: streams.map((stream, index) => ({
        i: stream.id,
        x: 0,
        y: index * 4,
        w: 2,
        h: 4
      }))
    },
    "side-by-side": {
      lg: streams.map((stream, index) => ({
        i: stream.id,
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 4,
        w: 6,
        h: 4,
        static: false
      })),
      md: streams.map((stream, index) => ({
        i: stream.id,
        x: (index % 2) * 4,
        y: Math.floor(index / 2) * 4,
        w: 4,
        h: 4
      })),
      sm: streams.map((stream, index) => ({
        i: stream.id,
        x: 0,
        y: index * 4,
        w: 4,
        h: 4
      })),
      xs: streams.map((stream, index) => ({
        i: stream.id,
        x: 0,
        y: index * 4,
        w: 2,
        h: 4
      }))
    },
    stacked: {
      lg: streams.map((stream, index) => ({
        i: stream.id,
        x: 0,
        y: index * 4,
        w: 12,
        h: 4
      })),
      md: streams.map((stream, index) => ({
        i: stream.id,
        x: 0,
        y: index * 4,
        w: 8,
        h: 4
      })),
      sm: streams.map((stream, index) => ({
        i: stream.id,
        x: 0,
        y: index * 4,
        w: 4,
        h: 4
      })),
      xs: streams.map((stream, index) => ({
        i: stream.id,
        x: 0,
        y: index * 4,
        w: 2,
        h: 4
      }))
    }
  };

  return presets[layoutMode] || presets.resizable;
}

function mergeLayoutsWithStreams(existingLayouts, streams, layoutMode) {
  const base = buildBaseLayout(streams, layoutMode);
  const next = {};

  for (const bp of Object.keys(COLS)) {
    const existing = Array.isArray(existingLayouts?.[bp]) ? existingLayouts[bp] : [];
    const existingMap = new Map(existing.map((item) => [item.i, item]));
    next[bp] = base[bp].map((baseItem) => {
      const prev = existingMap.get(baseItem.i);
      if (!prev) return baseItem;
      return {
        ...baseItem,
        ...prev,
        i: baseItem.i
      };
    });
  }

  return next;
}

function layoutsMatchStreams(nextLayouts, streams) {
  const streamIds = new Set(streams.map((stream) => stream.id));

  for (const bp of Object.keys(COLS)) {
    const layout = nextLayouts?.[bp];
    if (!Array.isArray(layout)) return false;

    const layoutIds = new Set(layout.map((item) => item.i));
    if (layoutIds.size !== streamIds.size) return false;

    for (const id of streamIds) {
      if (!layoutIds.has(id)) return false;
    }

    for (const id of layoutIds) {
      if (!streamIds.has(id)) return false;
    }
  }

  return true;
}

function applyPresetToLayouts(streams, focusedId, layoutMode, currentLayouts) {
  if (layoutMode === "resizable") {
    return mergeLayoutsWithStreams(currentLayouts, streams, layoutMode);
  }

  if (layoutMode === "stacked") {
    return buildBaseLayout(streams, "stacked");
  }

  if (layoutMode === "side-by-side") {
    return buildBaseLayout(streams, "side-by-side");
  }

  return mergeLayoutsWithStreams(currentLayouts, streams, "resizable");
}

function focusifyLayouts(layouts, focusedId) {
  if (!focusedId) return layouts;

  const next = {};

  for (const bp of Object.keys(COLS)) {
    const cols = COLS[bp];
    next[bp] = (layouts[bp] || []).map((item, index) => {
      if (item.i === focusedId) {
        const width = cols >= 12 ? 8 : cols >= 8 ? 5 : cols;
        const height = 6;
        return {
          ...item,
          x: 0,
          y: 0,
          w: width,
          h: height
        };
      }

      const focusedWidth = cols >= 12 ? 8 : cols >= 8 ? 5 : cols;
      const rightX = Math.min(focusedWidth, cols - 1);
      const width = cols >= 12 ? 4 : cols >= 8 ? 3 : cols;
      const yOffset = Math.max(0, index - 1);

      return {
        ...item,
        x: cols > focusedWidth ? rightX : 0,
        y: cols > focusedWidth ? yOffset * 3 : (index + 1) * 3,
        w: cols > focusedWidth ? Math.min(width, cols - rightX) : cols,
        h: 3
      };
    });
  }

  return next;
}

function reorderLayoutsAfterDrag(streams, layouts) {
  const next = {};

  for (const bp of Object.keys(COLS)) {
    const map = new Map((layouts[bp] || []).map((item) => [item.i, item]));
    next[bp] = streams
      .map((stream, index) => {
        const item = map.get(stream.id);
        if (item) return item;

        const cols = COLS[bp];
        const width = cols >= 12 ? 6 : cols >= 8 ? 4 : cols;
        return {
          i: stream.id,
          x: 0,
          y: index * 4,
          w: width,
          h: 4
        };
      })
      .filter(Boolean);
  }

  return next;
}

function LayoutToggle({ layoutMode, setLayoutMode }) {
  const options = [
    { key: "resizable", label: "Free", icon: LayoutGrid },
    { key: "side-by-side", label: "Side by side", icon: Columns2 },
    { key: "stacked", label: "Stacked", icon: Rows3 }
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--panel-border)] bg-[var(--surface-2)] p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const active = layoutMode === option.key;

        return (
          <button
            key={option.key}
            onClick={() => setLayoutMode(option.key)}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
              active
                ? "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)]"
                : "text-[var(--text-main)] hover:bg-[var(--card-bg)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StreamCard({
  stream,
  isAudible,
  isFocused,
  onToggleAudio,
  onToggleFocus,
  onRemove,
  onStartEditLabel,
  audioUnlocked,
  viewerMode
}) {
  return (
    <article
      className={`group relative h-full overflow-hidden transition duration-150 ${
        viewerMode
          ? "rounded-none border border-black bg-black"
          : isFocused
          ? "rounded-2xl border border-[var(--accent-border)] bg-[var(--card-bg)] shadow-sm ring-1 ring-[var(--accent-soft)]"
          : isAudible
          ? "rounded-2xl border border-[var(--accent-soft)] bg-[var(--card-bg)] shadow-sm ring-1 ring-[var(--accent-soft)]"
          : "rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm"
      }`}
    >
      <div
        className={`drag-handle flex items-center justify-between gap-2 border-b border-[var(--card-border)] px-3 py-2 ${
          viewerMode
            ? "absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-xl border border-white/10 bg-black/70 opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-within:opacity-100"
            : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className="cursor-grab rounded-lg p-1.5 text-[var(--muted)] active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          <button
            onClick={onToggleAudio}
            title={isAudible ? "Mute this stream" : "Unmute this stream"}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {isAudible && audioUnlocked ? (
              <Volume2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            )}
            <span className="truncate text-sm font-medium text-[var(--text-main)]">
              {getDisplayLabel(stream)}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onStartEditLabel}
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
            title="Rename stream"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onToggleFocus}
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
            title={isFocused ? "Exit focus sizing" : "Emphasise this stream"}
          >
            {isFocused ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          <a
            href={stream.raw}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
            title="Open original stream"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            onClick={onRemove}
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-red-400"
            title="Remove stream"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className={`bg-black ${
          viewerMode ? "h-full min-h-0" : "h-[calc(100%-68px)] min-h-[160px]"
        }`}
      >
        <StreamPlayer
          stream={stream}
          isAudible={isAudible}
          audioUnlocked={audioUnlocked}
        />
      </div>

      <div
        className={`items-center justify-between px-3 py-2 text-[11px] text-[var(--muted)] ${
          viewerMode ? "hidden" : "flex"
        }`}
      >
        <span>{stream.type === "youtube" ? "YouTube" : "Twitch"}</span>
        <span>
          {isFocused ? "Focused" : isAudible && audioUnlocked ? "Audible" : "Muted"}
        </span>
      </div>
    </article>
  );
}

export default function App() {
  const appShellRef = useRef(null);

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
  const [viewerMode, setViewerMode] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("multiview-theme") || "dark";
    } catch {
      return "dark";
    }
  });

  const [layoutMode, setLayoutMode] = useState(() => {
    if (sharedFromUrl?.layoutMode) return sharedFromUrl.layoutMode;
    try {
      return localStorage.getItem("multiview-layout-mode") || "resizable";
    } catch {
      return "resizable";
    }
  });

  const [streams, setStreams] = useState(() => {
    if (sharedFromUrl?.streams?.length) return sharedFromUrl.streams;

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

  const [focusedId, setFocusedId] = useState(() => {
    if (sharedFromUrl?.focusedId) return sharedFromUrl.focusedId;
    try {
      return localStorage.getItem("multiview-focused-id") || "demo-yt";
    } catch {
      return "demo-yt";
    }
  });

  const [audibleIds, setAudibleIds] = useState(() => {
    if (sharedFromUrl?.audibleIds) return sharedFromUrl.audibleIds;
    try {
      const stored = localStorage.getItem("multiview-audible-ids");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [layouts, setLayouts] = useState(() => {
    if (sharedFromUrl?.layouts) {
      return mergeLayoutsWithStreams(sharedFromUrl.layouts, sharedFromUrl.streams, "resizable");
    }

    try {
      const stored = localStorage.getItem("multiview-grid-layouts");
      const parsed = stored ? JSON.parse(stored) : null;
      return mergeLayoutsWithStreams(parsed, streams, "resizable");
    } catch {
      return buildBaseLayout(streams, "resizable");
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("multiview-theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-viewer-mode", viewerMode);
    return () => {
      document.documentElement.removeAttribute("data-viewer-mode");
    };
  }, [viewerMode]);

  useEffect(() => {
    function syncFullscreenState() {
      if (!document.fullscreenElement) {
        setViewerMode(false);
      }
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("multiview-layout-mode", layoutMode);
    } catch {}
  }, [layoutMode]);

  useEffect(() => {
    try {
      localStorage.setItem("multiview-grid-layouts", JSON.stringify(layouts));
    } catch {}
  }, [layouts]);

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
      if (focusedId) localStorage.setItem("multiview-focused-id", focusedId);
      else localStorage.removeItem("multiview-focused-id");
    } catch {}
  }, [focusedId]);

  useEffect(() => {
    try {
      localStorage.setItem("multiview-audible-ids", JSON.stringify(audibleIds));
    } catch {}
  }, [audibleIds]);

  useEffect(() => {
    if (!streams.length) {
      setFocusedId(null);
      setEditingLabelId(null);
      setAudibleIds([]);
      return;
    }

    if (focusedId && !streams.some((stream) => stream.id === focusedId)) {
      setFocusedId(streams[0].id);
    }

    if (editingLabelId && !streams.some((stream) => stream.id === editingLabelId)) {
      setEditingLabelId(null);
      setEditingLabelValue("");
    }

    setAudibleIds((current) =>
      current.filter((id) => streams.some((stream) => stream.id === id))
    );
  }, [streams, focusedId, editingLabelId]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(""), 2200);
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
      setFocusedId(duplicate.id);
      return;
    }

    const nextStreams = [...streams, parsed];

    setLayouts((current) =>
      applyPresetToLayouts(nextStreams, parsed.id, layoutMode, current)
    );
    setStreams(nextStreams);
    setFocusedId(parsed.id);
    setInput("");
    setSuccessMessage("Stream added.");
  }

  function removeStream(id) {
    const nextStreams = streams.filter((stream) => stream.id !== id);
    const nextFocusedId =
      focusedId === id ? nextStreams[0]?.id || null : focusedId;

    setLayouts((current) =>
      applyPresetToLayouts(nextStreams, nextFocusedId, layoutMode, current)
    );
    setStreams(nextStreams);
    setAudibleIds((current) => current.filter((value) => value !== id));

    if (editingLabelId === id) {
      setEditingLabelId(null);
      setEditingLabelValue("");
    }
  }

  function clearAll() {
    setStreams([]);
    setFocusedId(null);
    setAudibleIds([]);
    setEditingLabelId(null);
    setEditingLabelValue("");
    setSuccessMessage("");
    setError("");
    setLayouts(buildBaseLayout([], "resizable"));
  }

  function toggleFocus(id) {
    setFocusedId((current) => (current === id ? null : id));
  }

  function toggleAudio(id) {
    setAudibleIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function startEditLabel(stream) {
    setEditingLabelId(stream.id);
    setEditingLabelValue(stream.customLabel || "");
  }

  function saveLabel(id) {
    setStreams((current) =>
      current.map((stream) =>
        stream.id === id
          ? { ...stream, customLabel: editingLabelValue.trim() }
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
      const encoded = encodeShareState(
        streams,
        focusedId,
        audibleIds,
        layoutMode,
        layouts
      );
      const url = `${window.location.origin}${window.location.pathname}?view=${encoded}`;
      await navigator.clipboard.writeText(url);
      setError("");
      setSuccessMessage("Share link copied.");
    } catch {
      setError("Could not copy the share link.");
    }
  }

  async function enterViewerMode() {
    if (!streams.length) {
      setError("Add at least one stream before entering fullscreen.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setEditingLabelId(null);
    setViewerMode(true);

    try {
      await appShellRef.current?.requestFullscreen?.();
    } catch {
      // The clean viewer mode still works if the browser denies fullscreen.
    }
  }

  async function exitViewerMode() {
    setViewerMode(false);

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {}
  }

  function handleLayoutChange(_currentLayout, allLayouts) {
    if (!layoutsMatchStreams(allLayouts, streams)) {
      return;
    }

    setLayouts(allLayouts);
  }

  function handlePresetChange(mode) {
    setLayoutMode(mode);
    setLayouts((current) =>
      applyPresetToLayouts(streams, focusedId, mode, current)
    );
  }

  const effectiveLayouts = useMemo(() => {
    if (layoutMode === "resizable") {
      return layouts;
    }

    if (layoutMode === "side-by-side" || layoutMode === "stacked") {
      return applyPresetToLayouts(streams, focusedId, layoutMode, layouts);
    }

    return focusifyLayouts(
      applyPresetToLayouts(streams, focusedId, "resizable", layouts),
      focusedId
    );
  }, [layouts, layoutMode, streams, focusedId]);

  return (
    <div
      ref={appShellRef}
      className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-200"
    >
      <div
        className={`mx-auto ${
          viewerMode
            ? "h-screen max-w-none overflow-hidden p-0"
            : "max-w-[1500px] px-3 py-4 sm:px-4 lg:px-5"
        }`}
      >
        <header
          className={`mb-4 rounded-[1.2rem] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-3 shadow-[var(--panel-shadow)] backdrop-blur ${
            viewerMode ? "hidden" : ""
          }`}
        >
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
                Twitch + YouTube multiview
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">
                Multistream viewer
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LayoutToggle layoutMode={layoutMode} setLayoutMode={handlePresetChange} />

              <button
                onClick={copyShareUrl}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--text-main)] transition hover:opacity-90"
              >
                <Copy className="h-3.5 w-3.5" />
                Share
              </button>

              <button
                onClick={enterViewerMode}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--text-main)] transition hover:opacity-90"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Fullscreen
              </button>

              <button
                onClick={() =>
                  setTheme((current) => (current === "dark" ? "light" : "dark"))
                }
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--text-main)] transition hover:opacity-90"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-3.5 w-3.5" />
                    Light
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5" />
                    Dark
                  </>
                )}
              </button>

              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-soft)]">
                <div>
                  Streams:{" "}
                  <span className="font-semibold text-[var(--text-main)]">
                    {streams.length}
                  </span>
                </div>
                <div>
                  Audible:{" "}
                  <span className="font-semibold text-[var(--text-main)]">
                    {audibleIds.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2 lg:flex-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStream()}
              placeholder="Paste a YouTube or Twitch stream URL"
              className="h-9 flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-main)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]"
            />
            <button
              onClick={addStream}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-4 text-sm font-medium text-[var(--button-primary-text)] transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
            <button
              onClick={clearAll}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-4 text-sm font-medium text-[var(--text-main)] transition hover:opacity-90"
            >
              Clear
            </button>
          </div>

          {successMessage ? (
            <div className="mt-2 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-xs text-[var(--info-text)]">
              <span className="inline-flex items-center gap-2">
                <Check className="h-3.5 w-3.5" />
                {successMessage}
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="mt-2 rounded-xl border border-[var(--note-border)] bg-[var(--note-bg)] px-3 py-2 text-xs text-[var(--note-text)]">
              {error}
            </div>
          ) : null}

          {!audioUnlocked && (
            <div className="mt-2 rounded-xl border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-xs text-[var(--info-text)]">
              Click anywhere first, then toggle audio on any stream you want.
            </div>
          )}
        </header>

        {viewerMode && !!streams.length && (
          <div className="viewer-controls fixed bottom-3 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/75 px-3 py-2 text-white shadow-2xl backdrop-blur">
            {streams.map((stream) => {
              const isAudible = audibleIds.includes(stream.id);

              return (
                <button
                  key={stream.id}
                  onClick={() => toggleAudio(stream.id)}
                  title={isAudible ? "Mute this stream" : "Unmute this stream"}
                  className={`inline-flex h-8 max-w-[11rem] items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition ${
                    isAudible
                      ? "bg-violet-500 text-white"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  {isAudible && audioUnlocked ? (
                    <Volume2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{getDisplayLabel(stream)}</span>
                </button>
              );
            })}

            <button
              onClick={exitViewerMode}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/90"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Exit
            </button>
          </div>
        )}

        {editingLabelId && !viewerMode && (
          <div className="mb-4 rounded-[1.1rem] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 shadow-[var(--panel-shadow)]">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <p className="min-w-0 flex-1 text-sm font-medium text-[var(--text-main)]">
                Rename stream
              </p>

              <input
                autoFocus
                value={editingLabelValue}
                onChange={(e) => setEditingLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLabel(editingLabelId);
                  if (e.key === "Escape") cancelEditLabel();
                }}
                placeholder="Enter a custom stream name"
                className="h-9 min-w-0 flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-main)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => saveLabel(editingLabelId)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-3 font-medium text-[var(--button-primary-text)] transition hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </button>
                <button
                  onClick={cancelEditLabel}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 font-medium text-[var(--text-main)] transition hover:opacity-90"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {!streams.length && !viewerMode && (
          <div className="rounded-[1.1rem] border border-dashed border-[var(--panel-border)] bg-[var(--panel-bg)] p-8 text-center shadow-[var(--panel-shadow)]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-[var(--surface-2)]">
              <LinkIcon className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <h2 className="mt-3 text-lg font-semibold">No streams added yet</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
              Paste a Twitch or YouTube link above to start building your multiview page.
            </p>
          </div>
        )}

        {!!streams.length && (
          <ResponsiveGridLayout
            className={`multistream-grid ${viewerMode ? "viewer-grid" : ""}`}
            layouts={effectiveLayouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={viewerMode ? 100 : 90}
            margin={viewerMode ? [2, 2] : [16, 16]}
            containerPadding={[0, 0]}
            isResizable={true}
            isDraggable={true}
            isBounded={viewerMode}
            draggableHandle=".drag-handle"
            resizeHandles={["se", "sw", "e", "s"]}
            compactType="vertical"
            preventCollision={false}
            onLayoutChange={handleLayoutChange}
          >
            {streams.map((stream) => (
              <div key={stream.id} className="overflow-hidden">
                <StreamCard
                  stream={stream}
                  isAudible={audibleIds.includes(stream.id)}
                  isFocused={focusedId === stream.id}
                  onToggleAudio={() => toggleAudio(stream.id)}
                  onToggleFocus={() => toggleFocus(stream.id)}
                  onRemove={() => removeStream(stream.id)}
                  onStartEditLabel={() => startEditLabel(stream)}
                  audioUnlocked={audioUnlocked}
                  viewerMode={viewerMode}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>
    </div>
  );
}
