import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Track, Car, UpgradeState, Vector2D, RaceResult, TrackPickup, TrackObstacle } from '../types';
import { getDistance, getDistanceToTrackCenterline } from '../utils/trackData';
import { Flag, Shield, Flame, Gauge, Coins, Volume2, VolumeX, Eye, ArrowLeft, RotateCcw, Play, CircleDot } from 'lucide-react';

interface RacingGameCanvasProps {
  track: Track;
  selectedLevel: number;
  upgrades: UpgradeState;
  carColor: string;
  commentatorPersonality: string;
  onRaceFinish: (results: RaceResult[], coinsEarned: number) => void;
  onExit: () => void;
}

// Particle interface
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // 0 to 1
  decay: number;
  type: 'dust' | 'fire' | 'spark';
}

const AI_NAMES = ['Turbo Tom', 'Drift Queen', 'Speedy Sam', 'Shadow Racer'];
const AI_AVATARS = ['🐯', '🦊', '🦅', '🦁'];
const AI_COLORS = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981'];

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

export const RacingGameCanvas: React.FC<RacingGameCanvasProps> = ({
  track,
  selectedLevel,
  upgrades,
  carColor,
  commentatorPersonality,
  onRaceFinish,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeRef = useRef<any>(null);

  // Keyboard controls ref
  const keysRef = useRef<Record<string, boolean>>({});

  // Game Loop Ref
  const requestRef = useRef<number | null>(null);

  // Core Game State Refs to avoid re-render delays in high-fps loops
  const playerRef = useRef<Car>({
    id: 'player',
    name: 'Player 1',
    color: carColor,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    maxSpeed: 0,
    acceleration: 0,
    handling: 0,
    friction: 0.985,
    isAI: false,
    currentWaypointIndex: 0,
    lap: 1,
    lapProgress: 0,
    racePosition: 1,
    finished: false,
    finishTime: null,
    lastCrashTime: 0,
    nitroLevel: 50,
    isNitroActive: false,
    spinDuration: 0,
    stunnedDuration: 0,
    avatar: '🏎️',
  });

  const aiCarsRef = useRef<Car[]>([]);
  const pickupsRef = useRef<TrackPickup[]>([]);
  const obstaclesRef = useRef<TrackObstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const raceEndingRef = useRef(false);

  // NFS Heat themed HUD state additions
  const repPointsRef = useRef<number>(1520);
  const [repPoints, setRepPoints] = useState(1520);
  const [heatLevel, setHeatLevel] = useState(1);
  const [liveLeaderboard, setLiveLeaderboard] = useState<{ name: string; position: number; isPlayer: boolean; color: string }[]>([]);
  const leaderboardThrottleRef = useRef<number>(0);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const speedometerCanvasRef = useRef<HTMLCanvasElement>(null);

  // Sound toggling state (Visual sound notifications)
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Timing
  const raceStartTimeRef = useRef<number>(0);
  const [raceTime, setRaceTime] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(4); // 3, 2, 1, GO!
  const [subtitles, setSubtitles] = useState<string | null>("Drivers, rev your engines!");
  const [subtitleTimer, setSubtitleTimer] = useState<number>(4000);

  // Display states
  const [playerSpeedMPH, setPlayerSpeedMPH] = useState(0);
  const [playerLap, setPlayerLap] = useState(1);
  const [playerPosition, setPlayerPosition] = useState(1);
  const [playerNitro, setPlayerNitro] = useState(50);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [cameraMode, setCameraMode] = useState<'follow' | 'full' | 'cockpit'>('follow');
  const [showSteeringControls, setShowSteeringControls] = useState(true);
  const accelCamOffsetRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Sound indicators (Visual Popups)
  const [soundPopups, setSoundPopups] = useState<{ id: string; text: string; x: number; y: number; color: string }[]>([]);

  // Commentary rate limiting
  const lastCommentTimeRef = useRef<number>(0);

  // State refs to optimize the requestAnimationFrame loop and prevent recreating the loop on state updates
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const commentatorPersonalityRef = useRef(commentatorPersonality);
  commentatorPersonalityRef.current = commentatorPersonality;

  const selectedLevelRef = useRef(selectedLevel);
  selectedLevelRef.current = selectedLevel;

  // --- THREE.JS 3D RACING GRAPHICS PROCEDURAL BUILDERS ---
  const createSupercarGroup = (color: string, isPlayer: boolean): THREE.Group => {
    const carGroup = new THREE.Group();

    // 1. Sleek glossy paint material for Lamborghini-style sports car
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      roughness: 0.12,
      metalness: 0.82,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });

    // 2. Matte carbon-fiber material
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.65,
      metalness: 0.4
    });

    // 3. Polished dark windshield glass
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.05,
      metalness: 0.95
    });

    // 4. LED headlights and rear brake taillights
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xebf8ff });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // Chassis Base Plate (Low Aerodynamic body kit)
    const baseGeo = new THREE.BoxGeometry(6.6, 0.3, 3.1);
    const baseMesh = new THREE.Mesh(baseGeo, carbonMat);
    baseMesh.position.y = -0.1;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    carGroup.add(baseMesh);

    // Aerodynamic wedge core chassis
    const bodyGeo = new THREE.BoxGeometry(4.2, 0.7, 3.1);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(-0.4, 0.35, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    carGroup.add(bodyMesh);

    // Sloping front hood
    const hoodGeo = new THREE.BoxGeometry(2.4, 0.35, 3.1);
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
    hoodMesh.position.set(2.4, 0.15, 0);
    hoodMesh.rotation.z = -0.09;
    hoodMesh.castShadow = true;
    hoodMesh.receiveShadow = true;
    carGroup.add(hoodMesh);

    // Front splitter lip (carbon racing diffuser)
    const splitterGeo = new THREE.BoxGeometry(0.8, 0.1, 3.2);
    const splitterMesh = new THREE.Mesh(splitterGeo, carbonMat);
    splitterMesh.position.set(3.4, -0.15, 0);
    carGroup.add(splitterMesh);

    // Aggressive side skirts
    const skirtLGeo = new THREE.BoxGeometry(3.6, 0.15, 0.1);
    const skirtL = new THREE.Mesh(skirtLGeo, carbonMat);
    skirtL.position.set(-0.3, -0.12, 1.55);
    carGroup.add(skirtL);

    const skirtR = skirtL.clone();
    skirtR.position.z = -1.55;
    carGroup.add(skirtR);

    // Cockpit Canopy (Windshield cabin)
    const cabinGeo = new THREE.BoxGeometry(2.8, 0.65, 2.2);
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(-0.6, 0.85, 0);
    cabinMesh.castShadow = true;
    carGroup.add(cabinMesh);

    // Slanted windshield
    const windshieldGeo = new THREE.BoxGeometry(1.2, 0.05, 2.0);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0.7, 0.7, 0);
    windshield.rotation.z = -0.45;
    carGroup.add(windshield);

    // Slatted engine cover (NFS / Lambo style rear)
    const slatGeo = new THREE.BoxGeometry(1.8, 0.1, 2.1);
    const slats = new THREE.Mesh(slatGeo, carbonMat);
    slats.position.set(-2.0, 0.7, 0);
    slats.rotation.z = 0.05;
    carGroup.add(slats);

    // Dual intake side vents
    const intakeL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.2), carbonMat);
    intakeL.position.set(-1.0, 0.3, 1.5);
    carGroup.add(intakeL);

    const intakeR = intakeL.clone();
    intakeR.position.z = -1.5;
    carGroup.add(intakeR);

    // Dual chrome exhaust tips
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.15, metalness: 0.95 });
    const exhaustPipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.6, 8);
    exhaustPipeGeo.rotateZ(Math.PI / 2);

    const pipeL = new THREE.Mesh(exhaustPipeGeo, exhaustMat);
    pipeL.position.set(-3.4, 0.1, 0.65);
    carGroup.add(pipeL);

    const pipeR = pipeL.clone();
    pipeR.position.z = -0.65;
    carGroup.add(pipeR);

    // Large high-downforce rear wing (GT Spoiler)
    const spoilerL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.15), carbonMat);
    spoilerL.position.set(-2.9, 0.7, 1.1);
    spoilerL.rotation.z = -0.2;
    carGroup.add(spoilerL);

    const spoilerR = spoilerL.clone();
    spoilerR.position.z = -1.1;
    carGroup.add(spoilerR);

    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 3.8), carbonMat);
    flap.position.set(-3.0, 1.1, 0);
    flap.rotation.z = 0.08;
    flap.castShadow = true;
    carGroup.add(flap);

    // Wing plates
    const endL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.05), carbonMat);
    endL.position.set(-3.0, 1.1, 1.9);
    carGroup.add(endL);

    const endR = endL.clone();
    endR.position.z = -1.9;
    carGroup.add(endR);

    // Headlights
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.65), headlightMat);
    headL.position.set(3.4, 0.2, 1.15);
    headL.rotation.y = 0.15;
    carGroup.add(headL);

    const headR = headL.clone();
    headR.position.z = -1.15;
    headR.rotation.y = -0.15;
    carGroup.add(headR);

    // Dynamic headlight beam projection (Real Three.js SpotLight for player car)
    if (isPlayer) {
      const mainBeam = new THREE.SpotLight(0xfffbfa, 15, 95, Math.PI / 4, 0.55, 0.95);
      mainBeam.position.set(3.5, 0.2, 0);
      
      const lightTarget = new THREE.Object3D();
      lightTarget.position.set(15.0, 0.2, 0);
      carGroup.add(lightTarget);
      mainBeam.target = lightTarget;
      
      mainBeam.castShadow = true;
      mainBeam.shadow.mapSize.width = 512;
      mainBeam.shadow.mapSize.height = 512;
      mainBeam.shadow.camera.near = 1.0;
      mainBeam.shadow.camera.far = 95;
      carGroup.add(mainBeam);
    }

    // LED red brake tail lights
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 1.0), taillightMat);
    tailL.position.set(-3.3, 0.35, 1.0);
    carGroup.add(tailL);

    const tailR = tailL.clone();
    tailR.position.z = -1.0;
    carGroup.add(tailR);

    // Glowing taillight aura
    if (isPlayer) {
      const brakeGlow = new THREE.PointLight(0xff0044, 4.5, 12, 1.1);
      brakeGlow.position.set(-3.5, 0.35, 0);
      carGroup.add(brakeGlow);
    }

    // Sports Tires & metallic wheels
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9, metalness: 0.05 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.15, metalness: 0.95 });
    
    const tireGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.65, 18);
    tireGeo.rotateX(Math.PI / 2);
    
    const rimGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.7, 12);
    rimGeo.rotateX(Math.PI / 2);

    const wheelMeshes: THREE.Mesh[] = [];
    const positions = [
      { x: 1.85, z: 1.55 },  // FL
      { x: 1.85, z: -1.55 }, // FR
      { x: -1.85, z: 1.55 }, // RL
      { x: -1.85, z: -1.55 } // RR
    ];

    positions.forEach((pos) => {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      tire.add(rim);
      tire.position.set(pos.x, -0.12, pos.z);
      tire.castShadow = true;
      carGroup.add(tire);
      wheelMeshes.push(tire);
    });

    carGroup.userData = { wheels: wheelMeshes, isPlayer };
    return carGroup;
  };

  const buildTrack3D = (scene: THREE.Scene, track: Track): THREE.Mesh => {
    const waypoints = track.waypoints;
    const N = waypoints.length;
    const halfWidth = track.roadWidth / 2;

    const roadGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Left and right nodes
    const roadPoints: { L: THREE.Vector3; R: THREE.Vector3; C: THREE.Vector3; dir: THREE.Vector3; norm: THREE.Vector3 }[] = [];

    for (let i = 0; i < N; i++) {
      const p = waypoints[i];
      const pNext = waypoints[(i + 1) % N];

      const C = new THREE.Vector3(p.x, 0.01, p.y);
      const CNext = new THREE.Vector3(pNext.x, 0.01, pNext.y);

      const dir = new THREE.Vector3().subVectors(CNext, C).normalize();
      const norm = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

      const L = new THREE.Vector3().addVectors(C, new THREE.Vector3().addScaledVector(norm, halfWidth));
      const R = new THREE.Vector3().addVectors(C, new THREE.Vector3().addScaledVector(norm, -halfWidth));

      roadPoints.push({ L, R, C, dir, norm });
    }

    // Connect segments
    for (let i = 0; i < N; i++) {
      const curr = roadPoints[i];
      const next = roadPoints[(i + 1) % N];

      const vIdx = positions.length / 3;

      positions.push(curr.L.x, 0.015, curr.L.z);
      positions.push(curr.R.x, 0.015, curr.R.z);
      positions.push(next.L.x, 0.015, next.L.z);
      positions.push(next.R.x, 0.015, next.R.z);

      normals.push(0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0);

      const u1 = i / N;
      const u2 = (i + 1) / N;
      uvs.push(u1, 0,  u1, 1,  u2, 0,  u2, 1);

      indices.push(vIdx, vIdx + 2, vIdx + 1);
      indices.push(vIdx + 1, vIdx + 2, vIdx + 3);
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);

    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x2c2d35,
      roughness: 0.78,
      metalness: 0.22,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    const trackMesh = new THREE.Mesh(roadGeo, asphaltMat);
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // White centerline dashes
    const lineGeo = new THREE.BufferGeometry();
    const linePositions: number[] = [];
    const lineIndices: number[] = [];
    const lineW = 0.45;

    for (let i = 0; i < N; i++) {
      if (i % 3 === 0) {
        const curr = roadPoints[i];
        const next = roadPoints[(i + 1.5) % N >= N ? 0 : Math.floor((i + 1.5) % N)];

        const lIdx = linePositions.length / 3;

        const L1 = new THREE.Vector3().addVectors(curr.C, new THREE.Vector3().addScaledVector(curr.norm, lineW));
        const R1 = new THREE.Vector3().addVectors(curr.C, new THREE.Vector3().addScaledVector(curr.norm, -lineW));
        const L2 = new THREE.Vector3().addVectors(next.C, new THREE.Vector3().addScaledVector(next.norm, lineW));
        const R2 = new THREE.Vector3().addVectors(next.C, new THREE.Vector3().addScaledVector(next.norm, -lineW));

        linePositions.push(L1.x, 0.022, L1.z);
        linePositions.push(R1.x, 0.022, R1.z);
        linePositions.push(L2.x, 0.022, L2.z);
        linePositions.push(R2.x, 0.022, R2.z);

        lineIndices.push(lIdx, lIdx + 2, lIdx + 1);
        lineIndices.push(lIdx + 1, lIdx + 2, lIdx + 3);
      }
    }

    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeo.setIndex(lineIndices);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const centerline = new THREE.Mesh(lineGeo, lineMat);
    scene.add(centerline);

    // Rumble Curb Strips (Alternating Red and White)
    const curbGeoLeft = new THREE.BufferGeometry();
    const curbPositionsL: number[] = [];
    const curbColorsL: number[] = [];
    const curbIndicesL: number[] = [];

    const curbGeoRight = new THREE.BufferGeometry();
    const curbPositionsR: number[] = [];
    const curbColorsR: number[] = [];
    const curbIndicesR: number[] = [];

    const curbW = 1.5;

    for (let i = 0; i < N; i++) {
      const curr = roadPoints[i];
      const next = roadPoints[(i + 1) % N];

      const isRed = Math.floor(i / 3) % 2 === 0;
      const color = isRed ? [0.93, 0.15, 0.15] : [0.98, 0.98, 0.98];

      // Left Curb
      const lIdxL = curbPositionsL.length / 3;
      const innerL = curr.L;
      const outerL = new THREE.Vector3().addVectors(curr.L, new THREE.Vector3().addScaledVector(curr.norm, curbW));
      const innerNextL = next.L;
      const outerNextL = new THREE.Vector3().addVectors(next.L, new THREE.Vector3().addScaledVector(next.norm, curbW));

      curbPositionsL.push(innerL.x, 0.14, innerL.z);
      curbPositionsL.push(outerL.x, 0.02, outerL.z);
      curbPositionsL.push(innerNextL.x, 0.14, innerNextL.z);
      curbPositionsL.push(outerNextL.x, 0.02, outerNextL.z);

      for (let c = 0; c < 4; c++) curbColorsL.push(...color);
      curbIndicesL.push(lIdxL, lIdxL + 2, lIdxL + 1);
      curbIndicesL.push(lIdxL + 1, lIdxL + 2, lIdxL + 3);

      // Right Curb
      const lIdxR = curbPositionsR.length / 3;
      const innerR = curr.R;
      const outerR = new THREE.Vector3().addVectors(curr.R, new THREE.Vector3().addScaledVector(curr.norm, -curbW));
      const innerNextR = next.R;
      const outerNextR = new THREE.Vector3().addVectors(next.R, new THREE.Vector3().addScaledVector(next.norm, -curbW));

      curbPositionsR.push(innerR.x, 0.14, innerR.z);
      curbPositionsR.push(outerR.x, 0.02, outerR.z);
      curbPositionsR.push(innerNextR.x, 0.14, innerNextR.z);
      curbPositionsR.push(outerNextR.x, 0.02, outerNextR.z);

      for (let c = 0; c < 4; c++) curbColorsR.push(...color);
      curbIndicesR.push(lIdxR, lIdxR + 2, lIdxR + 1);
      curbIndicesR.push(lIdxR + 1, lIdxR + 2, lIdxR + 3);
    }

    curbGeoLeft.setAttribute('position', new THREE.Float32BufferAttribute(curbPositionsL, 3));
    curbGeoLeft.setAttribute('color', new THREE.Float32BufferAttribute(curbColorsL, 3));
    curbGeoLeft.setIndex(curbIndicesL);

    curbGeoRight.setAttribute('position', new THREE.Float32BufferAttribute(curbPositionsR, 3));
    curbGeoRight.setAttribute('color', new THREE.Float32BufferAttribute(curbColorsR, 3));
    curbGeoRight.setIndex(curbIndicesR);

    const curbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    const curbLeft = new THREE.Mesh(curbGeoLeft, curbMat);
    curbLeft.receiveShadow = true;
    curbLeft.castShadow = true;
    scene.add(curbLeft);

    const curbRight = new THREE.Mesh(curbGeoRight, curbMat);
    curbRight.receiveShadow = true;
    curbRight.castShadow = true;
    scene.add(curbRight);

    // Concrete safety boundaries
    const guardrailMat = new THREE.MeshStandardMaterial({ color: 0x5e5f66, roughness: 0.7, metalness: 0.2 });
    const barrierSegmentGeo = new THREE.BoxGeometry(5.0, 1.2, 0.4);

    // Glowing neon safety strips on top of guardrails to guide the driver with color
    const leftGlowColor = track.bgTheme === 'neon' ? 0x06b6d4 : (track.bgTheme === 'desert' ? 0xf59e0b : 0xec4899);
    const rightGlowColor = track.bgTheme === 'neon' ? 0xec4899 : (track.bgTheme === 'desert' ? 0xef4444 : 0x3b82f6);
    
    const neonStripGeo = new THREE.BoxGeometry(5.0, 0.12, 0.45);
    const leftNeonMat = new THREE.MeshBasicMaterial({ color: leftGlowColor });
    const rightNeonMat = new THREE.MeshBasicMaterial({ color: rightGlowColor });

    for (let i = 0; i < N; i += 5) {
      const p = roadPoints[i];
      const heading = -Math.atan2(p.dir.z, p.dir.x);

      // Guardrail Left
      const bL = new THREE.Mesh(barrierSegmentGeo, guardrailMat);
      const posL = new THREE.Vector3().addVectors(p.L, new THREE.Vector3().addScaledVector(p.norm, 3.8));
      bL.position.set(posL.x, 0.6, posL.z);
      bL.rotation.y = heading;
      bL.castShadow = true;
      bL.receiveShadow = true;
      
      const stripL = new THREE.Mesh(neonStripGeo, leftNeonMat);
      stripL.position.y = 0.55; // place exactly on top of barrier
      bL.add(stripL);
      scene.add(bL);

      // Guardrail Right
      const bR = new THREE.Mesh(barrierSegmentGeo, guardrailMat);
      const posR = new THREE.Vector3().addVectors(p.R, new THREE.Vector3().addScaledVector(p.norm, -3.8));
      bR.position.set(posR.x, 0.6, posR.z);
      bR.rotation.y = heading;
      bR.castShadow = true;
      bR.receiveShadow = true;

      const stripR = new THREE.Mesh(neonStripGeo, rightNeonMat);
      stripR.position.y = 0.55; // place exactly on top of barrier
      bR.add(stripR);
      scene.add(bR);
    }

    return trackMesh;
  };

  const buildScenery3D = (scene: THREE.Scene, decorations: { x: number; y: number; type: string; size: number }[]): THREE.Object3D[] => {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e3c15, roughness: 0.85 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.65 });
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.9 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.75 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 }); // vibrant red
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x18181b });

    const generated: THREE.Object3D[] = [];

    decorations.forEach((d) => {
      const group = new THREE.Group();
      group.position.set(d.x, 0, d.y);

      if (d.type === 'tree') {
        const isPalm = Math.random() > 0.45;
        if (isPalm) {
          // Relentless tropical palm tree
          const height = d.size * 0.45;
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.38, height, 8), trunkMat);
          trunk.position.y = height / 2;
          trunk.rotation.x = (Math.random() - 0.5) * 0.12;
          trunk.rotation.z = (Math.random() - 0.5) * 0.12;
          trunk.castShadow = true;
          group.add(trunk);

          const fronds = new THREE.Group();
          fronds.position.y = height;
          
          const leafGeo = new THREE.BoxGeometry(0.18, 0.05, d.size * 0.2);
          leafGeo.translate(0, 0, d.size * 0.08);

          for (let l = 0; l < 8; l++) {
            const leaf = new THREE.Mesh(leafGeo, leavesMat);
            leaf.rotation.y = (l * Math.PI) / 4;
            leaf.rotation.x = 0.2; // drooping frond
            fronds.add(leaf);
          }
          group.add(fronds);
        } else {
          // Forest Redwood/Pine tree
          const height = d.size * 0.5;
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, height * 0.28, 8), trunkMat);
          trunk.position.y = height * 0.14;
          trunk.castShadow = true;
          group.add(trunk);

          for (let c = 0; c < 3; c++) {
            const scale = 1 - c * 0.25;
            const folGeo = new THREE.ConeGeometry(d.size * 0.25 * scale, height * 0.38, 8);
            const fol = new THREE.Mesh(folGeo, foliageMat);
            fol.position.y = height * 0.28 + c * (height * 0.22);
            fol.castShadow = true;
            group.add(fol);
          }
        }
      } else if (d.type === 'cactus') {
        // Detailed PBR Cactus
        const height = d.size * 0.45;
        const main = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, height, 8), cactusMat);
        main.position.y = height / 2;
        main.castShadow = true;
        group.add(main);

        // side arm left
        const arm1 = new THREE.Group();
        arm1.position.set(0.55, height * 0.45, 0);
        const horiz1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 8), cactusMat);
        horiz1.rotation.z = Math.PI / 2;
        arm1.add(horiz1);
        const vert1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.1, 8), cactusMat);
        vert1.position.set(0.35, 0.45, 0);
        arm1.add(vert1);
        group.add(arm1);

        // side arm right
        const arm2 = new THREE.Group();
        arm2.position.set(-0.55, height * 0.58, 0);
        const horiz2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 8), cactusMat);
        horiz2.rotation.z = -Math.PI / 2;
        arm2.add(horiz2);
        const vert2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.9, 8), cactusMat);
        vert2.position.set(-0.35, 0.35, 0);
        arm2.add(vert2);
        group.add(arm2);
      } else if (d.type === 'neon-sign') {
        // Glowing brand billboard
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, d.size * 0.45, 6), boardMat);
        stand.position.y = d.size * 0.22;
        stand.castShadow = true;
        group.add(stand);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(d.size * 0.4, d.size * 0.26, 0.35), boardMat);
        frame.position.y = d.size * 0.48;
        frame.castShadow = true;
        group.add(frame);

        const screenGlowMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0x06b6d4 : 0xec4899,
        });
        const screen = new THREE.Mesh(new THREE.BoxGeometry(d.size * 0.36, d.size * 0.22, 0.4), screenGlowMat);
        screen.position.y = d.size * 0.48;
        group.add(screen);
      } else if (d.type === 'spectator-stand') {
        // Grandstands
        const w = d.size * 0.75;
        const base = new THREE.Mesh(new THREE.BoxGeometry(w, 3.8, 5.5), concreteMat);
        base.position.y = 1.9;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const canopy = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 0.35, 6.5), steelMat);
        canopy.position.set(0, 7.2, -0.4);
        canopy.rotation.x = 0.1;
        canopy.castShadow = true;
        group.add(canopy);

        // pillars
        const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, 5.5, 6);
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.8 });
        
        const c1 = new THREE.Mesh(pillarGeo, metalMat);
        c1.position.set(-w/2 + 0.4, 4.2, 2.2);
        group.add(c1);

        const c2 = c1.clone();
        c2.position.x = w/2 - 0.4;
        group.add(c2);

        const c3 = c1.clone();
        c3.position.z = -2.2;
        group.add(c3);

        const c4 = c2.clone();
        c4.position.z = -2.2;
        group.add(c4);
      } else if (d.type === 'audience') {
        // Render small cluster of 2-3 human spectators cheering on the side of the road!
        const numSpectators = Math.floor(1 + Math.random() * 2.5);
        
        // Shirt color palette
        const colors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xec4899, 0x8b5cf6, 0xf43f5e, 0x06b6d4];
        // Skin tones
        const skinTones = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];

        const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.2 * d.size, 6);
        const headGeo = new THREE.SphereGeometry(0.35 * d.size, 6, 6);
        const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8 * d.size, 5);

        for (let s = 0; s < numSpectators; s++) {
          const specGroup = new THREE.Group();
          
          // Random offset from center point to cluster them nicely
          const xOffset = (Math.random() - 0.5) * 1.6;
          const zOffset = (Math.random() - 0.5) * 1.6;
          specGroup.position.set(xOffset, 0, zOffset);

          // Random materials
          const shirtColor = colors[Math.floor(Math.random() * colors.length)];
          const skinColor = skinTones[Math.floor(Math.random() * skinTones.length)];
          const pantsColor = 0x1e3a8a; // blue jeans

          const bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
          const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
          const legMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });

          // Legs
          const legL = new THREE.Mesh(legGeo, legMat);
          legL.position.set(-0.18, (0.8 * d.size) / 2, 0);
          legL.castShadow = true;
          specGroup.add(legL);

          const legR = new THREE.Mesh(legGeo, legMat);
          legR.position.set(0.18, (0.8 * d.size) / 2, 0);
          legR.castShadow = true;
          specGroup.add(legR);

          // Torso/Shirt
          const torso = new THREE.Mesh(bodyGeo, bodyMat);
          torso.position.set(0, 0.8 * d.size + (1.2 * d.size) / 2, 0);
          torso.castShadow = true;
          specGroup.add(torso);

          // Head
          const head = new THREE.Mesh(headGeo, headMat);
          head.position.set(0, 0.8 * d.size + 1.2 * d.size + 0.3 * d.size, 0);
          head.castShadow = true;
          specGroup.add(head);

          // Arm left (raised to cheer!)
          const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9 * d.size, 5);
          const armL = new THREE.Mesh(armGeo, bodyMat);
          armL.position.set(-0.45 * d.size, 0.8 * d.size + 1.2 * d.size, 0);
          armL.rotation.z = 1.0 + Math.random() * 0.8; // wave up
          armL.castShadow = true;
          specGroup.add(armL);

          // Arm right
          const armR = new THREE.Mesh(armGeo, bodyMat);
          armR.position.set(0.45 * d.size, 0.8 * d.size + 1.2 * d.size, 0);
          armR.rotation.z = -1.0 - Math.random() * 0.8; // wave up
          armR.castShadow = true;
          specGroup.add(armR);

          // Rotate the spectator slightly towards the track/road center!
          specGroup.rotation.y = Math.random() * Math.PI * 2;

          group.add(specGroup);
        }
      }

      scene.add(group);
      generated.push(group);
    });

    return generated;
  };

  const buildItems3D = (scene: THREE.Scene, pickups: TrackPickup[], obstacles: TrackObstacle[]) => {
    const coinGeo = new THREE.TorusGeometry(0.8, 0.22, 8, 16);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.1, metalness: 0.95, emissive: 0xb45309 });

    const nitroGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.6, 12);
    const nitroMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.1, metalness: 0.95, emissive: 0x06b6d4 });

    const barrierGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.5, metalness: 0.4 });
    const barrierWarningMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const oilGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.04, 12);
    const oilMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.8, metalness: 0.6 });

    const pickupsMeshes = new Map<string, THREE.Object3D>();
    const obstaclesMeshes = new Map<string, THREE.Object3D>();

    pickups.forEach((p) => {
      let mesh: THREE.Mesh;
      if (p.type === 'coin') {
        mesh = new THREE.Mesh(coinGeo, coinMat);
        mesh.position.set(p.x, 1.1, p.y);
        mesh.castShadow = true;
      } else {
        mesh = new THREE.Mesh(nitroGeo, nitroMat);
        mesh.position.set(p.x, 1.0, p.y);
        mesh.castShadow = true;
      }
      scene.add(mesh);
      pickupsMeshes.set(p.id, mesh);
    });

    obstacles.forEach((o) => {
      let mesh: THREE.Mesh;
      if (o.type === 'oil') {
        mesh = new THREE.Mesh(oilGeo, oilMat);
        mesh.position.set(o.x, 0.015, o.y);
      } else {
        mesh = new THREE.Mesh(barrierGeo, barrierMat);
        mesh.position.set(o.x, 0.6, o.y);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // warning plates on sides
        const plates = new THREE.Mesh(new THREE.BoxGeometry(1.64, 1.2, 0.4), barrierWarningMat);
        plates.position.z = 0.4;
        mesh.add(plates);
        
        const platesB = plates.clone();
        platesB.position.z = -0.4;
        mesh.add(platesB);
      }
      scene.add(mesh);
      obstaclesMeshes.set(o.id, mesh);
    });

    return { pickupsMeshes, obstaclesMeshes };
  };

  const updateWeatherParticles = (dt: number, theme: string) => {
    if (!threeRef.current) return;
    const { weatherSystem } = threeRef.current;
    if (!weatherSystem) return;

    const positions = weatherSystem.geometry.attributes.position.array as Float32Array;
    const count = positions.length / 3;
    const p = playerRef.current;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      if (theme === 'desert') {
        // blowing sandstorm
        positions[idx] += 1.8 * dt;
        positions[idx + 1] -= 0.5 * dt;
        positions[idx + 2] += 0.9 * dt;

        if (positions[idx + 1] < 0 || positions[idx] > p.x + 180 || positions[idx + 2] > p.y + 180) {
          positions[idx] = p.x + (Math.random() - 0.5) * 300 - 100;
          positions[idx + 1] = 60 + Math.random() * 30;
          positions[idx + 2] = p.y + (Math.random() - 0.5) * 300 - 100;
        }
      } else {
        // dynamic falling rain
        positions[idx + 1] -= 3.2 * dt;

        if (positions[idx + 1] < 0) {
          positions[idx] = p.x + (Math.random() - 0.5) * 280;
          positions[idx + 1] = 80 + Math.random() * 20;
          positions[idx + 2] = p.y + (Math.random() - 0.5) * 280;
        }
      }
    }

    weatherSystem.geometry.attributes.position.needsUpdate = true;
  };

  // --- THREE.JS LIFECYCLE EFFECT ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = canvasSize.width;
    const height = canvasSize.height;

    // Create webgl renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // Scene and fog
    const scene = new THREE.Scene();
    
    let ambientColor = 0x312e3f; // Warm indigo night sky illumination
    let sunColor = 0xf59e0b; // Vibrant golden neon moon/amber glow
    let fogColor = 0x09070f; // Saturated dark violet-purple sky
    let groundColor = 0x112b18; // Saturated forest ground
    let fogDensity = 0.0011; // Slightly lower density for crisp visibility

    if (track.bgTheme === 'desert') {
      ambientColor = 0x5a3b2b; // terracotta ambient clay sky
      sunColor = 0xf97316; // vivid amber hot sunset light
      fogColor = 0x180c07; // deep sunset purple-black night
      groundColor = 0xb45309; // gorgeous red-orange desert sand
      fogDensity = 0.0009;
    } else if (track.bgTheme === 'neon') {
      ambientColor = 0x111c3a; // deep cobalt ambient sky
      sunColor = 0x06b6d4; // bright cyan cyber moon glow
      fogColor = 0x04060c; // deep space cyber navy blue
      groundColor = 0x0f172a; // dark steel-slate ground
      fogDensity = 0.0012;
    }

    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor, fogDensity);

    // Common Ambient and directional shadows sunlight
    const ambientLight = new THREE.AmbientLight(ambientColor, 1.45); // increased for rich coloring
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(sunColor, 2.85); // increased for brilliant highlights
    sunLight.position.set(150, 450, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1200;

    const d = 500;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0006;
    scene.add(sunLight);

    // Massive 3D landscape terrain
    const groundGeo = new THREE.PlaneGeometry(15000, 15000, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Build Spline Asphalt Road Racetrack
    const trackMesh = buildTrack3D(scene, track);

    // Build environment palm/pine trees, cacti, grandstands
    const decorationsMeshes = buildScenery3D(scene, track.decorations);

    // Build collectible items
    const { pickupsMeshes, obstaclesMeshes } = buildItems3D(scene, pickupsRef.current, obstaclesRef.current);

    // Create Player Supercar
    const playerCarMesh = createSupercarGroup(carColor, true);
    scene.add(playerCarMesh);

    // Create AI Competitors
    const aiCarMeshes: THREE.Group[] = [];
    aiCarsRef.current.forEach((ai) => {
      const aiMesh = createSupercarGroup(ai.color, false);
      scene.add(aiMesh);
      aiCarMeshes.push(aiMesh);
    });

    // Weather Particles (2000 count)
    const particleCount = 2000;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 500;
      rainPositions[i * 3 + 1] = Math.random() * 80;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: track.bgTheme === 'desert' ? 0xcc8d39 : 0x0ea5e9,
      size: track.bgTheme === 'desert' ? 0.7 : 0.42,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const weatherSystem = new THREE.Points(rainGeo, rainMat);
    scene.add(weatherSystem);

    // Drift smoke particles group in 3D
    const driftParticlesGroup = new THREE.Group();
    scene.add(driftParticlesGroup);

    // Camera FOV 60 degrees
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.5, 2000);

    threeRef.current = {
      renderer,
      scene,
      camera,
      playerCarMesh,
      aiCarMeshes,
      trackMesh,
      pickupsMeshes,
      obstaclesMeshes,
      decorationsMeshes,
      weatherSystem,
      driftParticlesGroup,
      activeDriftParticles: [],
      wheels: {
        player: playerCarMesh.userData.wheels,
        ai: aiCarMeshes.map((m) => m.userData.wheels),
      },
      headlights: [],
      taillights: [],
      sunLight,
      ambientLight,
      exhaustFlares: new THREE.Group(),
      ground,
    };

    // Clean up WebGL resources
    return () => {
      if (threeRef.current) {
        const { renderer, scene } = threeRef.current;
        scene.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        renderer.dispose();
        threeRef.current = null;
      }
    };
  }, [track, carColor]);

  // Handle Resize updates on Three.js Camera Aspect
  useEffect(() => {
    if (threeRef.current) {
      const { renderer, camera } = threeRef.current;
      renderer.setSize(canvasSize.width, canvasSize.height);
      camera.aspect = canvasSize.width / canvasSize.height;
      camera.updateProjectionMatrix();
    }
  }, [canvasSize]);

  // Initialize values
  useEffect(() => {
    // Sync player car color
    playerRef.current.color = carColor;

    // Calculate upgraded player stats
    // Base max speed is 9, each upgrade level adds 1.2
    playerRef.current.maxSpeed = 9 + upgrades.speedLevel * 1.2;
    // Base acceleration is 0.045, each upgrade level adds 0.012 to slowly and smoothly build up speed
    playerRef.current.acceleration = 0.045 + upgrades.accelLevel * 0.012;
    // Base handling is 0.045, each upgrade adds 0.008
    playerRef.current.handling = 0.038 + upgrades.handlingLevel * 0.008;

    // Reset game parameters
    setCoinsCollected(0);
    setCountdown(4);
    raceStartTimeRef.current = 0;
    setRaceTime(0);
    repPointsRef.current = 1520;
    setRepPoints(1520);
    setHeatLevel(1);
    setLiveLeaderboard([]);
    leaderboardThrottleRef.current = 0;

    // Deep copy pickups and obstacles from track definition so we don't modify global definitions
    pickupsRef.current = track.pickups.map(p => ({ ...p, collected: false, respawnTime: 0 }));
    obstaclesRef.current = track.obstacles.map(o => ({ ...o }));
    particlesRef.current = [];

    // Place player at starting point of track centerline
    const wp0 = track.waypoints[0];
    const wp1 = track.waypoints[1];
    const startAngle = Math.atan2(wp1.y - wp0.y, wp1.x - wp0.x);

    playerRef.current.x = wp0.x - Math.cos(startAngle) * 50;
    playerRef.current.y = wp0.y - Math.sin(startAngle) * 50;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.angle = startAngle;
    playerRef.current.speed = 0;
    playerRef.current.lap = 1;
    playerRef.current.currentWaypointIndex = 0;
    playerRef.current.finished = false;
    playerRef.current.finishTime = null;
    playerRef.current.nitroLevel = 40 + upgrades.nitroLevel * 12; // Cap level refilled
    playerRef.current.spinDuration = 0;
    playerRef.current.stunnedDuration = 0;
    playerRef.current.currentSteer = 0;

    // Generate AI competitors with staggered positions slightly behind player
    const aiCars: Car[] = AI_NAMES.map((name, i) => {
      // Offset starting placement sideways and backwards
      const heading = startAngle;
      const perp = heading + Math.PI / 2;
      const sideOffset = (i % 2 === 0 ? 1 : -1) * 22;
      const backOffset = -60 - Math.floor(i / 2) * 55;

      const aiX = wp0.x + Math.cos(heading) * backOffset + Math.cos(perp) * sideOffset;
      const aiY = wp0.y + Math.sin(heading) * backOffset + Math.sin(perp) * sideOffset;

      // Variable stats for diff AIs to make racing interesting
      const speedModifier = 0.88 + i * 0.03; // Drift queen, Sam, etc.
      return {
        id: `ai-${i}`,
        name: name,
        color: AI_COLORS[i],
        x: aiX,
        y: aiY,
        vx: 0,
        vy: 0,
        angle: startAngle,
        speed: 0,
        maxSpeed: 8.8 + speedModifier * 1.1, // around 9.5-10.5
        acceleration: 0.04 + i * 0.005,
        handling: 0.04 + i * 0.005,
        friction: 0.985,
        isAI: true,
        currentWaypointIndex: 0,
        lap: 1,
        lapProgress: 0,
        racePosition: i + 2,
        finished: false,
        finishTime: null,
        lastCrashTime: 0,
        nitroLevel: 0,
        isNitroActive: false,
        spinDuration: 0,
        stunnedDuration: 0,
        avatar: AI_AVATARS[i],
      };
    });
    aiCarsRef.current = aiCars;

    // Trigger starting commentator voice
    triggerAICommentary('race_start');
  }, [track, upgrades, carColor]);

  // Handle ResizeObserver for Canvas
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      // Ensure we don't have 0 width or height
      const w = Math.max(width, 320);
      const h = Math.max(height, 240);
      setCanvasSize({ width: w, height: h });
      if (canvasRef.current) {
        canvasRef.current.width = w;
        canvasRef.current.height = h;
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Block browser scrolling with arrow keys inside canvas
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current[k] = true;
      if (e.key === ' ') {
        keysRef.current['space'] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = false;
      if (e.key === ' ') {
        keysRef.current['space'] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Visual Sound Popup Effect
  const addSoundPopup = (text: string, x: number, y: number, color: string) => {
    if (!soundEnabledRef.current) return;
    const id = Math.random().toString(36).substr(2, 9);
    setSoundPopups((prev) => [...prev, { id, text, x, y, color }]);
    setTimeout(() => {
      setSoundPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1200);
  };

  // Spawns 3D drift smoke particles behind rear wheels
  const spawnDriftSmoke = (x: number, z: number, isOffRoad: boolean) => {
    if (!threeRef.current) return;
    const { driftParticlesGroup, activeDriftParticles } = threeRef.current;
    if (!driftParticlesGroup || !activeDriftParticles) return;

    // Create a small sphere
    const size = 0.25 + Math.random() * 0.3;
    const smokeGeo = new THREE.SphereGeometry(size, 4, 4);
    
    // Choose color based on theme / road condition
    let colorHex = 0xe2e8f0; // standard clean tire smoke
    if (isOffRoad) {
      if (track.bgTheme === 'desert') {
        colorHex = 0xd9a05b; // sandy dust
      } else if (track.bgTheme === 'neon') {
        colorHex = 0x1e293b; // dark slate
      } else {
        colorHex = 0x3f6212; // greenish grass dust
      }
    }

    const smokeMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(smokeGeo, smokeMat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.4,
      0.08 + Math.random() * 0.1,
      z + (Math.random() - 0.5) * 0.4
    );

    driftParticlesGroup.add(mesh);

    activeDriftParticles.push({
      mesh,
      life: 1.0,
      decay: 0.05 + Math.random() * 0.04,
      vx: (Math.random() - 0.5) * 0.15,
      vy: 0.05 + Math.random() * 0.08, // rise up
      vz: (Math.random() - 0.5) * 0.15,
      maxScale: 2.2 + Math.random() * 1.5,
    });
  };

  // Live commentary trigger helper
  const triggerAICommentary = async (eventType: string, competitorName = '') => {
    const now = Date.now();
    // Throttle requests to once every 12 seconds to prevent API flooding, except for race start and finishes!
    if (!eventType.startsWith('race_finished') && eventType !== 'race_start') {
      if (now - lastCommentTimeRef.current < 12000) return;
    }
    lastCommentTimeRef.current = now;

    try {
      const response = await fetch('/api/race-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackName: track.name,
          eventType,
          playerLap: playerRef.current.lap,
          playerPosition: playerRef.current.racePosition,
          competitorName,
          speed: Math.round(Math.abs(playerRef.current.speed) * 12.5),
          personality: commentatorPersonalityRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubtitles(data.commentary);
        setSubtitleTimer(4500); // Reset stay active
      }
    } catch (e) {
      console.error("AI commentary fetch failed:", e);
    }
  };

  // Fade out subtitles
  useEffect(() => {
    if (!subtitles) return;
    const interval = setInterval(() => {
      setSubtitleTimer((prev) => {
        if (prev <= 100) {
          setSubtitles(null);
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [subtitles]);

  // Main Game Loop Engine
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16.666, 4.0); // normalize dt to 1.0 at 60fps, cap at 4.0 to avoid large gaps
      lastTime = time;

      update(dt);
      render();

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [track]);

  // Update game mathematics
  const update = (dt: number) => {
    // Countdown updater
    if (countdownRef.current > 0) {
      const elapsed = raceStartTimeRef.current === 0 ? 0 : performance.now() - raceStartTimeRef.current;
      if (raceStartTimeRef.current === 0) {
        raceStartTimeRef.current = performance.now();
      }

      const diff = Math.floor(4 - (performance.now() - raceStartTimeRef.current) / 1000);
      if (diff !== countdownRef.current) {
        if (diff === 0) {
          setCountdown(0);
          raceStartTimeRef.current = performance.now(); // Start actual race timer
        } else {
          setCountdown(diff);
          if (diff === 3) addSoundPopup("🚦 RED", playerRef.current.x, playerRef.current.y - 40, 'text-red-500');
          if (diff === 2) addSoundPopup("🚦 ORANGE", playerRef.current.x, playerRef.current.y - 40, 'text-orange-500');
          if (diff === 1) addSoundPopup("🚦 YELLOW", playerRef.current.x, playerRef.current.y - 40, 'text-yellow-400');
        }
      }
      return; // Do not update physics while countdown active
    }

    // Race Timer
    if (raceStartTimeRef.current > 0 && !playerRef.current.finished) {
      setRaceTime(performance.now() - raceStartTimeRef.current);
    }

    const player = playerRef.current;
    const aiCars = aiCarsRef.current;
    const waypoints = track.waypoints;

    // --- RESPOND TO PLAYER PHYSICS ---
    if (!player.finished) {
      // Stunned cooldown from crashes
      if (player.stunnedDuration > 0) {
        player.stunnedDuration -= dt;
        player.speed = 0;
      } else {
        // Spin out cooldown from oil slicks
        if (player.spinDuration > 0) {
          player.spinDuration -= dt;
          player.angle += 0.2 * dt; // spin rotation
          // Slowly decay speed during spin
          player.speed *= Math.pow(0.96, dt);
        } else {
          // Normal Driving Controls
          const isUp = keysRef.current['w'] || keysRef.current['arrowup'];
          const isDown = keysRef.current['s'] || keysRef.current['arrowdown'];
          const isLeft = keysRef.current['a'] || keysRef.current['arrowleft'];
          const isRight = keysRef.current['d'] || keysRef.current['arrowright'];
          const isBoost = keysRef.current['space'] && player.nitroLevel > 0 && isUp;

          // Smoothly interpolate current steering towards target steering
          let targetSteer = 0;
          if (isLeft) targetSteer = -1;
          if (isRight) targetSteer = 1;

          if (player.currentSteer === undefined) player.currentSteer = 0;
          // Interpolate the steering angle to prevent instant snapping and jerky, high-sensitivity movement
          const steerSpeed = 0.08; 
          player.currentSteer += (targetSteer - player.currentSteer) * steerSpeed * dt;

          // Nitro triggers
          if (isBoost) {
            player.isNitroActive = true;
            player.nitroLevel = Math.max(0, player.nitroLevel - 0.6 * dt);
          } else {
            player.isNitroActive = false;
          }

          // Compute temporary limits
          const actualMaxSpeed = player.isNitroActive ? player.maxSpeed * 1.35 : player.maxSpeed;
          const actualAccel = player.isNitroActive ? player.acceleration * 2.2 : player.acceleration;

          // Check track centerline distance to check if off-road
          const centerlineInfo = getDistanceToTrackCenterline(player, waypoints);
          player.currentWaypointIndex = centerlineInfo.index;

          const isOffRoad = centerlineInfo.distance > track.roadWidth / 2;
          const finalMaxSpeed = isOffRoad ? actualMaxSpeed * 0.35 : actualMaxSpeed;
          const finalFriction = isOffRoad ? 0.93 : player.friction;

          // Steering math (steer is tighter at moderate speed, less tight at zero or ultra-high speeds)
          const speedFactor = Math.min(1.0, Math.abs(player.speed) / 4);
          if (speedFactor > 0.15) {
            player.angle += player.currentSteer * player.handling * speedFactor * (player.speed < 0 ? -1 : 1) * dt;
          }

          // Gently damp speed when steering hard so they don't move too fast and can make tight turns cleanly
          const steerIntensity = Math.abs(player.currentSteer || 0);
          if (steerIntensity > 0.25 && Math.abs(player.speed) > 1.5) {
            // Apply drift drag / automatic brake deceleration
            player.speed *= Math.pow(0.972 - steerIntensity * 0.012, dt);
          }

          // Acceleration / Braking
          if (isUp) {
            player.speed += actualAccel * dt;
          } else if (isDown) {
            player.speed -= (actualAccel * 1.5) * dt; // strong brakes/reverse
          } else {
            // Idle decay
            player.speed *= Math.pow(finalFriction, dt);
          }

          // Top speed clamp
          if (player.speed > finalMaxSpeed) {
            player.speed -= 0.15 * dt; // bring down to max
          } else if (player.speed < -finalMaxSpeed * 0.4) {
            player.speed = -finalMaxSpeed * 0.4;
          }

          // 3D Drift Smoke & Offroad Dust Generation
          const isDrifting = steerIntensity > 0.35 && Math.abs(player.speed) > 1.5;
          if (isDrifting || (isOffRoad && Math.abs(player.speed) > 1.5)) {
            // Calculate rear wheels positions (offset behind the center point)
            const backX = player.x - Math.cos(player.angle) * 3.4;
            const backZ = player.y - Math.sin(player.angle) * 3.4;
            const perpX = -Math.sin(player.angle);
            const perpZ = Math.cos(player.angle);

            // Left rear tyre smoke
            spawnDriftSmoke(backX + perpX * 1.15, backZ + perpZ * 1.15, isOffRoad);
            // Right rear tyre smoke
            spawnDriftSmoke(backX - perpX * 1.15, backZ - perpZ * 1.15, isOffRoad);
          }

          // Offroad dust particles
          if (isOffRoad && Math.abs(player.speed) > 2) {
            for (let i = 0; i < 2; i++) {
              createParticle(
                player.x - Math.cos(player.angle) * 12 + (Math.random() - 0.5) * 8,
                player.y - Math.sin(player.angle) * 12 + (Math.random() - 0.5) * 8,
                'dust',
                track.bgTheme === 'desert' ? '#dfc07f' : '#27272a'
              );
            }
          }

          // Nitro Flame particles
          if (player.isNitroActive) {
            createParticle(
              player.x - Math.cos(player.angle) * 14,
              player.y - Math.sin(player.angle) * 14,
              'fire',
              '#06b6d4'
            );
          }
        }
      }

      // Position update
      player.vx = Math.cos(player.angle) * player.speed;
      player.vy = Math.sin(player.angle) * player.speed;
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      // Rigid boundary check: Keep player inside total arena boundaries or slide off solid boundaries
      const pCenterline = getDistanceToTrackCenterline(player, waypoints);
      const outerWallLimit = track.roadWidth / 2 + 15;
      if (pCenterline.distance > outerWallLimit) {
        // Nudge player back towards the closest track point
        const dx = pCenterline.point.x - player.x;
        const dy = pCenterline.point.y - player.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        if (len > 0) {
          const pushX = (dx / len);
          const pushY = (dy / len);
          // Slide them back
          player.x += pushX * (pCenterline.distance - outerWallLimit);
          player.y += pushY * (pCenterline.distance - outerWallLimit);
        }

        // Trigger crash stun if speed was high
        if (Math.abs(player.speed) > 5) {
          player.speed = -player.speed * 0.35; // bounce back
          player.stunnedDuration = 12; // stun frames
          addSoundPopup("💥 CRASH!", player.x, player.y - 20, 'text-red-500 font-extrabold');
          triggerAICommentary('crash_wall');

          // Generate spark particles
          for (let s = 0; s < 12; s++) {
            createParticle(player.x, player.y, 'spark', '#f59e0b');
          }
        }
      }

      // Synchronize dashboard variables
      setPlayerSpeedMPH(Math.round(Math.abs(player.speed) * 12.5));
      setPlayerNitro(Math.round(player.nitroLevel));
    } else {
      // If player has finished, slowly brake
      player.speed *= Math.pow(0.95, dt);
      player.vx = Math.cos(player.angle) * player.speed;
      player.vy = Math.sin(player.angle) * player.speed;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
    }

    // --- RESPOND TO AI COMPETITORS PHYSICS ---
    aiCars.forEach((ai) => {
      if (ai.finished) {
        ai.speed *= Math.pow(0.95, dt);
        ai.x += Math.cos(ai.angle) * ai.speed * dt;
        ai.y += Math.sin(ai.angle) * ai.speed * dt;
        return;
      }

      // Waypoint chasing behavior
      const targetWp = waypoints[ai.currentWaypointIndex];
      const dist = getDistance(ai, targetWp);

      if (dist < 75) {
        ai.currentWaypointIndex = (ai.currentWaypointIndex + 1) % waypoints.length;
      }

      // Steering calculations
      const targetAngle = Math.atan2(targetWp.y - ai.y, targetWp.x - ai.x);
      let diffAngle = targetAngle - ai.angle;

      // Wrap diffAngle to [-PI, PI]
      while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
      while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

      // AI handling adjustments
      ai.angle += Math.sign(diffAngle) * Math.min(Math.abs(diffAngle), ai.handling * 0.7 * dt);

      // Check track condition at AI coordinates
      const aiCenterline = getDistanceToTrackCenterline(ai, waypoints);
      const isAiOffRoad = aiCenterline.distance > track.roadWidth / 2;

      // Slow down AI if approaching tight corner (checks waypoints ahead)
      const lookaheadIdx = (ai.currentWaypointIndex + 6) % waypoints.length;
      const lookaheadWp = waypoints[lookaheadIdx];
      const lookaheadAngle = Math.atan2(lookaheadWp.y - ai.y, lookaheadWp.x - ai.x);
      let lookaheadDiff = lookaheadAngle - ai.angle;
      while (lookaheadDiff < -Math.PI) lookaheadDiff += Math.PI * 2;
      while (lookaheadDiff > Math.PI) lookaheadDiff -= Math.PI * 2;

      const cornerBrakingFactor = Math.max(0.45, 1 - Math.abs(lookaheadDiff) * 0.65);
      const aiMaxLimit = isAiOffRoad ? ai.maxSpeed * 0.4 : ai.maxSpeed * cornerBrakingFactor;

      // Accelerating
      if (ai.spinDuration > 0) {
        ai.spinDuration -= dt;
        ai.angle += 0.22 * dt;
        ai.speed *= Math.pow(0.96, dt);
      } else {
        if (ai.speed < aiMaxLimit) {
          ai.speed += ai.acceleration * dt;
        } else {
          ai.speed *= Math.pow(ai.friction, dt);
        }
      }

      // Spawn 3D drift smoke for AI when turning hard or off-road
      const aiIsDrifting = Math.abs(diffAngle) > 0.18 && ai.speed > 2.0;
      if (aiIsDrifting || (isAiOffRoad && ai.speed > 2.0)) {
        const aiBackX = ai.x - Math.cos(ai.angle) * 3.4;
        const aiBackZ = ai.y - Math.sin(ai.angle) * 3.4;
        const aiPerpX = -Math.sin(ai.angle);
        const aiPerpZ = Math.cos(ai.angle);

        spawnDriftSmoke(aiBackX + aiPerpX * 1.15, aiBackZ + aiPerpZ * 1.15, isAiOffRoad);
        spawnDriftSmoke(aiBackX - aiPerpX * 1.15, aiBackZ - aiPerpZ * 1.15, isAiOffRoad);
      }

      ai.x += Math.cos(ai.angle) * ai.speed * dt;
      ai.y += Math.sin(ai.angle) * ai.speed * dt;

      // Keep AI inside track boundaries too
      const aiOuterWall = track.roadWidth / 2 + 10;
      if (aiCenterline.distance > aiOuterWall) {
        const dx = aiCenterline.point.x - ai.x;
        const dy = aiCenterline.point.y - ai.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          ai.x += (dx / len) * (aiCenterline.distance - aiOuterWall);
          ai.y += (dy / len) * (aiCenterline.distance - aiOuterWall);
        }
        ai.speed *= -0.2; // small bounce
      }
    });

    // --- CAR TO CAR COLLISION SOLVER ---
    const allCars = [player, ...aiCars];
    for (let i = 0; i < allCars.length; i++) {
      for (let j = i + 1; j < allCars.length; j++) {
        const c1 = allCars[i];
        const c2 = allCars[j];

        const d = getDistance(c1, c2);
        const colRadius = 26; // Car bounding circle radius

        if (d < colRadius) {
          // Push apart overlap
          const overlap = colRadius - d;
          const pushX = ((c1.x - c2.x) / d) * overlap * 0.5;
          const pushY = ((c1.y - c2.y) / d) * overlap * 0.5;

          c1.x += pushX;
          c1.y += pushY;
          c2.x -= pushX;
          c2.y -= pushY;

          // Swap simple kinetic velocities to simulate bouncing
          const tempSpeed = c1.speed;
          c1.speed = c2.speed * 0.78;
          c2.speed = tempSpeed * 0.78;

          // Spawn collision sparks
          const spawnX = (c1.x + c2.x) / 2;
          const spawnY = (c1.y + c2.y) / 2;
          for (let s = 0; s < 4; s++) {
            createParticle(spawnX, spawnY, 'spark', '#fff');
          }

          // Sound overlay popup
          if (c1.id === 'player' || c2.id === 'player') {
            addSoundPopup("💥 BUMP!", spawnX, spawnY, 'text-zinc-400 font-bold');
            // Randomly trigger overtake/clash comment if player bumps heavily
            if (Math.abs(c1.speed - c2.speed) > 3) {
              const otherName = c1.id === 'player' ? c2.name : c1.name;
              triggerAICommentary('overtook_competitor', otherName);
            }
          }
        }
      }
    }

    // --- MANAGE PICKUPS AND OBSTACLES ---
    const pickups = pickupsRef.current;
    const obstacles = obstaclesRef.current;

    // Tick respawns
    pickups.forEach((p) => {
      if (p.collected && p.respawnTime > 0) {
        p.respawnTime -= dt;
        if (p.respawnTime <= 0) {
          p.collected = false;
        }
      }
    });

    // Check coin & nitro collections
    allCars.forEach((car) => {
      // Pickups are only checked if active
      pickups.forEach((p) => {
        if (!p.collected) {
          const dist = getDistance(car, p);
          if (dist < p.radius + 13) {
            p.collected = true;
            p.respawnTime = p.type === 'coin' ? 360 : 480; // 6 or 8 seconds respawn

            if (car.id === 'player') {
              if (p.type === 'coin') {
                setCoinsCollected((prev) => prev + 15);
                repPointsRef.current += 1000;
                addSoundPopup("🪙 +15 (REP +1000!)", p.x, p.y - 15, 'text-amber-400 font-black text-xs animate-bounce');
              } else if (p.type === 'nitro') {
                player.nitroLevel = Math.min(100, player.nitroLevel + 40);
                addSoundPopup("⚡ NITRO RECHARGE!", p.x, p.y - 15, 'text-cyan-400 font-bold');
                triggerAICommentary('nitro_activated');
              }
            }
          }
        }
      });

      // Obstacles: Oil slicks trigger spin out
      obstacles.forEach((o) => {
        const dist = getDistance(car, o);
        // Oil Slicks (width 32)
        if (o.type === 'oil') {
          if (dist < 24) {
            if (car.spinDuration === 0) {
              car.spinDuration = 48; // Spin for ~0.8 seconds
              if (car.id === 'player') {
                addSoundPopup("⚠️ SLIPPED OIL!", car.x, car.y - 20, 'text-purple-400 font-extrabold animate-pulse');
                triggerAICommentary('hit_oil');
              }
            }
          }
        }
        // Barrier (width 24)
        else if (o.type === 'barrier') {
          if (dist < 20) {
            // Rigid bounce
            car.speed = -car.speed * 0.4;
            car.stunnedDuration = 12;
            // Nudge back away
            const dx = car.x - o.x;
            const dy = car.y - o.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
              car.x += (dx / len) * 8;
              car.y += (dy / len) * 8;
            }

            if (car.id === 'player') {
              addSoundPopup("💥 CRASHED BLOCK!", car.x, car.y - 20, 'text-red-500 font-bold');
              for (let s = 0; s < 8; s++) {
                createParticle(car.x, car.y, 'spark', '#ef4444');
              }
            }
          }
        }
      });
    });

    // --- CHECK LAPS AND FINISH LINES ---
    allCars.forEach((car) => {
      if (car.finished) return;

      // We track distance to waypoint 0 to check start-finish line crossing
      const dToStart = getDistance(car, waypoints[0]);
      
      // Let's implement robust lap progress tracking
      // To gain a lap, a car must increment its currentWaypointIndex sequentially.
      // If they are at a very high waypoint index (e.g. >90% of track length)
      // and they transition back to a very low waypoint index (e.g. < 5%), they gain a lap!
      const totalWp = waypoints.length;
      
      // In canvas rendering coordinate, when closest waypoint jumps from end to start:
      const centerline = getDistanceToTrackCenterline(car, waypoints);
      const oldIdx = car.currentWaypointIndex;
      const newIdx = centerline.index;

      // Track if they crossed checkpoint
      if (oldIdx > totalWp * 0.8 && newIdx < totalWp * 0.15) {
        // Lap increment!
        car.lap += 1;
        if (car.lap > selectedLevelRef.current) {
          car.finished = true;
          car.finishTime = performance.now() - raceStartTimeRef.current;
          
          if (car.id === 'player') {
            addSoundPopup("🏁 PLAYER FINISHED!", car.x, car.y - 30, 'text-emerald-400 font-black tracking-widest text-lg shadow-[0_0_12px_rgba(52,211,153,0.5)]');
          } else {
            addSoundPopup(`🏁 ${car.name} FINISHED!`, car.x, car.y - 30, 'text-zinc-400 font-bold text-xs');
          }

          // Count how many cars have finished the race (both Player and AI cars)
          const finishedCount = allCars.filter(c => c.finished).length;
          
          if (finishedCount >= 3 && !raceEndingRef.current) {
            raceEndingRef.current = true;
            // Display a centered, high-profile finish notice
            addSoundPopup("🏆 PODIUM SECURED! RACE OVER!", playerRef.current.x, playerRef.current.y - 50, 'text-yellow-400 font-black tracking-wider text-xl animate-pulse');
            
            // Brief buffer before launching result screen
            setTimeout(() => {
              checkRaceResults();
            }, 2200);
          }
        } else {
          if (car.id === 'player') {
            setPlayerLap(car.lap);
            addSoundPopup(`🏁 LAP ${car.lap}!`, car.x, car.y - 30, 'text-amber-400 font-bold');
            triggerAICommentary('lap_completed');
          }
        }
      }

      car.currentWaypointIndex = newIdx;
      // lap progress score used for placement calculating
      car.lapProgress = car.lap * 100000 + car.currentWaypointIndex * 100 + (100 - centerline.distance);
    });

    // --- CALCULATE REALTIME PLACEMENTS ---
    // Sort all cars by lapProgress descending
    const placements = [...allCars].sort((a, b) => b.lapProgress - a.lapProgress);
    placements.forEach((car, index) => {
      car.racePosition = index + 1;
    });

    setPlayerPosition(player.racePosition);

    // Update reputation points based on driver actions
    if (countdownRef.current === 0 && !player.finished) {
      if (player.speed > 3) {
        // Higher speed awards more reputation
        repPointsRef.current += Math.floor(player.speed * 0.08);
      }
      if (player.isNitroActive) {
        repPointsRef.current += 2;
      }
    }

    // Throttle React state updates to avoid slowing down the 60 FPS requestAnimationFrame loop
    leaderboardThrottleRef.current++;
    if (leaderboardThrottleRef.current >= 8) {
      leaderboardThrottleRef.current = 0;
      
      setLiveLeaderboard(
        placements.map((car) => ({
          name: car.name,
          position: car.racePosition,
          isPlayer: car.id === 'player',
          color: car.color,
        }))
      );

      const currentRep = repPointsRef.current;
      setRepPoints(currentRep);

      let level = 1;
      if (currentRep >= 50000) level = 5;
      else if (currentRep >= 30000) level = 4;
      else if (currentRep >= 15000) level = 3;
      else if (currentRep >= 5000) level = 2;
      setHeatLevel(level);
    }

    // --- UPDATE PARTICLES ---
    const particles = particlesRef.current;
    particlesRef.current = particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      return p.life > 0;
    });
  };

  // Check race results to push up
  const checkRaceResults = () => {
    const results: RaceResult[] = [playerRef.current, ...aiCarsRef.current].map((car) => ({
      carId: car.id,
      name: car.name,
      color: car.color,
      position: car.racePosition,
      finishTime: car.finishTime,
      isPlayer: car.id === 'player',
    })).sort((a, b) => a.position - b.position);

    // Calculate final coins earned:
    // ONLY top 3 winners earn rewards!
    const rank = playerRef.current.racePosition;
    let finalEarned = 0;
    if (rank <= 3) {
      const posBonus = rank === 1 ? 300 : rank === 2 ? 150 : 80;
      finalEarned = coinsCollected + posBonus + 50;
    } else {
      finalEarned = 0; // only top three winners earned some rewards
    }

    // Commentary on finish
    const trigger = rank === 1 ? 'race_finished_win' : rank <= 3 ? 'race_finished_podium' : 'race_finished_loss';
    triggerAICommentary(trigger);

    // Call callback after small delay
    onRaceFinish(results, finalEarned);
  };

  // Particle creator helper
  const createParticle = (x: number, y: number, type: 'dust' | 'fire' | 'spark', color: string) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = type === 'spark' ? 3 + Math.random() * 4 : 0.5 + Math.random() * 1.5;
    particlesRef.current.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: type === 'dust' ? 8 + Math.random() * 8 : type === 'fire' ? 6 + Math.random() * 5 : 2 + Math.random() * 2,
      life: 1.0,
      decay: type === 'spark' ? 0.05 + Math.random() * 0.05 : 0.02 + Math.random() * 0.02,
      type,
    });
  };

  // --- RENDER GAME CANVAS GRAPHICS ---
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const player = playerRef.current;
    const aiCars = aiCarsRef.current;
    const waypoints = track.waypoints;
    const dt = 0.016; // approximate delta time for animations

    const width = canvasSize.width;
    const height = canvasSize.height;

    if (threeRef.current) {
      const {
        renderer,
        scene,
        camera,
        playerCarMesh,
        aiCarMeshes,
        pickupsMeshes,
        obstaclesMeshes,
        wheels,
      } = threeRef.current;

      // 1. UPDATE PLAYER CAR POSITION AND ROTATION IN 3D
      playerCarMesh.position.set(player.x, 0.15, player.y);
      const playerSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
      
      // Calculate smooth dynamic visual drift slip angle
      const speedRatio = Math.min(1.0, playerSpeed / player.maxSpeed);
      let targetDriftAngle = 0;
      if (Math.abs(player.currentSteer || 0) > 0.15 && playerSpeed > 1.5) {
        // Point outward from turning direction
        targetDriftAngle = (player.currentSteer || 0) * 0.35 * speedRatio;
      }
      if (player.visualDriftAngle === undefined) player.visualDriftAngle = 0;
      player.visualDriftAngle += (targetDriftAngle - player.visualDriftAngle) * 0.15 * dt;

      playerCarMesh.rotation.y = -player.angle - player.visualDriftAngle; // Yaw rotation with drift

      // Rotate player wheels based on speed
      const wheelRotateSpeed = (playerSpeed * dt) / 0.85;
      wheels.player.forEach((wheel: THREE.Mesh, index: number) => {
        wheel.rotation.x += wheelRotateSpeed;
        
        // Front wheels turn smoothly in sync with interpolated steering inputs
        if (index < 2) {
          const steerAngle = (player.currentSteer || 0) * -0.42;
          wheel.rotation.y = steerAngle;
        }
      });

      // Spin effect if spun out
      if (player.spinDuration > 0) {
        playerCarMesh.rotation.y += Math.sin(Date.now() * 0.035) * 0.85;
      }

      // 2. UPDATE AI CARS IN 3D
      aiCars.forEach((ai, idx) => {
        const aiMesh = aiCarMeshes[idx];
        if (aiMesh) {
          aiMesh.position.set(ai.x, 0.15, ai.y);
          
          const aiSpeed = Math.sqrt(ai.vx * ai.vx + ai.vy * ai.vy);

          // Calculate dynamic visual drift slip angle for AI based on how hard they are turning
          let aiTargetDrift = 0;
          const aiSpeedRatio = Math.min(1.0, aiSpeed / ai.maxSpeed);
          
          // Estimate turning rate/drifting from waypoint chasing
          const targetWp = waypoints[ai.currentWaypointIndex];
          const targetAngle = Math.atan2(targetWp.y - ai.y, targetWp.x - ai.x);
          let diffAngle = targetAngle - ai.angle;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

          const aiIsDrifting = Math.abs(diffAngle) > 0.18 && aiSpeed > 2.0;
          if (aiIsDrifting) {
            aiTargetDrift = Math.sign(diffAngle) * 0.3 * aiSpeedRatio;
          }
          if (ai.visualDriftAngle === undefined) ai.visualDriftAngle = 0;
          ai.visualDriftAngle += (aiTargetDrift - ai.visualDriftAngle) * 0.15 * dt;

          aiMesh.rotation.y = -ai.angle - ai.visualDriftAngle;

          if (ai.spinDuration > 0) {
            aiMesh.rotation.y += Math.sin(Date.now() * 0.035) * 0.85;
          }

          const aiWheelRotateSpeed = (aiSpeed * dt) / 0.85;
          const aiWheelsList = wheels.ai[idx];
          if (aiWheelsList) {
            aiWheelsList.forEach((wheel: THREE.Mesh) => {
              wheel.rotation.x += aiWheelRotateSpeed;
            });
          }
        }
      });

      // 3. ANIMATE AND HIDE COLLECTED ITEMS
      const currentPickups = pickupsRef.current;
      pickupsMeshes.forEach((mesh: THREE.Object3D, id: string) => {
        const item = currentPickups.find((p) => p.id === id);
        if (item && !item.collected) {
          mesh.visible = true;
          mesh.rotation.y += 2.0 * dt;
        } else {
          mesh.visible = false;
        }
      });

      const currentObstacles = obstaclesRef.current;
      obstaclesMeshes.forEach((mesh: THREE.Object3D, id: string) => {
        const item = currentObstacles.find((o) => o.id === id);
        if (item && !item.triggered) {
          mesh.visible = true;
        } else if (item && item.type === 'oil') {
          mesh.visible = true;
        } else {
          mesh.visible = false;
        }
      });

      // 4. WEATHER PARTICLES EFFECT
      updateWeatherParticles(dt, track.bgTheme);

      // 4B. UPDATE 3D DRIFT SMOKE PARTICLES
      const activeDriftParticles = threeRef.current.activeDriftParticles || [];
      const driftParticlesGroup = threeRef.current.driftParticlesGroup;
      if (driftParticlesGroup && activeDriftParticles.length > 0) {
        threeRef.current.activeDriftParticles = activeDriftParticles.filter((p: any) => {
          p.life -= p.decay * dt;
          if (p.life <= 0) {
            driftParticlesGroup.remove(p.mesh);
            p.mesh.geometry.dispose();
            if (Array.isArray(p.mesh.material)) {
              p.mesh.material.forEach((m: any) => m.dispose());
            } else {
              p.mesh.material.dispose();
            }
            return false;
          }

          // Apply velocity
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;

          // Expand / Scale up over time
          const currentScale = 1.0 + (1.0 - p.life) * p.maxScale;
          p.mesh.scale.setScalar(currentScale);

          // Fade out over life
          if (p.mesh.material) {
            p.mesh.material.opacity = p.life * 0.65;
          }
          return true;
        });
      }

      // 5. CINEMATIC AND DYNAMIC CAMERAS
      if (cameraModeRef.current === 'follow') {
        const speedRatio = Math.min(1.0, Math.abs(player.speed) / player.maxSpeed);
        
        // Dynamically scale Field of View (FOV) slightly for speed sensation without pushing the car too far
        camera.fov = 55 + speedRatio * 8;
        camera.updateProjectionMatrix();

        const backX = Math.cos(player.angle);
        const backY = Math.sin(player.angle);

        // Keep a very tight camera lag offset so the car stays close on the screen when accelerating
        const isAccelerating = keysRef.current['w'] || keysRef.current['arrowup'] || keysRef.current['space'];
        const targetOffset = isAccelerating ? 0.8 : 0;
        accelCamOffsetRef.current += (targetOffset - accelCamOffsetRef.current) * 0.15;

        // Tighter camera framing: starting closer and pull-back limited to keep car prominently visible
        const distance = 10.5 + speedRatio * 3.5 + accelCamOffsetRef.current;
        const height = 2.8 + speedRatio * 1.5;

        const targetCamX = player.x - backX * distance;
        const targetCamZ = player.y - backY * distance;
        const targetCamY = height;

        // Stay tightly glued behind the car (0.26 interpolation factor instead of 0.12)
        camera.position.x += (targetCamX - camera.position.x) * 0.26;
        camera.position.z += (targetCamZ - camera.position.z) * 0.26;
        camera.position.y += (targetCamY - camera.position.y) * 0.26;

        // Add subtle screen vibration / shake at high speed for realism
        let shakeX = 0;
        let shakeY = 0;
        if (player.speed > 4.5) {
          const shakeIntensity = 0.02 * (player.speed / player.maxSpeed);
          shakeX = (Math.random() - 0.5) * shakeIntensity;
          shakeY = (Math.random() - 0.5) * shakeIntensity;
        }

        const lookTarget = new THREE.Vector3(
          player.x + backX * 5.0 + shakeX,
          1.0 + shakeY,
          player.y + backY * 5.0
        );
        camera.lookAt(lookTarget);
      } else if (cameraModeRef.current === 'cockpit') {
        // First-Person / Cockpit mode
        camera.fov = 76;
        camera.updateProjectionMatrix();

        const dirX = Math.cos(player.angle);
        const dirY = Math.sin(player.angle);

        // Position camera right inside the driver's seat / dashboard area
        // Player car is centered at player.x, player.y. Positive X is forward.
        const camX = player.x + dirX * -0.55;
        const camZ = player.y + dirY * -0.55;
        const camY = 1.32; // height at windshield level

        camera.position.set(camX, camY, camZ);

        // Subtle camera vibration in cockpit view too!
        let shakeX = 0;
        let shakeY = 0;
        if (player.speed > 3.0) {
          const shakeIntensity = 0.015 * (player.speed / player.maxSpeed);
          shakeX = (Math.random() - 0.5) * shakeIntensity;
          shakeY = (Math.random() - 0.5) * shakeIntensity;
        }

        // Look straight ahead along the car's heading
        const lookTarget = new THREE.Vector3(
          player.x + dirX * 35.0 + shakeX,
          1.15 + shakeY,
          player.y + dirY * 35.0
        );
        camera.lookAt(lookTarget);
      } else {
        camera.fov = 60;
        camera.updateProjectionMatrix();
        camera.position.set(player.x, 380, player.y + 10);
        camera.lookAt(new THREE.Vector3(player.x, 0, player.y));
      }

      // 6. RENDER WEBGL SCENE
      renderer.render(scene, camera);
    }

    const ctx = {} as CanvasRenderingContext2D;
    if (false) {
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      // CAMERA VIEW SETTINGS
    if (cameraMode === 'follow') {
      // Smooth follow player camera centering
      const camX = width / 2 - player.x;
      const camY = height / 2 - player.y;
      ctx.translate(camX, camY);
    } else {
      // Fit full track screen ratio scale
      // Bounding box of waypoints
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      waypoints.forEach(wp => {
        if (wp.x < minX) minX = wp.x;
        if (wp.x > maxX) maxX = wp.x;
        if (wp.y < minY) minY = wp.y;
        if (wp.y > maxY) maxY = wp.y;
      });

      const trackW = maxX - minX + 250;
      const trackH = maxY - minY + 250;
      const scaleX = width / trackW;
      const scaleY = height / trackH;
      const scale = Math.min(scaleX, scaleY, 1.0); // don't zoom in too close

      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
    }

    // 1. DRAW BACKGROUND MAP TEXTURE
    if (track.bgTheme === 'desert') {
      ctx.fillStyle = '#dfb572'; // warm desert sand
    } else if (track.bgTheme === 'neon') {
      ctx.fillStyle = '#09090b'; // dark cyberpunk slate
    } else {
      ctx.fillStyle = '#1e3f20'; // deep green grass
    }
    ctx.fillRect(-2000, -2000, 6000, 6000);

    // Draw background grid for technical/neon theme
    if (track.bgTheme === 'neon') {
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
      ctx.lineWidth = 1;
      for (let x = -2000; x < 4000; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, -2000);
        ctx.lineTo(x, 4000);
        ctx.stroke();
      }
      for (let y = -2000; y < 4000; y += 60) {
        ctx.beginPath();
        ctx.moveTo(-2000, y);
        ctx.lineTo(4000, y);
        ctx.stroke();
      }
    }

    // 2. DRAW TRACK SCENERY DECORATIONS
    track.decorations.forEach((d) => {
      ctx.save();
      ctx.translate(d.x, d.y);

      if (d.type === 'cactus') {
        // Desert Cactus
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(0, 0, d.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        // Arms
        ctx.lineWidth = d.size * 0.2;
        ctx.strokeStyle = '#15803d';
        ctx.beginPath();
        ctx.moveTo(-d.size * 0.3, 0);
        ctx.lineTo(-d.size * 0.5, 0);
        ctx.lineTo(-d.size * 0.5, -d.size * 0.4);
        ctx.moveTo(d.size * 0.3, 0);
        ctx.lineTo(d.size * 0.5, 0);
        ctx.lineTo(d.size * 0.5, -d.size * 0.4);
        ctx.stroke();
      } else if (d.type === 'tree') {
        // Forest Tree
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.arc(0, 0, d.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.arc(-d.size * 0.1, -d.size * 0.1, d.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'neon-sign') {
        // Cyberpunk billboard
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3;
        ctx.strokeRect(-d.size * 0.8, -d.size * 0.3, d.size * 1.6, d.size * 0.6);
        ctx.fillRect(-d.size * 0.8, -d.size * 0.3, d.size * 1.6, d.size * 0.6);
        ctx.fillStyle = '#ec4899';
        ctx.font = `bold ${Math.floor(d.size * 0.3)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TOKYO', 0, 0);
      } else if (d.type === 'spectator-stand') {
        // Grandstand
        ctx.fillStyle = '#27272a';
        ctx.strokeStyle = '#52525b';
        ctx.lineWidth = 2;
        ctx.fillRect(-d.size * 0.7, -d.size * 0.3, d.size * 1.4, d.size * 0.6);
        ctx.strokeRect(-d.size * 0.7, -d.size * 0.3, d.size * 1.4, d.size * 0.6);
        // Bench lines
        ctx.strokeStyle = '#3f3f46';
        ctx.beginPath();
        ctx.moveTo(-d.size * 0.6, -d.size * 0.1);
        ctx.lineTo(d.size * 0.6, -d.size * 0.1);
        ctx.moveTo(-d.size * 0.6, d.size * 0.15);
        ctx.lineTo(d.size * 0.6, d.size * 0.15);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 3. DRAW THE ROAD
    // A. Draw Red & White striped curbs by drawing a slightly wider line first, and dashing it
    ctx.strokeStyle = '#ef4444'; // Red dash
    ctx.lineWidth = track.roadWidth + 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    waypoints.forEach((wp, idx) => {
      if (idx === 0) ctx.moveTo(wp.x, wp.y);
      else ctx.lineTo(wp.x, wp.y);
    });
    ctx.closePath();
    ctx.stroke();

    // White curb overlay
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([15, 15]); // Dash patterns make alternating red/white!
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // B. Draw Main Asphalt Road
    ctx.strokeStyle = track.bgTheme === 'neon' ? '#18181b' : '#3f3f46'; // Asphalt dark slate or gray
    ctx.lineWidth = track.roadWidth;
    ctx.beginPath();
    waypoints.forEach((wp, idx) => {
      if (idx === 0) ctx.moveTo(wp.x, wp.y);
      else ctx.lineTo(wp.x, wp.y);
    });
    ctx.closePath();
    ctx.stroke();

    // C. Draw White dashed center strip
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 18]);
    ctx.beginPath();
    waypoints.forEach((wp, idx) => {
      if (idx === 0) ctx.moveTo(wp.x, wp.y);
      else ctx.lineTo(wp.x, wp.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // D. Draw Start-Finish Line Checkered Grid
    // We draw across the road between waypoint 0 and previous waypoint
    const wp0 = waypoints[0];
    const prevWp = waypoints[waypoints.length - 1];
    const heading = Math.atan2(wp0.y - prevWp.y, wp0.x - prevWp.x);
    const perp = heading + Math.PI / 2;

    const startLeftX = wp0.x + Math.cos(perp) * (track.roadWidth * 0.5);
    const startLeftY = wp0.y + Math.sin(perp) * (track.roadWidth * 0.5);
    const startRightX = wp0.x - Math.cos(perp) * (track.roadWidth * 0.5);
    const startRightY = wp0.y - Math.sin(perp) * (track.roadWidth * 0.5);

    ctx.save();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#000000'; // black checker band
    ctx.beginPath();
    ctx.moveTo(startLeftX, startLeftY);
    ctx.lineTo(startRightX, startRightY);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff'; // white checkered dash
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.restore();

    // 4. DRAW OBSTACLES AND PICKUPS
    const pickups = pickupsRef.current;
    const obstacles = obstaclesRef.current;

    // Draw Pickups (Coins/Nitro)
    pickups.forEach((p) => {
      if (!p.collected) {
        ctx.save();
        ctx.translate(p.x, p.y);

        if (p.type === 'coin') {
          // Gold coin
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Innner details
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
          // Dollar/C mark
          ctx.fillStyle = '#b45309';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('C', 0, 0);
        } else if (p.type === 'nitro') {
          // Blue Nitro canister
          ctx.fillStyle = '#06b6d4';
          ctx.strokeStyle = '#0891b2';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Lightning bolt sign inside
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-2, -8);
          ctx.lineTo(3, -2);
          ctx.lineTo(-1, 0);
          ctx.lineTo(2, 8);
          ctx.lineTo(-3, 2);
          ctx.lineTo(1, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }
    });

    // Draw Obstacles (Oil slick / Barrier)
    obstacles.forEach((o) => {
      ctx.save();
      ctx.translate(o.x, o.y);

      if (o.type === 'oil') {
        // Dark purple oil puddle
        ctx.fillStyle = 'rgba(74, 4, 78, 0.65)';
        ctx.strokeStyle = 'rgba(120, 113, 108, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, o.width * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Inner oil bubbles
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.beginPath();
        ctx.arc(-4, -2, 6, 0, Math.PI * 2);
        ctx.arc(6, 4, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.type === 'barrier') {
        // Concrete red-white barrier block
        ctx.fillStyle = '#52525b';
        ctx.fillRect(-o.width * 0.5, -o.height * 0.5, o.width, o.height);
        // Strips
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-o.width * 0.5, -o.height * 0.5, o.width * 0.3, o.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(o.width * 0.2, -o.height * 0.5, o.width * 0.3, o.height);
      }

      ctx.restore();
    });

    // 5. DRAW SMOKE / SPARK PARTICLES
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;

      ctx.beginPath();
      if (p.type === 'dust') {
        ctx.arc(0, 0, p.size * (2 - p.life), 0, Math.PI * 2);
      } else if (p.type === 'fire') {
        ctx.arc(0, 0, p.size * p.life, 0, Math.PI * 2);
      } else { // spark
        ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.fill();
      ctx.restore();
    });

    // 6. DRAW ALL CARS (PLAYER + AI)
    const drawCarCard = (car: Car) => {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      // Tire tracks / shadows helper
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-15, -10, 30, 20);

      // Draw Tires
      ctx.fillStyle = '#09090b';
      // Rear tires
      ctx.fillRect(-12, -11, 6, 4);
      ctx.fillRect(-12, 7, 6, 4);
      // Front tires
      ctx.fillRect(8, -11, 6, 4);
      ctx.fillRect(8, 7, 6, 4);

      // Draw Main Car Chassis Body
      ctx.fillStyle = car.color;
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1.5;
      
      // Draw streamlined racing car silhouette
      ctx.beginPath();
      ctx.moveTo(-14, -8); // rear left
      ctx.lineTo(8, -8);   // front left wing
      ctx.lineTo(15, -4);  // nose cone left
      ctx.lineTo(15, 4);   // nose cone right
      ctx.lineTo(8, 8);    // front right wing
      ctx.lineTo(-14, 8);  // rear right
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Rear Spoiler / Wing
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-16, -10, 3, 20);

      // Cockpit Window Glass
      ctx.fillStyle = '#06b6d4'; // teal cyan glass
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.lineTo(4, -5);
      ctx.lineTo(7, 0);
      ctx.lineTo(4, 5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();

      // Shiny glare on glass
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(-2, -4);
      ctx.lineTo(2, -4);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fill();

      // Stunned spinning effect indicator
      if (car.spinDuration > 0 || car.stunnedDuration > 0) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Draw tag / name above car if it is close to player or in full-map mode
      if (cameraMode === 'follow' || car.id === 'player') {
        ctx.save();
        ctx.translate(car.x, car.y - 25);
        
        // Label background
        ctx.fillStyle = car.id === 'player' ? 'rgba(245, 158, 11, 0.85)' : 'rgba(24, 24, 27, 0.75)';
        ctx.font = 'bold 9px sans-serif';
        const txtWidth = ctx.measureText(car.name).width;
        ctx.fillRect(-txtWidth / 2 - 5, -6, txtWidth + 10, 12);
        
        ctx.fillStyle = car.id === 'player' ? '#000000' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${car.avatar} ${car.name}`, 0, 0);
        ctx.restore();
      }
    };

    // Draw AI cars then Player (so player is always drawn on top of clutter)
    aiCars.forEach(drawCarCard);
    drawCarCard(player);

    ctx.restore(); // Restore main transforms
    } // End bypassed 2D loop

    // --- DRAW ROTATING GPS RADAR MINIMAP ---
    const mmCanvas = minimapCanvasRef.current;
    if (mmCanvas) {
      const mmCtx = mmCanvas.getContext('2d');
      if (mmCtx) {
        const mmW = mmCanvas.width;
        const mmH = mmCanvas.height;
        const mmCX = mmW / 2;
        const mmCY = mmH / 2;
        const radarRadius = mmW / 2 - 4;

        mmCtx.clearRect(0, 0, mmW, mmH);

        // A. Draw dark circular map background with faint grid
        mmCtx.save();
        mmCtx.beginPath();
        mmCtx.arc(mmCX, mmCY, radarRadius, 0, Math.PI * 2);
        mmCtx.clip(); // Clip everything to the circular map boundary!

        mmCtx.fillStyle = '#060a12'; // Dark radar space
        mmCtx.fillRect(0, 0, mmW, mmH);

        // Draw radar grid lines
        mmCtx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
        mmCtx.lineWidth = 1;
        mmCtx.beginPath();
        mmCtx.arc(mmCX, mmCY, radarRadius * 0.4, 0, Math.PI * 2);
        mmCtx.arc(mmCX, mmCY, radarRadius * 0.75, 0, Math.PI * 2);
        mmCtx.stroke();

        // Crosshairs
        mmCtx.strokeStyle = 'rgba(6, 182, 212, 0.05)';
        mmCtx.beginPath();
        mmCtx.moveTo(0, mmCY);
        mmCtx.lineTo(mmW, mmCY);
        mmCtx.moveTo(mmCX, 0);
        mmCtx.lineTo(mmCX, mmH);
        mmCtx.stroke();

        // B. Translate and rotate world to follow player
        mmCtx.translate(mmCX, mmCY);
        // Rotate so player heading faces straight UP (-player.angle - Math.PI/2)
        const rotationAngle = -player.angle - Math.PI / 2;
        mmCtx.rotate(rotationAngle);
        // Centered on player
        mmCtx.translate(-player.x, -player.y);

        // C. Draw track waypoints (roads) as thick blueprint lines
        mmCtx.strokeStyle = '#0e7490'; // Deep blue/cyan road outline
        mmCtx.lineWidth = 14;
        mmCtx.lineCap = 'round';
        mmCtx.lineJoin = 'round';
        mmCtx.beginPath();
        waypoints.forEach((wp, idx) => {
          if (idx === 0) mmCtx.moveTo(wp.x, wp.y);
          else mmCtx.lineTo(wp.x, wp.y);
        });
        mmCtx.closePath();
        mmCtx.stroke();

        mmCtx.strokeStyle = '#22d3ee'; // Bright neon cyan road center path
        mmCtx.lineWidth = 6;
        mmCtx.stroke();

        // Draw start/finish line checkered spot on radar
        const mmWp0 = waypoints[0];
        mmCtx.fillStyle = '#ffffff';
        mmCtx.beginPath();
        mmCtx.arc(mmWp0.x, mmWp0.y, 6, 0, Math.PI * 2);
        mmCtx.fill();

        // D. Draw AI Competitor Dots
        aiCars.forEach((ai) => {
          mmCtx.fillStyle = ai.color;
          mmCtx.strokeStyle = '#ffffff';
          mmCtx.lineWidth = 1.5;
          mmCtx.beginPath();
          mmCtx.arc(ai.x, ai.y, 4.5, 0, Math.PI * 2);
          mmCtx.fill();
          mmCtx.stroke();
        });

        mmCtx.restore(); // Restore to normal screen space coordinates

        // E. Draw Static Player Chevron at Center pointing straight UP
        mmCtx.save();
        mmCtx.translate(mmCX, mmCY);
        mmCtx.fillStyle = '#ffffff';
        mmCtx.strokeStyle = '#06b6d4';
        mmCtx.lineWidth = 2;
        mmCtx.shadowColor = '#06b6d4';
        mmCtx.shadowBlur = 6;
        mmCtx.beginPath();
        mmCtx.moveTo(0, -8);  // Nose
        mmCtx.lineTo(-5, 6);  // Bottom-left
        mmCtx.lineTo(0, 3);   // Rear indentation
        mmCtx.lineTo(5, 6);   // Bottom-right
        mmCtx.closePath();
        mmCtx.fill();
        mmCtx.stroke();
        mmCtx.restore();

        // F. Draw Outer ring border and ticks
        mmCtx.strokeStyle = '#0891b2'; // Cyan border
        mmCtx.lineWidth = 3;
        mmCtx.beginPath();
        mmCtx.arc(mmCX, mmCY, radarRadius, 0, Math.PI * 2);
        mmCtx.stroke();
      }
    }

    // --- DRAW MODERN SPEEDOMETER & TACHOMETER ---
    const smCanvas = speedometerCanvasRef.current;
    if (smCanvas) {
      const smCtx = smCanvas.getContext('2d');
      if (smCtx) {
        const smW = smCanvas.width;
        const smH = smCanvas.height;
        const smCX = smW / 2;
        const smCY = smH / 2;
        const radius = 64;

        smCtx.clearRect(0, 0, smW, smH);

        // Calculate Gear and RPM dynamically
        const speed = playerSpeedMPH;
        let gear = 1;
        let rpm = 1000;
        if (speed <= 30) {
          gear = 1;
          rpm = 1000 + (speed / 30) * 5500;
        } else if (speed <= 60) {
          gear = 2;
          rpm = 3800 + ((speed - 30) / 30) * 3500;
        } else if (speed <= 95) {
          gear = 3;
          rpm = 4200 + ((speed - 60) / 35) * 3300;
        } else if (speed <= 135) {
          gear = 4;
          rpm = 4600 + ((speed - 95) / 40) * 3000;
        } else {
          gear = 5;
          rpm = 5000 + Math.min(1, (speed - 135) / 55) * 3200;
        }

        // Draw ambient blue background glow inside circle
        const bgGlow = smCtx.createRadialGradient(smCX, smCY, 10, smCX, smCY, radius);
        bgGlow.addColorStop(0, 'rgba(6, 182, 212, 0.0)');
        bgGlow.addColorStop(0.85, 'rgba(6, 182, 212, 0.05)');
        bgGlow.addColorStop(1, 'rgba(6, 182, 212, 0.15)');
        smCtx.fillStyle = bgGlow;
        smCtx.beginPath();
        smCtx.arc(smCX, smCY, radius, 0, Math.PI * 2);
        smCtx.fill();

        // Draw Tachometer Blue Circular Arc Track (from 135 to 405 degrees)
        const startAngle = Math.PI * 0.75; // 135 deg
        const endAngle = Math.PI * 2.25;   // 405 deg
        
        smCtx.strokeStyle = 'rgba(6, 182, 212, 0.2)'; // Faint track
        smCtx.lineWidth = 4;
        smCtx.lineCap = 'round';
        smCtx.beginPath();
        smCtx.arc(smCX, smCY, radius, startAngle, endAngle);
        smCtx.stroke();

        // Blue glow highlight on the active RPM range
        const maxRpm = 9000;
        const rpmPercent = Math.min(1, rpm / maxRpm);
        const activeEndAngle = startAngle + (endAngle - startAngle) * rpmPercent;
        
        smCtx.save();
        smCtx.strokeStyle = '#06b6d4'; // Glowing neon cyan
        smCtx.lineWidth = 4;
        smCtx.shadowColor = '#06b6d4';
        smCtx.shadowBlur = 6;
        smCtx.beginPath();
        smCtx.arc(smCX, smCY, radius, startAngle, activeEndAngle);
        smCtx.stroke();
        smCtx.restore();

        // Draw RPM scale ticks & numbers (1 to 10)
        smCtx.save();
        smCtx.textAlign = 'center';
        smCtx.textBaseline = 'middle';
        for (let i = 0; i <= 10; i++) {
          const tickPct = i / 10;
          const tickAngle = startAngle + (endAngle - startAngle) * tickPct;
          
          const isMajor = i % 2 === 0 || i === 9 || i === 10;
          const tickLen = isMajor ? 8 : 4;
          
          // Tick line
          const startX = smCX + Math.cos(tickAngle) * (radius - 2);
          const startY = smCY + Math.sin(tickAngle) * (radius - 2);
          const endX = smCX + Math.cos(tickAngle) * (radius - 2 - tickLen);
          const endY = smCY + Math.sin(tickAngle) * (radius - 2 - tickLen);
          
          smCtx.strokeStyle = i >= 8 ? '#ef4444' : '#22d3ee'; // Redline above 8
          smCtx.lineWidth = isMajor ? 1.5 : 1;
          smCtx.beginPath();
          smCtx.moveTo(startX, startY);
          smCtx.lineTo(endX, endY);
          smCtx.stroke();
          
          // Scale numbers
          if (isMajor && i > 0 && i <= 10) {
            const numX = smCX + Math.cos(tickAngle) * (radius - 12);
            const numY = smCY + Math.sin(tickAngle) * (radius - 12);
            smCtx.fillStyle = i >= 8 ? '#f87171' : '#a1a1aa';
            smCtx.font = 'bold 8px sans-serif';
            smCtx.fillText(i.toString(), numX, numY);
          }
        }
        smCtx.restore();

        // Draw Nitrous vertical arc gauge on the LEFT of speedometer (White/cyan)
        // From 110 deg to 250 deg (in left quadrant)
        const nsStart = Math.PI * 0.9;  // around 160 deg
        const nsEnd = Math.PI * 1.45;  // around 260 deg
        smCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        smCtx.lineWidth = 3.5;
        smCtx.beginPath();
        smCtx.arc(smCX, smCY, radius + 8, nsStart, nsEnd);
        smCtx.stroke();

        const nitroPercent = playerNitro / 100;
        const nsActiveEnd = nsStart + (nsEnd - nsStart) * nitroPercent;
        smCtx.save();
        smCtx.strokeStyle = '#ffffff'; // White nitro boost curved gauge
        smCtx.lineWidth = 3.5;
        smCtx.shadowColor = '#ffffff';
        smCtx.shadowBlur = 4;
        smCtx.beginPath();
        smCtx.arc(smCX, smCY, radius + 8, nsStart, nsActiveEnd);
        smCtx.stroke();
        smCtx.restore();

        // Draw RED/ORANGE Glowing needle pointing to current RPM
        const needleAngle = startAngle + (endAngle - startAngle) * rpmPercent;
        smCtx.save();
        smCtx.strokeStyle = '#ef4444'; // Glowing red needle
        smCtx.lineWidth = 2.5;
        smCtx.lineCap = 'round';
        smCtx.shadowColor = '#ef4444';
        smCtx.shadowBlur = 10;
        
        const needleStartX = smCX + Math.cos(needleAngle) * 5;
        const needleStartY = smCY + Math.sin(needleAngle) * 5;
        const needleEndX = smCX + Math.cos(needleAngle) * (radius - 6);
        const needleEndY = smCY + Math.sin(needleAngle) * (radius - 6);
        
        smCtx.beginPath();
        smCtx.moveTo(needleStartX, needleStartY);
        smCtx.lineTo(needleEndX, needleEndY);
        smCtx.stroke();
        
        // Needle center hub
        smCtx.fillStyle = '#1c1917';
        smCtx.strokeStyle = '#ef4444';
        smCtx.lineWidth = 1.5;
        smCtx.beginPath();
        smCtx.arc(smCX, smCY, 5, 0, Math.PI * 2);
        smCtx.fill();
        smCtx.stroke();
        smCtx.restore();

        // Draw DIGITAL SPEED TEXT (Large italic displays in center)
        smCtx.save();
        smCtx.fillStyle = '#ffffff';
        smCtx.font = 'black 28px sans-serif';
        smCtx.textAlign = 'center';
        smCtx.textBaseline = 'middle';
        
        // Draw centered skewing speed digits
        smCtx.font = '900 28px font-speed italic';
        smCtx.fillText(Math.floor(speed).toString(), smCX - 3, smCY - 8);
        
        // Units
        smCtx.fillStyle = 'rgba(6, 182, 212, 0.85)';
        smCtx.font = 'bold 8px sans-serif';
        smCtx.fillText('MPH', smCX + 24, smCY - 3);

        // Draw GEAR value (e.g. "4") below speed
        smCtx.fillStyle = '#ffffff';
        smCtx.font = '900 13px font-display';
        smCtx.fillText(gear.toString(), smCX, smCY + 11);
        smCtx.restore();
      }
    }
  };

  // Mobile Touch Controls Click handlers
  const handleTouchSteer = (dir: 'left' | 'right' | 'none') => {
    if (dir === 'left') {
      keysRef.current['a'] = true;
      keysRef.current['d'] = false;
    } else if (dir === 'right') {
      keysRef.current['d'] = true;
      keysRef.current['a'] = false;
    } else {
      keysRef.current['a'] = false;
      keysRef.current['d'] = false;
    }
  };

  const handleTouchDrive = (act: 'forward' | 'reverse' | 'none') => {
    if (act === 'forward') {
      keysRef.current['w'] = true;
      keysRef.current['s'] = false;
    } else if (act === 'reverse') {
      keysRef.current['s'] = true;
      keysRef.current['w'] = false;
    } else {
      keysRef.current['w'] = false;
      keysRef.current['s'] = false;
    }
  };

  // Dynamic Distance computations (using 0.45 meters per pixel conversion factor)
  const getTrackLengthKmLocal = (wps: any[]) => {
    let px = 0;
    for (let i = 0; i < wps.length; i++) {
      px += getDistance(wps[i], wps[(i + 1) % wps.length]);
    }
    return px * 0.00045;
  };
  const lapLengthKm = getTrackLengthKmLocal(track.waypoints);
  const totalRaceDistanceKm = lapLengthKm * selectedLevel * 0.5;
  const playerDistanceKm = ((playerLap - 1 + playerRef.current.currentWaypointIndex / track.waypoints.length) * lapLengthKm * 0.5);
  const finalDistanceKm = Math.min(totalRaceDistanceKm, playerDistanceKm).toFixed(2);

  return (
    <div className="w-full flex flex-col h-full bg-[#050506] text-[#fafafa] relative overflow-hidden select-none">
      
      {/* 1. NFS-STYLE TOP LEFT STANDINGS & RANKING DECK */}
      <div className="absolute left-6 top-6 z-10 flex flex-col pointer-events-none select-none">
        <div className="flex items-baseline gap-1 font-speed italic tracking-tighter text-white">
          <span className="text-6xl font-black">{playerPosition}</span>
          <span className="text-2xl font-bold text-zinc-500 font-sans">/5</span>
        </div>
        
        {/* Live Standings list */}
        <div className="flex flex-col gap-1.5 mt-4 w-44 font-display">
          {liveLeaderboard.map((racer) => {
            const isSelf = racer.isPlayer;
            const posSuffix = racer.position === 1 ? 'st' : racer.position === 2 ? 'nd' : racer.position === 3 ? 'rd' : 'th';
            
            if (isSelf) {
              return (
                <div key={racer.name} className="relative transform -skew-x-12 bg-red-600 border border-red-500 px-3 py-1 flex items-center justify-between text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all duration-200 scale-105 origin-left">
                  <span className="text-sm font-black italic tracking-tight transform skew-x-12">
                    {racer.position}{posSuffix}
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider transform skew-x-12">
                    {racer.name.toUpperCase()}
                  </span>
                </div>
              );
            } else {
              return (
                <div key={racer.name} className="relative transform -skew-x-12 bg-zinc-950/70 border border-zinc-900 px-2.5 py-0.5 flex items-center justify-between text-zinc-400 opacity-75">
                  <span className="text-xs font-black transform skew-x-12">
                    {racer.position}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide transform skew-x-12 text-zinc-300">
                    {racer.name}
                  </span>
                </div>
              );
            }
          })}
        </div>
      </div>

      {/* 2. NFS-STYLE TOP CENTER REP & HEAT STATUS BAR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 pointer-events-none select-none">
        {/* Left Stats (THIS NIGHT REP) */}
        <div className="flex flex-col items-end text-right">
          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest leading-none mb-0.5 font-display">THIS NIGHT</span>
          <span className="text-xl font-black font-speed italic tracking-tight text-white leading-none">
            {repPoints.toLocaleString()} <span className="text-red-500 font-sans font-bold">R</span>
          </span>
        </div>

        {/* Center Heat Level Flame Badge */}
        <div className="relative flex items-center justify-center">
          {/* Outer spinning/pulsing flame ring with glowing violet/pink shadow */}
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-red-500 animate-pulse flex items-center justify-center p-0.5 shadow-[0_0_18px_rgba(236,72,153,0.7)] border border-pink-400">
            <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center relative overflow-hidden">
              <span className="text-[10px] text-pink-400 opacity-40 absolute -top-1 animate-bounce">🔥</span>
              <span className="text-lg font-black font-speed italic text-pink-500 drop-shadow-[0_0_8px_#ec4899]">
                {heatLevel}
              </span>
            </div>
          </div>
          
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-pink-500 text-xs font-black select-none">‹</div>
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-pink-500 text-xs font-black select-none">›</div>
        </div>

        {/* Right Stats (NEXT LEVEL PROGRESS) */}
        <div className="flex flex-col items-start text-left">
          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest leading-none mb-0.5 font-display">NEXT LEVEL</span>
          <span className="text-xl font-black font-speed italic tracking-tight text-white leading-none">
            {Math.max(0, (heatLevel === 1 ? 5000 : heatLevel === 2 ? 15000 : heatLevel === 3 ? 30000 : heatLevel === 4 ? 50000 : 99999) - repPoints).toLocaleString()} <span className="text-pink-500 font-sans font-bold">R</span>
          </span>
        </div>
      </div>

      {/* 3. NFS-STYLE TOP RIGHT TIMER & PROGRESS INDICATOR */}
      <div className="absolute right-6 top-6 z-10 flex flex-col items-end pointer-events-none select-none">
        <span className="text-4xl font-black font-mono tracking-tighter text-white">
          {formatTime(raceTime)}
        </span>
        
        {/* Race Completion Percent */}
        <div className="flex items-center gap-1.5 mt-1 bg-zinc-950/80 px-2.5 py-0.5 border border-zinc-800 rounded-sm transform -skew-x-12 shadow-md">
          <span className="text-[8px] text-zinc-500 font-black tracking-widest transform skew-x-12 font-display">COMPLETED</span>
          <span className="text-xs font-black font-speed italic text-cyan-400 transform skew-x-12">
            {Math.min(100, Math.floor(((playerLap - 1) * track.waypoints.length + playerRef.current.currentWaypointIndex) / (selectedLevel * track.waypoints.length) * 100))}%
          </span>
        </div>

        {/* Dynamic Distance Kilometer Tracker */}
        <div className="flex items-center gap-1.5 mt-1 bg-zinc-950/80 px-2.5 py-0.5 border border-zinc-800 rounded-sm transform -skew-x-12 shadow-md">
          <span className="text-[8px] text-zinc-500 font-black tracking-widest transform skew-x-12 font-display">DISTANCE</span>
          <span className="text-xs font-black font-speed italic text-cyan-400 transform skew-x-12">
            {finalDistanceKm} / {totalRaceDistanceKm.toFixed(2)} KM
          </span>
        </div>
      </div>

      {/* 3.5 ESCAPE/EXIT BUTTON (TOP RIGHT CORNER) */}
      <button
        onClick={onExit}
        className="absolute right-6 top-24 z-10 p-2 bg-zinc-950/90 border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-red-400 transition shadow-md transform -skew-x-12 pointer-events-auto"
        title="Exit Race"
      >
        <span className="transform skew-x-12 flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase px-1">
          <ArrowLeft className="w-3.5 h-3.5" /> ESCAPE
        </span>
      </button>

      {/* 3.6 CAMERA & STEERING OPTIONS CONTROL DECK */}
      <div className="absolute right-6 top-36 z-10 flex flex-col gap-3 pointer-events-auto text-right">
        {/* Camera selection buttons */}
        <div className="flex flex-col gap-1 items-end">
          <span className="text-[8px] text-zinc-500 font-black tracking-widest font-display uppercase">CAMERA VIEW</span>
          <div className="flex gap-1 bg-zinc-950/95 p-1 border border-zinc-800 rounded-sm transform -skew-x-12 shadow-lg">
            {(['follow', 'cockpit', 'full'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCameraMode(mode)}
                className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transform skew-x-12 transition-all duration-150 ${
                  cameraMode === mode
                    ? 'bg-cyan-500 text-black font-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                {mode === 'follow' ? 'Chase' : mode === 'cockpit' ? 'Cockpit' : 'Overview'}
              </button>
            ))}
          </div>
        </div>

        {/* On-screen steering controls overlay toggle */}
        <div className="flex flex-col gap-1 items-end">
          <span className="text-[8px] text-zinc-500 font-black tracking-widest font-display uppercase">STEERING OVERLAY</span>
          <button
            onClick={() => setShowSteeringControls((prev) => !prev)}
            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider transform -skew-x-12 border transition-all duration-150 ${
              showSteeringControls
                ? 'bg-red-600 border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                : 'bg-zinc-950/95 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <span className="transform skew-x-12 block">
              {showSteeringControls ? 'STEERING PANEL: ON' : 'STEERING PANEL: OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* 4. CIRCULAR GPS MINI-MAP RADAR (BOTTOM LEFT) */}
      <div className="absolute left-6 bottom-6 z-10 flex flex-col items-center pointer-events-none select-none">
        <div className="relative w-36 h-36 rounded-full border-[3px] border-zinc-800/90 bg-zinc-950/95 shadow-[0_4px_30px_rgba(0,0,0,0.85)] p-0.5 overflow-hidden flex items-center justify-center">
          <canvas ref={minimapCanvasRef} width={140} height={140} className="rounded-full" />
        </div>
        <span className="text-[10px] font-black font-display text-cyan-400 tracking-wider mt-2.5 uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          📍 {track.name.toUpperCase()}
        </span>
      </div>

      {/* 5. NEON SPEEDOMETER & TACHOMETER DECK (BOTTOM RIGHT) */}
      <div className="absolute right-6 bottom-6 z-10 flex flex-col items-center pointer-events-none select-none">
        <div className="relative w-44 h-44 flex items-center justify-center">
          
          {/* Speedometer Canvas drawing */}
          <canvas ref={speedometerCanvasRef} width={180} height={180} className="drop-shadow-[0_4px_30px_rgba(6,182,212,0.35)]" />

          {/* Dual Nitrous bottle indicators centered at bottom of speedometer */}
          <div className="absolute bottom-1 flex items-center gap-1.5 bg-zinc-950/95 px-2.5 py-0.5 border border-zinc-800 rounded-sm transform -skew-x-12 shadow-lg">
            <span className="text-[7px] text-zinc-500 font-black tracking-widest transform skew-x-12 font-display">N₂O</span>
            <div className={`w-2 h-3 border border-cyan-400 rounded-2xs ${playerNitro > 10 ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-transparent'}`} />
            <div className={`w-2 h-3 border border-cyan-400 rounded-2xs ${playerNitro > 50 ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-transparent'}`} />
          </div>

          {/* Small utility action buttons positioned around speedometer like the icons in screenshot */}
          <div className="absolute -left-3 bottom-4 pointer-events-auto">
            <button
              onClick={() => setCameraMode((prev) => (prev === 'follow' ? 'full' : 'follow'))}
              className="p-1.5 bg-zinc-950/90 border border-zinc-800 hover:border-cyan-500 text-zinc-500 hover:text-white rounded-full transition shadow-md"
              title="Toggle Camera"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="absolute -right-3 bottom-4 pointer-events-auto">
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-1.5 bg-zinc-950/90 border border-zinc-800 rounded-full transition shadow-md ${
                soundEnabled ? 'text-zinc-500 hover:text-white hover:border-cyan-500' : 'text-red-500 border-red-900 hover:border-red-500'
              }`}
              title="Toggle Audio popups"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>

        </div>
      </div>

      {/* 6. LIVE CO-PILOT SUBTITLES OVERLAY (MIDDLE BOTTOM) */}
      {subtitles && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl text-center px-4 pointer-events-none">
          <div className="relative transform -skew-x-12 bg-zinc-950/95 border-l-4 border-cyan-500 p-3 shadow-[0_4px_30px_rgba(0,0,0,0.7)] animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="absolute right-2 top-2 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
            </div>
            <span className="text-[8px] text-cyan-400 font-black font-display uppercase tracking-widest block mb-1 text-left transform skew-x-12">
              RADIO LINK // {commentatorPersonality.toUpperCase()}
            </span>
            <p className="text-xs md:text-sm font-semibold italic text-zinc-100 text-left transform skew-x-12 font-sans leading-relaxed">
              "{subtitles}"
            </p>
          </div>
        </div>
      )}

      {/* 7. VISUAL SOUND EFFECTS POPUPS */}
      {soundEnabled && soundPopups.map((p) => {
        // Project local coordinates to camera viewport coordinates
        let screenX = p.x;
        let screenY = p.y;

        if (cameraMode === 'follow') {
          // Centered relative to player car coordinates
          screenX = canvasSize.width / 2 + (p.x - playerRef.current.x);
          screenY = canvasSize.height / 2 + (p.y - playerRef.current.y);
        } else {
          // Full-map scaling calculations
          const waypoints = track.waypoints;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          waypoints.forEach(wp => {
            if (wp.x < minX) minX = wp.x;
            if (wp.x > maxX) maxX = wp.x;
            if (wp.y < minY) minY = wp.y;
            if (wp.y > maxY) maxY = wp.y;
          });
          const trackW = maxX - minX + 250;
          const trackH = maxY - minY + 250;
          const scale = Math.min(canvasSize.width / trackW, canvasSize.height / trackH, 1.0);

          const cX = canvasSize.width / 2;
          const cY = canvasSize.height / 2;
          const midX = (minX + maxX) / 2;
          const midY = (minY + maxY) / 2;

          screenX = cX + (p.x - midX) * scale;
          screenY = cY + (p.y - midY) * scale;
        }

        // Clip to avoid screen bleeding
        if (screenX < 20 || screenX > canvasSize.width - 20 || screenY < 20 || screenY > canvasSize.height - 20) {
          return null;
        }

        return (
          <div
            key={p.id}
            className={`absolute z-30 font-extrabold text-sm pointer-events-none tracking-tight animate-bounce ${p.color}`}
            style={{ left: screenX, top: screenY - 15 }}
          >
            {p.text}
          </div>
        );
      })}

      {/* 8. THREE-TWO-ONE START COUNTDOWN OVERLAY */}
      {countdown > 0 && (
        <div className="absolute inset-0 z-40 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
          <div className="text-center animate-pulse scale-105">
            <span className="text-[11px] font-black tracking-widest text-zinc-400 uppercase block mb-2">Championship Qualifier</span>
            <h1 className="text-7xl font-black italic tracking-tighter text-amber-500 select-none">
              {countdown === 4 ? 'READY' : countdown === 0 ? 'GO!' : countdown}
            </h1>
            <p className="text-zinc-500 text-[10px] mt-2 font-mono">Use WASD or Arrows keys. [SPACE] to nitro boost.</p>
          </div>
        </div>
      )}

      {/* 8.5 IMMERSIVE COCKPIT VIEW OVERLAY */}
      {cameraMode === 'cockpit' && (
        <div className="absolute inset-0 pointer-events-none z-15 flex flex-col justify-between">
          {/* Upper windshield shadow & mirror frame */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none" />
          
          {/* Left A-pillar */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-zinc-950 via-zinc-900/80 to-transparent border-r border-zinc-800/20 hidden md:block" 
               style={{ clipPath: 'polygon(0 0, 100% 0, 45% 100%, 0 100%)' }} />
          
          {/* Right A-pillar */}
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-zinc-950 via-zinc-900/80 to-transparent border-l border-zinc-800/20 hidden md:block"
               style={{ clipPath: 'polygon(100% 0, 0 0, 55% 100%, 100% 100%)' }} />

          {/* Glowing central rearview mirror bracket */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-10 bg-zinc-900 border-b border-x border-zinc-800 rounded-b-xl shadow-lg flex flex-col items-center justify-center">
            <span className="text-[6px] text-zinc-500 font-bold uppercase tracking-widest font-mono">REARVIEW ACTIVE</span>
            <div className="w-40 h-4 bg-zinc-950 rounded border border-zinc-850 flex items-center justify-between px-2 overflow-hidden">
              <span className="text-[5px] text-zinc-600 font-bold font-sans">L: SAFE</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[5px] text-zinc-600 font-bold font-sans">R: SAFE</span>
            </div>
          </div>

          {/* Lower Dashboard Consolidation */}
          <div className="mt-auto w-full flex flex-col items-center pb-0 relative">
            {/* Dashboard carbon texture bar stretching across screen bottom */}
            <div className="w-full h-16 bg-gradient-to-t from-zinc-950 via-zinc-900 to-transparent border-t border-zinc-900 flex justify-center relative">
              {/* Central gauge cluster container */}
              <div className="absolute bottom-0 w-full max-w-lg h-14 bg-zinc-950 border-t border-x border-zinc-800 rounded-t-2xl shadow-[0_-8px_20px_rgba(0,0,0,0.8)] flex justify-between items-center px-10">
                <div className="flex flex-col text-[7px] font-mono text-cyan-400 gap-0.5">
                  <span>ENGINE TEMP: 94°C</span>
                  <span>PSI BOOST: {(Math.floor(playerRef.current.speed * 1.5)).toFixed(1)}</span>
                </div>
                
                {/* Center glowing logo */}
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-black italic text-zinc-300 tracking-tighter font-sans">VITAL GT-R</span>
                  <div className="w-8 h-0.5 bg-red-600" />
                </div>

                <div className="flex flex-col text-[7px] font-mono text-zinc-400 gap-0.5 text-right">
                  <span>LAP {playerLap}/{selectedLevel}</span>
                  <span className="text-emerald-400">POSITION {playerPosition}/5</span>
                </div>
              </div>
            </div>

            {/* Glowing Interactive Steering Wheel centered above dashboard */}
            <div className="absolute bottom-2 flex flex-col items-center">
              <div
                className="w-36 h-36 rounded-full border-[14px] border-zinc-900 shadow-[inset_0_0_15px_rgba(0,0,0,0.95),0_6px_15px_rgba(0,0,0,0.9)] flex items-center justify-center relative transition-transform duration-75 ease-out"
                style={{
                  transform: `rotate(${(playerRef.current.currentSteer || 0) * 85}deg)`,
                  background: 'radial-gradient(circle, #1f1f23 0%, #0c0c0e 80%)',
                  borderColor: '#18181b',
                }}
              >
                {/* Red top stripe alignment marker */}
                <div className="absolute top-0 w-2.5 h-3 bg-red-600 rounded-b-xs" />

                {/* Left/Right Alcantara Grips */}
                <div className="absolute left-0 top-1/3 bottom-1/3 w-2.5 bg-zinc-800 rounded-r-sm border-r border-zinc-700" />
                <div className="absolute right-0 top-1/3 bottom-1/3 w-2.5 bg-zinc-800 rounded-l-sm border-l border-zinc-700" />

                {/* Spokes */}
                <div className="absolute w-full h-5 bg-zinc-850 flex justify-between items-center px-3 border-y border-zinc-800">
                  <div className="w-3 h-3 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-[5px] font-sans font-black text-cyan-400">LC</div>
                  <div className="w-3 h-3 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-[5px] font-sans font-black text-cyan-400">RC</div>
                </div>
                <div className="absolute top-1/2 bottom-0 w-6 bg-zinc-850 border-x border-zinc-800" />

                {/* Central Carbon Hub with logo */}
                <div className="w-12 h-12 rounded-full bg-zinc-950 border-2 border-zinc-800 flex flex-col items-center justify-center shadow-md relative z-10">
                  <span className="text-[7px] font-black italic text-cyan-400 leading-none font-sans">RACING</span>
                  <span className="text-[4px] text-zinc-500 font-bold uppercase tracking-widest leading-none font-sans">HUD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. CANVAS CONTAINER FOR HIGH-FPS RENDER */}
      <div ref={containerRef} className="flex-1 w-full h-full relative bg-zinc-950 overflow-hidden cursor-crosshair">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* 10. ARCADE TOUCH GAMEPAD & ON-SCREEN STEERING CONTROLS */}
      {showSteeringControls && (
        <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          {/* Left steering cluster */}
          <div className="flex items-center gap-3 pointer-events-auto bg-zinc-950/80 p-2.5 border border-zinc-900 rounded-2xl shadow-xl backdrop-blur-sm">
            <button
              onTouchStart={() => handleTouchSteer('left')}
              onTouchEnd={() => handleTouchSteer('none')}
              onMouseDown={() => handleTouchSteer('left')}
              onMouseUp={() => handleTouchSteer('none')}
              onMouseLeave={() => handleTouchSteer('none')}
              className="w-12 h-12 bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500 text-cyan-400 active:scale-95 transition flex items-center justify-center text-lg font-black rounded-xl"
              title="Steer Left (A / Left Arrow)"
            >
              ◀
            </button>
            
            {/* Embedded Visual Rotating Steering Wheel */}
            <div className="relative w-14 h-14 flex items-center justify-center bg-zinc-900 rounded-full border border-zinc-800">
              <div
                className="w-12 h-12 rounded-full border-4 border-zinc-700 flex items-center justify-center relative transition-transform duration-75 ease-out"
                style={{
                  transform: `rotate(${(playerRef.current.currentSteer || 0) * 85}deg)`,
                  background: 'radial-gradient(circle, #27272a 0%, #09090b 80%)'
                }}
              >
                {/* Red stripe top indicator */}
                <div className="absolute top-0 w-1.5 h-1.5 bg-red-500 rounded-b-3xs" />
                {/* Simple Horizontal spoke line */}
                <div className="absolute w-full h-1 bg-zinc-800" />
                {/* Center cap */}
                <div className="w-4 h-4 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-cyan-400" />
                </div>
              </div>
            </div>

            <button
              onTouchStart={() => handleTouchSteer('right')}
              onTouchEnd={() => handleTouchSteer('none')}
              onMouseDown={() => handleTouchSteer('right')}
              onMouseUp={() => handleTouchSteer('none')}
              onMouseLeave={() => handleTouchSteer('none')}
              className="w-12 h-12 bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500 text-cyan-400 active:scale-95 transition flex items-center justify-center text-lg font-black rounded-xl"
              title="Steer Right (D / Right Arrow)"
            >
              ▶
            </button>
          </div>

          {/* Action Nitro Button */}
          <button
            onTouchStart={() => { keysRef.current['space'] = true; keysRef.current['w'] = true; }}
            onTouchEnd={() => { keysRef.current['space'] = false; keysRef.current['w'] = false; }}
            onMouseDown={() => { keysRef.current['space'] = true; keysRef.current['w'] = true; }}
            onMouseUp={() => { keysRef.current['space'] = false; keysRef.current['w'] = false; }}
            onMouseLeave={() => { keysRef.current['space'] = false; keysRef.current['w'] = false; }}
            className="w-14 h-14 bg-cyan-600/90 border border-cyan-400/80 rounded-full flex flex-col items-center justify-center text-[8px] text-white font-black active:bg-cyan-500 hover:bg-cyan-500 hover:scale-105 transition shadow-[0_0_15px_#06b6d4] pointer-events-auto transform -skew-x-6"
            title="Nitro Boost (SPACEBAR)"
          >
            <Flame className="w-5 h-5 text-white mb-0.5 animate-pulse" />
            BOOST
          </button>

          {/* Right Pedal Cluster */}
          <div className="flex items-center gap-3 pointer-events-auto bg-zinc-950/80 p-2.5 border border-zinc-900 rounded-2xl shadow-xl backdrop-blur-sm transform -skew-x-6">
            <button
              onTouchStart={() => handleTouchDrive('reverse')}
              onTouchEnd={() => handleTouchDrive('none')}
              onMouseDown={() => handleTouchDrive('reverse')}
              onMouseUp={() => handleTouchDrive('none')}
              onMouseLeave={() => handleTouchDrive('none')}
              className="w-12 h-12 bg-red-950/90 border border-red-900 text-red-400 hover:text-red-300 font-bold active:scale-95 transition flex flex-col items-center justify-center text-[8px] rounded-xl"
              title="Brake / Reverse (S / Down Arrow)"
            >
              <span>BRAKE</span>
              <span className="text-[10px] mt-0.5 font-normal">⬇</span>
            </button>
            <button
              onTouchStart={() => handleTouchDrive('forward')}
              onTouchEnd={() => handleTouchDrive('none')}
              onMouseDown={() => handleTouchDrive('forward')}
              onMouseUp={() => handleTouchDrive('none')}
              onMouseLeave={() => handleTouchDrive('none')}
              className="w-14 h-14 bg-emerald-600/95 border border-emerald-400/80 text-white font-black hover:bg-emerald-500 active:scale-95 transition flex flex-col items-center justify-center text-[9px] rounded-xl shadow-lg"
              title="Drive / Move (W / Up Arrow)"
            >
              <span>DRIVE</span>
              <span className="text-sm font-normal">⬆</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
