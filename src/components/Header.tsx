import React from 'react';
import { Sparkles, Video, Code2, LineChart, Cpu, Upload } from 'lucide-react';

interface HeaderProps {
  activeTab: 'tracker' | 'telemetry' | 'notebook' | 'architecture';
  setActiveTab: (tab: 'tracker' | 'telemetry' | 'notebook' | 'architecture') => void;
  onTriggerGeminiAnalysis: () => void;
  isAnalyzing: boolean;
  onOpenUpload: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onTriggerGeminiAnalysis,
  isAnalyzing,
  onOpenUpload,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="text-slate-950 font-black text-xl font-display">H</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0">
            HoopVision <span className="text-amber-500 font-medium">CV</span>
          </span>
        </div>

        {/* Zone 2: 4 single-line nav links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'tracker'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-amber-500" />
            <span>Video CV Tracker</span>
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'telemetry'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <LineChart className="w-3.5 h-3.5 text-amber-500" />
            <span>Shot Trajectory</span>
          </button>

          <button
            onClick={() => setActiveTab('notebook')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'notebook'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-amber-500" />
            <span>Cleaned Python/Gemini Code</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'architecture'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            <span>CV Pipeline Math</span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenUpload}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="Upload Basketball Video"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span>Upload Clip</span>
          </button>

          <button
            onClick={onTriggerGeminiAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Analyzing Arc...' : 'Gemini AI Coach'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
