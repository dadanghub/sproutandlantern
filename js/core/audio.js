// Lightweight WebAudio architecture: all sounds are synthesized (no assets).
// - soft forest ambience (day pad + wind, night pad + crickets) crossfaded by phase
// - a short generative music loop (4-bar Am–F–C–G, A/B variations) that
//   darkens through a lowpass as twilight falls
// - small placeholder SFX for planting, watering, harvest, crafting, chimes...
// - a unique little motif per Axie class, played on selection
// The player can never be hurt by sound; everything sits well below 6dBFS.

class AudioMgr {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.dayGain = null;
    this.nightGain = null;
    this.windGain = null;
    this.muted = false;
    this.nightT = 0;
    this._nextCricket = 0;
    this._started = false;
    // music sequencer state
    this._musicOn = false;
    this._musicBus = null;
    this._musicFilter = null;
    this._musicStep = 0;
    this._musicNextT = 0;
    this._musicPass = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    this._pad(this.dayGain = ctx.createGain(), [261.63, 329.63, 392.0], 0.014);
    this._pad(this.nightGain = ctx.createGain(), [130.81, 174.61, 233.08], 0.02);
    this.dayGain.gain.value = 1;
    this.nightGain.gain.value = 0;

    // music bus: everything in the loop passes through a lowpass that
    // closes as twilight falls (day = airy, night = muffled & far)
    this._musicFilter = ctx.createBiquadFilter();
    this._musicFilter.type = 'lowpass';
    this._musicFilter.frequency.value = 6500;
    this._musicBus = ctx.createGain();
    this._musicBus.gain.value = 0.9;
    this._musicFilter.connect(this._musicBus).connect(this.master);

    // wind: looped filtered noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.012;
    src.connect(lp).connect(this.windGain).connect(this.master);
    src.start();

