import React from 'react';
import { HSVSettings, HoopZone } from '../types/tracker';
import { Sliders, RotateCcw, Crosshair, Sun, Eye } from 'lucide-react';

interface CvControlsProps {
  settings: HSVSettings;
  setSettings: React.Dispatch<React.SetStateAction<HSVSettings>>;
  hoopZone: HoopZone;
  setHoopZone: React.Dispatch<React.SetStateAction<HoopZone>>;
  isCalibratingHoop: boolean;
  setIsCalibratingHoop: (val: boolean) => void;
}

export const CvControls: React.FC<CvControlsProps> = ({
  settings,
  setSettings,
  hoopZone,
  setHoopZone,
  isCalibratingHoop,
  setIsCalibratingHoop,
}) => {
  // Preset handlers
  const applyPreset = (preset: 'standard' | 'outdoor' | 'lowlight') => {
    if (preset === 'standard') {
      setSettings({
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
    } else if (preset === 'outdoor') {
      setSettings({
        hMin: 5,
        hMax: 32,
        sMin: 90,
        sMax: 255,
        vMin: 100,
        vMax: 255,
        minArea: 60,
        maxArea: 4000,
        minCircularity: 0.6,
      });
    } else if (preset === 'lowlight') {
      setSettings({
        hMin: 10,
        hMax: 24,
        sMin: 140,
        sMax: 255,
        vMin: 50,
        vMax: 220,
        minArea: 70,
        maxArea: 3000,
        minCircularity: 0.65,
      });
    }
  };

  const resetDefaults = () => {
    applyPreset('standard');
    setHoopZone({
      x: 600,
      y: 160,
      width: 70,
      height: 60,
      rimY: 180,
    });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-display">
              OpenCV Filter & HSV Calibration
            </h3>
            <p className="text-xs text-slate-400">
              Color space masking, morphology, and circularity thresholds
            </p>
          </div>
        </div>

        <button
          onClick={resetDefaults}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-md transition-colors"
          title="Reset to default basketball thresholds"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Quick Lighting Presets */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-300 block mb-1.5">
          Lighting Presets:
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => applyPreset('standard')}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700/80 border border-slate-700/50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Sun className="w-3 h-3 text-amber-400" />
            <span>Indoor Gym</span>
          </button>
          <button
            onClick={() => applyPreset('outdoor')}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700/80 border border-slate-700/50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Eye className="w-3 h-3 text-sky-400" />
            <span>Outdoor</span>
          </button>
          <button
            onClick={() => applyPreset('lowlight')}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700/80 border border-slate-700/50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Crosshair className="w-3 h-3 text-emerald-400" />
            <span>Dim/Rec</span>
          </button>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="space-y-3.5">
        {/* Hue Range */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-300 font-medium">Hue Range (0 - 180):</span>
            <span className="font-mono tabular-nums text-amber-400">
              {settings.hMin} - {settings.hMax}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400">Min</span>
              <input
                type="range"
                min="0"
                max="90"
                value={settings.hMin}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, hMin: Number(e.target.value) }))
                }
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Max</span>
              <input
                type="range"
                min="10"
                max="180"
                value={settings.hMax}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, hMax: Number(e.target.value) }))
                }
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Saturation Range */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-300 font-medium">Saturation Range (0 - 255):</span>
            <span className="font-mono tabular-nums text-amber-400">
              {settings.sMin} - {settings.sMax}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400">Min</span>
              <input
                type="range"
                min="0"
                max="255"
                value={settings.sMin}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, sMin: Number(e.target.value) }))
                }
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Max</span>
              <input
                type="range"
                min="100"
                max="255"
                value={settings.sMax}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, sMax: Number(e.target.value) }))
                }
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Value/Brightness Range */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-300 font-medium">Value / Lightness (0 - 255):</span>
            <span className="font-mono tabular-nums text-amber-400">
              {settings.vMin} - {settings.vMax}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400">Min</span>
              <input
                type="range"
                min="0"
                max="255"
                value={settings.vMin}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, vMin: Number(e.target.value) }))
                }
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Max</span>
              <input
                type="range"
                min="100"
                max="255"
                value={settings.vMax}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, vMax: Number(e.target.value) }))
                }
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Circularity Threshold */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-300 font-medium">Min Circularity (Sphere Filter):</span>
            <span className="font-mono tabular-nums text-amber-400">
              {settings.minCircularity.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.30"
            max="0.95"
            step="0.05"
            value={settings.minCircularity}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, minCircularity: Number(e.target.value) }))
            }
            className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-slate-400 mt-0.5">
            4π·A / P² (rejects players arms, backboards, and shoes)
          </p>
        </div>

        {/* Hoop Calibration Button */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-300 block">Hoop Target Rim</span>
              <span className="text-[11px] text-slate-400 font-mono">
                X:{hoopZone.x} Y:{hoopZone.y} (RimY:{hoopZone.rimY})
              </span>
            </div>
            <button
              onClick={() => setIsCalibratingHoop(!isCalibratingHoop)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                isCalibratingHoop
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isCalibratingHoop ? 'Click Video to Set Rim' : 'Calibrate Rim'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
