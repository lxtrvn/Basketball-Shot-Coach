import React from 'react';
import { Cpu, Target, Eye, Activity, ArrowRight } from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            System Architecture
          </span>
          <span className="text-slate-400 text-xs">·</span>
          <span className="text-slate-400 text-xs">Client-Side Computer Vision &amp; Kinematic Physics</span>
        </div>
        <h2 className="text-lg font-bold text-white font-display">
          Basketball CV Tracking &amp; Shot Physics Architecture
        </h2>
        <p className="text-xs text-slate-400 max-w-3xl mt-1">
          How video frames and live camera feeds are ingested locally in the browser, thresholded in HSV space, filtered for circularity, and regressed into parabolic shot telemetry with zero backend API calls.
        </p>
      </div>

      {/* Visual Pipeline Flow */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">
          End-to-End Processing Pipeline:
        </span>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Step 1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 relative">
            <span className="text-[10px] font-mono text-amber-400 font-bold block mb-1">STAGE 01</span>
            <h4 className="text-xs font-semibold text-white mb-1">Frame Ingestion</h4>
            <p className="text-[11px] text-slate-400">
              HTML5 Video / Webcam stream sampled at 30-60 FPS into raw RGB pixel buffers.
            </p>
            <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 relative">
            <span className="text-[10px] font-mono text-amber-400 font-bold block mb-1">STAGE 02</span>
            <h4 className="text-xs font-semibold text-white mb-1">HSV Mask & Morph</h4>
            <p className="text-[11px] text-slate-400">
              Convert BGR to HSV color space. In-range filtering for basketball orange + morphological erosion.
            </p>
            <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 relative">
            <span className="text-[10px] font-mono text-amber-400 font-bold block mb-1">STAGE 03</span>
            <h4 className="text-xs font-semibold text-white mb-1">Circularity Filter</h4>
            <p className="text-[11px] text-slate-400">
              Compute moments: area, centroid (cx, cy) and isoperimetric quotient 4πA/P² &gt; 0.65 to isolate ball.
            </p>
            <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 relative">
            <span className="text-[10px] font-mono text-amber-400 font-bold block mb-1">STAGE 04</span>
            <h4 className="text-xs font-semibold text-white mb-1">Parabolic Regression</h4>
            <p className="text-[11px] text-slate-400">
              Fit quadratic curve y = ax² + bx + c via least-squares; compute vertex apex, release angle, and entry vector.
            </p>
            <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] font-mono text-amber-400 font-bold block mb-1">STAGE 05</span>
            <h4 className="text-xs font-semibold text-white mb-1">Shot Telemetry HUD</h4>
            <p className="text-[11px] text-slate-400">
              Real-time release angle, apex elevation, entry angle, velocity, and rim outcome computed locally.
            </p>
          </div>
        </div>
      </div>

      {/* Deep Dive Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Mathematical Foundations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white font-display">
              1. Mathematical Foundations & Parabolic Arc
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            In Newtonian projectile motion under constant downward gravity <em>g</em>, horizontal velocity is constant (<em>x(t) = v₀ₓ·t + x₀</em>) and vertical motion is quadratic:
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-amber-300">
            y(x) = a·x² + b·x + c
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            From the fitted quadratic coefficients [a, b, c]:
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
            <li>
              <strong>Apex Position:</strong> Minimum Y at <em>x_apex = -b / (2a)</em>, <em>y_apex = c - b² / (4a)</em>.
            </li>
            <li>
              <strong>Release Angle:</strong> Tangent slope at launch <em>x₀</em>: <em>θ = arctan(2a·x₀ + b)</em>.
            </li>
            <li>
              <strong>Rim Entry Angle:</strong> Tangent slope at hoop center: <em>θ_entry = arctan(|2a·x_rim + b|)</em>.
            </li>
          </ul>
        </div>

        {/* Card 2: The Geometry of Rim Entry */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white font-display">
              2. Why 45° - 52° Entry Angle Matters
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            A standard basketball rim has a diameter of 18 inches, and an official ball has a diameter of 9.5 inches.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Entry Angle 35° (Flat):</span>
              <span className="text-rose-400 font-mono">Apparent target width ~ 10.3 in</span>
            </div>
            <div className="flex justify-between">
              <span>Entry Angle 45° (Standard):</span>
              <span className="text-amber-400 font-mono">Apparent target width ~ 12.7 in</span>
            </div>
            <div className="flex justify-between">
              <span>Entry Angle 52° (Elite Rainbow):</span>
              <span className="text-emerald-400 font-mono">Apparent target width ~ 14.2 in</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Increasing entry angle from 35° to 50° yields nearly <strong>+38% more rim aperture margin</strong>, explaining why high-arc shooters like Stephen Curry enjoy higher shooting percentages and softer rim rebounds.
          </p>
        </div>

        {/* Card 3: Computer Vision Masking */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white font-display">
              3. Color Space Masking vs RGB
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            RGB color representation combines luminance and chrominance in every channel. A shadow or arena spotlight radically changes R, G, and B simultaneously.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            By transforming to <strong>HSV (Hue, Saturation, Value)</strong>, the orange pigment of basketball leather resides tightly in <em>H ∈ [8, 26]</em>. Value changes only brightness, allowing robust tracking across bright arena floodlights and shadowy baseline corners.
          </p>
        </div>

        {/* Card 4: Client-Side Edge Execution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white font-display">
              4. 100% Client-Side Canvas Processing
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Every uploaded clip and live camera frame is processed directly in browser memory via HTML5 Canvas <code className="text-amber-400 font-mono">ImageData</code> buffers without uploading video to external servers.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
            {`Video / WebRTC Stream -> Offscreen Canvas -> HSV Mask -> Telemetry HUD`}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            This keeps latency under 16ms per frame for smooth 60 FPS overlay rendering and lets the app run as a completely free static site on GitHub Pages.
          </p>
        </div>
      </div>
    </div>
  );
};
