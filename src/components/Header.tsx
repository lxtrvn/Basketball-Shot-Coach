import React from 'react';
import { Video, LineChart, Cpu, Upload } from 'lucide-react';

interface HeaderProps {
  activeTab: 'tracker' | 'telemetry' | 'architecture';
  setActiveTab: (tab: 'tracker' | 'telemetry' | 'architecture') => void;
  onOpenUpload: () => void;
  onOpenYoutubeModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenUpload,
  onOpenYoutubeModal,
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

        {/* Zone 2: Single-line nav links */}
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

        {/* Zone 3: Video source actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenYoutubeModal}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="Provide YouTube video link for shot"
          >
            <svg className="w-3.5 h-3.5 fill-current text-rose-500" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span>YouTube Link</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 transition-all whitespace-nowrap shrink-0"
            title="Upload Basketball Video"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Clip</span>
          </button>
        </div>
      </div>
    </header>
  );
};
