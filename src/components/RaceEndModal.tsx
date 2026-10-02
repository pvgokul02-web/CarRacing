import React from 'react';
import { RaceResult } from '../types';
import { 
  Trophy, 
  RotateCcw, 
  Wrench, 
  Home, 
  ChevronRight, 
  Award, 
  Zap, 
  Coins, 
  Clock, 
  Sparkles, 
  Activity 
} from 'lucide-react';

interface RaceEndModalProps {
  isOpen: boolean;
  results: RaceResult[];
  coinsEarned: number;
  onRetry: () => void;
  onGarage: () => void;
  onMenu: () => void;
  nextTrackAvailable: boolean;
  onNextTrack: () => void;
}

function formatTime(ms: number | null): string {
  if (ms === null) return 'DNF';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

export const RaceEndModal: React.FC<RaceEndModalProps> = ({
  isOpen,
  results,
  coinsEarned,
  onRetry,
  onGarage,
  onMenu,
  nextTrackAvailable,
  onNextTrack,
}) => {
  if (!isOpen) return null;

  // Find player ranking position
  const playerResult = results.find((r) => r.isPlayer);
  const playerPos = playerResult ? playerResult.position : 5;
  const isPodium = playerPos <= 3;

  // Glowing borders matching placement
  const getOutcomeBorder = () => {
    switch (playerPos) {
      case 1: return 'border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.25)]';
      case 2: return 'border-zinc-300 shadow-[0_0_30px_rgba(212,212,216,0.15)]';
      case 3: return 'border-amber-700 shadow-[0_0_20px_rgba(180,83,9,0.15)]';
      default: return 'border-red-600 shadow-[0_0_25px_rgba(239,68,68,0.2)]';
    }
  };

  return (
    <div id="race-end-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      <div className={`relative w-full max-w-2xl nfs-carbon border-2 rounded-sm p-6 md:p-8 relative overflow-hidden ${getOutcomeBorder()} ring-1 ring-black`}>
        
        {/* Dynamic diagonal stripe decoration on top corner */}
        <div className="absolute right-0 top-0 w-32 h-32 nfs-stripes pointer-events-none opacity-20"></div>
        
        {/* Placement colored alert line */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
          playerPos === 1 ? 'from-amber-400 via-yellow-300 to-amber-600' : 'from-red-600 via-amber-500 to-red-800'
        }`}></div>

        {/* Header / Outcome */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-4 bg-zinc-900 border border-zinc-800 rounded-sm mb-4 relative transform -skew-x-12 shadow-lg">
            {isPodium ? (
              <Trophy className={`w-14 h-14 transform skew-x-12 ${
                playerPos === 1 ? 'text-amber-400 animate-bounce' : playerPos === 2 ? 'text-zinc-300' : 'text-amber-600'
              }`} />
            ) : (
              <Award className="w-14 h-14 text-zinc-500 transform skew-x-12" />
            )}
            
            {/* Ambient visual indicator dots */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
          </div>

          <span className="text-[10px] font-black font-display text-cyan-400 tracking-widest block uppercase mb-1">
            // CIRCUIT CHAMPIONSHIP TRANSMISSION
          </span>

          <h2 className="text-3xl md:text-4xl font-black font-speed italic tracking-tighter text-white uppercase leading-none">
            {playerPos === 1 ? (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">VICTORY! 1ST PLACE</span>
            ) : playerPos === 2 ? (
              <span className="text-zinc-200">2ND PLACE PODIUM!</span>
            ) : playerPos === 3 ? (
              <span className="text-amber-600">3RD PLACE PODIUM!</span>
            ) : (
              <span className="text-red-500">RACE FINISHED</span>
            )}
          </h2>
          
          <p className="text-zinc-400 text-xs mt-3.5 max-w-md mx-auto leading-relaxed">
            {isPodium 
              ? 'Phenomenal precision lines! You secured a spot in the professional podium standings and qualified for subsequent track challenges.' 
              : 'Sub-optimal velocity limits. Complete upgrades inside the tuner shop to squeeze out higher top speeds and steering response ratios.'}
          </p>
        </div>

        {/* Earnings & Time Telemetry Widgets */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          
          {/* Earnings card */}
          <div className="bg-zinc-950 border border-zinc-900 p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500"></div>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-1 font-mono">CREDITS AWARDED</span>
            <span className="text-2xl font-black text-amber-400 font-mono tracking-wider">🪙 +{coinsEarned} CR</span>
          </div>

          {/* Time Card */}
          <div className="bg-zinc-950 border border-zinc-900 p-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-cyan-400"></div>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-1 font-mono">CHASSIS TIMING LIMIT</span>
            <span className="text-2xl font-black text-cyan-400 font-mono tracking-wider">
              {formatTime(playerResult?.finishTime || null)}
            </span>
          </div>
        </div>

        {/* Results Standings Leaderboard */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden mb-6">
          <div className="bg-zinc-900/80 border-b border-zinc-900 px-4 py-2 flex items-center justify-between text-[10px] text-zinc-500 font-black uppercase tracking-widest font-display">
            <span>POS / DRIVER TELEMETRY</span>
            <span>CHASSIS TIME</span>
          </div>

          <div className="divide-y divide-zinc-900/40">
            {results.map((car) => {
              const isSelf = car.isPlayer;
              return (
                <div
                  key={car.carId}
                  className={`px-4 py-2.5 flex items-center justify-between transition-colors ${
                    isSelf 
                      ? 'bg-gradient-to-r from-red-600/15 via-red-950/5 to-transparent border-l-4 border-red-500' 
                      : 'hover:bg-zinc-900/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Position circle */}
                    <div
                      className={`w-6 h-6 rounded-sm transform -skew-x-12 flex items-center justify-center text-[11px] font-black font-mono border ${
                        car.position === 1
                          ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                          : car.position === 2
                          ? 'bg-zinc-300/20 border-zinc-400 text-zinc-200'
                          : car.position === 3
                          ? 'bg-amber-800/20 border-amber-700 text-amber-500'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      <span className="transform skew-x-12">{car.position}</span>
                    </div>

                    {/* Livery Indicator */}
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-black shadow-inner"
                      style={{ backgroundColor: car.color }}
                    />

                    {/* Driver Name */}
                    <span className={`text-xs font-display uppercase tracking-wide flex items-center gap-1.5 ${isSelf ? 'font-black text-white' : 'text-zinc-300'}`}>
                      {car.name} 
                      {isSelf && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-red-500 bg-red-500/10 border border-red-500/20 px-1 py-0.5 transform -skew-x-12">
                          <span className="transform skew-x-12">YOU</span>
                        </span>
                      )}
                    </span>
                  </div>

                  <span className={`text-xs font-mono font-bold ${isSelf ? 'text-red-400' : 'text-zinc-500'}`}>
                    {formatTime(car.finishTime)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls Deck */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-900 pt-5">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onMenu}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition duration-150 font-black text-xs uppercase tracking-widest transform -skew-x-12 shadow-sm"
            >
              <span className="transform skew-x-12 flex items-center gap-1.5"><Home className="w-4 h-4" /> MENU</span>
            </button>
            <button
              onClick={onGarage}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-red-600 border border-zinc-800 hover:border-red-500 text-zinc-300 hover:text-white transition duration-150 font-black text-xs uppercase tracking-widest transform -skew-x-12 shadow-sm"
            >
              <span className="transform skew-x-12 flex items-center gap-1.5"><Wrench className="w-4 h-4" /> TUNING DECK</span>
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onRetry}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition duration-150 font-black text-xs uppercase tracking-widest transform -skew-x-12 shadow-sm"
            >
              <span className="transform skew-x-12 flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> RETRY</span>
            </button>

            {nextTrackAvailable ? (
              <button
                onClick={onNextTrack}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black transition duration-150 font-black text-xs uppercase tracking-widest transform -skew-x-12 shadow-[0_4px_15px_rgba(245,158,11,0.35)] active:scale-95"
              >
                <span className="transform skew-x-12 flex items-center gap-1">
                  NEXT LEVEL <ChevronRight className="w-4 h-4 text-black" />
                </span>
              </button>
            ) : isPodium ? (
              <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider transform -skew-x-12">
                <span className="transform skew-x-12 flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> SERIES COMPLETED</span>
              </div>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
};
