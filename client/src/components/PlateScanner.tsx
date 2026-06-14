import { useState, useRef, useEffect, useCallback } from 'react';
import { createWorker, type Worker } from 'tesseract.js';
import { X, Keyboard, Camera, Loader2, ScanLine } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────
const PLATE_REGEX = /^[A-Z0-9]{2,4}-[A-Z0-9]{2,4}$/;
const SCAN_INTERVAL_MS = 1500;
const CONFIRM_THRESHOLD = 3;

// Guide box position as % of screen (matches SVG overlay)
const BOX = { x: 0.05, y: 0.36, w: 0.90, h: 0.18 };

// ── Types ────────────────────────────────────────────────────────────────────
interface PlateScannerProps {
  onDetected: (plate: string) => void;
  onClose: () => void;
}

type Phase = 'loading' | 'active' | 'error';

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractPlate(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Try with inserted hyphen at common split points
  for (const split of [3, 2, 4]) {
    if (cleaned.length > split) {
      const candidate = `${cleaned.slice(0, split)}-${cleaned.slice(split)}`;
      if (PLATE_REGEX.test(candidate)) return candidate;
    }
  }
  // Try direct regex on cleaned text that may already have a hyphen
  const withHyphen = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const m = withHyphen.match(/[A-Z0-9]{2,4}-[A-Z0-9]{2,4}/);
  return m ? m[0] : null;
}

