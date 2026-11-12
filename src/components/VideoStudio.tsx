import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  HSVSettings,
  HoopZone,
  Point,
  ShotTrajectory,
  ViewMode,
  BallDetection,
} from '../types/tracker';
import {
  generateHsvMask,
  detectBasketballInMask,
  computeTrajectoryTelemetry,
  fitParabola,
} from '../utils/cvEngine';
import { SAMPLE_SHOTS, SampleShotConfig, generateShotVideoBlob } from '../utils/sampleVideos';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Upload,
  Camera,
  Layers,
  Sparkles,
  Maximize2,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface VideoStudioProps {
  settings: HSVSettings;
  hoopZone: HoopZone;
  setHoopZone: React.Dispatch<React.SetStateAction<HoopZone>>;
  telemetry: ShotTrajectory;
  setTelemetry: React.Dispatch<React.SetStateAction<ShotTrajectory>>;
  isCalibratingHoop: boolean;
  setIsCalibratingHoop: (val: boolean) => void;
  onFrameCaptured: (dataUrl: string) => void;
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (open: boolean) => void;
}

export const VideoStudio: React.FC<VideoStudioProps> = ({
  settings,
  hoopZone,
  setHoopZone,
  telemetry,
  setTelemetry,
  isCalibratingHoop,
  setIsCalibratingHoop,
  onFrameCaptured,
  isUploadModalOpen,
  setIsUploadModalOpen,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(3);
  const [viewMode, setViewMode] = useState<ViewMode>('annotated');
  const [activeShot, setActiveShot] = useState<SampleShotConfig>(SAMPLE_SHOTS[0]);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [trackedPoints, setTrackedPoints] = useState<Point[]>([]);
  const [lastDetection, setLastDetection] = useState<BallDetection | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Initialize first sample shot on mount
  useEffect(() => {
    loadSampleShot(SAMPLE_SHOTS[0]);
  }, []);

  const loadSampleShot = async (shot: SampleShotConfig) => {
    setIsLoadingSample(true);
    setActiveShot(shot);
    setTrackedPoints([]);
    setLastDetection(null);

    try {
      const blob = await generateShotVideoBlob(shot);
      const url = URL.createObjectURL(blob);
      setVideoSrc(url);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
      }
    } catch (e) {
      console.error('Failed to load sample video:', e);
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Video source loading & listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 3);
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = video.videoWidth || 720;
        overlayCanvasRef.current.height = video.videoHeight || 480;
      }
      if (maskCanvasRef.current) {
        maskCanvasRef.current.width = video.videoWidth || 720;
        maskCanvasRef.current.height = video.videoHeight || 480;
      }
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      offscreenCanvasRef.current.width = video.videoWidth || 720;
      offscreenCanvasRef.current.height = video.videoHeight || 480;
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc]);

  // Main Computer Vision Processing Loop
  const processCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!video || !overlay || !maskCanvas || video.readyState < 2) return;

    const width = overlay.width;
    const height = overlay.height;

    // Use offscreen canvas to extract pixel data from video
    let offscreen = offscreenCanvasRef.current;
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      offscreenCanvasRef.current = offscreen;
    }
    if (offscreen.width !== width || offscreen.height !== height) {
      offscreen.width = width;
      offscreen.height = height;
    }

    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    const overCtx = overlay.getContext('2d');
    if (!offCtx || !overCtx) return;

    offCtx.drawImage(video, 0, 0, width, height);
    const frameImageData = offCtx.getImageData(0, 0, width, height);

    // 1. Generate OpenCV HSV Mask
    const { maskData } = generateHsvMask(frameImageData, settings, maskCanvas);

    // 2. Detect Basketball in Mask
    const lastKnownPoint = trackedPoints.length > 0 ? trackedPoints[trackedPoints.length - 1] : null;
    const detection = detectBasketballInMask(maskData, settings, lastKnownPoint);

    let updatedPoints = [...trackedPoints];
    if (detection) {
      setLastDetection(detection);
      const newPt: Point = {
        x: detection.x,
        y: detection.y,
        t: video.currentTime,
      };

      // Only add point if ball has moved or first point
      if (
        !lastKnownPoint ||
        Math.hypot(newPt.x - lastKnownPoint.x, newPt.y - lastKnownPoint.y) > 1.5
      ) {
        updatedPoints.push(newPt);
        if (updatedPoints.length > 50) {
          updatedPoints = updatedPoints.slice(-50);
        }
        setTrackedPoints(updatedPoints);

        // Update telemetry
        const tel = computeTrajectoryTelemetry(updatedPoints, hoopZone);
        setTelemetry(tel);

        // Capture frame snapshot for Gemini analysis
        if (updatedPoints.length === 12 || tel.outcome === 'make') {
          try {
            const snap = offscreen.toDataURL('image/jpeg', 0.8);
            onFrameCaptured(snap);
          } catch (e) {
            // Ignore cross-origin error on local blob
          }
        }

        // Celebrate swish with confetti!
        if (tel.outcome === 'make' && telemetry.outcome !== 'make') {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#f97316', '#eab308', '#22c55e'],
          });
        }
      }
    }

    // 3. Draw Overlays on Overlay Canvas
    overCtx.clearRect(0, 0, width, height);

    // Draw Hoop Zone
    overCtx.save();
    overCtx.strokeStyle = isCalibratingHoop ? '#f59e0b' : 'rgba(249, 115, 22, 0.85)';
    overCtx.lineWidth = isCalibratingHoop ? 3 : 2;
    overCtx.setLineDash([5, 4]);
    overCtx.strokeRect(hoopZone.x, hoopZone.y, hoopZone.width, hoopZone.height);
    overCtx.setLineDash([]);

    // Draw Rim Line (The scoring target)
    overCtx.strokeStyle = '#ef4444';
    overCtx.lineWidth = 4;
    overCtx.beginPath();
    overCtx.moveTo(hoopZone.x, hoopZone.rimY);
    overCtx.lineTo(hoopZone.x + hoopZone.width, hoopZone.rimY);
    overCtx.stroke();

    // Hoop label
    overCtx.fillStyle = '#ffffff';
    overCtx.font = '10px JetBrains Mono';
    overCtx.fillText(
      isCalibratingHoop ? 'TARGET RIM (CLICK TO MOVE)' : 'HOOP TARGET RIM',
      hoopZone.x,
      hoopZone.y - 6
    );
    overCtx.restore();

    // Draw Parabolic Fitted Arc Curve
    const parabola = fitParabola(updatedPoints);
    if (parabola && updatedPoints.length >= 4) {
      overCtx.save();
      overCtx.strokeStyle = 'rgba(234, 179, 8, 0.75)';
      overCtx.lineWidth = 2;
      overCtx.setLineDash([4, 4]);
      overCtx.beginPath();

      const startX = Math.max(0, updatedPoints[0].x - 40);
      const endX = Math.min(width, hoopZone.x + hoopZone.width + 30);

      let first = true;
      for (let px = startX; px <= endX; px += 4) {
        const py = parabola.a * px * px + parabola.b * px + parabola.c;
        if (py >= 0 && py <= height) {
          if (first) {
            overCtx.moveTo(px, py);
            first = false;
          } else {
            overCtx.lineTo(px, py);
          }
        }
      }
      overCtx.stroke();
      overCtx.restore();
    }

    // Draw Trajectory Ribbon Trail
    if (updatedPoints.length > 1) {
      overCtx.save();
      for (let i = 1; i < updatedPoints.length; i++) {
        const pPrev = updatedPoints[i - 1];
        const pCurr = updatedPoints[i];

        const alpha = Math.min(1.0, 0.2 + (i / updatedPoints.length) * 0.8);
        const grad = overCtx.createLinearGradient(pPrev.x, pPrev.y, pCurr.x, pCurr.y);
        grad.addColorStop(0, `rgba(249, 115, 22, ${alpha})`);
        grad.addColorStop(1, `rgba(34, 197, 94, ${alpha})`);

        overCtx.strokeStyle = grad;
        overCtx.lineWidth = 3 + (i / updatedPoints.length) * 3;
        overCtx.beginPath();
        overCtx.moveTo(pPrev.x, pPrev.y);
        overCtx.lineTo(pCurr.x, pCurr.y);
        overCtx.stroke();
      }

      // Draw Release Point Marker
      const rel = updatedPoints[0];
      overCtx.fillStyle = '#38bdf8';
      overCtx.beginPath();
      overCtx.arc(rel.x, rel.y, 6, 0, Math.PI * 2);
      overCtx.fill();
      overCtx.font = '10px JetBrains Mono';
      overCtx.fillText(`RELEASE (${telemetry.releaseAngleDeg}°)`, rel.x - 30, rel.y + 18);

      // Draw Apex Marker (Minimum Y)
      let apex = updatedPoints[0];
      for (const p of updatedPoints) {
        if (p.y < apex.y) apex = p;
      }
      overCtx.fillStyle = '#fbbf24';
      overCtx.beginPath();
      overCtx.arc(apex.x, apex.y, 7, 0, Math.PI * 2);
      overCtx.fill();
      overCtx.strokeStyle = '#000000';
      overCtx.lineWidth = 1.5;
      overCtx.stroke();
      overCtx.fillText('APEX PEAK', apex.x - 25, apex.y - 12);

      overCtx.restore();
    }

    // Draw Detection Bounding Box on Current Ball
    if (detection) {
      overCtx.save();
      overCtx.strokeStyle = '#22c55e';
      overCtx.lineWidth = 2;
      overCtx.strokeRect(
        detection.box.x,
        detection.box.y,
        detection.box.width,
        detection.box.height
      );

      // Center crosshair
      overCtx.fillStyle = '#ef4444';
      overCtx.beginPath();
      overCtx.arc(detection.x, detection.y, 3, 0, Math.PI * 2);
      overCtx.fill();

      // Confidence & circularity label
      overCtx.fillStyle = '#22c55e';
      overCtx.font = '10px JetBrains Mono';
      overCtx.fillText(
        `BALL ${(detection.confidence * 100).toFixed(0)}%`,
        detection.box.x,
        detection.box.y - 4
      );
      overCtx.restore();
    }
  }, [
    settings,
    hoopZone,
    trackedPoints,
    isCalibratingHoop,
    telemetry.outcome,
    telemetry.releaseAngleDeg,
    onFrameCaptured,
    setTelemetry,
  ]);

  // RequestAnimationFrame animation runner
  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (videoRef.current && (!videoRef.current.paused || isPlaying)) {
        processCurrentFrame();
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, processCurrentFrame]);

  // Handle Play/Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(console.error);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Step Frame
  const stepFrame = (forward: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const step = 1 / 30; // 30 fps
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + (forward ? step : -step)));
    setTimeout(processCurrentFrame, 50);
  };

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = Number(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
    setTimeout(processCurrentFrame, 30);
  };

  // Reset tracking
  const resetTracking = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      setCurrentTime(0);
    }
    setTrackedPoints([]);
    setLastDetection(null);
    setTelemetry({
      points: [],
      releasePoint: null,
      apexPoint: null,
      rimEntry: null,
      parabolaCoeffs: null,
      releaseAngleDeg: 0,
      apexHeightPx: 0,
      entryAngleDeg: 0,
      shotVelocityMph: 0,
      durationSec: 0,
      outcome: 'ready',
    });
  };

  // Handle Canvas Click for Hoop Calibration
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCalibratingHoop || !overlayCanvasRef.current) return;
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const scaleX = overlayCanvasRef.current.width / rect.width;
    const scaleY = overlayCanvasRef.current.height / rect.height;

    const clickX = Math.round((e.clientX - rect.left) * scaleX);
    const clickY = Math.round((e.clientY - rect.top) * scaleY);

    setHoopZone({
      x: clickX - 35,
      y: clickY - 20,
      width: 70,
      height: 60,
      rimY: clickY,
    });
    setIsCalibratingHoop(false);
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }
    resetTracking();
    setIsUploadModalOpen(false);
  };

  // Webcam Start
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 720, height: 480 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsPlaying(true);
        setIsWebcamActive(true);
      }
    } catch (err) {
      alert('Camera access denied or unavailable in this environment.');
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    loadSampleShot(activeShot);
  };

  return (
    <div className="space-y-4">
      {/* Top Shot Selector & Mode Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Preset Shots */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
          {SAMPLE_SHOTS.map((shot) => (
            <button
              key={shot.id}
              onClick={() => {
                if (isWebcamActive) stopWebcam();
                loadSampleShot(shot);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeShot.id === shot.id && !isWebcamActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {shot.name}
            </button>
          ))}

          {/* Webcam Toggle */}
          <button
            onClick={isWebcamActive ? stopWebcam : startWebcam}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              isWebcamActive
                ? 'bg-rose-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isWebcamActive ? 'Stop Camera' : 'Live Camera'}</span>
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('annotated')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'annotated'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Annotated Tracking
          </button>
          <button
            onClick={() => setViewMode('binary_mask')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'binary_mask'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            OpenCV HSV Mask
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'split'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Split View
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center">
        {/* Loading Spinner */}
        {isLoadingSample && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mb-2" />
            <span className="text-xs font-semibold text-slate-300">Rendering Shot Physics...</span>
          </div>
        )}

        {/* Calibrating Hoop Notice */}
        {isCalibratingHoop && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-slate-950 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg animate-bounce">
            Click anywhere on the hoop rim to reposition target
          </div>
        )}

        {/* Split View Container */}
        {viewMode === 'split' ? (
          <div className="grid grid-cols-2 w-full h-full">
            {/* Left: Annotated Video */}
            <div className="relative w-full h-full border-r border-slate-800 flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                src={videoSrc}
                playsInline
                muted
                loop={!isWebcamActive}
                className="max-h-full max-w-full object-contain"
              />
              <canvas
                ref={overlayCanvasRef}
                onClick={handleCanvasClick}
                className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
              />
              <span className="absolute top-2 left-2 z-20 text-[10px] font-mono font-bold bg-slate-950/80 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                Tracking Overlay
              </span>
            </div>

            {/* Right: OpenCV Binary Mask */}
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <canvas
                ref={maskCanvasRef}
                className="max-h-full max-w-full object-contain"
              />
              <span className="absolute top-2 left-2 z-20 text-[10px] font-mono font-bold bg-slate-950/80 px-2 py-0.5 rounded text-amber-400 border border-slate-800">
                OpenCV HSV Binary Mask
              </span>
            </div>
          </div>
        ) : viewMode === 'binary_mask' ? (
          /* Binary Mask Only */
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              muted
              loop={!isWebcamActive}
              className="hidden"
            />
            <canvas
              ref={maskCanvasRef}
              className="max-h-full max-w-full object-contain"
            />
            <canvas
              ref={overlayCanvasRef}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
            />
            <span className="absolute top-3 left-3 z-20 text-xs font-mono font-bold bg-slate-950/80 px-2.5 py-1 rounded text-amber-400 border border-slate-800">
              OpenCV HSV Binary Mask View
            </span>
          </div>
        ) : (
          /* Annotated Tracking (Default) */
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              muted
              loop={!isWebcamActive}
              className="max-h-full max-w-full object-contain"
            />
            <canvas
              ref={overlayCanvasRef}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
            />
            <canvas ref={maskCanvasRef} className="hidden" />

            {/* Quiet status watermark */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-800">
              <span>Shot: {activeShot.name}</span>
              <span>·</span>
              <span className="text-amber-400">{activeShot.tag}</span>
            </div>
          </div>
        )}

        {/* Video Scrubber & Playback Controls Bar */}
        <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-3 sm:p-4 pt-8">
          {/* Scrubber progress */}
          {!isWebcamActive && (
            <div className="relative flex items-center mb-2.5 group">
              <input
                type="range"
                min="0"
                max={duration || 3}
                step="0.01"
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-amber-500 h-1.5 bg-slate-800/80 rounded-lg cursor-pointer"
              />
            </div>
          )}

          {/* Controls Row */}
          <div className="flex items-center justify-between text-xs text-slate-300">
            {/* Play/Step */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={() => stepFrame(false)}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Step backward 1 frame"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => stepFrame(true)}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Step forward 1 frame"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={resetTracking}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Reset points & replay"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Time display */}
              {!isWebcamActive && (
                <span className="font-mono text-slate-400 tabular-nums ml-2">
                  {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
                </span>
              )}
            </div>

            {/* Speed & Actions */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5">
                {[0.25, 0.5, 1].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => {
                      setPlaybackSpeed(spd);
                      if (videoRef.current) videoRef.current.playbackRate = spd;
                    }}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded ${
                      playbackSpeed === spd
                        ? 'bg-amber-500/20 text-amber-400 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload Video</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white font-display mb-1">
              Upload Basketball Shot Video
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select an MP4, WebM, or MOV video clip recorded on your phone or gym camera. The computer vision pipeline will track the ball and fit trajectory telemetry.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 bg-slate-950/60 rounded-xl p-8 text-center cursor-pointer transition-colors group mb-4"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                Click to browse video file
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Supports MP4, WebM, MOV (Max 50MB)
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
