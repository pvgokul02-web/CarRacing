import React from 'react';
import { UpgradeState } from '../types';
import { 
  Zap, 
  Gauge, 
  Compass, 
  Flame, 
  ArrowLeft, 
  Paintbrush, 
  Sparkles, 
  Coins, 
  Cpu, 
  Wrench, 
  Activity, 
  ShieldAlert 
} from 'lucide-react';

interface GarageProps {
  playerCoins: number;
  upgrades: UpgradeState;
  onUpgrade: (stat: keyof UpgradeState, cost: number) => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
  onBack: () => void;
}

const UPGRADE_COSTS = [0, 80, 150, 250, 400]; // Cost to reach level 2, 3, 4, 5

const STAT_DESCRIPTIONS = {
  speedLevel: {
    name: 'Top Speed Engine Map',
    description: 'Upgrades the cylinder head, variable valve timing, and lightweight carbon flywheel to increase top speed velocity limits.',
    telemetry: 'BOOST_MAX: 2.4 BAR / V-MAX: +42 MPH',
    icon: Gauge,
    color: 'text-rose-500',
    borderColor: 'border-rose-500/20',
    barColor: 'bg-rose-500',
    glowColor: 'shadow-rose-500/30',
  },
  accelLevel: {
    name: 'Instant Torque Gearbox',
    description: 'Installs dual-clutch sequential transmission gearboxes and high-flow superchargers for zero-lag throttle response.',
    telemetry: 'GEAR_LOCK: 85MS / RATIO: 3.85:1',
    icon: Zap,
    color: 'text-amber-500',
    borderColor: 'border-amber-500/20',
    barColor: 'bg-amber-500',
    glowColor: 'shadow-amber-500/30',
  },
  handlingLevel: {
    name: 'Aerodynamic Vectoring Tires',
    description: 'Equips soft track-day slick racing compounds and active downforce carbon wings for extreme high-G cornering grip.',
    telemetry: 'LATERAL_G: 1.85 / SLIP_RATIO: 0.08',
    icon: Compass,
    color: 'text-emerald-500',
    borderColor: 'border-emerald-500/20',
    barColor: 'bg-emerald-500',
    glowColor: 'shadow-emerald-500/30',
  },
  nitroLevel: {
    name: 'Nitrous Oxide Flow Valve',
    description: 'Installs dual nitrous canisters and multi-port injection jets to trigger instantaneous maximum speed warp capabilities.',
    telemetry: 'N2O_PSI: 1800 / INJ_NOZZLES: 8-PORT',
    icon: Flame,
    color: 'text-cyan-500',
    borderColor: 'border-cyan-500/20',
    barColor: 'bg-cyan-500',
    glowColor: 'shadow-cyan-500/30',
  },
};

const COLORS = [
  { value: '#ef4444', name: 'Rosso Red', type: 'Candy Gloss' },
  { value: '#06b6d4', name: 'Cyber Cyan', type: 'Fluorescent Pearl' },
  { value: '#f59e0b', name: 'Formula Gold', type: 'Metallic Chrome' },
  { value: '#a855f7', name: 'Neon Purple', type: 'Anodized Matte' },
  { value: '#22c55e', name: 'Apex Green', type: 'Satin Racing' },
  { value: '#e2e8f0', name: 'Carbon White', type: 'Chassis Pearl' },
];

