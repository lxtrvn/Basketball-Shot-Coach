import React, { useState } from 'react';
import { HSVSettings, HoopZone } from '../types/tracker';
import { generateCleanedPythonCode, generateJupyterNotebookJson } from '../utils/notebookGenerator';
import { Copy, Download, Check, Sparkles, Code2, Terminal, BookOpen, Layers } from 'lucide-react';

interface CleanNotebookViewerProps {
  settings: HSVSettings;
  hoopZone: HoopZone;
}

export const CleanNotebookViewer: React.FC<CleanNotebookViewerProps> = ({
  settings,
  hoopZone,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'python' | 'changes' | 'customizer'>('python');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const [customCode, setCustomCode] = useState<string | null>(null);

  const pythonCode = customCode || generateCleanedPythonCode(settings, hoopZone);

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPy = () => {
    const blob = new Blob([pythonCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'basketball_cv_tracker.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadIpynb = () => {
    const jsonStr = generateJupyterNotebookJson(settings, hoopZone);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Basketball_CV_Tracker.ipynb';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateCustomCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim() || isGeneratingCustom) return;

    setIsGeneratingCustom(true);
    try {
      const res = await fetch('/api/clean-code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hsvSettings: settings,
          hoopZone,
          userCustomizationPrompt: customPrompt,
        }),
      });
      const data = await res.json();
      if (data.code) {
        setCustomCode(data.code);
        setActiveCodeTab('python');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PEP-8 Clean Architecture
              </span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-slate-400 text-xs">OpenCV 4.10+ & Google GenAI SDK</span>
            </div>
            <h2 className="text-lg font-bold text-white font-display">
              Cleaned-Up Python Script & Jupyter Notebook
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl mt-1">
              Refactored from messy prototype notebook cells into an object-oriented, production-ready computer vision pipeline synced with your exact HSV sliders and hoop coordinates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadPy}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Download standalone .py script"
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              <span>Download .py</span>
            </button>

            <button
              onClick={handleDownloadIpynb}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md shadow-amber-500/10"
              title="Download as Jupyter Notebook (.ipynb)"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Download .ipynb</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveCodeTab('python')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeCodeTab === 'python'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Refactored Python Script</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('changes')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeCodeTab === 'changes'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>What Was Cleaned Up</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('customizer')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeCodeTab === 'customizer'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Code Customizer</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Code View */}
      {activeCodeTab === 'python' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-amber-500" />
              <span>basketball_cv_tracker.py</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Python 3.10+</span>
              <span>·</span>
              <span>OpenCV 4.10+</span>
              <span>·</span>
              <span>google-genai</span>
            </div>
          </div>

          <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed max-h-[650px] selection:bg-amber-500/30">
            <code>{pythonCode}</code>
          </pre>
        </div>
      )}

      {/* Tab 2: What was cleaned up */}
      {activeCodeTab === 'changes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block mb-2">
              Before (Messy Notebook Problems):
            </span>
            <ul className="space-y-3 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">×</span>
                <span>
                  <strong>Global State Pollution:</strong> Variables scattered across 15 different Jupyter cells with arbitrary execution orders causing NameError and stale state.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">×</span>
                <span>
                  <strong>Hardcoded Screen Coordinates:</strong> No dynamic hoop scaling or court calibration, failing whenever a video with a different resolution was loaded.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">×</span>
                <span>
                  <strong>False Positive Spikes:</strong> Floor reflection, player sneakers, and orange jerseys constantly triggered false detections due to lack of circularity ($4\pi A / P^2$) and kinematic distance gating.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">×</span>
                <span>
                  <strong>No Physics or Arc Regression:</strong> Only raw point trails without least-squares parabolic curve fitting, making release angle and entry angle impossible to measure accurately.
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">
              After (Production Refactor Improvements):
            </span>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong>Modular Classes:</strong> Clean separation into <code className="text-amber-400 font-mono">BasketballCVDetector</code>, <code className="text-amber-400 font-mono">ShotPhysicsEngine</code>, and <code className="text-amber-400 font-mono">GeminiShotCoach</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong>Morphological Noise Filter:</strong> Elliptical kernel erosion & dilation (<code className="text-slate-200 font-mono">cv2.MORPH_ELLIPSE</code>) removes floor glare and court lines.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong>Parabolic Least Squares:</strong> Real mathematical curve fitting with <code className="text-slate-200 font-mono">np.polyfit(deg=2)</code> yielding vertex apex, launch angle, and hoop rim intersection angle.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong>Modern Google GenAI Integration:</strong> Uses modern <code className="text-amber-400 font-mono">google-genai</code> SDK with multimodal frame input support for biomechanical feedback.
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 3: Customizer */}
      {activeCodeTab === 'customizer' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white font-display mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Customize Python Script with Gemini AI</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Need to adapt the code for multi-camera tracking, homography court bird&apos;s-eye projection, YOLOv8 pose integration, or custom video format streaming? Tell Gemini what to adapt:
          </p>

          <form onSubmit={handleGenerateCustomCode} className="space-y-3">
            <textarea
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Add perspective transform (homography) to project ball trajectory onto a 2D court floor map, and calculate shot release height relative to player head."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Uses your current HSV sliders [{settings.hMin}-{settings.hMax}, {settings.sMin}-{settings.sMax}, {settings.vMin}-{settings.vMax}]
              </span>
              <button
                type="submit"
                disabled={isGeneratingCustom || !customPrompt.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingCustom ? 'animate-spin' : ''}`} />
                <span>{isGeneratingCustom ? 'Refactoring Code...' : 'Generate Custom Script'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
