import { Track, Vector2D, TrackObstacle, TrackPickup } from '../types';

// Catmull-Rom Spline Interpolation for smooth, semi-circle turns and wide turn radii
function catmullRom(p0: Vector2D, p1: Vector2D, p2: Vector2D, p3: Vector2D, t: number): Vector2D {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: 0.5 * (
      (2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),
    y: 0.5 * (
      (2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    )
  };
}

// Generate a smooth dense array of waypoints from sparse key points using Catmull-Rom splines
export function interpolateWaypoints(points: Vector2D[], stepsPerSegment = 18): Vector2D[] {
  const result: Vector2D[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let step = 0; step < stepsPerSegment; step++) {
      result.push(catmullRom(p0, p1, p2, p3, step / stepsPerSegment));
    }
  }
  return result;
}

// Calculate distance between two 2D points
export function getDistance(p1: Vector2D, p2: Vector2D): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Helper to check if a point is close to the track road centerline
export function getDistanceToTrackCenterline(pos: Vector2D, waypoints: Vector2D[]): { distance: number; index: number; point: Vector2D } {
  let minDistance = Infinity;
  let nearestIndex = 0;
  let nearestPoint = waypoints[0];

  // For speed, we look at every waypoint. Since we have ~150-300 points, it's very fast.
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const dist = getDistance(pos, wp);
    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
      nearestPoint = wp;
    }
  }

  return { distance: minDistance, index: nearestIndex, point: nearestPoint };
}

// Generate obstacles and pickups along the track centerline
function generateTrackItems(
  waypoints: Vector2D[],
  roadWidth: number,
  coinIndices: number[],
  nitroIndices: number[],
  oilIndices: number[],
  barrierIndices: number[]
): { pickups: TrackPickup[]; obstacles: TrackObstacle[] } {
  const pickups: TrackPickup[] = [];
  const obstacles: TrackObstacle[] = [];

  // Generate Coins
  coinIndices.forEach((idx, i) => {
    if (idx < waypoints.length) {
      const wp = waypoints[idx];
      // Random slight offset from center to make it interesting
      const angle = Math.random() * Math.PI * 2;
      const offsetDist = (Math.random() - 0.5) * (roadWidth * 0.5);
      pickups.push({
        id: `coin-${idx}-${i}`,
        type: 'coin',
        x: wp.x + Math.cos(angle) * offsetDist * 0.4,
        y: wp.y + Math.sin(angle) * offsetDist * 0.4,
        radius: 12,
        collected: false,
        respawnTime: 0,
      });
    }
  });

  // Generate Nitro pads
  nitroIndices.forEach((idx, i) => {
    if (idx < waypoints.length) {
      const wp = waypoints[idx];
      pickups.push({
        id: `nitro-${idx}-${i}`,
        type: 'nitro',
        x: wp.x,
        y: wp.y,
        radius: 16,
        collected: false,
        respawnTime: 0,
      });
    }
  });

  // Generate Oil slicks
  oilIndices.forEach((idx, i) => {
    if (idx < waypoints.length) {
      const wp = waypoints[idx];
      const offset = (Math.random() - 0.5) * (roadWidth * 0.6);
      const nextWp = waypoints[(idx + 1) % waypoints.length];
      const heading = Math.atan2(nextWp.y - wp.y, nextWp.x - wp.x);
      const perp = heading + Math.PI / 2;

      obstacles.push({
        id: `oil-${idx}-${i}`,
        type: 'oil',
        x: wp.x + Math.cos(perp) * offset,
        y: wp.y + Math.sin(perp) * offset,
        width: 32,
        height: 32,
      });
    }
  });

  // Generate barriers
  barrierIndices.forEach((idx, i) => {
    if (idx < waypoints.length) {
      const wp = waypoints[idx];
      const offset = (Math.random() > 0.5 ? 1 : -1) * (roadWidth * 0.35); // place at side of road
      const nextWp = waypoints[(idx + 1) % waypoints.length];
      const heading = Math.atan2(nextWp.y - wp.y, nextWp.x - wp.x);
      const perp = heading + Math.PI / 2;

      obstacles.push({
        id: `barrier-${idx}-${i}`,
        type: 'barrier',
        x: wp.x + Math.cos(perp) * offset,
        y: wp.y + Math.sin(perp) * offset,
        width: 24,
        height: 24,
      });
    }
  });

  return { pickups, obstacles };
}

