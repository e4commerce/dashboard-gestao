"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const MAX_DRAG = 2;
const MAX_TYPED = 99;
const STEP = 0.05;

type Props = {
  day: number;
  weight: number;
  share: number;
  avgShare: number;
  onChange: (value: number) => void;
  shareLabel?: string;
  disabled?: boolean;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function snap(v: number): number {
  return Math.round(v / STEP) * STEP;
}

export function WeightCell({
  day,
  weight,
  share,
  avgShare,
  onChange,
  shareLabel,
  disabled = false,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const updateFromY = useCallback(
    (clientY: number) => {
      if (disabled) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top;
      const ratio = 1 - clamp(y / rect.height, 0, 1);
      const next = snap(ratio * MAX_DRAG);
      onChange(next);
    },
    [onChange, disabled],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || editing) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    updateFromY(e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromY(e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  function startEdit() {
    if (disabled) return;
    setEditValue(weight.toFixed(2));
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commitEdit() {
    const raw = editValue.replace(",", ".").trim();
    const v = parseFloat(raw);
    if (Number.isFinite(v) && v >= 0) {
      onChange(snap(clamp(v, 0, MAX_TYPED)));
    }
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  // Barra reflete o SHARE (R$ proporcional). Mexer outro dia muda este share.
  // Normalização: avgShare → 50% (referência), 2×avgShare → 100% (clamped acima).
  const barFill =
    avgShare > 0 ? clamp((share / (2 * avgShare)) * 100, 0, 100) : 0;

  const isAboveDragMax = weight > MAX_DRAG;

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label={`Peso do dia ${day}`}
      aria-valuemin={0}
      aria-valuemax={MAX_TYPED}
      aria-valuenow={weight}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled || editing) return;
        if (e.key === "ArrowUp" || e.key === "ArrowRight") {
          onChange(clamp(snap(weight + STEP), 0, MAX_TYPED));
          e.preventDefault();
        } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
          onChange(clamp(snap(weight - STEP), 0, MAX_TYPED));
          e.preventDefault();
        } else if (e.key === "Enter") {
          startEdit();
          e.preventDefault();
        }
      }}
      className={`relative flex h-[88px] flex-col justify-between overflow-hidden rounded-md border bg-surface-input p-1.5 outline-none transition-opacity focus-visible:border-action-primary ${
        isAboveDragMax ? "border-status-warning/60" : "border-border-default"
      } ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : editing
            ? ""
            : "cursor-ns-resize select-none"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-action-primary/30 transition-[height] duration-200 ease-out"
        style={{ height: `${barFill}%` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0"
        style={{ bottom: "50%" }}
      >
        <div className="h-px w-full bg-border-subtle/50" />
      </div>

      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-medium text-fg-muted">{day}</span>
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step={STEP}
            min={0}
            max={MAX_TYPED}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitEdit();
                (e.currentTarget as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                cancelEdit();
              }
              e.stopPropagation();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-12 rounded border border-action-primary bg-surface-page px-1 py-0 text-right text-[10px] font-semibold tabular-nums text-fg-primary outline-none"
          />
        ) : (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              startEdit();
            }}
            disabled={disabled}
            title="Clique para digitar um valor maior"
            className={`rounded px-1 text-[10px] font-semibold tabular-nums hover:bg-surface-page/80 ${
              isAboveDragMax ? "text-status-warning" : "text-fg-secondary"
            }`}
          >
            {weight.toFixed(2)}
          </button>
        )}
      </div>

      <div className="relative text-right text-[10px] font-medium text-fg-primary tabular-nums truncate transition-opacity">
        {shareLabel ?? "—"}
      </div>
    </div>
  );
}
