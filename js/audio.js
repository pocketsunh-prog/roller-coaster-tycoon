// Tiny WebAudio sound effects (no assets needed)
let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0) {
  try {
    const a = ac();
    const t = a.currentTime + when;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) { /* audio unavailable */ }
}

export const sfx = {
  place() { tone(140, 0.12, 'square', 0.1); tone(90, 0.18, 'triangle', 0.1, 0.02); },
  undo() { tone(220, 0.1, 'square', 0.08); },
  cash() { tone(880, 0.09, 'sine', 0.1); tone(1320, 0.14, 'sine', 0.1, 0.08); },
  error() { tone(110, 0.25, 'sawtooth', 0.1); },
  depart() { tone(300, 0.3, 'triangle', 0.12); tone(450, 0.3, 'triangle', 0.1, 0.12); },
  open() { tone(523, 0.12, 'square', 0.09); tone(659, 0.12, 'square', 0.09, 0.1); tone(784, 0.2, 'square', 0.09, 0.2); },
};
