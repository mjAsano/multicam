export type CameraAngle = {
  id: string;
  label: string;
  operator: string;
  lens: string;
  resolution: string;
  fps: number;
  color: string;
  accent: string;
  status: "recording" | "synced" | "standby";
  latencyMs: number;
  assetId?: string;
};

export type MediaAsset = {
  id: string;
  name: string;
  type: "sequence" | "video" | "audio";
  duration: number;
  cameras: number;
  synced: boolean;
  url?: string;
  mimeType?: string;
  size?: number;
  imported?: boolean;
  relativePath?: string;
};

export type TimelineClip = {
  id: string;
  track: "V1" | "V2" | "A1" | "A2";
  label: string;
  start: number;
  duration: number;
  source: string;
  angleId?: string;
  assetId?: string;
  color: string;
  audioLevel?: number[];
};

export type CutPoint = {
  id: string;
  time: number;
  angleId: string;
};

export type Marker = {
  id: string;
  time: number;
  label: string;
  color: string;
};

export type ToolMode = "select" | "blade" | "trim";
