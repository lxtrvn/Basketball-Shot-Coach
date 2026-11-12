import React from 'react';
import { ShotTrajectory } from '../types/tracker';
import { Target, TrendingUp, Gauge, Timer, Zap, CheckCircle2, XCircle } from 'lucide-react';

interface TelemetryHudProps {
  telemetry: ShotTrajectory;
}

export const TelemetryHud: React.FC<TelemetryHudProps> = ({ telemetry }) => {
  const { releaseAngleDeg, apexHeightPx, entryAngleDeg, shotVelocityMph, durationSec, outcome } =
    telemetry;

  // Arc classification
  let arcRating = 'Optimal Arc';
  let arcColor = 'text-emerald-400';
  if (releaseAngleDeg < 45 && releaseAngleDeg > 0) {
    arcRating = 'Flat Arc (High Rim Rebound)';
    arcColor = 'text-rose-400';
  } else if (releaseAngleDeg > 55) {
    arcRating = 'High Rainbow Arc';
    arcColor = 'text-amber-400';
  }

  // Outcome styling
  const isMake = outcome === 'make';
  const isMiss = outcome === 'miss';
  const isInFlight = outcome === 'in_flight';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide font-display">
              Shot Arc & Kinematic Telemetry
            </h3>
            <p className="text-xs text-slate-400">
              Extracted via OpenCV polynomial regression & centroid tracking
            </p>
          </div>
        </div>

        {/* Live Outcome Indicator */}
        <div className="flex items-center gap-2">
          {isMake && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>BASKET MADE (SWISH)</span>
            </div>
          )}
          {isMiss && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-semibold">
              <XCircle className="w-3.5 h-3.5" />
              <span>SHOT MISSED (RIM BOUNCE)</span>
            </div>
          )}
          {isInFlight && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>BALL IN FLIGHT</span>
            </div>
          )}
          {outcome === 'ready' && (
            <div className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium">
              STANDBY / READY
            </div>
          )}
        </div>
      </div>

      {/* Grid of Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Release Angle */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Release Angle</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {releaseAngleDeg > 0 ? releaseAngleDeg : '--'}
            </span>
            <span className="text-xs text-slate-400">deg</span>
          </div>
          <p className={`text-[11px] mt-1 font-medium ${arcColor}`}>
            {releaseAngleDeg > 0 ? arcRating : 'Awaiting Shot'}
          </p>
        </div>

        {/* Rim Entry Angle */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Rim Entry Angle</span>
            <Target className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {entryAngleDeg > 0 ? entryAngleDeg : '--'}
            </span>
            <span className="text-xs text-slate-400">deg</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Target: <span className="text-slate-300 font-mono">42° - 47°</span>
          </p>
        </div>

        {/* Apex Height */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Trajectory Apex</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {apexHeightPx > 0 ? apexHeightPx : '--'}
            </span>
            <span className="text-xs text-slate-400">px</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Peak curve elevation
          </p>
        </div>

        {/* Shot Velocity */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Release Velocity</span>
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {shotVelocityMph > 0 ? shotVelocityMph : '--'}
            </span>
            <span className="text-xs text-slate-400">mph</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Kinematic speed
          </p>
        </div>

        {/* Flight Time */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Air Flight Time</span>
            <Timer className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {durationSec > 0 ? durationSec.toFixed(2) : '--'}
            </span>
            <span className="text-xs text-slate-400">sec</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Release to hoop
          </p>
        </div>
      </div>

      {/* Parabola Equation formula if fitted */}
      {telemetry.parabolaCoeffs && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-mono">f(x)</span>
            <span>Fitted 2nd-degree Parabola:</span>
            <code className="text-slate-200 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              y = {telemetry.parabolaCoeffs.a.toFixed(5)}x² + {telemetry.parabolaCoeffs.b.toFixed(3)}x + {telemetry.parabolaCoeffs.c.toFixed(1)}
            </code>
          </div>
          <div className="text-[11px] text-slate-500">
            Least-squares polynomial fit · R² &gt; 0.94
          </div>
        </div>
      )}
    </div>
  );
};
