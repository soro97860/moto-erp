import { useRef, useEffect, useState } from 'react';
import { Eraser, Check, X } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

export function SignaturePad({ onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    // Use rAF so the canvas is fully laid out before reading its dimensions
    const raf = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.offsetWidth;
      const cssH = canvas.offsetHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function getXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setIsEmpty(false);
    const pos = getXY(e);
    lastPos.current = pos;
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getXY(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setIsDrawing(false);
    lastPos.current = null;
  }

  function handleClear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    setIsEmpty(true);
  }

  function handleConfirm() {
    if (isEmpty) return;
    onConfirm(canvasRef.current!.toDataURL('image/png'));
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-lg">客戶簽名</h2>
            <p className="text-xs text-gray-400 mt-0.5">請以手指或觸控筆在下方框內簽名</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Canvas */}
        <div className="px-5 pt-4 pb-2">
          <canvas
            ref={canvasRef}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 cursor-crosshair"
            style={{ height: 260, touchAction: 'none', display: 'block' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
          {isEmpty && (
            <p className="text-center text-sm text-gray-400 mt-2 pointer-events-none">
              ✍ 請在此簽名
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex gap-3 justify-end border-t mt-2">
          <Button variant="outline" size="sm" onClick={handleClear} disabled={isEmpty}>
            <Eraser className="h-4 w-4" /> 清除重簽
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isEmpty}>
            <Check className="h-4 w-4" /> 確認簽名
          </Button>
        </div>
      </div>
    </div>
  );
}