// ── Component ────────────────────────────────────────────────────────────────
export function PlateScanner({ onDetected, onClose }: PlateScannerProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastPlate, setLastPlate] = useState('');
  const [confirmCount, setConfirmCount] = useState(0);
  const [isOCR, setIsOCR] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);
  const lastPlateRef = useRef('');
  const consecutiveRef = useRef(0);
  const mountedRef = useRef(true);

  // ── Stop all resources ──────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    workerRef.current?.terminate().catch(() => {});
    workerRef.current = null;
  }, []);

  // ── Initialise camera + Tesseract ───────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      // 1. Init Tesseract worker
      let worker: Worker;
      try {
        worker = await createWorker('eng', 1, { logger: () => {} });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
          tessedit_pageseg_mode: '7',
        } as any);
        if (!mountedRef.current) { worker.terminate(); return; }
        workerRef.current = worker;
      } catch {
        if (mountedRef.current) { setErrorMsg('OCR 引擎初始化失敗'); setPhase('error'); }
        return;
      }

      // 2. Request rear camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setPhase('active');
      } catch (err) {
        if (!mountedRef.current) return;
        const name = (err as { name?: string }).name;
        setErrorMsg(
          name === 'NotAllowedError' ? '請允許相機存取權限'
          : name === 'NotFoundError' ? '找不到相機裝置'
          : '無法開啟相機，請使用手動輸入',
        );
        setPhase('error');
      }
    }

    init();
    return () => {
      mountedRef.current = false;
      stopAll();
    };
  }, [stopAll]);

  // ── Start OCR scan loop once camera is active ───────────────────────────
  useEffect(() => {
    if (phase !== 'active' || manualMode) return;

    intervalRef.current = setInterval(() => {
      captureAndOCR();
    }, SCAN_INTERVAL_MS);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  // captureAndOCR is defined below; use eslint-disable to avoid stale closure warning
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, manualMode]);

  // ── Capture a frame and run OCR ─────────────────────────────────────────
  function captureFrame(): HTMLCanvasElement | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // Map guide-box screen % to video frame coords (accounting for object-fit: cover)
    const rect = video.getBoundingClientRect();
    const displayW = rect.width || window.innerWidth;
    const displayH = rect.height || window.innerHeight;
    const scale = Math.max(displayW / vw, displayH / vh);
    const offsetX = (vw - displayW / scale) / 2;
    const offsetY = (vh - displayH / scale) / 2;

    const cropX = offsetX + (BOX.x * displayW) / scale;
    const cropY = offsetY + (BOX.y * displayH) / scale;
    const cropW = (BOX.w * displayW) / scale;
    const cropH = (BOX.h * displayH) / scale;

    // Upscale 2× for better OCR accuracy
    canvas.width = Math.round(cropW * 2);
    canvas.height = Math.round(cropH * 2);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.filter = 'grayscale(100%) contrast(160%) brightness(105%)';
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  async function captureAndOCR() {
    if (processingRef.current || !workerRef.current) return;
    const canvas = captureFrame();
    if (!canvas) return;

    processingRef.current = true;
    if (mountedRef.current) setIsOCR(true);

    try {
      const { data: { text } } = await workerRef.current.recognize(canvas);
      if (!mountedRef.current) return;

      const plate = extractPlate(text);

      if (plate) {
        setLastPlate(plate);

        if (plate === lastPlateRef.current) {
          consecutiveRef.current += 1;
          setConfirmCount(consecutiveRef.current);

          if (consecutiveRef.current >= CONFIRM_THRESHOLD) {
            // ✅ Confirmed — stop scanning and fire callback
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            streamRef.current?.getTracks().forEach((t) => t.stop());
            workerRef.current?.terminate().catch(() => {});
            workerRef.current = null;
            onDetected(plate);
            return;
          }
        } else {
          lastPlateRef.current = plate;
          consecutiveRef.current = 1;
          setConfirmCount(1);
        }
      } else {
        // No match — reset streak but keep last displayed plate
        lastPlateRef.current = '';
        consecutiveRef.current = 0;
        setConfirmCount(0);
      }
    } catch {
      // OCR error — continue
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setIsOCR(false);
    }
  }

  function handleManualSubmit() {
    const plate = manualInput.trim().toUpperCase();
    if (!plate) return;
    stopAll();
    onDetected(plate);
  }

  function handleClose() {
    stopAll();
    onClose();
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Hidden OCR canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera feed */}
      <video
        ref={videoRef}
        className={cn(
          'absolute inset-0 w-full h-full object-cover',
          manualMode && 'opacity-20',
        )}
        playsInline
        muted
      />

      {/* SVG overlay: dark mask with guide-box cutout */}
      {!manualMode && phase === 'active' && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Dark overlay with cutout */}
          <path
            d="M0 0 H100 V100 H0 Z M5 36 H95 V54 H5 Z"
            fill="rgba(0,0,0,0.55)"
            fillRule="evenodd"
          />
          {/* Guide box border */}
          <rect
            x="5" y="36" width="90" height="18"
            fill="none"
            stroke={confirmCount > 0 ? '#4ade80' : 'rgba(255,255,255,0.7)'}
            strokeWidth="0.4"
          />
          {/* Corner accents — top-left */}
          <path d="M5 39 L5 36 L8 36"   stroke={confirmCount > 0 ? '#4ade80' : 'white'} strokeWidth="0.8" fill="none" />
          {/* top-right */}
          <path d="M92 36 L95 36 L95 39"  stroke={confirmCount > 0 ? '#4ade80' : 'white'} strokeWidth="0.8" fill="none" />
          {/* bottom-left */}
          <path d="M5 51 L5 54 L8 54"    stroke={confirmCount > 0 ? '#4ade80' : 'white'} strokeWidth="0.8" fill="none" />
          {/* bottom-right */}
          <path d="M92 54 L95 54 L95 51"  stroke={confirmCount > 0 ? '#4ade80' : 'white'} strokeWidth="0.8" fill="none" />
          {/* Hint text below box */}
          {!lastPlate && (
            <text x="50" y="58.5" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="2.5">
              將車牌對準框內
            </text>
          )}
        </svg>
      )}

      {/* UI overlay */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 pt-safe-top">
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white"
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>

          <span className="text-white text-sm font-medium bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
            {manualMode ? '手動輸入車牌' : '掃描車牌'}
          </span>

          <div className="w-10" />
        </div>

        {/* Center area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          {/* Loading */}
          {phase === 'loading' && (
            <div className="text-center text-white space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-sm opacity-80">初始化辨識引擎與相機…</p>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="text-center text-white space-y-3">
              <Camera className="h-12 w-12 mx-auto opacity-40" />
              <p className="text-red-400 font-medium">{errorMsg}</p>
            </div>
          )}

          {/* Active scanning status */}
          {phase === 'active' && !manualMode && (
            <div className="mt-[56%] w-full max-w-xs space-y-3 text-center">
              {/* Detected plate */}
              {lastPlate ? (
                <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 inline-block">
                  <p className="text-xl font-mono font-bold text-white tracking-widest">{lastPlate}</p>
                </div>
              ) : null}

              {/* Confirmation dots */}
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: CONFIRM_THRESHOLD }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-2.5 h-2.5 rounded-full transition-all duration-200',
                      i < confirmCount ? 'bg-green-400 scale-110' : 'bg-white/30',
                    )}
                  />
                ))}
                {lastPlate && (
                  <span className="text-xs text-white/60 ml-1">
                    確認中 {confirmCount}/{CONFIRM_THRESHOLD}
                  </span>
                )}
              </div>

              {/* OCR indicator */}
              {isOCR && (
                <div className="flex items-center justify-center gap-1.5 text-white/60 text-xs">
                  <ScanLine className="h-3 w-3 animate-pulse" />
                  辨識中…
                </div>
              )}
            </div>
          )}

          {/* Manual input */}
          {manualMode && (
            <div className="w-full max-w-xs space-y-3 bg-black/70 backdrop-blur-sm rounded-2xl p-5">
              <p className="text-white text-center text-sm font-medium">輸入車牌號碼</p>
              <Input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="ABC-1234"
                className="text-center text-lg font-mono uppercase tracking-widest h-12 bg-white/10 border-white/30 text-white placeholder:text-white/30 focus:border-white/60"
                autoFocus
                maxLength={10}
              />
              <Button
                className="w-full"
                onClick={handleManualSubmit}
                disabled={!manualInput.trim()}
              >
                確認車牌
              </Button>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="pb-safe-bottom flex justify-center py-6">
          <Button
            variant="outline"
            className="bg-black/50 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:border-white/50 hover:text-white gap-2"
            onClick={() => setManualMode((v) => !v)}
          >
            <Keyboard className="h-4 w-4" />
            {manualMode ? '返回掃描' : '手動輸入'}
          </Button>
        </div>
      </div>
    </div>
  );
}
