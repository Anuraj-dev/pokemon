/**
 * audio — fully procedural Web Audio chiptune music + SFX. Zero sound files.
 * Music is composed deterministically per track id (seeded RNG over a chord
 * progression), sequenced with a look-ahead scheduler.
 */
import { RNG } from '../core/rng';

export type TrackId =
  | 'title'
  | 'town'
  | 'route'
  | 'forest'
  | 'cave'
  | 'gym'
  | 'battle-wild'
  | 'battle-trainer'
  | 'battle-gym'
  | 'battle-final'
  | 'evil'
  | 'victory'
  | 'center'
  | 'credits';

interface TrackConfig {
  tempo: number; // BPM
  root: number; // MIDI note of key root
  minor: boolean;
  /** chord progression in scale degrees (0-based), one chord per bar */
  progression: number[];
  leadDensity: number; // 0..1 chance a 8th-note slot has a note
  bassPattern: 'pulse' | 'walk' | 'drone';
  drums: boolean;
  seed: number;
  leadWave: OscillatorType;
}

const TRACKS: Record<TrackId, TrackConfig> = {
  title: { tempo: 96, root: 57, minor: false, progression: [0, 5, 3, 4], leadDensity: 0.65, bassPattern: 'pulse', drums: true, seed: 101, leadWave: 'square' },
  town: { tempo: 100, root: 60, minor: false, progression: [0, 3, 4, 0], leadDensity: 0.55, bassPattern: 'pulse', drums: false, seed: 202, leadWave: 'triangle' },
  route: { tempo: 122, root: 62, minor: false, progression: [0, 4, 5, 3], leadDensity: 0.7, bassPattern: 'walk', drums: true, seed: 303, leadWave: 'square' },
  forest: { tempo: 92, root: 57, minor: true, progression: [0, 2, 4, 5], leadDensity: 0.45, bassPattern: 'drone', drums: false, seed: 404, leadWave: 'triangle' },
  cave: { tempo: 84, root: 55, minor: true, progression: [0, 5, 0, 6], leadDensity: 0.35, bassPattern: 'drone', drums: false, seed: 505, leadWave: 'sine' },
  gym: { tempo: 116, root: 59, minor: true, progression: [0, 3, 0, 4], leadDensity: 0.6, bassPattern: 'pulse', drums: true, seed: 606, leadWave: 'square' },
  'battle-wild': { tempo: 150, root: 57, minor: true, progression: [0, 0, 5, 4], leadDensity: 0.8, bassPattern: 'walk', drums: true, seed: 707, leadWave: 'square' },
  'battle-trainer': { tempo: 156, root: 59, minor: true, progression: [0, 5, 3, 4], leadDensity: 0.85, bassPattern: 'walk', drums: true, seed: 808, leadWave: 'square' },
  'battle-gym': { tempo: 162, root: 60, minor: true, progression: [0, 3, 5, 4], leadDensity: 0.85, bassPattern: 'walk', drums: true, seed: 909, leadWave: 'square' },
  'battle-final': { tempo: 168, root: 62, minor: true, progression: [0, 5, 6, 4], leadDensity: 0.9, bassPattern: 'walk', drums: true, seed: 1010, leadWave: 'square' },
  evil: { tempo: 108, root: 56, minor: true, progression: [0, 6, 0, 5], leadDensity: 0.5, bassPattern: 'pulse', drums: true, seed: 1111, leadWave: 'sawtooth' },
  victory: { tempo: 132, root: 60, minor: false, progression: [0, 4, 0, 4], leadDensity: 0.75, bassPattern: 'pulse', drums: true, seed: 1212, leadWave: 'square' },
  center: { tempo: 104, root: 64, minor: false, progression: [0, 3, 1, 4], leadDensity: 0.5, bassPattern: 'pulse', drums: false, seed: 1313, leadWave: 'triangle' },
  credits: { tempo: 90, root: 60, minor: false, progression: [0, 5, 3, 4], leadDensity: 0.6, bassPattern: 'pulse', drums: false, seed: 1414, leadWave: 'triangle' },
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

interface NoteEvent {
  step: number; // 8th-note index in the loop
  midi: number;
  dur: number; // in 8th notes
  channel: 'lead' | 'bass' | 'arp';
  vel: number;
}

/** Deterministically compose an 8-bar loop for a track. */
function compose(cfg: TrackConfig): { events: NoteEvent[]; steps: number } {
  const rng = new RNG(cfg.seed);
  const scale = cfg.minor ? MINOR : MAJOR;
  const bars = cfg.progression.length * 2; // play progression twice w/ variation
  const stepsPerBar = 8;
  const steps = bars * stepsPerBar;
  const events: NoteEvent[] = [];

  const degreeNote = (degree: number, octave: number) =>
    cfg.root + scale[((degree % 7) + 7) % 7] + 12 * (octave + Math.floor(degree / 7));

  for (let bar = 0; bar < bars; bar++) {
    const chord = cfg.progression[bar % cfg.progression.length];
    // Bass
    for (let s = 0; s < stepsPerBar; s++) {
      const step = bar * stepsPerBar + s;
      if (cfg.bassPattern === 'pulse' && s % 2 === 0) {
        events.push({ step, midi: degreeNote(chord, -1), dur: 1, channel: 'bass', vel: 0.8 });
      } else if (cfg.bassPattern === 'walk' && s % 2 === 0) {
        const walk = [chord, chord + 4, chord + 2, chord + 4][Math.floor(s / 2) % 4];
        events.push({ step, midi: degreeNote(walk, -1), dur: 1, channel: 'bass', vel: 0.8 });
      } else if (cfg.bassPattern === 'drone' && s === 0) {
        events.push({ step, midi: degreeNote(chord, -1), dur: stepsPerBar, channel: 'bass', vel: 0.6 });
      }
    }
    // Arp (chord tones on off-beats)
    if (cfg.drums || cfg.leadDensity > 0.5) {
      for (let s = 1; s < stepsPerBar; s += 2) {
        const tone = [chord, chord + 2, chord + 4][((bar + s) >> 1) % 3];
        events.push({ step: bar * stepsPerBar + s, midi: degreeNote(tone, 0), dur: 1, channel: 'arp', vel: 0.35 });
      }
    }
    // Lead melody
    let prevDegree = chord + 7;
    for (let s = 0; s < stepsPerBar; s++) {
      if (!rng.chance(cfg.leadDensity)) continue;
      const drift = rng.int(-2, 2);
      let degree = prevDegree + drift;
      if (s === 0) degree = chord + 7 + rng.int(0, 2); // land on chord tone at bar start
      degree = Math.max(chord + 4, Math.min(chord + 13, degree));
      prevDegree = degree;
      const dur = rng.chance(0.25) ? 2 : 1;
      events.push({ step: bar * stepsPerBar + s, midi: degreeNote(degree, 0), dur, channel: 'lead', vel: 0.55 });
      if (dur === 2) s++;
    }
  }
  return { events, steps };
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;

  musicVol = 0.5;
  sfxVol = 0.6;

  private currentTrack: TrackId | null = null;
  private schedTimer: number | null = null;
  private loop: { events: NoteEvent[]; steps: number } | null = null;
  private trackCfg: TrackConfig | null = null;
  private nextStep = 0;
  private nextStepTime = 0;

  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVol;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.master);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** Call on any user gesture to unlock audio on mobile/Chrome. */
  unlock(): void {
    const ctx = this.ensureCtx();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  setMusicVolume(v: number): void {
    this.musicVol = v;
    if (this.ctx) this.musicGain.gain.value = v;
  }

  setSfxVolume(v: number): void {
    this.sfxVol = v;
    if (this.ctx) this.sfxGain.gain.value = v;
  }

  // ----------------------------------------------------------------- cries

  private cryCache = new Map<string, HTMLAudioElement>();

  /** Play a creature's cry from assets/cries/<speciesId>.ogg, if present. */
  playCry(speciesId: string): void {
    let el = this.cryCache.get(speciesId);
    if (!el) {
      el = new Audio(`assets/cries/${speciesId}.ogg`);
      el.preload = 'auto';
      this.cryCache.set(speciesId, el);
    }
    el.volume = this.sfxVol;
    el.currentTime = 0;
    void el.play().catch(() => {
      /* file missing or autoplay blocked — synth game continues fine */
    });
  }

  // ----------------------------------------------------------------- music

  playMusic(track: TrackId): void {
    if (this.currentTrack === track) return;
    this.stopMusic();
    const ctx = this.ensureCtx();
    if (!ctx) return;
    this.currentTrack = track;
    this.trackCfg = TRACKS[track];
    this.loop = compose(this.trackCfg);
    this.nextStep = 0;
    this.nextStepTime = ctx.currentTime + 0.1;
    this.schedTimer = window.setInterval(() => this.schedule(), 90);
  }

  stopMusic(): void {
    if (this.schedTimer !== null) {
      clearInterval(this.schedTimer);
      this.schedTimer = null;
    }
    this.currentTrack = null;
    this.loop = null;
  }

  getCurrentTrack(): TrackId | null {
    return this.currentTrack;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.loop || !this.trackCfg) return;
    const stepDur = 60 / this.trackCfg.tempo / 2; // 8th notes
    const horizon = ctx.currentTime + 0.35;
    while (this.nextStepTime < horizon) {
      const stepInLoop = this.nextStep % this.loop.steps;
      for (const ev of this.loop.events) {
        if (ev.step !== stepInLoop) continue;
        this.playNote(ev, this.nextStepTime, stepDur);
      }
      if (this.trackCfg.drums) {
        const beat = stepInLoop % 8;
        if (beat === 0) this.drum(this.nextStepTime, 'kick');
        else if (beat === 4) this.drum(this.nextStepTime, 'snare');
        else if (beat % 2 === 1) this.drum(this.nextStepTime, 'hat');
      }
      this.nextStep++;
      this.nextStepTime += stepDur;
    }
  }

  private playNote(ev: NoteEvent, time: number, stepDur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = ev.channel === 'bass' ? 'triangle' : ev.channel === 'arp' ? 'square' : this.trackCfg!.leadWave;
    osc.frequency.value = midiToFreq(ev.midi);
    const dur = ev.dur * stepDur;
    const vel = ev.vel * (ev.channel === 'arp' ? 0.5 : 1);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vel * 0.22, time + 0.01);
    gain.gain.setValueAtTime(vel * 0.22, time + dur * 0.6);
    gain.gain.linearRampToValueAtTime(0.0001, time + dur * 0.95);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur);
  }

  private drum(time: number, kind: 'kick' | 'snare' | 'hat'): void {
    const ctx = this.ctx!;
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.13);
    } else {
      const len = kind === 'snare' ? 0.09 : 0.03;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = kind === 'snare' ? 0.25 : 0.08;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = kind === 'snare' ? 1500 : 6000;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      src.start(time);
    }
  }

  // ------------------------------------------------------------------- sfx

  private blip(freqStart: number, freqEnd: number, dur: number, type: OscillatorType = 'square', vol = 0.25, when = 0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, freq: number, when = 0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
  }

  sfxMenuMove(): void { this.blip(880, 880, 0.04, 'square', 0.12); }
  sfxMenuSelect(): void { this.blip(660, 1320, 0.07, 'square', 0.18); }
  sfxMenuCancel(): void { this.blip(440, 220, 0.08, 'square', 0.15); }
  sfxBump(): void { this.blip(120, 80, 0.06, 'triangle', 0.2); }

  sfxHit(mult: number): void {
    if (mult > 1) {
      this.noiseBurst(0.18, 0.4, 900);
      this.blip(300, 80, 0.18, 'sawtooth', 0.3);
    } else if (mult < 1) {
      this.noiseBurst(0.08, 0.2, 500);
    } else {
      this.noiseBurst(0.12, 0.3, 700);
      this.blip(220, 110, 0.1, 'square', 0.15);
    }
  }

  sfxFaint(): void {
    this.blip(440, 55, 0.45, 'sawtooth', 0.25);
  }

  sfxThrow(): void { this.blip(300, 900, 0.18, 'sine', 0.2); }
  sfxBallShake(): void { this.blip(200, 150, 0.07, 'square', 0.2); }
  sfxCatch(): void {
    this.blip(523, 523, 0.09, 'square', 0.2);
    this.blip(659, 659, 0.09, 'square', 0.2, 0.1);
    this.blip(784, 784, 0.2, 'square', 0.2, 0.2);
  }

  sfxHeal(): void {
    [659, 784, 988, 1319].forEach((f, i) => this.blip(f, f, 0.12, 'triangle', 0.18, i * 0.09));
  }

  sfxLevelUp(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, f, 0.1, 'square', 0.2, i * 0.07));
  }

  sfxEncounter(): void {
    this.blip(1200, 200, 0.3, 'sawtooth', 0.2);
    this.blip(900, 150, 0.3, 'square', 0.15, 0.05);
  }

  sfxBadge(): void {
    [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => this.blip(f, f, 0.12, 'square', 0.2, i * 0.1));
  }

  sfxEvolve(): void {
    [440, 554, 659, 880, 1109, 1319].forEach((f, i) => this.blip(f, f, 0.15, 'triangle', 0.2, i * 0.12));
  }
}

export const audio = new AudioEngine();
