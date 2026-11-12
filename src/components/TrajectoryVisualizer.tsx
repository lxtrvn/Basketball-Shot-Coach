import React from 'react';
import { ShotTrajectory, HoopZone } from '../types/tracker';
import { Target, TrendingUp, Compass, Award, Activity } from 'lucide-react';

interface TrajectoryVisualizerProps {
  telemetry: ShotTrajectory;
  hoopZone: HoopZone;
}

export const TrajectoryVisualizer: React.FC<TrajectoryVisualizerProps> = ({
  telemetry,
  hoopZone,
}) => {
  const { points, parabolaCoeffs, releaseAngleDeg, entryAngleDeg, apexHeightPx, shotVelocityMph, outcome } =
    telemetry;

  // Generate chart plot points
  const chartWidth = 650;
  const chartHeight = 300;

  // Normalize points to chart viewBox
  const minX = points.length > 0 ? Math.min(...points.map((p) => p.x)) : 100;
  const maxX = points.length > 0 ? Math.max(...points.map((p) => p.x), hoopZone.x + hoopZone.width) : 650;
  const minY = points.length > 0 ? Math.min(...points.map((p) => p.y)) : 80;
  const maxY = points.length > 0 ? Math.max(...points.map((p) => p.y)) : 400;

  const mapX = (x: number) => 40 + ((x - minX) / Math.max(1, maxX - minX)) * (chartWidth - 80);
  // Invert Y so up is up in SVG
  const mapY = (y: number) => chartHeight - 40 - ((maxY - y) / Math.max(1, maxY - minY)) * (chartHeight - 80);

  // Parabolic curve path
  let parabolaPath = '';
  if (parabolaCoeffs) {
    const step = 4;
    let isFirst = true;
    for (let px = minX; px <= maxX; px += step) {
      const py = parabolaCoeffs.a * px * px + parabolaCoeffs.b * px + parabolaCoeffs.c;
      const svgX = mapX(px);
      const svgY = mapY(py);
      if (svgY >= 20 && svgY <= chartHeight - 20) {
        if (isFirst) {
          parabolaPath += `M ${svgX} ${svgY} `;
          isFirst = false;
        } else {
          parabolaPath += `L ${svgX} ${svgY} `;
        }
      }
    }
  }

  // Ideal benchmark curve (50° release, clean entry)
  let benchmarkPath = '';
  if (points.length >= 2) {
    const startX = points[0].x;
    const startY = points[0].y;
    const endX = hoopZone.x + hoopZone.width / 2;
    const endY = hoopZone.rimY;

    // Ideal vertex midpoint
    const apexX = (startX + endX) * 0.5;
    const apexY = Math.min(startY, endY) - 140;

    const bSvgStart = `${mapX(startX)} ${mapY(startY)}`;
    const bSvgApex = `${mapX(apexX)} ${mapY(apexY)}`;
    const bSvgEnd = `${mapX(endX)} ${mapY(endY)}`;
    benchmarkPath = `M ${bSvgStart} Q ${bSvgApex} ${bSvgEnd}`;
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Parabolic Analysis
          </span>
          <span className="text-slate-400 text-xs">·</span>
          <span className="text-slate-400 text-xs">Least-Squares 2nd Degree Polynomial</span>
        </div>
        <h2 className="text-lg font-bold text-white font-display">
          Shot Trajectory & Kinematic Arc Modeling
        </h2>
        <p className="text-xs text-slate-400 max-w-2xl mt-1">
          Comparing the tracked basketball flight coordinates with the ideal NBA 50° high-entry benchmark arc.
        </p>
      </div>

      {/* 2D Trajectory SVG Plot Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-300">Tracked Ball Points</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-amber-400 inline-block border-b-2 border-dashed border-amber-400" />
              <span className="text-slate-300">Fitted Parabola</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-emerald-500 inline-block" />
              <span className="text-slate-300">Ideal 50° NBA Arc</span>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Sampled Points: <span className="text-amber-400">{points.length} frames</span>
          </div>
        </div>

        {/* SVG Plot */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto bg-slate-900/60 rounded-lg border border-slate-800/80"
          >
            {/* Grid Lines */}
            {Array.from({ length: 6 }).map((_, i) => {
              const y = 30 + (i * (chartHeight - 60)) / 5;
              return (
                <line
                  key={`gy-${i}`}
                  x1={40}
                  y1={y}
                  x2={chartWidth - 40}
                  y2={y}
                  stroke="rgba(51, 65, 85, 0.4)"
                  strokeDasharray="2 3"
                />
              );
            })}
            {Array.from({ length: 7 }).map((_, i) => {
              const x = 40 + (i * (chartWidth - 80)) / 6;
              return (
                <line
                  key={`gx-${i}`}
                  x1={x}
                  y1={30}
                  x2={x}
                  y2={chartHeight - 30}
                  stroke="rgba(51, 65, 85, 0.4)"
                  strokeDasharray="2 3"
                />
              );
            })}

            {/* Ideal Benchmark Curve */}
            {benchmarkPath && (
              <path
                d={benchmarkPath}
                fill="none"
                stroke="#10b981"
                strokeWidth={2}
                opacity={0.65}
              />
            )}

            {/* Fitted Parabola Curve */}
            {parabolaPath && (
              <path
                d={parabolaPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="5 4"
              />
            )}

            {/* Hoop Rim Zone on Chart */}
            <rect
              x={mapX(hoopZone.x)}
              y={mapY(hoopZone.rimY) - 5}
              width={Math.max(16, (hoopZone.width / (maxX - minX)) * (chartWidth - 80))}
              height={10}
              fill="#f97316"
              rx={2}
            />
            <text
              x={mapX(hoopZone.x)}
              y={mapY(hoopZone.rimY) - 10}
              fill="#f97316"
              fontSize="9"
              fontFamily="JetBrains Mono"
            >
              RIM TARGET
            </text>

            {/* Tracked Points as Circles */}
            {points.map((pt, idx) => {
              const sx = mapX(pt.x);
              const sy = mapY(pt.y);
              return (
                <circle
                  key={idx}
                  cx={sx}
                  cy={sy}
                  r={idx === 0 || idx === points.length - 1 ? 4 : 2.5}
                  fill={idx === 0 ? '#38bdf8' : idx === points.length - 1 ? '#22c55e' : '#fb923c'}
                  stroke="#0f172a"
                  strokeWidth={1}
                />
              );
            })}

            {/* Ground / Baseline Axis */}
            <line
              x1={30}
              y1={chartHeight - 30}
              x2={chartWidth - 30}
              y2={chartHeight - 30}
              stroke="#64748b"
              strokeWidth={1.5}
            />
            <text
              x={chartWidth - 90}
              y={chartHeight - 12}
              fill="#94a3b8"
              fontSize="10"
              fontFamily="JetBrains Mono"
            >
              Court Distance (x) →
            </text>
            <text
              x={12}
              y={25}
              fill="#94a3b8"
              fontSize="10"
              fontFamily="JetBrains Mono"
            >
              Height (y) ↑
            </text>
          </svg>
        </div>
      </div>

      {/* Physics Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Release Mechanics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Compass className="w-4 h-4" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-display">
              Launch Angle Mechanics
            </h3>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold font-mono tabular-nums text-white">
              {releaseAngleDeg}°
            </span>
            <span className="text-xs text-slate-400">launch angle</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {releaseAngleDeg >= 48 && releaseAngleDeg <= 54
              ? 'Excellent optimal trajectory. Provides peak entrance window area into the 18-inch hoop.'
              : releaseAngleDeg < 48
              ? 'Flat launch angle. Increases rim collision velocity and narrows vertical clearance.'
              : 'High arc. Maximizes rim opening but requires extra arm velocity from long range.'}
          </p>
        </div>

        {/* Rim Approach */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <Target className="w-4 h-4" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-display">
              Hoop Entry Geometry
            </h3>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold font-mono tabular-nums text-white">
              {entryAngleDeg}°
            </span>
            <span className="text-xs text-slate-400">rim entry</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Standard 18&quot; hoop aperture provides <strong>{(entryAngleDeg * 0.28).toFixed(1)} inches</strong> of apparent target diameter at this angle. (45° gives ~12.7 in).
          </p>
        </div>

        {/* Velocity & Energy */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-sky-400">
            <Activity className="w-4 h-4" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-display">
              Velocity & Apex Height
            </h3>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold font-mono tabular-nums text-white">
              {shotVelocityMph}
            </span>
            <span className="text-xs text-slate-400">mph</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ball apex attained at pixel <span className="font-mono text-amber-400">{apexHeightPx}</span> with soft backspin landing dynamics.
          </p>
        </div>
      </div>
    </div>
  );
};
