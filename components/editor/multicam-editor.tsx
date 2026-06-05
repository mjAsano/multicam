"use client";

import {
  Captions,
  CircleDot,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Film,
  FolderOpen,
  Gauge,
  Grid2X2,
  Magnet,
  MonitorPlay,
  MousePointer2,
  Pause,
  PanelRightOpen,
  Play,
  Plus,
  Radio,
  Save,
  Scissors,
  Settings2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Upload,
  Volume2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent
} from "react";
import {
  PROJECT_DURATION,
  cameraAngles,
  initialClips,
  initialCuts,
  initialMarkers,
  mediaAssets
} from "@/lib/editor-data";
import type { CameraAngle, CutPoint, Marker, MediaAsset, TimelineClip, ToolMode } from "@/lib/editor-types";
import styles from "./multicam-editor.module.css";

const TRACKS: TimelineClip["track"][] = ["V2", "V1", "A1", "A2"];
const SNAP_SECONDS = 0.5;
const TRACK_LABEL_WIDTH = 48;
const ANGLE_PALETTE = [
  ["#9155E6", "#C4B5FD"],
  ["#2E8DEB", "#97CCFF"],
  ["#A379C6", "#D8B4FE"],
  ["#818CF8", "#C4B5FD"],
  ["#9DA0E1", "#C4B5FD"],
  ["#97CCFF", "#D8ECFF"],
  ["#C4B5FD", "#E9D5FF"],
  ["#A379C6", "#E9D5FF"],
  ["#2E8DEB", "#BFDBFE"]
] as const;

type CutSegment = {
  id: string;
  start: number;
  duration: number;
  angleId: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((value - totalSeconds) * 60);

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

function statusLabel(status: CameraAngle["status"]) {
  if (status === "recording") return "REC";
  if (status === "synced") return "SYNC";
  return "STBY";
}

function getActiveAngleId(cuts: CutPoint[], currentTime: number) {
  return cuts
    .filter((cut) => cut.time <= currentTime)
    .sort((a, b) => b.time - a.time)[0]?.angleId ?? cuts[0]?.angleId ?? "cam-a";
}

function createCutSegments(cuts: CutPoint[], duration: number): CutSegment[] {
  const sorted = [...cuts].sort((a, b) => a.time - b.time);

  return sorted.map((cut, index) => {
    const next = sorted[index + 1]?.time ?? duration;
    return {
      id: `${cut.id}-${index}`,
      start: cut.time,
      duration: Math.max(0, next - cut.time),
      angleId: cut.angleId
    };
  });
}

function getClipAtTime(clips: TimelineClip[], currentTime: number) {
  return (
    clips.find(
      (clip) => clip.track === "V1" && currentTime >= clip.start && currentTime < clip.start + clip.duration
    ) ?? clips.find((clip) => currentTime >= clip.start && currentTime < clip.start + clip.duration)
  );
}

function isVideoOrAudio(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/") ||
    ["mov", "mp4", "m4v", "webm", "mkv", "avi", "wav", "mp3", "m4a", "aac", "flac"].includes(extension)
  );
}

function getMediaType(file: File): "video" | "audio" {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("audio/") || ["wav", "mp3", "m4a", "aac", "flac"].includes(extension)) {
    return "audio";
  }
  return "video";
}

function sortByFolderPath(files: File[]) {
  return [...files].sort((a, b) => {
    const left = a.webkitRelativePath || a.name;
    const right = b.webkitRelativePath || b.name;
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  });
}

function buildMulticamProgramClips(
  cuts: CutPoint[],
  duration: number,
  angles: CameraAngle[],
  source = "Multicam Sequence"
): TimelineClip[] {
  return createCutSegments(cuts, duration)
    .filter((segment) => segment.duration > 0.05)
    .map((segment, index) => {
      const angle = angles.find((item) => item.id === segment.angleId) ?? angles[0];

      return {
        id: `mc-${index}-${segment.angleId}-${segment.start.toFixed(2)}`,
        track: "V1",
        label: `${angle?.label ?? "CAM"} program`,
        start: segment.start,
        duration: segment.duration,
        source,
        angleId: segment.angleId,
        color: angle?.color ?? "#9155E6"
      };
    });
}

