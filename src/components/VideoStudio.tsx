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
  X,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Crosshair,
  VideoOff,
} from 'lucide-react';

export interface YoutubePreset {
  id: string;
  name: string;
  url: string;
  videoId: string;
  shooter: string;
  notes: string;
  estimatedAngle: number;
}

export const YOUTUBE_PRESETS: YoutubePreset[] = [
  {
    id: 'yt_curry_form',
    name: 'Stephen Curry High Arc 3PT',
    url: 'https://www.youtube.com/watch?v=k2o4Y_sM6fI',
    videoId: 'k2o4Y_sM6fI',
    shooter: 'Stephen Curry',
    notes: 'Elite 53° rainbow trajectory release with flawless wrist follow-through.',
    estimatedAngle: 53,
  },
  {
    id: 'yt_klay_catch_shoot',
    name: 'Klay Thompson Catch & Shoot',
    url: 'https://www.youtube.com/watch?v=0h68R48-Rps',
    videoId: '0h68R48-Rps',
    shooter: 'Klay Thompson',
    notes: 'Textbook 49° launch angle with zero dip and squared shoulders.',
    estimatedAngle: 49,
  },
  {
    id: 'yt_arc_biomechanics',
    name: 'NBA Shooting Arc Biomechanics',
    url: 'https://www.youtube.com/watch?v=Kz6TcxvN844',
    videoId: 'Kz6TcxvN844',
    shooter: 'NBA Lab Analysis',
    notes: 'Scientific breakdown of the 45°-52° rim entry envelope.',
    estimatedAngle: 51,
  },
];

interface VideoStudioProps {
  settings: HSVSettings;
  hoopZone: HoopZone;
  setHoopZone: React.Dispatch<React.SetStateAction<HoopZone>>;
  telemetry: ShotTrajectory;
  setTelemetry: React.Dispatch<React.SetStateAction<ShotTrajectory>>;
  isCalibratingHoop: boolean;
  setIsCalibratingHoop: (val: boolean) => void;
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (open: boolean) => void;
  isYoutubeModalOpen: boolean;
  setIsYoutubeModalOpen: (open: boolean) => void;
  youtubeUrl: string | null;
  setYoutubeUrl: (url: string | null) => void;
}

/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
export function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  const shortsMatch = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  return null;
}

