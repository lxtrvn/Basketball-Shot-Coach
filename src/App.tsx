import React, { useState } from 'react';
import { Header } from './components/Header';
import { VideoStudio } from './components/VideoStudio';
import { TelemetryHud } from './components/TelemetryHud';
import { CvControls } from './components/CvControls';
import { GeminiCoachPanel } from './components/GeminiCoachPanel';
import { CleanNotebookViewer } from './components/CleanNotebookViewer';
import { TrajectoryVisualizer } from './components/TrajectoryVisualizer';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { HSVSettings, HoopZone, ShotTrajectory, AIAnalysisResult } from './types/tracker';
import { Sparkles, Sliders, Upload, Target, Video } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'tracker' | 'telemetry' | 'notebook' | 'architecture'>('tracker');

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

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>({
    shotScore: 92,
    arcRating: 'Optimal (48°-54°)',
    mechanicsBreakdown:
      'High-release trajectory with a 52° launch angle provides optimal ball clearance and soft descent. Ball apex reaches maximum elevation before entering the cylinder at 46°.',
    releaseFeedback:
      'Clean wrist snap with continuous elbow extension. Backspin frequency stabilizes flight against aerodynamic turbulence.',
    makeMissDiagnosis:
      'Trajectory intersected center-rim cylinder directly within the optimal 46° entry envelope, providing ~14 inches of effective basket aperture for a clean swish.',
    actionableDrills: [
      'Form Shooting Progression: 50 shots from 5 ft focusing strictly on 50° high-release follow-through.',
      'Rainbow Arc Tape Drill: Place visual marker at 12 ft elevation to enforce high-arc clearance.',
      'Catch & Elevate 3PT: Quick-trigger rhythm jumpers off lateral screen drift.',
    ],
    keyMetricsSummary:
      'Exceptional arc geometry matching modern NBA shooting efficiency benchmarks. Maintain this 50°-53° launch angle for long-range consistency.',
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCalibratingHoop, setIsCalibratingHoop] = useState(false);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Trigger Gemini AI Shot Analysis
  const handleTriggerGeminiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/shot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetry,
          frameImageBase64: snapshotDataUrl,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (err) {
      console.error('Failed to analyze shot:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header complying with Top Bar Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTriggerGeminiAnalysis={handleTriggerGeminiAnalysis}
        isAnalyzing={isAnalyzing}
        onOpenUpload={() => setIsUploadModalOpen(true)}
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
                  onFrameCaptured={setSnapshotDataUrl}
                  isUploadModalOpen={isUploadModalOpen}
                  setIsUploadModalOpen={setIsUploadModalOpen}
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

                {/* Quick Action Card */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Gemini Vision AI Coach</span>
                  </h4>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    Once the video completes or a shot is tracked, run the multimodal evaluation to generate personalized shooting drills and mechanical breakdown.
                  </p>
                  <button
                    onClick={handleTriggerGeminiAnalysis}
                    disabled={isAnalyzing}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzing ? 'Analyzing Arc...' : 'Analyze Shot Mechanics'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Full-Width AI Coaching Panel */}
            <GeminiCoachPanel
              analysis={aiAnalysis}
              telemetry={telemetry}
              isLoading={isAnalyzing}
              onRefreshAnalysis={handleTriggerGeminiAnalysis}
              snapshotDataUrl={snapshotDataUrl}
            />
          </div>
        )}

        {/* Tab 2: Shot Trajectory Analytics */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <TrajectoryVisualizer telemetry={telemetry} hoopZone={hoopZone} />
            <TelemetryHud telemetry={telemetry} />
          </div>
        )}

        {/* Tab 3: Cleaned Python/Gemini Notebook */}
        {activeTab === 'notebook' && (
          <CleanNotebookViewer settings={settings} hoopZone={hoopZone} />
        )}

        {/* Tab 4: Architecture & CV Math */}
        {activeTab === 'architecture' && <ArchitectureGuide />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300 font-display">HoopVision AI</span>
            <span>·</span>
            <span>OpenCV Basketball Computer Vision & Gemini 3.8 Flash Analytics</span>
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
