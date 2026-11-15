// New-order chime via WebAudio. Browsers block audio until the user interacts, so the layout
// has an "Enable sound" button that calls enableSound() from a click.
let ctx: AudioContext | null = null;
let enabled = false;

export const soundEnabled = () => enabled;

export function enableSound() {
  ctx ??= new AudioContext();
  void ctx.resume();
  enabled = true;
  chime();
}

export function chime() {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  [880, 1175].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.4);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(now + i * 0.18);
    osc.stop(now + i * 0.18 + 0.45);
  });
}
