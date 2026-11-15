export interface Point {
  x: number;
  y: number;
  t: number; // timestamp in seconds
  vx?: number;
  vy?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BallDetection {
  x: number;
  y: number;
  radius: number;
  confidence: number;
  box: BoundingBox;
}

export interface HSVSettings {
  hMin: number;
  hMax: number;
  sMin: number;
  sMax: number;
  vMin: number;
  vMax: number;
  minArea: number;
  maxArea: number;
  minCircularity: number;
}

export interface HoopZone {
  x: number;
  y: number;
  width: number;
  height: number;
  rimY: number; // Y level of the rim line
  backboardBox?: BoundingBox | null;
}

export interface ShotTrajectory {
  points: Point[];
  releasePoint: Point | null;
  apexPoint: Point | null;
  rimEntry: Point | null;
  parabolaCoeffs: { a: number; b: number; c: number } | null; // y = ax^2 + bx + c
  releaseAngleDeg: number;
  apexHeightPx: number;
  entryAngleDeg: number;
  shotVelocityMph: number;
  durationSec: number;
  outcome: 'make' | 'miss' | 'in_flight' | 'ready';
}

export type ViewMode = 'annotated' | 'binary_mask' | 'trajectory_arc' | 'split';