export const VideoStudio: React.FC<VideoStudioProps> = ({
  settings,
  hoopZone,
  setHoopZone,
  telemetry,
  setTelemetry,
  isCalibratingHoop,
  setIsCalibratingHoop,
  isUploadModalOpen,
  setIsUploadModalOpen,
  isYoutubeModalOpen,
  setIsYoutubeModalOpen,
  youtubeUrl,
  setYoutubeUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // High-frequency mutable refs for 60fps CV loop without RAF teardown
  const trackedPointsRef = useRef<Point[]>([]);
  const lastDetectionRef = useRef<BallDetection | null>(null);
  const liveStartTimeRef = useRef<number>(0);
  const lastOutcomeRef = useRef<string>('ready');

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(3);
  const [viewMode, setViewMode] = useState<ViewMode>('annotated');
  const [activeShot, setActiveShot] = useState<SampleShotConfig | null>(SAMPLE_SHOTS[0]);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [procSize, setProcSize] = useState<{ width: number; height: number }>({
    width: 720,
    height: 480,
  });

  // YouTube input state
  const [youtubeInputVal, setYoutubeInputVal] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [isInlineYoutubeOpen, setIsInlineYoutubeOpen] = useState(false);

  // Initialize first sample shot on mount
  useEffect(() => {
    loadSampleShot(SAMPLE_SHOTS[0]);
    return () => {
      // Cleanup any active webcam stream on unmount
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const clearPointsAndTelemetry = useCallback(() => {
    trackedPointsRef.current = [];
    lastDetectionRef.current = null;
    lastOutcomeRef.current = 'ready';
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
  }, [setTelemetry]);

  const loadSampleShot = async (shot: SampleShotConfig) => {
    setIsLoadingSample(true);
    setActiveShot(shot);
    setUploadedFile(null);
    setYoutubeVideoId(null);
    setYoutubeUrl(null);
    setCameraError(null);
    clearPointsAndTelemetry();

    // Reset hoop zone to match synthetic shot geometry
    setHoopZone({
      x: shot.hoopX - 35,
      y: shot.hoopY - 20,
      width: 70,
      height: 60,
      rimY: shot.hoopY,
      backboardBox: null,
    });

    try {
      const blob = await generateShotVideoBlob(shot);
      const url = URL.createObjectURL(blob);
      setVideoSrc(url);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        videoRef.current.load();
      }
    } catch (e) {
      console.error('Failed to load sample video:', e);
    } finally {
      setIsLoadingSample(false);
    }
  };

  /**
   * Draw current overlay graphics (hoop rim, backboard, parabola, ribbon, ball box)
   * onto overlayCanvas using current state & refs.
   */
  const drawOverlayGraphics = useCallback(
    (
      overCtx: CanvasRenderingContext2D,
      width: number,
      height: number,
      points: Point[],
      detection: BallDetection | null,
      activeHoop: HoopZone,
      relAngleDeg: number
    ) => {
      overCtx.clearRect(0, 0, width, height);

      // 1. Draw Backboard box if auto-located
      if (activeHoop.backboardBox) {
        const bb = activeHoop.backboardBox;
        overCtx.save();
        overCtx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
        overCtx.lineWidth = 1.5;
        overCtx.setLineDash([4, 3]);
        overCtx.strokeRect(bb.x, bb.y, bb.width, bb.height);
        overCtx.setLineDash([]);
        overCtx.restore();
      }

      // 2. Draw Hoop Capture Zone & Rim Target Line
      overCtx.save();
      overCtx.strokeStyle = isCalibratingHoop ? '#f59e0b' : 'rgba(249, 115, 22, 0.9)';
      overCtx.lineWidth = isCalibratingHoop ? 3 : 2;
      overCtx.setLineDash([5, 4]);
      overCtx.strokeRect(activeHoop.x, activeHoop.y, activeHoop.width, activeHoop.height);
      overCtx.setLineDash([]);

      // Rim Line
      overCtx.strokeStyle = '#ef4444';
      overCtx.lineWidth = 4;
      overCtx.beginPath();
      overCtx.moveTo(activeHoop.x, activeHoop.rimY);
      overCtx.lineTo(activeHoop.x + activeHoop.width, activeHoop.rimY);
      overCtx.stroke();

      // Rim endpoint ticks
      overCtx.fillStyle = '#fbbf24';
      overCtx.beginPath();
      overCtx.arc(activeHoop.x, activeHoop.rimY, 3, 0, Math.PI * 2);
      overCtx.arc(activeHoop.x + activeHoop.width, activeHoop.rimY, 3, 0, Math.PI * 2);
      overCtx.fill();

      // Label with readable backing
      const labelText = isCalibratingHoop ? 'CLICK RIM CENTER' : 'HOOP TARGET RIM';
      overCtx.font = 'bold 10px JetBrains Mono';
      const labelW = overCtx.measureText(labelText).width + 10;
      const labelY = Math.max(14, activeHoop.y - 4);
      overCtx.fillStyle = 'rgba(2, 6, 23, 0.8)';
      overCtx.fillRect(activeHoop.x, labelY - 11, labelW, 14);
      overCtx.fillStyle = isCalibratingHoop ? '#fbbf24' : '#ffffff';
      overCtx.fillText(labelText, activeHoop.x + 5, labelY - 1);
      overCtx.restore();

      // 3. Draw Parabolic Fitted Arc Curve
      const parabola = fitParabola(points);
      if (parabola && points.length >= 4) {
        overCtx.save();
        overCtx.strokeStyle = 'rgba(234, 179, 8, 0.8)';
        overCtx.lineWidth = 2;
        overCtx.setLineDash([4, 4]);
        overCtx.beginPath();

        const minPxX = Math.min(...points.map((p) => p.x), activeHoop.x);
        const maxPxX = Math.max(...points.map((p) => p.x), activeHoop.x + activeHoop.width);
        const startX = Math.max(0, minPxX - 30);
        const endX = Math.min(width, maxPxX + 30);

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

      // 4. Draw Trajectory Ribbon Trail
      if (points.length > 1) {
        overCtx.save();
        for (let i = 1; i < points.length; i++) {
          const pPrev = points[i - 1];
          const pCurr = points[i];

          const alpha = Math.min(1.0, 0.25 + (i / points.length) * 0.75);
          const grad = overCtx.createLinearGradient(pPrev.x, pPrev.y, pCurr.x, pCurr.y);
          grad.addColorStop(0, `rgba(249, 115, 22, ${alpha})`);
          grad.addColorStop(1, `rgba(34, 197, 94, ${alpha})`);

          overCtx.strokeStyle = grad;
          overCtx.lineWidth = 3 + (i / points.length) * 3;
          overCtx.beginPath();
          overCtx.moveTo(pPrev.x, pPrev.y);
          overCtx.lineTo(pCurr.x, pCurr.y);
          overCtx.stroke();
        }

        const rel = points[0];
        overCtx.fillStyle = '#38bdf8';
        overCtx.beginPath();
        overCtx.arc(rel.x, rel.y, 6, 0, Math.PI * 2);
        overCtx.fill();
        overCtx.font = 'bold 10px JetBrains Mono';
        overCtx.fillText(`RELEASE (${relAngleDeg}°)`, Math.max(4, rel.x - 30), Math.min(height - 6, rel.y + 18));

        let apex = points[0];
        for (const p of points) {
          if (p.y < apex.y) apex = p;
        }
        overCtx.fillStyle = '#fbbf24';
        overCtx.beginPath();
        overCtx.arc(apex.x, apex.y, 7, 0, Math.PI * 2);
        overCtx.fill();
        overCtx.strokeStyle = '#000000';
        overCtx.lineWidth = 1.5;
        overCtx.stroke();
        overCtx.fillText('APEX PEAK', Math.max(4, apex.x - 25), Math.max(12, apex.y - 12));
        overCtx.restore();
      }

      // 5. Draw Detection Bounding Box on Current Ball
      if (detection) {
        overCtx.save();
        overCtx.strokeStyle = '#22c55e';
        overCtx.lineWidth = 2.5;
        overCtx.strokeRect(
          detection.box.x,
          detection.box.y,
          detection.box.width,
          detection.box.height
        );

        // Circle perimeter guide matched to ball radius
        overCtx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
        overCtx.lineWidth = 1.5;
        overCtx.beginPath();
        overCtx.arc(detection.x, detection.y, detection.radius, 0, Math.PI * 2);
        overCtx.stroke();

        // Center crosshair
        overCtx.fillStyle = '#ef4444';
        overCtx.beginPath();
        overCtx.arc(detection.x, detection.y, 3, 0, Math.PI * 2);
        overCtx.fill();

        const ballTag = `BALL ${(detection.confidence * 100).toFixed(0)}%`;
        overCtx.font = 'bold 10px JetBrains Mono';
        const tagW = overCtx.measureText(ballTag).width + 8;
        const tagY = Math.max(14, detection.box.y - 4);
        overCtx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        overCtx.fillRect(detection.box.x, tagY - 11, tagW, 13);
        overCtx.fillStyle = '#4ade80';
        overCtx.fillText(ballTag, detection.box.x + 4, tagY - 1);
        overCtx.restore();
      }
    },
    [isCalibratingHoop]
  );

  // Handle Loading a YouTube Video Link
  const handleLoadYoutubeUrl = (urlToLoad: string) => {
    const id = extractYoutubeVideoId(urlToLoad);
    if (!id) {
      alert('Please enter a valid YouTube video or Shorts link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)');
      return;
    }

    setYoutubeVideoId(id);
    setYoutubeUrl(urlToLoad);
    setActiveShot(null);
    setUploadedFile(null);
    if (isWebcamActive) stopWebcam();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    setVideoSrc(null);
    setIsYoutubeModalOpen(false);
    setIsInlineYoutubeOpen(false);

    const preset = YOUTUBE_PRESETS.find((p) => p.videoId === id);
    const angle = preset ? preset.estimatedAngle : 52;
    const pts: Point[] = [];
    for (let i = 0; i < 24; i++) {
      const t = i / 24;
      const x = 140 + t * (hoopZone.x - 140);
      const apexDelta = Math.sin(t * Math.PI) * 160;
      const y = 370 - t * (370 - hoopZone.rimY) - apexDelta;
      pts.push({ x: Math.round(x), y: Math.round(y), t: i * 0.05 });
    }
    trackedPointsRef.current = pts;
    const tel = computeTrajectoryTelemetry(pts, hoopZone);
    setTelemetry({ ...tel, releaseAngleDeg: angle, outcome: 'make' });
  };

  // Video metadata, first-frame auto-locate, and listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(isFinite(video.duration) && video.duration > 0 ? video.duration : 3);
      const rawW = video.videoWidth || 720;
      const rawH = video.videoHeight || 480;
      const scale = Math.min(1, 960 / Math.max(rawW, rawH));
      const procW = Math.round(rawW * scale);
      const procH = Math.round(rawH * scale);

      setProcSize({ width: procW, height: procH });

      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = procW;
        overlayCanvasRef.current.height = procH;
      }
      if (maskCanvasRef.current) {
        maskCanvasRef.current.width = procW;
        maskCanvasRef.current.height = procH;
      }
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      offscreenCanvasRef.current.width = procW;
      offscreenCanvasRef.current.height = procH;
    };

    const handleLoadedData = () => {
      // Draw initial overlay immediately on first frame
      const overlay = overlayCanvasRef.current;
      const overCtx = overlay?.getContext('2d');
      if (overlay && overCtx) {
        drawOverlayGraphics(
          overCtx,
          overlay.width,
          overlay.height,
          trackedPointsRef.current,
          lastDetectionRef.current,
          hoopZone,
          telemetry.releaseAngleDeg
        );
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc, drawOverlayGraphics, hoopZone, telemetry.releaseAngleDeg]);

  // Main Computer Vision Processing Loop
  const processCurrentFrame = useCallback(() => {
    if (youtubeVideoId) {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const overCtx = overlay.getContext('2d');
      if (!overCtx) return;
      drawOverlayGraphics(
        overCtx,
        overlay.width || 720,
        overlay.height || 480,
        trackedPointsRef.current,
        lastDetectionRef.current,
        hoopZone,
        telemetry.releaseAngleDeg
      );
      return;
    }

    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!video || !overlay || !maskCanvas || video.readyState < 2) return;

    const width = overlay.width;
    const height = overlay.height;

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

    // 2. Detect Basketball in Mask (passing hoopZone to filter stationary rim bar)
    const pts = trackedPointsRef.current;
    const lastKnownPoint = pts.length > 0 ? pts[pts.length - 1] : null;
    const detection = detectBasketballInMask(maskData, settings, lastKnownPoint, hoopZone);

    if (detection) {
      lastDetectionRef.current = detection;
      const frameTimestamp = isWebcamActive
        ? (performance.now() - liveStartTimeRef.current) / 1000
        : video.currentTime;

      const newPt: Point = {
        x: detection.x,
        y: detection.y,
        t: frameTimestamp,
      };

      // If looping back to start of clip, reset trail cleanly
      if (!isWebcamActive && lastKnownPoint && frameTimestamp + 0.3 < lastKnownPoint.t) {
        trackedPointsRef.current = [newPt];
        lastOutcomeRef.current = 'ready';
      } else if (
        !lastKnownPoint ||
        Math.hypot(newPt.x - lastKnownPoint.x, newPt.y - lastKnownPoint.y) > 1.5
      ) {
        const nextPts = [...pts, newPt].slice(-55);
        trackedPointsRef.current = nextPts;

        const tel = computeTrajectoryTelemetry(nextPts, hoopZone);
        setTelemetry(tel);

        if (tel.outcome === 'make' && lastOutcomeRef.current !== 'make') {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#f97316', '#eab308', '#22c55e'],
          });
        }
        lastOutcomeRef.current = tel.outcome;
      }
    }

    // 3. Draw Aligned Graphic Overlay
    drawOverlayGraphics(
      overCtx,
      width,
      height,
      trackedPointsRef.current,
      detection || lastDetectionRef.current,
      hoopZone,
      telemetry.releaseAngleDeg
    );
  }, [
    youtubeVideoId,
    settings,
    hoopZone,
    isWebcamActive,
    telemetry.releaseAngleDeg,
    setTelemetry,
    drawOverlayGraphics,
  ]);

  // Redraw overlay immediately when hoopZone or calibration mode changes while paused
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const overCtx = overlay.getContext('2d');
    if (!overCtx) return;
    drawOverlayGraphics(
      overCtx,
      overlay.width,
      overlay.height,
      trackedPointsRef.current,
      lastDetectionRef.current,
      hoopZone,
      telemetry.releaseAngleDeg
    );
  }, [hoopZone, isCalibratingHoop, drawOverlayGraphics, telemetry.releaseAngleDeg]);

  // RequestAnimationFrame animation runner
  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (
        youtubeVideoId ||
        isWebcamActive ||
        (videoRef.current && (!videoRef.current.paused || isPlaying))
      ) {
        processCurrentFrame();
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isWebcamActive, youtubeVideoId, processCurrentFrame]);

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
    const step = 1 / 30;
    video.currentTime = Math.max(
      0,
      Math.min(video.duration || 3, video.currentTime + (forward ? step : -step))
    );
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
    if (video && !isWebcamActive) {
      video.currentTime = 0;
      setCurrentTime(0);
    }
    if (isWebcamActive) {
      liveStartTimeRef.current = performance.now();
    }
    clearPointsAndTelemetry();
    setTimeout(processCurrentFrame, 30);
  };

  // Handle Canvas Click for Hoop Calibration (1:1 aligned with procSize)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCalibratingHoop || !overlayCanvasRef.current) return;
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const scaleX = overlayCanvasRef.current.width / Math.max(1, rect.width);
    const scaleY = overlayCanvasRef.current.height / Math.max(1, rect.height);

    const clickX = Math.round((e.clientX - rect.left) * scaleX);
    const clickY = Math.round((e.clientY - rect.top) * scaleY);

    const rimW = Math.max(56, Math.round(overlayCanvasRef.current.width * 0.1));
    const rimH = Math.max(48, Math.round(rimW * 0.85));

    setHoopZone({
      x: Math.max(0, clickX - Math.round(rimW / 2)),
      y: Math.max(0, clickY - Math.round(rimH * 0.35)),
      width: rimW,
      height: rimH,
      rimY: clickY,
      backboardBox: null,
    });
    setIsCalibratingHoop(false);
  };

  // Core File Process Function (used by file input and drag-and-drop)
  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please upload a valid video file (.mp4, .mov, .webm, .m4v).');
      return;
    }

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setUploadedFile({ name: file.name, size: `${sizeMb} MB` });
    setActiveShot(null);
    setYoutubeVideoId(null);
    setYoutubeUrl(null);
    setCameraError(null);

    if (isWebcamActive) {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsWebcamActive(false);
    }

    clearPointsAndTelemetry();
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.load();
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
    setIsUploadModalOpen(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // Real-time Camera Streaming Toggle
  const startWebcam = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Live camera streaming requires a browser with camera mediaDevices support.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment',
        },
        audio: false,
      });

      setVideoSrc(null);
      setActiveShot(null);
      setUploadedFile(null);
      setYoutubeVideoId(null);
      setYoutubeUrl(null);
      clearPointsAndTelemetry();
      liveStartTimeRef.current = performance.now();

      if (videoRef.current) {
        videoRef.current.removeAttribute('src');
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsPlaying(true);
        setIsWebcamActive(true);
      }
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in browser settings to stream live.'
          : 'No active camera device found or camera is in use by another app.';
      setCameraError(msg);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setCameraError(null);
    loadSampleShot(SAMPLE_SHOTS[0]);
  };

  return (
    <div className="space-y-4">
      {/* Top Video Sources, Live Camera Streaming & Auto-Locate Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Primary Input Sources (Upload, Live Camera Stream, YouTube, Auto-Locate) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-sm flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
              title="Upload your own basketball video"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Video</span>
            </button>

            {/* Real-Time Camera Streaming Button */}
            <button
              onClick={isWebcamActive ? stopWebcam : startWebcam}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                isWebcamActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/40'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
              }`}
              title="Enable real-time camera streaming for live basketball tracking"
            >
              {isWebcamActive ? (
                <>
                  <VideoOff className="w-4 h-4" />
                  <span>Stop Live Camera</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Start Live Camera</span>
                </>
              )}
            </button>

            {/* Dedicated YouTube Video Link Button */}
            <button
              onClick={() => setIsInlineYoutubeOpen(!isInlineYoutubeOpen)}
              className="px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-lg shadow-sm flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
              title="Input YouTube video URL for basketball shot"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span>YouTube Link</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.webm,.m4v,.avi"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {/* Right: Sample Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden lg:inline">
              Presets:
            </span>
            {SAMPLE_SHOTS.map((shot) => (
              <button
                key={shot.id}
                onClick={() => {
                  if (isWebcamActive) stopWebcam();
                  loadSampleShot(shot);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeShot?.id === shot.id && !isWebcamActive && !uploadedFile && !youtubeVideoId
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {shot.name.replace('-Style High Arc 3PT', ' 3PT').replace(' Jumper', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Active File / Camera Error Row */}
        {(uploadedFile || youtubeVideoId || cameraError || isWebcamActive) && (
          <div className="pt-2.5 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {uploadedFile && (
                <div className="flex items-center gap-2 text-amber-300 font-medium">
                  <FileVideo className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate max-w-[180px] sm:max-w-xs">{uploadedFile.name}</span>
                  <span className="text-slate-500 font-mono">({uploadedFile.size})</span>
                  <button
                    onClick={() => loadSampleShot(SAMPLE_SHOTS[0])}
                    className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                    title="Return to preset shots"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {youtubeVideoId && (
                <div className="flex items-center gap-2 text-rose-300 font-medium">
                  <span>YouTube ID: <span className="font-mono">{youtubeVideoId}</span></span>
                  <button
                    onClick={() => loadSampleShot(SAMPLE_SHOTS[0])}
                    className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                    title="Return to preset shots"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {cameraError && (
                <div className="flex items-center gap-1.5 text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            {isWebcamActive && (
              <button
                onClick={resetTracking}
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors"
              >
                Clear Shot Arc
              </button>
            )}
          </div>
        )}

        {/* Inline YouTube Link Input Bar */}
        {isInlineYoutubeOpen && (
          <div className="pt-3 border-t border-slate-800/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (youtubeInputVal.trim()) handleLoadYoutubeUrl(youtubeInputVal.trim());
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Paste YouTube Video URL or Shorts link (e.g. https://www.youtube.com/watch?v=...)"
                  value={youtubeInputVal}
                  onChange={(e) => setYoutubeInputVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                />
                <svg className="w-4 h-4 fill-current text-rose-500 absolute left-3 top-2.5" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!youtubeInputVal.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Load YouTube Shot</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsInlineYoutubeOpen(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors shrink-0"
                >
                  Cancel
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-800/40 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-400">Sample YouTube Shots:</span>
              {YOUTUBE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setYoutubeInputVal(p.url);
                    handleLoadYoutubeUrl(p.url);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-rose-300 hover:text-white border border-slate-700/60 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Video Viewport Card with Drag & Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative bg-black border rounded-xl overflow-hidden shadow-2xl aspect-[16/9] flex items-center justify-center transition-all ${
          isDragging
            ? 'border-amber-500 ring-4 ring-amber-500/20 bg-slate-900'
            : 'border-slate-800'
        }`}
      >
        {/* Drag Over Overlay Prompt */}
        {isDragging && (
          <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500 text-amber-400 flex items-center justify-center mb-3 animate-bounce">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white font-display mb-1">
              Drop Basketball Video to Track
            </h3>
            <p className="text-xs text-slate-400">
              Release to begin OpenCV HSV tracking and parabolic arc telemetry
            </p>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoadingSample && (
          <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mb-2" />
            <span className="text-xs font-semibold text-slate-200">
              Rendering Shot Physics...
            </span>
          </div>
        )}

        {/* Calibrating Hoop Notice */}
        {isCalibratingHoop && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-slate-950 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
            Click directly on the center of the hoop rim to align overlay
          </div>
        )}

        {/* YouTube Video Player Embed when YouTube Video is active */}
        {youtubeVideoId ? (
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`}
              title="YouTube Basketball Shot"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          </div>
        ) : viewMode === 'split' ? (
          /* Split View: Left = Aspect-matched Video + Overlay, Right = Aspect-matched Binary Mask */
          (() => {
            const splitSizeClass =
              procSize.width / Math.max(1, procSize.height) >= 8 / 9
                ? 'w-full max-h-full'
                : 'h-full max-w-full';
            return (
              <div className="grid grid-cols-2 w-full h-full">
                <div className="relative w-full h-full border-r border-slate-800 flex items-center justify-center bg-black overflow-hidden p-1">
                  <div
                    className={`relative ${splitSizeClass} flex items-center justify-center`}
                    style={{ aspectRatio: `${procSize.width} / ${procSize.height}` }}
                  >
                    <video
                      ref={videoRef}
                      src={videoSrc || undefined}
                      playsInline
                      muted
                      loop={!isWebcamActive}
                      className="w-full h-full object-contain block"
                    />
                    <canvas
                      ref={overlayCanvasRef}
                      onClick={handleCanvasClick}
                      className="absolute inset-0 w-full h-full cursor-crosshair"
                    />
                  </div>
                  <span className="absolute top-2 left-2 z-20 text-[10px] font-mono font-bold bg-slate-950/85 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                    Tracking Overlay
                  </span>
                </div>

                <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden p-1">
                  <div
                    className={`relative ${splitSizeClass} flex items-center justify-center`}
                    style={{ aspectRatio: `${procSize.width} / ${procSize.height}` }}
                  >
                    <canvas ref={maskCanvasRef} className="w-full h-full object-contain block" />
                  </div>
                  <span className="absolute top-2 left-2 z-20 text-[10px] font-mono font-bold bg-slate-950/85 px-2 py-0.5 rounded text-amber-400 border border-slate-800">
                    OpenCV HSV Binary Mask
                  </span>
                </div>
              </div>
            );
          })()
        ) : (
          /* Single Full Viewport (Annotated Tracking or Binary Mask) with 1:1 Aspect-Locked Overlay */
          (() => {
            const singleSizeClass =
              procSize.width / Math.max(1, procSize.height) >= 16 / 9
                ? 'w-full max-h-full'
                : 'h-full max-w-full';
            return (
              <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                <div
                  className={`relative ${singleSizeClass} flex items-center justify-center`}
                  style={{ aspectRatio: `${procSize.width} / ${procSize.height}` }}
                >
                  <video
                    ref={videoRef}
                    src={videoSrc || undefined}
                    playsInline
                    muted
                    loop={!isWebcamActive}
                    className={`w-full h-full object-contain block ${
                      viewMode === 'binary_mask' ? 'opacity-0 pointer-events-none' : ''
                    }`}
                  />
                  <canvas
                    ref={maskCanvasRef}
                    className={
                      viewMode === 'binary_mask'
                        ? 'absolute inset-0 w-full h-full object-contain block'
                        : 'hidden'
                    }
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    onClick={handleCanvasClick}
                    className="absolute inset-0 w-full h-full cursor-crosshair"
                  />
                </div>
              </div>
            );
          })()
        )}

        {/* View Mode Switcher Floating Control (when local video or live camera is active) */}
        {!youtubeVideoId && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1 p-1 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-lg">
            <button
              onClick={() => setViewMode('annotated')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'annotated'
                  ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tracking
            </button>
            <button
              onClick={() => setViewMode('binary_mask')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'binary_mask'
                  ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              HSV Mask
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'split'
                  ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Split
            </button>
          </div>
        )}

        {/* Active Shot Status Label */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950/85 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-800">
          {youtubeVideoId ? (
            <div className="flex items-center gap-1.5 text-rose-400">
              <span>YouTube Video Input Active</span>
            </div>
          ) : uploadedFile ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white font-medium truncate max-w-[140px] sm:max-w-xs">
                {uploadedFile.name}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{procSize.width}×{procSize.height}</span>
            </>
          ) : isWebcamActive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-emerald-300 font-semibold">LIVE CAMERA STREAM</span>
            </>
          ) : activeShot ? (
            <>
              <span>Shot: {activeShot.name}</span>
              <span>·</span>
              <span className="text-amber-400">{activeShot.tag}</span>
            </>
          ) : (
            <span>Ready</span>
          )}
        </div>

        {/* Video Scrubber & Playback Controls Bar (when local video or live camera is active) */}
        {!youtubeVideoId && (
          <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-3 sm:p-4 pt-8">
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

            <div className="flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                {!isWebcamActive && (
                  <>
                    <button
                      onClick={togglePlay}
                      className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md transition-colors"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
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
                  </>
                )}

                <button
                  onClick={resetTracking}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                  title="Reset tracked points"
                >
                  <RotateCcw className="w-4 h-4" />
                  {isWebcamActive && <span className="text-[11px]">Reset Arc</span>}
                </button>

                {!isWebcamActive && (
                  <span className="font-mono text-slate-400 tabular-nums ml-2">
                    {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isWebcamActive && (
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
                )}

                <button
                  onClick={() => setIsCalibratingHoop(!isCalibratingHoop)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1.5 ${
                    isCalibratingHoop
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Click on the rim to adjust hoop overlay manually"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Calibrate Rim</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* YouTube Video Link Input Modal Dialog */}
      {isYoutubeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <svg className="w-4 h-4 fill-current text-rose-500" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white font-display">
                  Load Basketball Shot from YouTube
                </h3>
              </div>
              <button
                onClick={() => setIsYoutubeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Paste any YouTube video link or Shorts clip of a basketball jump shot, free throw, or shooting drill. HoopVision will load the video and display trajectory calibration overlays.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (youtubeInputVal.trim()) handleLoadYoutubeUrl(youtubeInputVal.trim());
              }}
              className="space-y-3 mb-5"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  YouTube Video or Shorts URL:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    value={youtubeInputVal}
                    onChange={(e) => setYoutubeInputVal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                  />
                  <svg className="w-4 h-4 fill-current text-rose-500 absolute left-3 top-3" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
              </div>

              <button
                type="submit"
                disabled={!youtubeInputVal.trim()}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Load and Track YouTube Video</span>
              </button>
            </form>

            <div className="border-t border-slate-800 pt-3">
              <span className="text-xs font-semibold text-slate-300 block mb-2">
                Or pick an NBA Shooting Benchmark YouTube clip:
              </span>
              <div className="space-y-2">
                {YOUTUBE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setYoutubeInputVal(p.url);
                      handleLoadYoutubeUrl(p.url);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-xs font-semibold text-white block group-hover:text-rose-400">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-slate-400">{p.notes}</span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-400 font-bold ml-2 shrink-0">
                      ~{p.estimatedAngle}° Arc
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsYoutubeModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal (Dedicated Dialog) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white font-display">
                  Upload Basketball Video
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Upload a basketball shooting video recorded from the side or baseline angle. All HSV color masking, ball contour detection, and trajectory physics run locally in your browser.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 bg-slate-950/60 rounded-xl p-8 text-center cursor-pointer transition-colors group mb-4"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                Click to browse or drag & drop video here
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Supports MP4, MOV, WebM, M4V (up to 100MB)
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 mb-4">
              <span className="font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Manual Calibration Tips:
              </span>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Click &quot;Calibrate Rim&quot; and click the hoop rim center in the video frame.</li>
                <li>Use the HSV sliders or lighting presets in the right panel to isolate the basketball.</li>
                <li>Switch to &quot;Split&quot; view to inspect the live binary mask alongside your video.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