// Generate surrounding scenery/decorations outside the track
function generateScenery(
  waypoints: Vector2D[],
  roadWidth: number,
  theme: 'grass' | 'desert' | 'neon',
  count = 120
): { x: number; y: number; type: 'tree' | 'cactus' | 'neon-sign' | 'spectator-stand' | 'audience'; size: number }[] {
  const decors: { x: number; y: number; type: 'tree' | 'cactus' | 'neon-sign' | 'spectator-stand' | 'audience'; size: number }[] = [];

  // Determine bounding box of waypoints
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  waypoints.forEach(wp => {
    if (wp.x < minX) minX = wp.x;
    if (wp.x > maxX) maxX = wp.x;
    if (wp.y < minY) minY = wp.y;
    if (wp.y > maxY) maxY = wp.y;
  });

  // Add margin
  minX -= 400;
  maxX += 400;
  minY -= 400;
  maxY += 400;

  // 1. Generate audience explicitly along the left side of the road!
  for (let i = 0; i < waypoints.length; i += 5) {
    const p = waypoints[i];
    const pNext = waypoints[(i + 1) % waypoints.length];
    
    const dx = pNext.x - p.x;
    const dy = pNext.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const dirX = dx / len;
      const dirY = dy / len;
      // In our 2D coordinate system, left normal is (-dirY, dirX)
      const normX = -dirY;
      const normY = dirX;

      // Place them on the left side of the road, just outside the track curbs
      const distOffset = roadWidth / 2 + 5.0 + Math.random() * 2.5;
      const audX = p.x + normX * distOffset;
      const audY = p.y + normY * distOffset;

      decors.push({
        x: audX,
        y: audY,
        type: 'audience',
        size: 1.8 + Math.random() * 1.0, // Represents scale/height of audience member
      });
    }
  }

  // 2. Generate random background scenery (trees, cactuses, spectator stands, etc.)
  let attempts = 0;
  const bufferDist = roadWidth * 1.1; // Ensure decoration is safely off the road

  while (decors.length < count + (waypoints.length / 5) && attempts < 1500) {
    attempts++;
    const testX = minX + Math.random() * (maxX - minX);
    const testY = minY + Math.random() * (maxY - minY);
    const pos = { x: testX, y: testY };

    // Check distance to closest track point
    const { distance } = getDistanceToTrackCenterline(pos, waypoints);

    if (distance > bufferDist) {
      // Pick appropriate decoration type based on theme
      let type: 'tree' | 'cactus' | 'neon-sign' | 'spectator-stand' | 'audience' = 'tree';
      let size = 20 + Math.random() * 25;

      if (theme === 'desert') {
        type = Math.random() > 0.85 ? 'spectator-stand' : 'cactus';
        if (type === 'spectator-stand') size = 60 + Math.random() * 30;
      } else if (theme === 'neon') {
        type = Math.random() > 0.85 ? 'spectator-stand' : 'neon-sign';
        if (type === 'spectator-stand') size = 60 + Math.random() * 30;
        else size = 30 + Math.random() * 25;
      } else { // grass
        type = Math.random() > 0.9 ? 'spectator-stand' : 'tree';
        if (type === 'spectator-stand') size = 65 + Math.random() * 25;
      }

      decors.push({
        x: testX,
        y: testY,
        type,
        size,
      });
    }
  }

  return decors;
}

// DEFINING DENSE TRACKS
// 1. Oval Super-Speedway (Easy)
const ovalSparsePoints: Vector2D[] = [
  { x: 400, y: 300 },
  { x: 1600, y: 300 },
  { x: 2000, y: 600 },
  { x: 2000, y: 1400 },
  { x: 1600, y: 1700 },
  { x: 400, y: 1700 },
  { x: 100, y: 1400 },
  { x: 100, y: 600 },
];
const ovalWaypoints = interpolateWaypoints(ovalSparsePoints, 22);

// 2. Desert Mirage Lemniscate (Medium)
const desertSparsePoints: Vector2D[] = [
  { x: 400, y: 400 },
  { x: 1000, y: 400 },
  { x: 1300, y: 800 },
  { x: 1700, y: 1200 },
  { x: 2100, y: 1200 },
  { x: 2300, y: 1600 },
  { x: 2000, y: 2000 },
  { x: 1400, y: 2000 },
  { x: 1100, y: 1600 },
  { x: 700, y: 1200 },
  { x: 300, y: 1200 },
  { x: 150, y: 800 },
];
const desertWaypoints = interpolateWaypoints(desertSparsePoints, 18);

