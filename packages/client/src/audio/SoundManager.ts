/**
 * Sound effects manager using the Web Audio API.
 *
 * Synthesizes short tones for game events — no audio files needed.
 * All sounds are non-blocking and won't delay gameplay.
 */

type SoundName =
  | 'tilePlaced'
  | 'moveSubmitted'
  | 'moveRejected'
  | 'timerWarning'
  | 'timerUrgent'
  | 'gameOver'
  | 'pass'
  | 'exchange';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  rampDown = true,
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume if suspended (browsers require user gesture)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);

  if (rampDown) {
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playMultiTone(
  notes: { freq: number; start: number; duration: number; type?: OscillatorType; volume?: number }[],
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = note.type ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);
    gain.gain.setValueAtTime(note.volume ?? 0.12, ctx.currentTime + note.start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.start + note.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + note.start);
    osc.stop(ctx.currentTime + note.start + note.duration);
  }
}

const sounds: Record<SoundName, () => void> = {
  tilePlaced: () => {
    // Short soft click
    playTone(800, 0.05, 'square', 0.06);
  },

  moveSubmitted: () => {
    // Pleasant ascending two-tone
    playMultiTone([
      { freq: 523, start: 0, duration: 0.1 },     // C5
      { freq: 659, start: 0.08, duration: 0.15 },  // E5
    ]);
  },

  moveRejected: () => {
    // Low buzz
    playMultiTone([
      { freq: 200, start: 0, duration: 0.15, type: 'sawtooth', volume: 0.1 },
      { freq: 180, start: 0.1, duration: 0.15, type: 'sawtooth', volume: 0.1 },
    ]);
  },

  timerWarning: () => {
    // Single subtle ping at 10s
    playTone(880, 0.15, 'sine', 0.08);
  },

  timerUrgent: () => {
    // More insistent double-tap at 5s
    playMultiTone([
      { freq: 1047, start: 0, duration: 0.08, volume: 0.12 },
      { freq: 1047, start: 0.12, duration: 0.08, volume: 0.12 },
    ]);
  },

  gameOver: () => {
    // Descending three-note chime
    playMultiTone([
      { freq: 784, start: 0, duration: 0.2 },     // G5
      { freq: 659, start: 0.15, duration: 0.2 },   // E5
      { freq: 523, start: 0.3, duration: 0.35 },    // C5
    ]);
  },

  pass: () => {
    // Soft descending tone
    playTone(440, 0.12, 'sine', 0.08);
  },

  exchange: () => {
    // Quick shuffle-like sound
    playMultiTone([
      { freq: 600, start: 0, duration: 0.06, type: 'triangle', volume: 0.08 },
      { freq: 500, start: 0.05, duration: 0.06, type: 'triangle', volume: 0.08 },
      { freq: 650, start: 0.1, duration: 0.06, type: 'triangle', volume: 0.08 },
    ]);
  },
};

export function playSound(name: SoundName) {
  try {
    sounds[name]();
  } catch {
    // Silently ignore audio errors
  }
}

export type { SoundName };