function replaceProgramTrack(clips: TimelineClip[], programClips: TimelineClip[]) {
  return clips.filter((clip) => clip.track !== "V1").concat(programClips);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function snapTime(time: number, enabled: boolean) {
  if (!enabled) return time;
  return Math.round(time / SNAP_SECONDS) * SNAP_SECONDS;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function formatFileSize(size?: number) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readMediaDuration(url: string, type: "video" | "audio") {
  return new Promise<number>((resolve) => {
    const media: HTMLMediaElement =
      type === "audio" ? new Audio() : document.createElement("video");
    let settled = false;

    const finish = (duration: number) => {
      if (settled) return;
      settled = true;
      media.removeAttribute("src");
      media.load();
      resolve(Number.isFinite(duration) && duration > 0 ? duration : PROJECT_DURATION);
    };

    media.preload = "metadata";
    media.onloadedmetadata = () => finish(media.duration);
    media.onerror = () => finish(PROJECT_DURATION);
    media.src = url;
  });
}

export default function MulticamEditor() {
  const [currentTime, setCurrentTime] = useState(38);
  const [isPlaying, setIsPlaying] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>(mediaAssets);
  const [angles, setAngles] = useState<CameraAngle[]>(cameraAngles);
  const [sequenceDuration, setSequenceDuration] = useState(PROJECT_DURATION);
  const [selectedAssetId, setSelectedAssetId] = useState(mediaAssets[0].id);
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [cuts, setCuts] = useState<CutPoint[]>(initialCuts);
  const [markers, setMarkers] = useState<Marker[]>(initialMarkers);
  const [selectedClipId, setSelectedClipId] = useState("v1-02");
  const [tool, setTool] = useState<ToolMode>("select");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [multicamEnabled, setMulticamEnabled] = useState(true);
  const [waveformsEnabled, setWaveformsEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [saveState, setSaveState] = useState("저장됨");
  const [exportProgress, setExportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const importedUrlsRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const timelineDragRef = useRef({ active: false, pointerId: -1, bladeApplied: false });

  const activeAngleId = useMemo(() => getActiveAngleId(cuts, currentTime), [cuts, currentTime]);
  const activeAngle = angles.find((angle) => angle.id === activeAngleId) ?? angles[0];
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const liveClip = useMemo(() => getClipAtTime(clips, currentTime), [clips, currentTime]);
  const liveAsset = useMemo(
    () => assets.find((asset) => asset.id === liveClip?.assetId),
    [assets, liveClip?.assetId]
  );
  const activeAngleAsset = useMemo(
    () => assets.find((asset) => asset.id === activeAngle?.assetId),
    [activeAngle?.assetId, assets]
  );
  const programAsset = liveAsset ?? activeAngleAsset;
  const programAssetTime = liveAsset && liveClip ? currentTime - liveClip.start : currentTime;
  const cutSegments = useMemo(() => createCutSegments(cuts, sequenceDuration), [cuts, sequenceDuration]);
  const playheadPercent = (currentTime / sequenceDuration) * 100;
  const timelineWidth = `${Math.round(1180 * zoom)}px`;

  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.time - b.time),
    [markers]
  );

  const visibleClipsByTrack = useMemo(() => {
    return TRACKS.reduce<Record<TimelineClip["track"], TimelineClip[]>>(
      (grouped, track) => {
        grouped[track] = clips
          .filter((clip) => clip.track === track)
          .sort((a, b) => a.start - b.start);
        return grouped;
      },
      { V1: [], V2: [], A1: [], A2: [] }
    );
  }, [clips]);

  useEffect(() => {
    return () => {
      importedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      importedUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }

      const delta = (timestamp - lastFrameRef.current) / 1000;
      lastFrameRef.current = timestamp;

      setCurrentTime((time) => {
        const next = time + delta;
        if (next >= sequenceDuration) {
          setIsPlaying(false);
          return sequenceDuration;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = null;
    };
  }, [isPlaying, sequenceDuration]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      if (event.code === "Space") {
        event.preventDefault();
        setIsPlaying((value) => !value);
      }

      const angleIndex = Number(event.key) - 1;
      if (angleIndex >= 0 && angleIndex < angles.length) {
        event.preventDefault();
        applyAngleCut(angles[angleIndex].id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (exportProgress === 0 || exportProgress >= 100) return;

    const timer = window.setTimeout(() => {
      setExportProgress((value) => clamp(value + 8, 0, 100));
    }, 420);

    return () => window.clearTimeout(timer);
  }, [exportProgress]);

  const setTime = useCallback((time: number) => {
    setCurrentTime(clamp(time, 0, sequenceDuration));
  }, [sequenceDuration]);

  const importFiles = useCallback(async (fileList: FileList | null, createMulticam = false) => {
    const files = sortByFolderPath(Array.from(fileList ?? []).filter(isVideoOrAudio));

    if (files.length === 0) return;

    const importedAssets = await Promise.all(
      files.map(async (file) => {
        const type = getMediaType(file);
        const url = URL.createObjectURL(file);
        importedUrlsRef.current.push(url);
        const duration = await readMediaDuration(url, type);

        return {
          id: makeId("asset"),
          name: file.name,
          type,
          duration,
          cameras: type === "video" ? 1 : 0,
          synced: false,
          url,
          mimeType: file.type,
          size: file.size,
          imported: true,
          relativePath: file.webkitRelativePath || undefined
        } satisfies MediaAsset;
      })
    );

    setAssets((previous) => [...importedAssets, ...previous]);
    setSelectedAssetId(importedAssets[0].id);

    if (createMulticam) {
      const videoAssets = importedAssets.filter((asset) => asset.type === "video");

      if (videoAssets.length > 0) {
        const nextDuration = Math.max(10, Math.ceil(Math.max(...videoAssets.map((asset) => asset.duration))));
        const nextAngles = videoAssets.slice(0, 9).map((asset, index) => {
          const [color, accent] = ANGLE_PALETTE[index % ANGLE_PALETTE.length];

          return {
            id: `cam-${asset.id}`,
            label: `CAM ${index + 1}`,
            operator: stripExtension(asset.name),
            lens: asset.relativePath ? asset.relativePath.split("/").slice(0, -1).join("/") || "Folder" : "Imported",
            resolution: "local",
            fps: 30,
            color,
            accent,
            status: "synced",
            latencyMs: 0,
            assetId: asset.id
          } satisfies CameraAngle;
        });
        const nextCuts: CutPoint[] = [{ id: makeId("cut"), time: 0, angleId: nextAngles[0].id }];
        const programClips = buildMulticamProgramClips(nextCuts, nextDuration, nextAngles, "Folder Multicam");

        setAngles(nextAngles);
        setSequenceDuration(nextDuration);
        setCurrentTime(0);
        setCuts(nextCuts);
        setMarkers([]);
        setClips((previous) => replaceProgramTrack(previous, programClips));
        setSelectedClipId(programClips[0]?.id ?? selectedClipId);
      }
    }

    setSaveState("변경사항 있음");
  }, [selectedClipId]);

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void importFiles(event.target.files);
      event.target.value = "";
    },
    [importFiles]
  );

  const handleFolderInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void importFiles(event.target.files, true);
      event.target.value = "";
    },
    [importFiles]
  );

  const addOrReplaceCut = useCallback((angleId: string, time: number) => {
    setCuts((previous) => {
      const cutTime = clamp(time, 0, sequenceDuration - 0.25);
      const filtered = previous.filter((cut) => Math.abs(cut.time - cutTime) > 0.35);
      const nextCuts = [...filtered, { id: makeId("cut"), time: cutTime, angleId }].sort(
        (a, b) => a.time - b.time
      );
      const programClips = buildMulticamProgramClips(nextCuts, sequenceDuration, angles);
      const selectedProgramClip =
        programClips.find((clip) => cutTime >= clip.start && cutTime < clip.start + clip.duration) ??
        programClips[0];

      setClips((previousClips) => replaceProgramTrack(previousClips, programClips));
      if (selectedProgramClip) {
        setSelectedClipId(selectedProgramClip.id);
      }

      return nextCuts;
    });
    setSaveState("변경사항 있음");
  }, [angles, sequenceDuration]);

  const applyAngleCut = useCallback(
    (angleId: string) => {
      const time = snapTime(currentTime, snapEnabled);
      if (multicamEnabled) {
        addOrReplaceCut(angleId, time);
      }
      setSaveState("변경사항 있음");
    },
    [addOrReplaceCut, currentTime, multicamEnabled, snapEnabled]
  );

  const insertSelectedAsset = useCallback(() => {
    if (!selectedAsset || selectedAsset.type === "sequence") return;

    const start = clamp(snapTime(currentTime, snapEnabled), 0, sequenceDuration - 1);
    const duration = clamp(Math.min(selectedAsset.duration, sequenceDuration - start), 1, sequenceDuration);
    const track: TimelineClip["track"] = selectedAsset.type === "audio" ? "A2" : "V2";
    const color = selectedAsset.type === "audio" ? "#818CF8" : activeAngle.color;
    const newClip: TimelineClip = {
      id: makeId(track.toLowerCase()),
      track,
      label: stripExtension(selectedAsset.name),
      start,
      duration,
      source: selectedAsset.name,
      assetId: selectedAsset.id,
      angleId: selectedAsset.type === "video" ? activeAngle.id : undefined,
      color,
      audioLevel:
        selectedAsset.type === "audio"
          ? [22, 34, 49, 42, 58, 37, 65, 52, 71, 46, 62, 39, 56, 44, 51, 32]
          : undefined
    };

    setClips((previous) => previous.concat(newClip));
    setSelectedClipId(newClip.id);
    setSaveState("변경사항 있음");
  }, [activeAngle.color, activeAngle.id, currentTime, selectedAsset, sequenceDuration, snapEnabled]);

  const splitSelectedClip = useCallback(
    (time = currentTime) => {
      setClips((previous) => {
        const target = previous.find((clip) => clip.id === selectedClipId);
        if (!target) return previous;

        const splitAt = snapTime(time, snapEnabled);
        const clipEnd = target.start + target.duration;
        if (splitAt <= target.start + 0.5 || splitAt >= clipEnd - 0.5) return previous;

        const left: TimelineClip = {
          ...target,
          duration: splitAt - target.start,
          label: `${target.label} A`
        };
        const right: TimelineClip = {
          ...target,
          id: makeId(target.track.toLowerCase()),
          start: splitAt,
          duration: clipEnd - splitAt,
          label: `${target.label} B`
        };

        setSelectedClipId(right.id);
        setSaveState("변경사항 있음");
        return previous.map((clip) => (clip.id === target.id ? left : clip)).concat(right);
      });
    },
    [currentTime, selectedClipId, snapEnabled]
  );

  const trimSelectedClip = useCallback(
    (side: "in" | "out") => {
      if (!selectedClip) return;
      const trimAt = snapTime(currentTime, snapEnabled);

      setClips((previous) =>
        previous.map((clip) => {
          if (clip.id !== selectedClip.id) return clip;
          const end = clip.start + clip.duration;

          if (side === "in" && trimAt > clip.start && trimAt < end - 1) {
            return { ...clip, start: trimAt, duration: end - trimAt };
          }

          if (side === "out" && trimAt > clip.start + 1 && trimAt < end) {
            return { ...clip, duration: trimAt - clip.start };
          }

          return clip;
        })
      );
      setSaveState("변경사항 있음");
    },
    [currentTime, selectedClip, snapEnabled]
  );

  const addMarker = useCallback(() => {
    const time = snapTime(currentTime, snapEnabled);
    setMarkers((previous) =>
      previous.concat({
        id: makeId("marker"),
        time,
        label: `마커 ${previous.length + 1}`,
        color: activeAngle.color
      })
    );
    setSaveState("변경사항 있음");
  }, [activeAngle.color, currentTime, snapEnabled]);

  const scrubTimeline = useCallback(
    (target: HTMLDivElement, clientX: number, allowBlade = false) => {
      const rect = target.getBoundingClientRect();
      const bodyWidth = Math.max(1, rect.width - TRACK_LABEL_WIDTH);
      const x = clamp(clientX - rect.left - TRACK_LABEL_WIDTH, 0, bodyWidth);
      const time = (x / bodyWidth) * sequenceDuration;
      const nextTime = snapTime(time, snapEnabled);
      setTime(nextTime);

      if (allowBlade && tool === "blade") {
        splitSelectedClip(nextTime);
      }

      return nextTime;
    },
    [sequenceDuration, setTime, snapEnabled, splitSelectedClip, tool]
  );

  const handleTimelinePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const clipTarget = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-clip-id]");
      if (clipTarget?.dataset.clipId) {
        setSelectedClipId(clipTarget.dataset.clipId);
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      timelineDragRef.current = { active: true, pointerId: event.pointerId, bladeApplied: false };
      scrubTimeline(event.currentTarget, event.clientX, true);
      timelineDragRef.current.bladeApplied = true;
    },
    [scrubTimeline]
  );

  const handleTimelinePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = timelineDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      event.preventDefault();
      scrubTimeline(event.currentTarget, event.clientX, false);
    },
    [scrubTimeline]
  );

  const handleTimelinePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = timelineDragRef.current;
    if (drag.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    timelineDragRef.current = { active: false, pointerId: -1, bladeApplied: false };
  }, []);

  const handleSave = useCallback(() => {
    setSaveState("저장됨");
  }, []);

  const startExport = useCallback(() => {
    setExportProgress(12);
  }, []);

  return (
    <section className={styles.editor} aria-label="멀티캠 NLE 편집 워크스페이스">
      <TopBar
        saveState={saveState}
        onSave={handleSave}
        onExport={startExport}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((value) => !value)}
      />

      <div className={styles.workspace}>
        <aside className={styles.leftPanel} aria-label="미디어 및 프로젝트 패널">
          <PanelSection icon={<FolderOpen size={16} />} title="미디어 풀">
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              accept="video/*,audio/*"
              multiple
              onChange={handleFileInput}
            />
            <input
              ref={folderInputRef}
              className={styles.fileInput}
              type="file"
              accept="video/*,audio/*"
              multiple
              onChange={handleFolderInput}
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            />
            <div className={styles.mediaActions}>
              <button
                type="button"
                className={styles.commandButton}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                Import
              </button>
              <button
                type="button"
                className={styles.commandButton}
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderOpen size={16} />
                Folder
              </button>
              <button
                type="button"
                className={styles.commandButton}
                disabled={!selectedAsset || selectedAsset.type === "sequence"}
                onClick={insertSelectedAsset}
              >
                <Plus size={16} />
                Timeline
              </button>
            </div>
            <div className={styles.assetList}>
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  className={`${styles.assetItem} ${asset.id === selectedAssetId ? styles.assetSelected : ""}`}
                  type="button"
                  onClick={() => setSelectedAssetId(asset.id)}
                >
                  <span className={styles.assetIcon}>
                    {asset.type === "audio" ? <Volume2 size={16} /> : <Film size={16} />}
                  </span>
                  <span className={styles.assetText}>
                    <span>{asset.name}</span>
                    <small>
                      {formatTime(asset.duration)} ·{" "}
                      {asset.relativePath ?? (asset.imported ? formatFileSize(asset.size) : asset.synced ? "동기화됨" : "대기")}
                    </small>
                  </span>
                  {asset.type === "sequence" ? <span className={styles.assetBadge}>{asset.cameras} cam</span> : null}
                  {asset.imported ? <span className={styles.assetBadge}>local</span> : null}
                </button>
              ))}
            </div>
          </PanelSection>

          <PanelSection icon={<MonitorPlay size={16} />} title="멀티캠 소스">
            <div className={styles.sourceStack}>
              {angles.map((angle) => (
                <button
                  key={angle.id}
                  className={`${styles.sourceButton} ${angle.id === activeAngleId ? styles.activeSource : ""}`}
                  style={{ "--angle": angle.color } as CSSProperties}
                  type="button"
                  onClick={() => applyAngleCut(angle.id)}
                >
                  <span>{angle.label}</span>
                  <small>
                    {angle.operator} · {angle.lens}
                  </small>
                </button>
              ))}
            </div>
          </PanelSection>
        </aside>

        <div className={styles.mainStage}>
          <div className={styles.monitorGrid}>
            <ProgramMonitor
              activeAngle={activeAngle}
              currentTime={currentTime}
              liveClip={liveClip}
              liveAsset={programAsset}
              assetTime={programAssetTime}
              isPlaying={isPlaying}
            />
            <SourceMonitor
              angles={angles}
              assets={assets}
              activeAngleId={activeAngleId}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSelect={applyAngleCut}
            />
          </div>

          <Transport
            currentTime={currentTime}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying((value) => !value)}
            onStepBack={() => setTime(currentTime - 1 / 60)}
            onStepForward={() => setTime(currentTime + 1 / 60)}
            onJumpStart={() => setTime(0)}
            onJumpEnd={() => setTime(sequenceDuration)}
          />

          <Toolbar
            tool={tool}
            setTool={setTool}
            snapEnabled={snapEnabled}
            setSnapEnabled={setSnapEnabled}
            multicamEnabled={multicamEnabled}
            setMulticamEnabled={setMulticamEnabled}
            waveformsEnabled={waveformsEnabled}
            setWaveformsEnabled={setWaveformsEnabled}
            zoom={zoom}
            setZoom={setZoom}
            onAddMarker={addMarker}
            onSplit={() => splitSelectedClip()}
          />

          <Timeline
            clipsByTrack={visibleClipsByTrack}
            cutSegments={cutSegments}
            angles={angles}
            markers={sortedMarkers}
            duration={sequenceDuration}
            selectedClipId={selectedClipId}
            playheadPercent={playheadPercent}
            timelineWidth={timelineWidth}
            waveformsEnabled={waveformsEnabled}
            onSelectClip={setSelectedClipId}
            onPointerDown={handleTimelinePointerDown}
            onPointerMove={handleTimelinePointerMove}
            onPointerUp={handleTimelinePointerUp}
            onPointerCancel={handleTimelinePointerUp}
          />
        </div>

        {inspectorOpen ? (
          <aside className={styles.rightPanel} aria-label="인스펙터 및 출력 패널">
            <PanelSection icon={<SlidersHorizontal size={16} />} title="인스펙터">
              {selectedClip ? (
                <div className={styles.inspectorStack}>
                  <div>
                    <span className={styles.kicker}>선택 클립</span>
                    <h2>{selectedClip.label}</h2>
                    <p>{selectedClip.source}</p>
                  </div>
                  <dl className={styles.metaGrid}>
                    <div>
                      <dt>트랙</dt>
                      <dd>{selectedClip.track}</dd>
                    </div>
                    <div>
                      <dt>시작</dt>
                      <dd>{formatTime(selectedClip.start)}</dd>
                    </div>
                    <div>
                      <dt>길이</dt>
                      <dd>{formatTime(selectedClip.duration)}</dd>
                    </div>
                    <div>
                      <dt>앵글</dt>
                      <dd>{selectedClip.angleId?.toUpperCase() ?? "N/A"}</dd>
                    </div>
                  </dl>
                  <div className={styles.trimActions}>
                    <button type="button" onClick={() => trimSelectedClip("in")}>
                      Trim In
                    </button>
                    <button type="button" onClick={() => trimSelectedClip("out")}>
                      Trim Out
                    </button>
                  </div>
                </div>
              ) : (
                <p className={styles.emptyText}>타임라인 클립을 선택하세요.</p>
              )}
            </PanelSection>

            <PanelSection icon={<Captions size={16} />} title="마커">
              <div className={styles.markerList}>
                {sortedMarkers.map((marker) => (
                  <button
                    key={marker.id}
                    className={styles.markerItem}
                    style={{ "--marker": marker.color } as CSSProperties}
                    type="button"
                    onClick={() => setTime(marker.time)}
                  >
                    <span>{marker.label}</span>
                    <small>{formatTime(marker.time)}</small>
                  </button>
                ))}
              </div>
            </PanelSection>

            <PanelSection icon={<Download size={16} />} title="출력">
              <div className={styles.exportBox}>
                <div>
                  <span className={styles.kicker}>프리셋</span>
                  <strong>H.264 4K / 59.94fps</strong>
                </div>
                <div className={styles.progressTrack} aria-label="출력 진행률">
                  <span style={{ width: `${exportProgress}%` }} />
                </div>
                <button type="button" onClick={startExport}>
                  {exportProgress >= 100 ? "다시 출력" : exportProgress > 0 ? `${exportProgress}% 렌더링` : "렌더 큐 추가"}
                </button>
              </div>
            </PanelSection>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function TopBar({
  saveState,
  onSave,
  onExport,
  inspectorOpen,
  onToggleInspector
}: {
  saveState: string;
  onSave: () => void;
  onExport: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}) {
  return (
    <header className={styles.topBar}>
      <div className={styles.brandBlock}>
        <div className={styles.brandMark}>
          <img src="/someple/assets/someple-logo-gradient.svg" alt="" />
        </div>
        <div>
          <strong>Someple Multicam NLE</strong>
          <span>Live concert rough cut</span>
        </div>
      </div>

      <div className={styles.projectStats} aria-label="프로젝트 상태">
        <span>
          <Radio size={14} />
          4 camera sync
        </span>
        <span>
          <Gauge size={14} />
          proxy ready
        </span>
        <span>
          <Clock3 size={14} />
          {saveState}
        </span>
      </div>

      <div className={styles.topActions}>
        <button type="button" className={styles.iconButton} title="프로젝트 저장" onClick={onSave}>
          <Save size={18} />
        </button>
        <button type="button" className={styles.primaryButton} onClick={onExport}>
          <Download size={17} />
          Export
        </button>
        <button
          type="button"
          className={styles.iconButton}
          title={inspectorOpen ? "인스펙터 닫기" : "인스펙터 열기"}
          onClick={onToggleInspector}
        >
          <PanelRightOpen size={18} />
        </button>
      </div>
    </header>
  );
}

function PanelSection({
  icon,
  title,
  children
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.panelSection}>
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

const ProgramMonitor = memo(function ProgramMonitor({
  activeAngle,
  currentTime,
  liveClip,
  liveAsset,
  assetTime,
  isPlaying
}: {
  activeAngle: CameraAngle;
  currentTime: number;
  liveClip?: TimelineClip;
  liveAsset?: MediaAsset;
  assetTime: number;
  isPlaying: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || liveAsset?.type !== "video") return;

    const targetTime = clamp(assetTime, 0, liveAsset.duration);
    if (Math.abs(video.currentTime - targetTime) > 0.08) {
      video.currentTime = targetTime;
    }

    if (isPlaying) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [assetTime, isPlaying, liveAsset?.duration, liveAsset?.type, liveAsset?.url]);

  return (
    <section className={styles.programMonitor} style={{ "--angle": activeAngle.color } as CSSProperties}>
      <div className={styles.monitorHeader}>
        <span>
          <CircleDot size={14} />
          PROGRAM
        </span>
        <span>{formatTime(currentTime)}</span>
      </div>
      <div className={styles.programFrame}>
        {liveAsset?.type === "video" && liveAsset.url ? (
          <video
            ref={videoRef}
            className={styles.programVideo}
            src={liveAsset.url}
            muted
            playsInline
            preload="metadata"
          />
        ) : null}
        <div className={`${styles.frameOverlay} ${liveAsset?.url ? styles.frameOverlayCompact : ""}`}>
          <span className={styles.recState}>{isPlaying ? "PLAY" : "PAUSE"}</span>
          <strong>{liveAsset?.url ? stripExtension(liveAsset.name) : activeAngle.label}</strong>
          <small>{liveAsset?.name ?? liveClip?.label ?? "No clip under playhead"}</small>
        </div>
        <div className={styles.safeArea} />
      </div>
      <div className={styles.monitorFooter}>
        <span>{activeAngle.operator}</span>
        <span>
          {activeAngle.resolution} · {activeAngle.fps}fps · {activeAngle.latencyMs}ms
        </span>
      </div>
    </section>
  );
});

const SourceMonitor = memo(function SourceMonitor({
  angles,
  assets,
  activeAngleId,
  currentTime,
  isPlaying,
  onSelect
}: {
  angles: CameraAngle[];
  assets: MediaAsset[];
  activeAngleId: string;
  currentTime: number;
  isPlaying: boolean;
  onSelect: (angleId: string) => void;
}) {
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

  return (
    <section className={styles.sourceMonitor}>
      <div className={styles.monitorHeader}>
        <span>
          <Grid2X2 size={14} />
          SOURCE
        </span>
        <span>Number keys 1-{Math.min(angles.length, 9)}</span>
      </div>
      <div className={styles.angleGrid}>
        {angles.map((angle, index) => (
          <SourcePreviewTile
            key={angle.id}
            angle={angle}
            asset={angle.assetId ? assetById.get(angle.assetId) : undefined}
            index={index}
            active={activeAngleId === angle.id}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onClick={() => onSelect(angle.id)}
          />
        ))}
      </div>
    </section>
  );
});

const SourcePreviewTile = memo(function SourcePreviewTile({
  angle,
  asset,
  index,
  active,
  currentTime,
  isPlaying,
  onClick
}: {
  angle: CameraAngle;
  asset?: MediaAsset;
  index: number;
  active: boolean;
  currentTime: number;
  isPlaying: boolean;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset?.type !== "video") return;

    const targetTime = clamp(currentTime, 0, asset.duration);
    if (Math.abs(video.currentTime - targetTime) > 0.18) {
      video.currentTime = targetTime;
    }

    if (isPlaying) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [asset?.duration, asset?.type, asset?.url, currentTime, isPlaying]);

  return (
    <button
      className={`${styles.angleTile} ${asset?.url ? styles.angleTileHasVideo : ""} ${
        active ? styles.angleTileActive : ""
      }`}
      style={{ "--angle": angle.color, "--angle-soft": angle.accent } as CSSProperties}
      type="button"
      onClick={onClick}
    >
      {asset?.type === "video" && asset.url ? (
        <video
          ref={videoRef}
          className={styles.angleVideo}
          src={asset.url}
          muted
          playsInline
          preload="metadata"
        />
      ) : null}
      <span className={styles.angleKey}>{index + 1}</span>
      <strong>{angle.label}</strong>
      <small>{asset?.name ? stripExtension(asset.name) : angle.operator}</small>
      <em>{statusLabel(angle.status)}</em>
    </button>
  );
});

function Transport({
  currentTime,
  isPlaying,
  onPlayPause,
  onStepBack,
  onStepForward,
  onJumpStart,
  onJumpEnd
}: {
  currentTime: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
}) {
  return (
    <div className={styles.transport} aria-label="재생 컨트롤">
      <button type="button" title="처음으로" onClick={onJumpStart}>
        <SkipBack size={18} />
      </button>
      <button type="button" title="1프레임 뒤로" onClick={onStepBack}>
        <span className={styles.frameStep}>-1</span>
      </button>
      <button type="button" className={styles.playButton} title="재생 / 일시정지" onClick={onPlayPause}>
        {isPlaying ? <Pause size={22} /> : <Play size={22} />}
      </button>
      <button type="button" title="1프레임 앞으로" onClick={onStepForward}>
        <span className={styles.frameStep}>+1</span>
      </button>
      <button type="button" title="끝으로" onClick={onJumpEnd}>
        <SkipForward size={18} />
      </button>
      <output>{formatTime(currentTime)}</output>
    </div>
  );
}

function Toolbar({
  tool,
  setTool,
  snapEnabled,
  setSnapEnabled,
  multicamEnabled,
  setMulticamEnabled,
  waveformsEnabled,
  setWaveformsEnabled,
  zoom,
  setZoom,
  onAddMarker,
  onSplit
}: {
  tool: ToolMode;
  setTool: (tool: ToolMode) => void;
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  multicamEnabled: boolean;
  setMulticamEnabled: (enabled: boolean) => void;
  waveformsEnabled: boolean;
  setWaveformsEnabled: (enabled: boolean) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  onAddMarker: () => void;
  onSplit: () => void;
}) {
  return (
    <div className={styles.toolbar} aria-label="편집 도구">
      <div className={styles.segmented}>
        <button
          type="button"
          className={tool === "select" ? styles.activeTool : ""}
          title="선택 도구"
          onClick={() => setTool("select")}
        >
          <MousePointer2 size={17} />
        </button>
        <button
          type="button"
          className={tool === "blade" ? styles.activeTool : ""}
          title="블레이드 도구"
          onClick={() => setTool("blade")}
        >
          <Scissors size={17} />
        </button>
        <button
          type="button"
          className={tool === "trim" ? styles.activeTool : ""}
          title="트림 도구"
          onClick={() => setTool("trim")}
        >
          <Settings2 size={17} />
        </button>
      </div>

      <button type="button" className={styles.commandButton} onClick={onSplit}>
        <Scissors size={16} />
        Split
      </button>
      <button type="button" className={styles.commandButton} onClick={onAddMarker}>
        <Plus size={16} />
        Marker
      </button>

      <label className={styles.toggleButton}>
        <input
          type="checkbox"
          checked={snapEnabled}
          onChange={(event) => setSnapEnabled(event.target.checked)}
        />
        <Magnet size={16} />
        Snap
      </label>
      <label className={styles.toggleButton}>
        <input
          type="checkbox"
          checked={multicamEnabled}
          onChange={(event) => setMulticamEnabled(event.target.checked)}
        />
        <MonitorPlay size={16} />
        Multicam
      </label>
      <label className={styles.toggleButton}>
        <input
          type="checkbox"
          checked={waveformsEnabled}
          onChange={(event) => setWaveformsEnabled(event.target.checked)}
        />
        {waveformsEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
        Wave
      </label>

      <div className={styles.zoomControls}>
        <button
          type="button"
          title="타임라인 축소"
          onClick={() => setZoom(clamp(zoom - 0.15, 0.75, 1.8))}
        >
          <ZoomOut size={16} />
        </button>
        <input
          aria-label="타임라인 줌"
          type="range"
          min="0.75"
          max="1.8"
          step="0.05"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
        <button
          type="button"
          title="타임라인 확대"
          onClick={() => setZoom(clamp(zoom + 0.15, 0.75, 1.8))}
        >
          <ZoomIn size={16} />
        </button>
      </div>
    </div>
  );
}

const Timeline = memo(function Timeline({
  clipsByTrack,
  cutSegments,
  angles,
  markers,
  duration,
  selectedClipId,
  playheadPercent,
  timelineWidth,
  waveformsEnabled,
  onSelectClip,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: {
  clipsByTrack: Record<TimelineClip["track"], TimelineClip[]>;
  cutSegments: CutSegment[];
  angles: CameraAngle[];
  markers: Marker[];
  duration: number;
  selectedClipId: string;
  playheadPercent: number;
  timelineWidth: string;
  waveformsEnabled: boolean;
  onSelectClip: (clipId: string) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <section className={styles.timelinePanel} aria-label="타임라인">
      <div className={styles.timelineHeader}>
        <span>Program cuts</span>
        <span>
          {Math.round(duration)}s sequence · {angles.length} video angles · 2 audio tracks
        </span>
      </div>
      <div className={styles.timelineScroll}>
        <div
          className={styles.timelineCanvas}
          style={
            {
              width: timelineWidth
            } as CSSProperties
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div className={styles.ruler}>
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} style={{ left: `${(index / 8) * 100}%` }}>
                {formatTime((duration / 8) * index)}
              </span>
            ))}
          </div>

          <div className={styles.markerLayer}>
            {markers.map((marker) => (
              <span
                key={marker.id}
                className={styles.markerPin}
                style={{ left: `${(marker.time / duration) * 100}%`, "--marker": marker.color } as CSSProperties}
                title={`${marker.label} ${formatTime(marker.time)}`}
              />
            ))}
          </div>

          <div className={styles.cutTrack}>
            {cutSegments.map((segment) => {
              const angle = angles.find((item) => item.id === segment.angleId) ?? angles[0];
              return (
                <span
                  key={segment.id}
                  className={styles.cutSegment}
                  style={
                    {
                      left: `${(segment.start / duration) * 100}%`,
                      width: `${(segment.duration / duration) * 100}%`,
                      "--angle": angle.color
                    } as CSSProperties
                  }
                >
                  {angle.label}
                </span>
              );
            })}
          </div>

          {TRACKS.map((track) => (
            <TimelineLane
              key={track}
              track={track}
              clips={clipsByTrack[track]}
              selectedClipId={selectedClipId}
              duration={duration}
              waveformsEnabled={waveformsEnabled}
              onSelectClip={onSelectClip}
            />
          ))}

          <div className={styles.playheadLayer} aria-hidden="true">
            <div className={styles.playhead} style={{ left: `${playheadPercent}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
});

const TimelineLane = memo(function TimelineLane({
  track,
  clips,
  selectedClipId,
  duration,
  waveformsEnabled,
  onSelectClip
}: {
  track: TimelineClip["track"];
  clips: TimelineClip[];
  selectedClipId: string;
  duration: number;
  waveformsEnabled: boolean;
  onSelectClip: (clipId: string) => void;
}) {
  return (
    <div className={styles.timelineLane}>
      <div className={styles.trackLabel}>{track}</div>
      <div className={styles.trackBody}>
        {clips.map((clip) => (
          <button
            key={clip.id}
            className={`${styles.clip} ${clip.id === selectedClipId ? styles.selectedClip : ""} ${
              clip.track.startsWith("A") ? styles.audioClip : ""
            }`}
            style={
              {
                left: `${(clip.start / duration) * 100}%`,
                width: `${(clip.duration / duration) * 100}%`,
                "--clip": clip.color
              } as CSSProperties
            }
            type="button"
            data-clip-id={clip.id}
            onClick={(event) => {
              event.stopPropagation();
              onSelectClip(clip.id);
            }}
          >
            <span>{clip.label}</span>
            <small>{formatTime(clip.duration)}</small>
            {clip.audioLevel && waveformsEnabled ? (
              <span className={styles.waveform} aria-hidden="true">
                {clip.audioLevel.map((level, index) => (
                  <i key={`${clip.id}-${index}`} style={{ height: `${level}%` }} />
                ))}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
});