// 3. Neon Tokyo Street Circuit (Hard)
const neonSparsePoints: Vector2D[] = [
  { x: 300, y: 300 },
  { x: 1100, y: 300 },
  { x: 1100, y: 700 },
  { x: 1500, y: 700 },
  { x: 1500, y: 300 },
  { x: 2100, y: 300 },
  { x: 2100, y: 1100 },
  { x: 1600, y: 1100 },
  { x: 1600, y: 1500 },
  { x: 2100, y: 1900 },
  { x: 1800, y: 2200 },
  { x: 1200, y: 2200 },
  { x: 1200, y: 1700 },
  { x: 800, y: 1700 },
  { x: 800, y: 2200 },
  { x: 300, y: 2200 },
  { x: 300, y: 1300 },
  { x: 650, y: 1300 },
  { x: 650, y: 900 },
  { x: 300, y: 900 },
];
const neonWaypoints = interpolateWaypoints(neonSparsePoints, 14);

// Generate Tracks list
export const TRACKS: Track[] = [
  {
    id: 'oval_speedway',
    name: 'Redwood Oval Speedway',
    description: 'A lightning-fast asphalt loop surrounded by lush green woodlands. Perfect for speed tuning and simple overtaking manoeuvres.',
    difficulty: 'Easy',
    bgTheme: 'grass',
    roadWidth: 90,
    waypoints: ovalWaypoints,
    obstacles: [], // Will populate below
    pickups: [], // Will populate below
    totalLaps: 3,
    decorations: [], // Will populate below
  },
  {
    id: 'desert_mirage',
    name: 'Sahara Sandstorm Loop',
    description: 'A challenging figure-8 race through dry desert dunes and canyons. Features tight sweeping curves and hazardous oil spills.',
    difficulty: 'Medium',
    bgTheme: 'desert',
    roadWidth: 80,
    waypoints: desertWaypoints,
    obstacles: [],
    pickups: [],
    totalLaps: 3,
    decorations: [],
  },
  {
    id: 'neon_tokyo',
    name: 'Neo-Tokyo Gridway',
    description: 'A futuristic night-street circuit glowing with vibrant neon displays. Technical hairpins and barriers test your extreme drift handling.',
    difficulty: 'Hard',
    bgTheme: 'neon',
    roadWidth: 70,
    waypoints: neonWaypoints,
    obstacles: [],
    pickups: [],
    totalLaps: 3,
    decorations: [],
  },
];

// POPULATING ITEMS ON TRACKS
// Redwood Speedway
const ovalItems = generateTrackItems(
  TRACKS[0].waypoints,
  TRACKS[0].roadWidth,
  [15, 25, 35, 55, 65, 75, 95, 105, 115, 135, 145, 155], // Coin indices
  [45, 125], // Nitro indices
  [20, 80, 140], // Oil indices
  [30, 90, 150] // Barrier indices
);
TRACKS[0].pickups = ovalItems.pickups;
TRACKS[0].obstacles = ovalItems.obstacles;
TRACKS[0].decorations = generateScenery(TRACKS[0].waypoints, TRACKS[0].roadWidth, 'grass', 150);

// Desert Mirage
const desertItems = generateTrackItems(
  TRACKS[1].waypoints,
  TRACKS[1].roadWidth,
  [10, 20, 40, 50, 70, 80, 100, 110, 130, 140, 160, 170, 190, 200],
  [30, 90, 150, 210],
  [15, 60, 120, 180],
  [25, 75, 135, 195]
);
TRACKS[1].pickups = desertItems.pickups;
TRACKS[1].obstacles = desertItems.obstacles;
TRACKS[1].decorations = generateScenery(TRACKS[1].waypoints, TRACKS[1].roadWidth, 'desert', 180);

// Neon Tokyo
const neonItems = generateTrackItems(
  TRACKS[2].waypoints,
  TRACKS[2].roadWidth,
  [12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252, 264],
  [18, 54, 90, 126, 162, 198, 234, 270],
  [30, 78, 114, 150, 186, 222, 258],
  [42, 102, 138, 174, 210, 246]
);
TRACKS[2].pickups = neonItems.pickups;
TRACKS[2].obstacles = neonItems.obstacles;
TRACKS[2].decorations = generateScenery(TRACKS[2].waypoints, TRACKS[2].roadWidth, 'neon', 220);
