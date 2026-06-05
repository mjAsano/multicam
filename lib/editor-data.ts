import type { CameraAngle, CutPoint, Marker, MediaAsset, TimelineClip } from "./editor-types";

export const PROJECT_DURATION = 128;

export const cameraAngles: CameraAngle[] = [
  {
    id: "cam-a",
    label: "CAM A",
    operator: "Wide Master",
    lens: "24mm",
    resolution: "4K DCI",
    fps: 59.94,
    color: "#9155E6",
    accent: "#C4B5FD",
    status: "recording",
    latencyMs: 14
  },
  {
    id: "cam-b",
    label: "CAM B",
    operator: "Speaker Close",
    lens: "50mm",
    resolution: "UHD",
    fps: 59.94,
    color: "#2E8DEB",
    accent: "#97CCFF",
    status: "synced",
    latencyMs: 9
  },
  {
    id: "cam-c",
    label: "CAM C",
    operator: "Audience Left",
    lens: "35mm",
    resolution: "UHD",
    fps: 59.94,
    color: "#A379C6",
    accent: "#D8B4FE",
    status: "synced",
    latencyMs: 11
  },
  {
    id: "cam-d",
    label: "CAM D",
    operator: "Overhead Detail",
    lens: "70mm",
    resolution: "1080p",
    fps: 59.94,
    color: "#818CF8",
    accent: "#C4B5FD",
    status: "standby",
    latencyMs: 22
  }
];

export const mediaAssets: MediaAsset[] = [
  {
    id: "asset-seq",
    name: "Concert_Master_Multicam",
    type: "sequence",
    duration: PROJECT_DURATION,
    cameras: 4,
    synced: true
  },
  {
    id: "asset-a",
    name: "A001_Wide_Master.mov",
    type: "video",
    duration: PROJECT_DURATION,
    cameras: 1,
    synced: true
  },
  {
    id: "asset-b",
    name: "B014_Close_Speaker.mov",
    type: "video",
    duration: PROJECT_DURATION,
    cameras: 1,
    synced: true
  },
  {
    id: "asset-mix",
    name: "FOH_Stereo_Mix.wav",
    type: "audio",
    duration: PROJECT_DURATION,
    cameras: 0,
    synced: true
  }
];

export const initialClips: TimelineClip[] = [
  {
    id: "v1-01",
    track: "V1",
    label: "Intro wide",
    start: 0,
    duration: 22,
    source: "Concert_Master_Multicam",
    angleId: "cam-a",
    color: "#9155E6"
  },
  {
    id: "v1-02",
    track: "V1",
    label: "Lead line",
    start: 22,
    duration: 18,
    source: "Concert_Master_Multicam",
    angleId: "cam-b",
    color: "#2E8DEB"
  },
  {
    id: "v1-03",
    track: "V1",
    label: "Crowd lift",
    start: 40,
    duration: 21,
    source: "Concert_Master_Multicam",
    angleId: "cam-c",
    color: "#A379C6"
  },
  {
    id: "v1-04",
    track: "V1",
    label: "Detail run",
    start: 61,
    duration: 15,
    source: "Concert_Master_Multicam",
    angleId: "cam-d",
    color: "#818CF8"
  },
  {
    id: "v1-05",
    track: "V1",
    label: "Final chorus",
    start: 76,
    duration: 52,
    source: "Concert_Master_Multicam",
    angleId: "cam-b",
    color: "#2E8DEB"
  },
  {
    id: "v2-01",
    track: "V2",
    label: "Lower third",
    start: 8,
    duration: 11,
    source: "Graphics",
    color: "#C4B5FD"
  },
  {
    id: "v2-02",
    track: "V2",
    label: "Sponsor bumper",
    start: 95,
    duration: 12,
    source: "Graphics",
    color: "#A379C6"
  },
  {
    id: "a1-01",
    track: "A1",
    label: "Stereo program",
    start: 0,
    duration: PROJECT_DURATION,
    source: "FOH_Stereo_Mix",
    color: "#2E8DEB",
    audioLevel: [24, 42, 36, 58, 71, 45, 67, 74, 55, 38, 63, 77, 68, 49, 70, 44]
  },
  {
    id: "a2-01",
    track: "A2",
    label: "Ambience",
    start: 4,
    duration: 112,
    source: "Room pair",
    color: "#818CF8",
    audioLevel: [12, 18, 28, 33, 26, 31, 44, 51, 46, 39, 34, 47, 42, 32, 28, 20]
  }
];

export const initialCuts: CutPoint[] = [
  { id: "cut-00", time: 0, angleId: "cam-a" },
  { id: "cut-01", time: 22, angleId: "cam-b" },
  { id: "cut-02", time: 40, angleId: "cam-c" },
  { id: "cut-03", time: 61, angleId: "cam-d" },
  { id: "cut-04", time: 76, angleId: "cam-b" },
  { id: "cut-05", time: 109, angleId: "cam-a" }
];

export const initialMarkers: Marker[] = [
  { id: "marker-01", time: 18, label: "첫 후렴", color: "#9155E6" },
  { id: "marker-02", time: 58, label: "드럼 필인", color: "#2E8DEB" },
  { id: "marker-03", time: 102, label: "엔딩 컷 후보", color: "#A379C6" }
];
