import React, { useState } from 'react';
import { Header } from './components/Header';
import { VideoStudio } from './components/VideoStudio';
import { TelemetryHud } from './components/TelemetryHud';
import { CvControls } from './components/CvControls';
import { TrajectoryVisualizer } from './components/TrajectoryVisualizer';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { HSVSettings, HoopZone, ShotTrajectory } from './types/tracker';
import { Upload } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'tracker' | 'telemetry' | 'architecture'>('tracker');

  // OpenCV Basketball Leather HSV Thresholds (OpenCV H: 0-180)
  const [settings, setSettings] = useState<HSVSettings>({
    hMin: 8,
    hMax: 26,
    sMin: 120,
    sMax: 255,
    vMin: 70,
    vMax: 255,
    minArea: 80,
    maxArea: 3500,
    minCircularity: 0.65,
  });

  // Target Rim Calibration Zone
  const [hoopZone, setHoopZone] = useState<HoopZone>({
    x: 600,
    y: 160,
    width: 70,
    height: 60,
    rimY: 180,
  });

  // Real-time Shot Telemetry
  const [telemetry, setTelemetry] = useState<ShotTrajectory>({
    points: [],
    releasePoint: null,
    apexPoint: null,
    rimEntry: null,
    parabolaCoeffs: null,
    releaseAngleDeg: 52,
    apexHeightPx: 145,
    entryAngleDeg: 46,
    shotVelocityMph: 17.8,
    durationSec: 1.45,
    outcome: 'make',
  });

  const [isCalibratingHoop, setIsCalibratingHoop] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenYoutubeModal={() => setIsYoutubeModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tab 1: Video CV Tracker */}
        {activeTab === 'tracker' && (
          <div className="space-y-6">
            {/* Top Workspace Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left / Center Video Viewport (8 cols) */}
              <div className="lg:col-span-8 space-y-6">
                <VideoStudio
                  settings={settings}
                  hoopZone={hoopZone}
                  setHoopZone={setHoopZone}
                  telemetry={telemetry}
                  setTelemetry={setTelemetry}
                  isCalibratingHoop={isCalibratingHoop}
                  setIsCalibratingHoop={setIsCalibratingHoop}
                  isUploadModalOpen={isUploadModalOpen}
                  setIsUploadModalOpen={setIsUploadModalOpen}
                  isYoutubeModalOpen={isYoutubeModalOpen}
                  setIsYoutubeModalOpen={setIsYoutubeModalOpen}
                  youtubeUrl={youtubeUrl}
                  setYoutubeUrl={setYoutubeUrl}
                />

                {/* Telemetry HUD */}
                <TelemetryHud telemetry={telemetry} />
              </div>

              {/* Right Sidebar Controls (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                {/* OpenCV Filter Tuning */}
                <CvControls
                  settings={settings}
                  setSettings={setSettings}
                  hoopZone={hoopZone}
                  setHoopZone={setHoopZone}
                  isCalibratingHoop={isCalibratingHoop}
                  setIsCalibratingHoop={setIsCalibratingHoop}
                />

                {/* Video Inputs Panel (Upload & YouTube) */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span>Video Input Sources</span>
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">Upload / YouTube</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Provide a local video clip, enable live camera streaming, or enter any YouTube link to track shooting mechanics locally.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Video</span>
                    </button>
                    <button
                      onClick={() => setIsYoutubeModalOpen(true)}
                      className="py-2.5 px-3 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 hover:text-white font-semibold text-xs rounded-lg border border-rose-800/60 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 fill-current text-rose-500" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span>YouTube Link</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Shot Trajectory Analytics */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <TrajectoryVisualizer telemetry={telemetry} hoopZone={hoopZone} />
            <TelemetryHud telemetry={telemetry} />
          </div>
        )}

        {/* Tab 3: Architecture & CV Math */}
        {activeTab === 'architecture' && <ArchitectureGuide />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300 font-display">HoopVision CV</span>
            <span>·</span>
            <span>Client-Side OpenCV Basketball Tracking &amp; Trajectory Physics</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>HSV Bandpass</span>
            <span>·</span>
            <span>Circularity Index</span>
            <span>·</span>
            <span>Parabolic Polynomial Regression</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
