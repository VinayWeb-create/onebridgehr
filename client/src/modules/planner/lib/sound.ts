/** Tiny synthesized notification sounds (no audio assets needed). */

export const SOUNDS = [
  { key: 'chime', label: 'Chime' },
  { key: 'bell', label: 'Bell' },
  { key: 'pop', label: 'Pop' },
  { key: 'alert', label: 'Alert' },
] as const;

const PATTERNS: Record<string, Array<[number, number, number]>> = {
  // [frequency Hz, start s, duration s]
  chime: [
    [880, 0, 0.18],
    [1318.5, 0.14, 0.32],
  ],
  bell: [
    [659.3, 0, 0.6],
    [987.8, 0, 0.6],
  ],
  pop: [[523.3, 0, 0.09]],
  alert: [
    [988, 0, 0.12],
    [988, 0.18, 0.12],
    [988, 0.36, 0.2],
  ],
};

let ctx: AudioContext | null = null;

export function playReminderSound(key = 'chime', volume = 0.18) {
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    ctx = ctx || new Ctor();
    const ac = ctx!;
    if (ac.state === 'suspended') void ac.resume();
    const now = ac.currentTime;
    for (const [freq, start, dur] of PATTERNS[key] || PATTERNS.chime) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = key === 'alert' ? 'square' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    }
  } catch {
    /* autoplay restrictions etc. — sound is best-effort */
  }
}