export const GarageShop: React.FC<GarageProps> = ({
  playerCoins,
  upgrades,
  onUpgrade,
  selectedColor,
  onColorChange,
  onBack,
}) => {
  return (
    <div id="garage-shop-container" className="w-full max-w-5xl mx-auto nfs-carbon border-2 border-zinc-800 rounded-sm shadow-2xl relative overflow-hidden ring-1 ring-black">
      
      {/* Visual background lines and laser trims */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-cyan-500"></div>
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 p-6 border-b-2 border-zinc-900 bg-zinc-950/80 relative">
        <div className="flex items-center gap-4">
          <button
            id="garage-back-btn"
            onClick={onBack}
            className="p-3 bg-zinc-900 border border-zinc-800 hover:border-red-500 hover:bg-red-600 transition text-zinc-400 hover:text-white transform -skew-x-12 duration-150"
          >
            <ArrowLeft className="w-5 h-5 transform skew-x-12" />
          </button>
          
          <div>
            <span className="text-[10px] font-black font-display text-red-500 tracking-widest block uppercase">STAGE 2 PERFORMANCE STATION</span>
            <h1 className="text-2xl md:text-3xl font-black font-speed italic text-white tracking-tighter uppercase flex items-center gap-2">
              PERFORMANCE TUNING DECK <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
            </h1>
          </div>
        </div>

        {/* Cash Counter */}
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-5 py-2.5 transform -skew-x-12 shadow-[0_4px_15px_rgba(245,158,11,0.05)]">
          <Coins className="w-5 h-5 text-amber-500 transform skew-x-12 animate-pulse" />
          <span className="text-lg font-black font-mono text-amber-400 transform skew-x-12 tracking-wider flex items-center gap-1">
            🪙 <span className="font-display font-black text-white">{playerCoins}</span> <span className="text-[10px] text-zinc-500 uppercase font-sans font-bold">CR</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-8">
        
        {/* Left Side: Car Visual Customization */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-zinc-950/90 border border-zinc-900 p-6 shadow-xl relative overflow-hidden">
          {/* Laser grids and alert banner */}
          <div className="absolute right-0 top-0 w-16 h-16 nfs-stripes pointer-events-none opacity-10"></div>
          
          <div className="w-full">
            <h2 className="text-xs font-black font-display uppercase tracking-widest text-cyan-400 mb-4 flex items-center gap-2 pb-2.5 border-b border-zinc-900">
              <Paintbrush className="w-4 h-4 text-cyan-400" /> CUSTOM PAINT SPRAY CHAMBER
            </h2>

            {/* 2D Render of Player Car in High-Tech Neon Garage Box */}
            <div className="relative w-full h-56 bg-[#040406] rounded-sm border border-zinc-900 flex items-center justify-center overflow-hidden mb-6">
              
              {/* Technical blueprint grid overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:14px_14px] opacity-25"></div>
              
              {/* Dynamic Laser scanner lines animating */}
              <div className="absolute inset-x-0 h-[2px] bg-cyan-500/80 shadow-[0_0_12px_#06b6d4] top-6 animate-[bounce_5s_infinite_ease-in-out] pointer-events-none z-10"></div>
              
              {/* Garage mechanical telemetry ticks */}
              <div className="absolute left-3 top-3 text-[8px] font-mono text-zinc-600 space-y-0.5">
                <div>SYS_OK: ACTIVE</div>
                <div>LIDAR_SCAN: CALIBRATING</div>
                <div>LIVERY: 100% SPEC</div>
              </div>
              <div className="absolute right-3 top-3 text-[8px] font-mono text-zinc-600 text-right space-y-0.5">
                <div>CHASSIS_ID: #0829</div>
                <div>DRAG_COEFF: 0.28</div>
                <div>TEMP: 21.8°C</div>
              </div>

              {/* Angle visual brackets */}
              <div className="absolute left-2 inset-y-2 w-1 border-y border-l border-zinc-800/40"></div>
              <div className="absolute right-2 inset-y-2 w-1 border-y border-r border-zinc-800/40"></div>

              {/* The Car Graphic styled elegantly */}
              <div className="relative w-20 h-36 flex flex-col justify-between items-center transition-all duration-300 transform scale-105">
                {/* Rear Wing / Spoiler */}
                <div className="w-24 h-4 bg-zinc-800 rounded-sm shadow-md border-b border-zinc-700 flex items-center justify-center">
                  <div className="w-20 h-1 bg-red-600"></div>
                </div>

                {/* Rear Wheels */}
                <div className="absolute top-8 -left-3.5 w-4 h-9 bg-zinc-950 border border-zinc-700 shadow-md">
                  <div className="w-1 h-full bg-zinc-800 mx-auto"></div>
                </div>
                <div className="absolute top-8 -right-3.5 w-4 h-9 bg-zinc-950 border border-zinc-700 shadow-md">
                  <div className="w-1 h-full bg-zinc-800 mx-auto"></div>
                </div>

                {/* Car Main Body */}
                <div
                  className="w-14 h-30 rounded-2xl relative shadow-2xl flex flex-col items-center justify-between transition-colors duration-300 border-x border-zinc-950/40"
                  style={{ 
                    backgroundColor: selectedColor,
                    boxShadow: `0 0 25px ${selectedColor}33, inset 0 0 15px rgba(0,0,0,0.3)`
                  }}
                >
                  {/* Neon Underglow light bar */}
                  <div className="absolute inset-x-2 bottom-6 h-1 rounded-full animate-pulse" style={{ backgroundColor: selectedColor, boxShadow: `0 0 10px ${selectedColor}` }} />

                  {/* Racing lines / Carbon decals */}
                  <div className="w-1.5 h-12 bg-zinc-950/40 absolute top-2"></div>
                  <div className="w-1 h-12 bg-zinc-100/30 absolute top-2 left-4"></div>

                  {/* Cabin Windshield with mirror shine */}
                  <div className="w-10 h-11 bg-zinc-900/95 rounded-b-lg border-x border-b border-zinc-800 absolute top-8 flex items-center justify-center overflow-hidden">
                    <div className="w-full h-[1px] bg-cyan-400/40 absolute top-2 transform rotate-12"></div>
                    <div className="w-6 h-2 bg-sky-400/20 rounded-full blur-xs"></div>
                  </div>

                  {/* Headlights */}
                  <div className="absolute bottom-1.5 left-2 w-2 h-4 bg-amber-200 rounded-t-full shadow-[0_0_8px_#fef08a] border-t border-white"></div>
                  <div className="absolute bottom-1.5 right-2 w-2 h-4 bg-amber-200 rounded-t-full shadow-[0_0_8px_#fef08a] border-t border-white"></div>
                  
                  {/* Hood mesh lines */}
                  <div className="w-8 h-5 border-t border-x border-zinc-950/60 rounded-t-md absolute bottom-7 opacity-75"></div>
                </div>

                {/* Front Wheels */}
                <div className="absolute bottom-6 -left-3.5 w-4 h-9 bg-zinc-950 border border-zinc-700 shadow-md">
                  <div className="w-1 h-full bg-zinc-800 mx-auto"></div>
                </div>
                <div className="absolute bottom-6 -right-3.5 w-4 h-9 bg-zinc-950 border border-zinc-700 shadow-md">
                  <div className="w-1 h-full bg-zinc-800 mx-auto"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Color Selection Grid */}
          <div className="w-full">
            <p className="text-[10px] font-black font-display text-zinc-500 uppercase tracking-widest mb-3.5">
              // CHEMICAL PAINT LIVERY OPTIONS
            </p>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((color) => {
                const isSelected = selectedColor === color.value;
                return (
                  <button
                    key={color.value}
                    onClick={() => onColorChange(color.value)}
                    className={`group p-3 rounded-sm border flex items-center gap-3 transition-all duration-150 text-left ${
                      isSelected
                        ? 'bg-zinc-900 border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                        : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-white'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full border border-black shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] relative flex-shrink-0"
                      style={{ 
                        backgroundColor: color.value,
                        boxShadow: isSelected ? `0 0 10px ${color.value}88` : 'none'
                      }}
                    >
                      {isSelected && (
                        <div className="absolute inset-1 rounded-full border border-white opacity-45"></div>
                      )}
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-black font-display uppercase tracking-wide block truncate">{color.name}</span>
                      <span className="text-[9px] text-zinc-500 block font-mono truncate uppercase leading-none mt-0.5">{color.type}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Performance Upgrades */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <h2 className="text-xs font-black font-display uppercase tracking-widest text-amber-500 flex items-center gap-2 pb-2.5 border-b border-zinc-900">
            <Cpu className="w-4 h-4 text-amber-500" /> STAGE-SPEC PERFORMANCE REFIT LOGS
          </h2>

          <div className="space-y-3.5">
            {(Object.keys(STAT_DESCRIPTIONS) as Array<keyof UpgradeState>).map((key) => {
              const currentLevel = upgrades[key];
              const isMax = currentLevel >= 5;
              const nextCost = isMax ? 0 : UPGRADE_COSTS[currentLevel];
              const canAfford = playerCoins >= nextCost && !isMax;
              const statInfo = STAT_DESCRIPTIONS[key];
              const StatIcon = statInfo.icon;

              return (
                <div
                  key={key}
                  className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-zinc-950 border transition-all duration-150 ${
                    isMax 
                      ? 'border-zinc-900/50 bg-zinc-950/40' 
                      : canAfford
                      ? 'border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10'
                      : 'border-zinc-900'
                  }`}
                >
                  {/* Stat descriptions */}
                  <div className="flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-2.5 mb-1">
                      <div className={`p-2 bg-zinc-900 border border-zinc-800 rounded-sm ${statInfo.color}`}>
                        <StatIcon className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-black font-display uppercase tracking-wide text-white leading-none">
                        {statInfo.name}
                      </h3>
                      
                      {/* Level display */}
                      <span className="text-[9px] font-black font-mono px-2 py-0.5 rounded-sm bg-zinc-900 border border-zinc-800 text-zinc-300">
                        LEVEL {currentLevel}/5
                      </span>
                    </div>

                    <p className="text-zinc-500 text-[11px] leading-relaxed max-w-xl font-sans mt-2">
                      {statInfo.description}
                    </p>

                    {/* Horizontal Tilted Segmented Bar - Tachometer style */}
                    <div className="flex items-center gap-1.5 mt-3">
                      {[1, 2, 3, 4, 5].map((lvl) => {
                        const active = lvl <= currentLevel;
                        return (
                          <div
                            key={lvl}
                            className={`h-3 w-7 transform -skew-x-12 transition-all duration-300 ${
                              active
                                ? `${statInfo.barColor} ${statInfo.glowColor} shadow-[0_0_10px_currentColor]`
                                : 'bg-zinc-900 border border-zinc-800/80'
                            }`}
                          />
                        );
                      })}
                      
                      {/* Telemetry metadata micro text */}
                      <span className="text-[9px] font-mono text-zinc-600 ml-auto tracking-wider hidden sm:inline">
                        {statInfo.telemetry}
                      </span>
                    </div>
                  </div>

                  {/* Upgrade Button panel */}
                  <div className="w-full md:w-auto flex md:flex-col items-center justify-between md:justify-center gap-3 border-t md:border-t-0 border-zinc-900 pt-3 md:pt-0">
                    {!isMax ? (
                      <>
                        <div className="text-left md:text-right">
                          <span className="text-[9px] text-zinc-500 block uppercase tracking-widest font-mono">COST CREDITS</span>
                          <span className={`text-sm font-bold font-mono ${canAfford ? 'text-amber-400' : 'text-zinc-600'}`}>
                            🪙 {nextCost} <span className="text-[10px] text-zinc-500 uppercase">CR</span>
                          </span>
                        </div>
                        <button
                          onClick={() => onUpgrade(key, nextCost)}
                          disabled={!canAfford}
                          className={`w-full md:w-32 py-2 px-4 rounded-sm font-black text-xs transition-all tracking-widest uppercase transform -skew-x-12 ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_4px_12px_rgba(245,158,11,0.25)] cursor-pointer active:scale-95'
                              : 'bg-zinc-900 text-zinc-600 border border-zinc-800/60 cursor-not-allowed'
                          }`}
                        >
                          <span className="transform skew-x-12 block">REFIT</span>
                        </button>
                      </>
                    ) : (
                      <div className="w-full md:w-32 py-2 px-4 rounded-sm bg-zinc-900 border border-zinc-800 text-center transform -skew-x-12">
                        <span className="text-emerald-500 font-black text-[10px] uppercase tracking-widest block transform skew-x-12">MAXED OUT</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Safety alert footer strip */}
      <div className="bg-zinc-950 p-4 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-zinc-600" /> CALIBRATION SPECIFICATIONS STRICTLY UNDERGROUND AUTHORIZED ONLY
        </span>
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-black text-xs uppercase tracking-widest transform -skew-x-12 transition-all duration-150 shadow-md"
        >
          <span className="transform skew-x-12 block">EXIT TUNING DECK</span>
        </button>
      </div>

    </div>
  );
};
