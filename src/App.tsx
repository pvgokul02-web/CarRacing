import { useState, useEffect } from 'react';
import { TRACKS } from './utils/trackData';
import { UpgradeState, RaceResult, ScreenType } from './types';
import { GarageShop } from './components/GarageShop';
import { RaceEndModal } from './components/RaceEndModal';
import { RacingGameCanvas } from './components/RacingGameCanvas';
import { 
  Trophy, 
  Wrench, 
  Shield, 
  Flag, 
  Radio, 
  Compass, 
  Coins, 
  Play, 
  Flame, 
  Gauge, 
  Sparkles, 
  Activity, 
  ChevronRight, 
  Cpu, 
  Zap, 
  Volume2 
} from 'lucide-react';

export default function App() {
  // Screen Router
  const [screen, setScreen] = useState<ScreenType>('menu');

  // Persistence State variables
  const [playerCoins, setPlayerCoins] = useState<number>(() => {
    const saved = localStorage.getItem('car_racing_coins');
    return saved ? parseInt(saved, 10) : 100; // starts with 100 gold
  });

  const [upgrades, setUpgrades] = useState<UpgradeState>(() => {
    const saved = localStorage.getItem('car_racing_upgrades');
    return saved ? JSON.parse(saved) : { speedLevel: 1, accelLevel: 1, handlingLevel: 1, nitroLevel: 1 };
  });

  const [selectedColor, setSelectedColor] = useState<string>(() => {
    return localStorage.getItem('car_racing_color') || '#ef4444'; // classic racing red
  });

  const [unlockedTrackIds, setUnlockedTrackIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('car_racing_unlocked');
    return saved ? JSON.parse(saved) : ['oval_speedway']; // Only first track by default
  });

  const [commentator, setCommentator] = useState<string>(() => {
    return localStorage.getItem('car_racing_commentator') || 'Excited GP Announcer';
  });

  // Track select
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(0);
  const [selectedLevel, setSelectedLevel] = useState<number>(3); // 1 to 5, default to 3

  const getTrackLengthKm = (waypoints: any[]) => {
    if (!waypoints || waypoints.length === 0) return 0;
    let totalPx = 0;
    for (let i = 0; i < waypoints.length; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[(i + 1) % waypoints.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      totalPx += Math.sqrt(dx * dx + dy * dy);
    }
    return totalPx * 0.00045; // 0.45 meters per pixel
  };

  // Active race variables
  const [activeRaceResults, setActiveRaceResults] = useState<RaceResult[]>([]);
  const [activeCoinsEarned, setActiveCoinsEarned] = useState<number>(0);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Sync state changes to local storage for persistence
  useEffect(() => {
    localStorage.setItem('car_racing_coins', playerCoins.toString());
  }, [playerCoins]);

  useEffect(() => {
    localStorage.setItem('car_racing_upgrades', JSON.stringify(upgrades));
  }, [upgrades]);

  useEffect(() => {
    localStorage.setItem('car_racing_color', selectedColor);
  }, [selectedColor]);

  useEffect(() => {
    localStorage.setItem('car_racing_unlocked', JSON.stringify(unlockedTrackIds));
  }, [unlockedTrackIds]);

  useEffect(() => {
    localStorage.setItem('car_racing_commentator', commentator);
  }, [commentator]);

  // Upgrade Purchase Logic
  const handlePurchaseUpgrade = (stat: keyof UpgradeState, cost: number) => {
    if (playerCoins >= cost && upgrades[stat] < 5) {
      setPlayerCoins((prev) => prev - cost);
      setUpgrades((prev) => ({
        ...prev,
        [stat]: prev[stat] + 1,
      }));
    }
  };

  // Complete Race callback logic
  const handleRaceFinish = (results: RaceResult[], coinsEarned: number) => {
    setActiveRaceResults(results);
    setActiveCoinsEarned(coinsEarned);
    
    // Add coins to wallet
    setPlayerCoins((prev) => prev + coinsEarned);

    // Find if player qualified (top 3) to unlock next track
    const playerRank = results.find(r => r.isPlayer)?.position || 5;
    
    if (playerRank <= 3) {
      // Unlock next level if available
      const nextIdx = selectedTrackIndex + 1;
      if (nextIdx < TRACKS.length) {
        const nextTrack = TRACKS[nextIdx];
        if (!unlockedTrackIds.includes(nextTrack.id)) {
          setUnlockedTrackIds((prev) => [...prev, nextTrack.id]);
        }
      }
    }

    setIsResultModalOpen(true);
    setScreen('results');
  };

  // Next level navigation
  const handleNextTrack = () => {
    const nextIdx = selectedTrackIndex + 1;
    if (nextIdx < TRACKS.length) {
      setSelectedTrackIndex(nextIdx);
      setIsResultModalOpen(false);
      setScreen('racing');
    }
  };

  const handleRetryTrack = () => {
    setIsResultModalOpen(false);
    setScreen('racing');
  };

  // Previews level colors
  const getThemeBg = (theme: string) => {
    switch (theme) {
      case 'desert': return 'from-amber-500/20 to-orange-950/40 border-amber-500/40';
      case 'neon': return 'from-cyan-950/30 to-indigo-950/50 border-cyan-500/40';
      default: return 'from-emerald-950/30 to-zinc-900/40 border-emerald-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#050506] text-[#fafafa] flex flex-col antialiased selection:bg-red-600 selection:text-white">
      
      {/* 1. TOP GLOBAL MENU HEADER (NFS UNDERGROUND STYLE) */}
      {screen !== 'racing' && (
        <header className="relative bg-zinc-950/90 border-b-2 border-red-600 py-3 px-6 select-none shadow-[0_4px_30px_rgba(239,68,68,0.15)] overflow-hidden">
          {/* Top subtle red/cyan laser line effect */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-600 via-amber-500 to-cyan-500"></div>
          
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 relative">
            <div className="flex items-center gap-4">
              {/* Slanted racing badge */}
              <div className="relative transform -skew-x-12 bg-red-600 text-black px-4 py-2 font-black tracking-tighter text-xl shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-1">
                <Trophy className="w-5 h-5 transform skew-x-12 animate-pulse text-white" />
                <span className="text-white font-speed uppercase italic">HYPER AI</span>
              </div>
              
              <div className="hidden sm:block">
                <h1 className="text-sm font-black font-display tracking-widest text-zinc-300 uppercase leading-none">
                  CHAMPIONSHIP SERIES
                </h1>
                <p className="text-[10px] text-cyan-400 font-mono tracking-wider uppercase mt-1 flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse text-cyan-400" /> WebGL 2D PHYSICS MOTOR / CO-PILOT RADIO
                </p>
              </div>
            </div>

            {/* Currency Count & Tune button */}
            <div className="flex items-center gap-3">
              {/* Cash count styled like NFS credits */}
              <div className="relative transform -skew-x-12 bg-zinc-900 border border-zinc-800 px-5 py-1.5 flex items-center gap-2 shadow-[inset_0_0_10px_rgba(245,158,11,0.05)]">
                <Coins className="w-4 h-4 text-amber-500 transform skew-x-12 animate-pulse" />
                <span className="text-sm font-black font-mono text-amber-400 transform skew-x-12 tracking-wide">
                  🪙 <span className="font-display font-black text-white">{playerCoins}</span> <span className="text-[10px] text-zinc-500 uppercase font-sans font-bold">CR</span>
                </span>
              </div>
              
              {screen === 'menu' && (
                <button
                  id="header-tune-garage-btn"
                  onClick={() => setScreen('garage')}
                  className="relative transform -skew-x-12 bg-zinc-900 hover:bg-red-600 border border-zinc-800 hover:border-red-500 px-4 py-1.5 rounded-sm text-xs font-black uppercase tracking-wider text-zinc-300 hover:text-white transition-all duration-200 group flex items-center gap-2"
                >
                  <Wrench className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transform skew-x-12" /> 
                  <span className="transform skew-x-12">TUNE GARAGE</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* 2. MENU SCREEN - CORE LEVEL SELECTION & DIALOGUES */}
      {screen === 'menu' && (
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-8">
          
          {/* Welcome Dashboard Panel */}
          <div className="relative p-6 md:p-8 nfs-carbon border border-zinc-800/80 rounded-sm overflow-hidden shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6 ring-1 ring-zinc-800">
            {/* Diagonal stripes on one corner */}
            <div className="absolute right-0 top-0 w-32 h-32 nfs-stripes pointer-events-none opacity-20"></div>
            {/* Left border indicator line */}
            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-red-600 shadow-[0_0_10px_#ef4444]"></div>
            
            <div className="flex-1 max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black font-display text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1 border border-red-500/20 transform -skew-x-12">
                <Cpu className="w-3.5 h-3.5 animate-pulse text-red-500" /> STATUS: ACTIVE DRIVER REGISTRATION
              </span>
              <h2 className="text-3xl md:text-4xl font-black font-speed italic uppercase text-white tracking-tighter mt-4 leading-tight">
                DOMINATE THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">UNDERGROUND ARCADE</span>
              </h2>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed font-sans">
                Take the steering wheel in responsive top-down high-speed combat. Drift around dangerous corners to evade static hazards, collect gold coin caches, and outrun 4 relentless AI competitors to secure a podium placement!
              </p>
            </div>

            {/* Diagnostics HUD Panel */}
            <div className="w-full lg:w-auto bg-zinc-950/90 border border-zinc-800 p-5 rounded-sm flex flex-col gap-4 min-w-[280px] shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-500"></div>
              
              <span className="text-[10px] font-black font-display text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400 animate-pulse" /> VEHICLE SPECTRA DIAGNOSTIC
              </span>

              {/* Status values with visual performance blocks */}
              <div className="space-y-3">
                {/* Speed indicator */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-zinc-500 font-bold uppercase flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-rose-500" /> Top Speed
                    </span>
                    <span className="text-rose-400 font-black">LVL {upgrades.speedLevel}/5</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 rounded-sm overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`flex-1 h-full transition-all duration-300 ${
                          lvl <= upgrades.speedLevel ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Acceleration indicator */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-zinc-500 font-bold uppercase flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" /> Inst. Torque
                    </span>
                    <span className="text-amber-400 font-black">LVL {upgrades.accelLevel}/5</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 rounded-sm overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`flex-1 h-full transition-all duration-300 ${
                          lvl <= upgrades.accelLevel ? 'bg-gradient-to-r from-amber-500 to-amber-300' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Nitrous indicator */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-zinc-500 font-bold uppercase flex items-center gap-1">
                      <Flame className="w-3 h-3 text-cyan-500" /> Nitro Tank
                    </span>
                    <span className="text-cyan-400 font-black">LVL {upgrades.nitroLevel}/5</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 rounded-sm overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`flex-1 h-full transition-all duration-300 ${
                          lvl <= upgrades.nitroLevel ? 'bg-gradient-to-r from-cyan-500 to-cyan-300' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Steering info */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-zinc-500 font-bold uppercase flex items-center gap-1">
                      <Compass className="w-3 h-3 text-emerald-500" /> Tyre compounds
                    </span>
                    <span className="text-emerald-400 font-black">LVL {upgrades.handlingLevel}/5</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 rounded-sm overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`flex-1 h-full transition-all duration-300 ${
                          lvl <= upgrades.handlingLevel ? 'bg-gradient-to-r from-emerald-500 to-emerald-300' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Configure link */}
              <button
                onClick={() => setScreen('garage')}
                className="w-full py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border border-red-500 text-white text-[11px] font-black uppercase tracking-wider transition duration-150 transform -skew-x-12 shadow-[0_4px_12px_rgba(239,68,68,0.25)] flex items-center justify-center gap-2"
              >
                <Wrench className="w-3.5 h-3.5" /> <span className="transform skew-x-12">REFIT VEHICLE MODULES</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Tracks Selection List */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              
              {/* CHAMPIONSHIP LEVEL SELECTOR WITH LEVEL RATIO AND KM RANGE */}
              <div className="relative p-5 bg-zinc-950 border border-zinc-800/80 rounded-sm mb-2 overflow-hidden shadow-xl ring-1 ring-zinc-850">
                <div className="absolute right-0 top-0 w-24 h-24 nfs-stripes pointer-events-none opacity-5"></div>
                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-cyan-500 shadow-[0_0_12px_#06b6d4]"></div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[9px] font-black font-display text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 bg-cyan-950/20 border border-cyan-800/30 px-2.5 py-1 transform -skew-x-12 w-fit">
                      <Gauge className="w-3.5 h-3.5 animate-pulse text-cyan-400" /> SYSTEM LEVEL RATIO TUNING
                    </span>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tight mt-2.5">
                      CHOOSE EVENT DISTANCE LEVEL
                    </h3>
                    <p className="text-zinc-500 text-xs mt-1 font-sans">
                      Select difficulty and distance level. Level ratios scale the number of laps and the range of total kilometers (km).
                    </p>
                  </div>
                  
                  {/* Current Distance Indicator */}
                  <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 flex items-center gap-2 transform -skew-x-12 self-start sm:self-auto">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider transform skew-x-12 font-mono">EST. DISTANCE</span>
                    <span className="text-sm font-black font-mono text-cyan-400 transform skew-x-12">
                      ~{(getTrackLengthKm(TRACKS[selectedTrackIndex].waypoints) * selectedLevel * 0.5).toFixed(2)} KM
                    </span>
                  </div>
                </div>

                {/* Level selector buttons */}
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const ratio = lvl * 0.5;
                    const isSelected = selectedLevel === lvl;
                    const trackLength = getTrackLengthKm(TRACKS[selectedTrackIndex].waypoints);
                    const totalKm = (trackLength * lvl * 0.5).toFixed(2);
                    
                    return (
                      <button
                        key={lvl}
                        onClick={() => setSelectedLevel(lvl)}
                        className={`p-3 rounded-sm border flex flex-col items-center justify-center transition-all duration-200 transform -skew-x-6 ${
                          isSelected
                            ? 'bg-gradient-to-br from-cyan-950/40 to-zinc-900/40 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                            : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <span className="text-xs font-black font-display uppercase tracking-wider block transform skew-x-6">LVL {lvl}</span>
                        <span className="text-[10px] font-mono font-black mt-1.5 block text-cyan-400 transform skew-x-6">
                          {ratio.toFixed(1)}x
                        </span>
                        <span className="text-[9px] text-zinc-500 mt-0.5 font-sans leading-none block transform skew-x-6">
                          {totalKm} KM
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2 font-display mt-2">
                <Flag className="w-5 h-5 text-red-500" /> SELECT EVENT CHAMPIONSHIP
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {TRACKS.map((track, idx) => {
                  const isUnlocked = unlockedTrackIds.includes(track.id);
                  const isSelected = selectedTrackIndex === idx;

                  return (
                    <div
                      key={track.id}
                      onClick={() => isUnlocked && setSelectedTrackIndex(idx)}
                      className={`relative rounded-sm border transition-all duration-200 p-5 flex flex-col justify-between overflow-hidden cursor-pointer ${
                        isSelected 
                          ? `bg-gradient-to-br ${getThemeBg(track.bgTheme)} border-red-500 ring-2 ring-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.25)]`
                          : isUnlocked 
                          ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40'
                          : 'bg-zinc-950/80 border-zinc-900 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {/* Diagonal accent on Selected cards */}
                      {isSelected && (
                        <div className="absolute right-0 top-0 w-24 h-24 nfs-stripes pointer-events-none opacity-10"></div>
                      )}

                      {/* Track Details */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-sm transform -skew-x-12 ${
                            track.difficulty === 'Easy' 
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' 
                              : track.difficulty === 'Medium'
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                              : 'bg-red-500/15 border border-red-500/30 text-red-400'
                          }`}>
                            {track.difficulty} RATING
                          </span>

                          <span className="text-[10px] text-cyan-400 font-mono font-black bg-zinc-900 px-2 py-0.5 border border-cyan-500/25 rounded-sm">
                            🏎️ {selectedLevel} LAPS ({(getTrackLengthKm(track.waypoints) * selectedLevel * 0.5).toFixed(2)} KM)
                          </span>
                        </div>

                        <h4 className="text-lg font-black font-display italic text-white tracking-tight uppercase leading-tight">
                          {track.name}
                        </h4>
                        <p className="text-zinc-500 text-xs leading-relaxed mt-2.5 mb-5 font-sans">
                          {track.description}
                        </p>
                      </div>

                      {/* Launch Button / Locked Indicator */}
                      <div className="flex items-center justify-between pt-4 border-t border-zinc-900 mt-2">
                        <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-mono">
                          // {track.bgTheme.toUpperCase()} MATRIX
                        </span>

                        {isUnlocked ? (
                          isSelected ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setScreen('racing');
                              }}
                              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest rounded-sm transition duration-150 transform -skew-x-12 shadow-[0_4px_15px_rgba(239,68,68,0.4)] flex items-center gap-1.5"
                            >
                              <span className="transform skew-x-12 flex items-center gap-1">
                                IGNITE <Play className="w-3.5 h-3.5 fill-white text-white" />
                              </span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-display font-black uppercase tracking-wider hover:text-white transition">
                              [ LOCK TRACK ]
                            </span>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-red-500 font-black tracking-widest uppercase">
                            <Shield className="w-3.5 h-3.5 text-red-500" /> LOCKED
                          </div>
                        )}
                      </div>

                      {/* Overlay Lock block */}
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-[2px] flex items-center justify-center p-5 text-center flex-col z-10">
                          {/* Angled caution hazard stripes */}
                          <div className="absolute inset-x-0 top-0 h-4 nfs-stripes-red opacity-30"></div>
                          <Shield className="w-8 h-8 text-red-500 mb-2 animate-pulse" />
                          <h5 className="text-xs font-black font-display text-zinc-200 uppercase tracking-widest">CHAMPIONSHIP LOCKED</h5>
                          <p className="text-zinc-500 text-[10px] max-w-xs mt-1 leading-normal">
                            Qualify in the top 3 on the previous racetrack to unlock this event.
                          </p>
                          <div className="absolute inset-x-0 bottom-0 h-4 nfs-stripes-red opacity-30"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Commentator Customization & Instructions */}
            <div className="lg:col-span-4 flex flex-col gap-6 bg-zinc-950 border border-zinc-800 p-6 rounded-sm shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 nfs-stripes pointer-events-none opacity-5"></div>
              
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-4 font-display">
                  <Radio className="w-5 h-5 text-cyan-400" /> TEAM RADIO TUNER
                </h3>

                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  Synchronize your cockpit's active commentator channel. Gemini translates race positions and crashes into reactive, voice-synthesized text commentaries.
                </p>

                {/* Commentators Grid Selection with LED status nodes */}
                <div className="space-y-2">
                  {[
                    { name: 'Excited GP Announcer', icon: '🎙️', desc: 'High-adrenaline hyper casting.', activeColor: 'bg-red-500' },
                    { name: 'Sarcastic Mechanic', icon: '🔧', desc: 'Salty mechanic critiquing drift lines.', activeColor: 'bg-amber-500' },
                    { name: 'Zen Racing Coach', icon: '🧘', desc: 'Calm breathing and apex coaching.', activeColor: 'bg-emerald-500' },
                    { name: 'Cybernetic Co-Pilot', icon: '🤖', desc: 'Telemetry analysis and speed logs.', activeColor: 'bg-cyan-500' },
                  ].map((comm) => {
                    const isActive = commentator === comm.name;
                    return (
                      <button
                        key={comm.name}
                        onClick={() => setCommentator(comm.name)}
                        className={`w-full text-left p-3 rounded-sm border flex items-center justify-between transition-all duration-150 ${
                          isActive
                            ? 'bg-zinc-900/90 border-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                            : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex gap-3 items-center">
                          <span className="text-lg">{comm.icon}</span>
                          <div>
                            <span className="text-xs font-black font-display uppercase tracking-wider block">{comm.name}</span>
                            <span className="text-[10px] text-zinc-500 block mt-0.5 leading-none">{comm.desc}</span>
                          </div>
                        </div>

                        {/* Telemetry Indicator node */}
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${isActive ? `${comm.activeColor} animate-ping` : 'bg-zinc-800'}`}></div>
                          <div className={`w-2 h-2 rounded-full ${isActive ? comm.activeColor : 'bg-zinc-800'}`}></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cockpit Manual Panel */}
              <div className="border-t border-zinc-900 pt-5">
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3.5 flex items-center gap-1.5 font-display">
                  <Compass className="w-4 h-4 text-red-500" /> COCKPIT STEERING CONTROLS
                </h4>
                <div className="space-y-2.5 font-mono text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 p-3 rounded-sm">
                  <div className="flex items-center justify-between">
                    <span>ACCELERATOR</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded-sm text-[10px] text-white">W</kbd>
                      <kbd className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded-sm text-[10px] text-white">↑</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>REVERSE / BRAKE</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded-sm text-[10px] text-white">S</kbd>
                      <kbd className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded-sm text-[10px] text-white">↓</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>STEER STEERING</span>
                    <div className="flex gap-1">
                      <kbd className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded-sm text-[10px] text-white">A</kbd>
                      <kbd className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded-sm text-[10px] text-white">D</kbd>
                      <span className="text-zinc-600">/</span>
                      <kbd className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded-sm text-[10px] text-white">←</kbd>
                      <kbd className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded-sm text-[10px] text-white">→</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-cyan-400 border-t border-zinc-800/50 pt-2.5">
                    <span className="font-bold flex items-center gap-1"><Flame className="w-3.5 h-3.5 animate-bounce" /> NITRO BOOST</span>
                    <kbd className="px-2.5 py-0.5 bg-cyan-950/60 border border-cyan-800 text-cyan-300 rounded-sm text-[9px] font-black">SPACEBAR</kbd>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      )}

      {/* 3. TUNE GARAGE SCREEN */}
      {screen === 'garage' && (
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex items-center justify-center">
          <GarageShop
            playerCoins={playerCoins}
            upgrades={upgrades}
            onUpgrade={handlePurchaseUpgrade}
            selectedColor={selectedColor}
            onColorChange={setSelectedColor}
            onBack={() => setScreen('menu')}
          />
        </main>
      )}

      {/* 4. ACTIVE GAME SCREEN */}
      {screen === 'racing' && (
        <main className="flex-1 w-full h-full min-h-[calc(100vh-100px)] relative flex bg-black">
          <RacingGameCanvas
            track={TRACKS[selectedTrackIndex]}
            selectedLevel={selectedLevel}
            upgrades={upgrades}
            carColor={selectedColor}
            commentatorPersonality={commentator}
            onRaceFinish={handleRaceFinish}
            onExit={() => setScreen('menu')}
          />
        </main>
      )}

      {/* 5. RESULTS OVERLAY MODAL */}
      <RaceEndModal
        isOpen={isResultModalOpen}
        results={activeRaceResults}
        coinsEarned={activeCoinsEarned}
        onRetry={handleRetryTrack}
        onGarage={() => {
          setIsResultModalOpen(false);
          setScreen('garage');
        }}
        onMenu={() => {
          setIsResultModalOpen(false);
          setScreen('menu');
        }}
        nextTrackAvailable={selectedTrackIndex + 1 < TRACKS.length && unlockedTrackIds.includes(TRACKS[selectedTrackIndex + 1].id)}
        onNextTrack={handleNextTrack}
      />

    </div>
  );
}