    this._started = true;
  }

  _pad(gainNode, freqs, amp) {
    const ctx = this.ctx;
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = amp;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = amp * 0.5;
      lfo.connect(lfoGain).connect(g.gain);
      o.connect(g).connect(gainNode);
      gainNode.connect(this.master);
      o.start();
      lfo.start();
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ------------------------------------------------------------ music ----
  // A short 4-bar loop at 84 BPM (32 eighth-note steps): Am · F · C · G.
  // Pad + bass + a gentle pentatonic melody; every other pass plays a
  // variation, so the full A/B pattern takes ~23s to repeat.
  _musicOn() { return this._musicOn && this.ctx; }

  startMusic() {
    if (!this.ctx || this._musicOn) return;
    this._musicOn = true;
    this._musicStep = 0;
    this._musicPass = 0;
    this._musicNextT = this.ctx.currentTime + 0.2;
  }

  stopMusic() {
    this._musicOn = false;
  }

  _scheduleMusic() {
    const STEP = 60 / 84 / 2; // 8th notes
    while (this._musicNextT < this.ctx.currentTime + 0.45) {
      this._musicNote(this._musicStep, this._musicNextT, this._musicPass % 2);
      this._musicNextT += STEP;
      if (++this._musicStep >= 64) {
        this._musicStep = 0;
        this._musicPass++;
      }
    }
  }

  _musicNote(step, at, pass) {
    const BARS = [
      { bass: 110.0, pad: [220.0, 261.63, 329.63] },  // Am
      { bass: 87.31, pad: [174.61, 220.0, 261.63] },  // F
      { bass: 130.81, pad: [261.63, 329.63, 392.0] }, // C
      { bass: 98.0, pad: [196.0, 246.94, 293.66] },   // G
    ];
    const MELODY_A = [
      0, 0, 659.25, 0, 587.33, 523.25, 0, 0,
      0, 523.25, 0, 493.88, 0, 440.0, 0, 0,
      0, 0, 587.33, 0, 659.25, 783.99, 0, 0,
      0, 783.99, 0, 659.25, 0, 523.25, 440.0, 0,
    ];
    const MELODY_B = [
      523.25, 0, 440.0, 0, 0, 0, 329.63, 0,
      0, 440.0, 523.25, 0, 349.23, 0, 0, 0,
      0, 0, 523.25, 587.33, 0, 523.25, 440.0, 0,
      0, 0, 440.0, 0, 493.88, 0, 587.33, 0,
    ];
    const bar = Math.floor(step / 8);
    const inBar = step % 8;
    const chord = BARS[bar];
    const ctx = this.ctx;
    const bus = this._musicBus;

    // pad: whole-bar soft chord
    if (inBar === 0) {
      for (const f of chord.pad) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.017, at + 0.45);
        g.gain.setValueAtTime(0.017, at + 2.4);
        g.gain.linearRampToValueAtTime(0.0001, at + 3.1);
        o.connect(g).connect(bus);
        o.start(at);
        o.stop(at + 3.2);
      }
    }
    // bass: beats 1 & 3
    if (inBar === 0 || inBar === 4) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = chord.bass;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.05, at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(g).connect(bus);
      o.start(at);
      o.stop(at + 0.55);
    }
    // melody
    const note = (pass ? MELODY_B : MELODY_A)[step];
    if (note) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = note;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.042, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(g).connect(bus);
      o.start(at);
      o.stop(at + 0.55);
    }
  }

  // ------------------------------------------------------- pick motifs ---
  /** A unique little motif per Axie class, played when an Axie is chosen. */
  axiePick(cls) {
    switch (cls) {
      case 'plant': // sprout: rising plucks + a leafy shimmer
        this.blip(392.0, 0.12, 'triangle', 0.05);
        this.blip(659.25, 0.16, 'triangle', 0.05, 0.09);
        this.noiseBurst(0.1, 2400, 0.015);
        break;
      case 'aquatic': // droplet plop with a soft echo
        this._tone(880, 440, 0.16, 'sine', 0.05);
        this._tone(660, 392, 0.14, 'sine', 0.025, 0.13);
        break;
      case 'bird': // quick high chirp trill
        this._tone(2100, 2900, 0.07, 'sine', 0.035);
        this._tone(2400, 3200, 0.07, 'sine', 0.035, 0.09);
        this._tone(1900, 2700, 0.1, 'sine', 0.03, 0.19);
        break;
      case 'beast': // deep rumbling thud
        this._tone(130, 55, 0.32, 'sine', 0.07);
        this.noiseBurst(0.14, 180, 0.03);
        break;
      case 'bug': // tiny happy buzz
        this.blip(820, 0.05, 'square', 0.02);
        this.blip(1180, 0.05, 'square', 0.02, 0.07);
        this.blip(950, 0.07, 'square', 0.018, 0.15);
        break;
      case 'reptile': // soft hiss + low rumble
        this.noiseBurst(0.28, 2600, 0.018);
        this._tone(90, 60, 0.34, 'sine', 0.05, 0.04);
        break;
      default:
        this.blip(600, 0.08, 'triangle', 0.04);
    }
  }

  /** Call every frame with the current twilight blend (0 = day, 1 = night). */
  update(dt, nightT) {
    if (!this.ctx) return;
    this.nightT = nightT;
    const t = this.ctx.currentTime;
    this.dayGain.gain.setTargetAtTime(1 - nightT * 0.85, t, 0.8);
    this.nightGain.gain.setTargetAtTime(nightT, t, 0.8);
    this.windGain.gain.setTargetAtTime(0.008 + nightT * 0.012, t, 1.2);
    // music: schedule ahead + let the filter close as night falls
    if (this._musicOn) {
      this._scheduleMusic();
      this._musicFilter.frequency.setTargetAtTime(6500 - nightT * 4900, t, 0.6);
      this._musicBus.gain.setTargetAtTime(0.9 - nightT * 0.25, t, 1.2);
    }
    // crickets
    if (nightT > 0.25) {
      if (t > this._nextCricket) {
        this._cricket(t);
        this._nextCricket = t + 0.35 + Math.random() * 0.8;
      }
    }
  }

  _cricket(t) {
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.07;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 4200 + Math.random() * 300;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.011, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
      o.connect(g).connect(this.master);
      o.start(at);
      o.stop(at + 0.08);
    }
  }

  blip(freq, dur = 0.1, type = 'sine', gain = 0.06, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Tone with a pitch glide — droplets, chirps, thuds. */
  _tone(f0, f1, dur = 0.2, type = 'sine', gain = 0.05, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noiseBurst(dur = 0.12, freq = 900, gain = 0.05) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  sfx(name) {
    switch (name) {
      case 'click': this.blip(620, 0.05, 'triangle', 0.04); break;
      case 'plant': this.blip(180, 0.12, 'triangle', 0.07); this.noiseBurst(0.1, 500, 0.04); break;
      case 'water': this.noiseBurst(0.16, 1400, 0.045); this.blip(940, 0.08, 'sine', 0.03, 0.03); break;
      case 'harvest':
        this.blip(523, 0.1, 'triangle', 0.05);
        this.blip(659, 0.1, 'triangle', 0.05, 0.07);
        this.blip(784, 0.14, 'triangle', 0.05, 0.14);
        break;
      case 'chime': this.blip(880, 0.4, 'sine', 0.05); this.blip(1318.5, 0.5, 'sine', 0.04, 0.05); break;
      case 'big':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.blip(f, 0.5, 'sine', 0.055, i * 0.12));
        break;
      case 'craft': this.blip(440, 0.1, 'triangle', 0.05); this.blip(554, 0.14, 'triangle', 0.05, 0.08); break;
      case 'level': [392, 493.88, 587.33, 783.99].forEach((f, i) => this.blip(f, 0.35, 'sine', 0.05, i * 0.09)); break;
      case 'spirit': this.blip(987.77, 0.3, 'sine', 0.045); this.blip(1318.5, 0.4, 'sine', 0.04, 0.09); break;
      case 'pet': this.blip(740, 0.07, 'sine', 0.045); this.blip(880, 0.09, 'sine', 0.04, 0.05); break;
      case 'error': this.blip(170, 0.16, 'sine', 0.04); break;
      case 'pulse':
        this.blip(220, 0.35, 'sine', 0.05);
        this.blip(880, 0.5, 'sine', 0.04, 0.12);
        break;
      case 'rest': this.blip(392, 0.5, 'sine', 0.04); this.blip(523.25, 0.7, 'sine', 0.035, 0.15); break;
      case 'build':
        this.noiseBurst(0.15, 700, 0.05);
        this.blip(261.63, 0.4, 'triangle', 0.05, 0.1);
        break;
      default: this.blip(600, 0.06, 'sine', 0.04);
    }
  }
}

export const audio = new AudioMgr();
