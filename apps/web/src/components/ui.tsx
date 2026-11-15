import type { ReactNode } from 'react';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card modal scroll" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label>
      {label}
      {children}
      {hint && <span className="hint muted">{hint}</span>}
    </label>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function ErrorBox({ message, onClear }: { message: string; onClear?: () => void }) {
  if (!message) return null;
  return (
    <div className="error" role="alert" onClick={onClear}>
      {message}
    </div>
  );
}

/** "12.5" -> 1250 paise; null if not a valid non-negative amount. */
export function toPaise(rupeesText: string): number | null {
  const n = Number(rupeesText);
  if (!rupeesText.trim() || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export const paiseToText = (p: number) => String(p / 100);

/** Today as YYYY-MM-DD in the browser's local time. */
export const todayStr = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA');
};
