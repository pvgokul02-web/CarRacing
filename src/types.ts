export interface Vector2D {
  x: number;
  y: number;
}

export interface Car {
  id: string; // 'player' or AI names
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // in radians
  speed: number;
  maxSpeed: number;
  acceleration: number;
  handling: number; // steer speed multiplier
  friction: number;
  isAI: boolean;
  currentWaypointIndex: number;
  lap: number;
  lapProgress: number; // calculated progress along the track
  racePosition: number; // 1-indexed (1st, 2nd, etc.)
  finished: boolean;
  finishTime: number | null;
  lastCrashTime: number;
  nitroLevel: number; // 0 to 100
  isNitroActive: boolean;
  spinDuration: number; // in frames, >0 when spinning out (mud/oil)
  stunnedDuration: number; // in frames, >0 when hit wall hard
  avatar: string;
  currentSteer?: number; // smoothly interpolated steering value
}

export type TrackTheme = 'grass' | 'desert' | 'neon';

export interface TrackObstacle {
  id: string;
  type: 'oil' | 'barrier';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrackPickup {
  id: string;
  type: 'coin' | 'nitro';
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  respawnTime: number; // in frames, 0 if active
}

export interface Track {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  bgTheme: TrackTheme;
  roadWidth: number;
  waypoints: Vector2D[]; // centerline points defining the track loop
  obstacles: TrackObstacle[];
  pickups: TrackPickup[];
  totalLaps: number;
  decorations: { x: number; y: number; type: 'tree' | 'cactus' | 'neon-sign' | 'spectator-stand' | 'audience'; size: number }[];
}

export interface UpgradeState {
  speedLevel: number; // 1 to 5
  accelLevel: number; // 1 to 5
  handlingLevel: number; // 1 to 5
  nitroLevel: number; // 1 to 5
}

export interface RaceResult {
  carId: string;
  name: string;
  color: string;
  position: number;
  finishTime: number | null; // ms
  isPlayer: boolean;
}

export type ScreenType = 'menu' | 'garage' | 'racing' | 'results';
