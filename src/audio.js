import { clamp } from './utils.js';

/**
 * A fully procedural soundscape: no audio files, no autoplay surprises.
 * The context is created and resumed from a user gesture by start().
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.started = false;
    this.muted = false;
    this.volume = 0.62;
    this.nodes = {};
    this.flight = { throttle: 0.2, warp: 0, speed: 0 };
  }

  init() {
    if (this.ctx) return this.ctx;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 3.2;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.32;
    this.master.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    this.createAmbience();
    this.createThrust();
    this.createWarp();
    return this.ctx;
  }

  createBus(volume = 0) {
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.connect(this.master);
    return gain;
  }

  createNoiseBuffer(seconds = 3) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.86 + white * 0.14;
      data[i] = white * 0.45 + last * 0.55;
    }
    return buffer;
  }

  createNoiseSource(playbackRate = 1) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer || (this.noiseBuffer = this.createNoiseBuffer(4));
    source.loop = true;
    source.playbackRate.value = playbackRate;
    return source;
  }

  createAmbience() {
    const bus = this.createBus(0.7);
    this.nodes.ambienceBus = bus;

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 340;
    droneFilter.Q.value = 0.8;
    droneFilter.connect(bus);

    const voices = [
      [36.7, 0.016, 'sine', -3],
      [55, 0.02, 'sine', 2],
      [82.41, 0.013, 'triangle', -4],
      [110.08, 0.007, 'sine', 5],
      [164.82, 0.004, 'sine', -7],
    ];
    voices.forEach(([frequency, volume, type, detune]) => {
      const oscillator = this.ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      oscillator.connect(gain);
      gain.connect(droneFilter);
      oscillator.start();
    });

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.035;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 130;
    lfo.connect(lfoDepth);
    lfoDepth.connect(droneFilter.frequency);
    lfo.start();

    // Solar wind: filtered noise with its own very slow swell.
    const wind = this.createNoiseSource(0.34);
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.55;
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.032;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(bus);
    wind.start();

    const windLfo = this.ctx.createOscillator();
    windLfo.frequency.value = 0.055;
    const windLfoDepth = this.ctx.createGain();
    windLfoDepth.gain.value = 0.014;
    windLfo.connect(windLfoDepth);
    windLfoDepth.connect(windGain.gain);
    windLfo.start();

    // A far-away high shimmer keeps the low drone from feeling dead.
    const shimmerOsc = this.ctx.createOscillator();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.value = 1318.5;
    const shimmerGain = this.ctx.createGain();
    shimmerGain.gain.value = 0.003;
    const shimmerLfo = this.ctx.createOscillator();
    shimmerLfo.frequency.value = 0.087;
    const shimmerDepth = this.ctx.createGain();
    shimmerDepth.gain.value = 0.0024;
    shimmerLfo.connect(shimmerDepth);
    shimmerDepth.connect(shimmerGain.gain);
    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(bus);
    shimmerOsc.start();
    shimmerLfo.start();

    this.nodes.ambience = { bus, windGain };
  }

  createThrust() {
    const bus = this.createBus(0);
    this.nodes.thrustBus = bus;

    const noise = this.createNoiseSource(0.8);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 1.3;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.2;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(bus);
    noise.start();

    const lowOsc = this.ctx.createOscillator();
    lowOsc.type = 'sawtooth';
    lowOsc.frequency.value = 43;
    const lowFilter = this.ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.value = 190;
    const lowGain = this.ctx.createGain();
    lowGain.gain.value = 0.05;
    lowOsc.connect(lowFilter);
    lowFilter.connect(lowGain);
    lowGain.connect(bus);
    lowOsc.start();

    const growl = this.ctx.createOscillator();
    growl.type = 'triangle';
    growl.frequency.value = 88;
    const growlGain = this.ctx.createGain();
    growlGain.gain.value = 0.018;
    growl.connect(growlGain);
    growlGain.connect(bus);
    growl.start();

    this.nodes.thrust = { noise, filter, lowOsc, growl };
  }

  createWarp() {
    const bus = this.createBus(0);
    this.nodes.warpBus = bus;

    const noise = this.createNoiseSource(1.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.2;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(bus);
    noise.start();

    const oscillators = [];
    [61.7, 92.6, 138.9].forEach((frequency, index) => {
      const oscillator = this.ctx.createOscillator();
      oscillator.type = index === 2 ? 'triangle' : 'sawtooth';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = (index - 1) * 7;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.035 / (index + 1);
      oscillator.connect(gain);
      gain.connect(bus);
      oscillator.start();
      oscillators.push(oscillator);
    });

    const whine = this.ctx.createOscillator();
    whine.type = 'sine';
    whine.frequency.value = 760;
    const whineGain = this.ctx.createGain();
    whineGain.gain.value = 0.012;
    whine.connect(whineGain);
    whineGain.connect(bus);
    whine.start();

    this.nodes.warp = { filter, oscillators, whine, whineGain };
  }

  async start() {
    const context = this.init();
    if (!context) return false;
    try {
      await context.resume();
    } catch (error) {
      // The browser can still let a later gesture resume it.
    }
    if (!this.started) {
      this.started = true;
      this.master.gain.cancelScheduledValues(context.currentTime);
      this.master.gain.setValueAtTime(0.0001, context.currentTime);
      this.master.gain.exponentialRampToValueAtTime(
        this.muted ? 0.0001 : this.volume,
        context.currentTime + 1.4,
      );
    }
    return true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setFlight({ throttle = 0, warp = 0, speed = 0 } = {}) {
    this.flight = {
      throttle: clamp(throttle, 0, 1.3),
      warp: clamp(warp, 0, 1),
      speed: Math.max(0, speed),
    };
    if (!this.ctx || !this.started) return;
    const now = this.ctx.currentTime;
    const { thrust, warp: warpNodes, thrustBus, warpBus } = this.nodes;
    const energy = clamp(this.flight.throttle + this.flight.warp * 0.75, 0, 1.4);
    thrustBus.gain.setTargetAtTime(energy > 0.02 ? 0.34 : 0.02, now, 0.18);
    warpBus.gain.setTargetAtTime(this.flight.warp * 0.38, now, 0.22);
    thrust.filter.frequency.setTargetAtTime(
      220 + energy * 660 + this.flight.warp * 520,
      now,
      0.24,
    );
    thrust.lowOsc.frequency.setTargetAtTime(
      38 + energy * 22 + this.flight.warp * 11,
      now,
      0.3,
    );
    thrust.growl.frequency.setTargetAtTime(82 + energy * 28, now, 0.35);
    warpNodes.filter.frequency.setTargetAtTime(
      700 + this.flight.warp * 2600,
      now,
      0.3,
    );
    warpNodes.whine.frequency.setTargetAtTime(
      540 + this.flight.warp * 1450,
      now,
      0.4,
    );
    warpNodes.oscillators.forEach((oscillator, index) => {
      oscillator.frequency.setTargetAtTime(
        [61.7, 92.6, 138.9][index] * (1 + this.flight.warp * 0.42),
        now,
        0.4,
      );
    });
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.ctx || !this.master) return this.muted;
    const now = this.ctx.currentTime;
    const target = this.muted ? 0.0001 : this.volume;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(target, now, 0.06);
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  tone({ frequency = 440, endFrequency = frequency, duration = 0.2, volume = 0.05, type = 'sine', delay = 0 }) {
    if (!this.ctx || !this.started || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      start + duration,
    );
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  noiseBurst({ duration = 0.3, volume = 0.06, frequency = 220, delay = 0 } = {}) {
    if (!this.ctx || !this.started || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(Math.max(0.25, duration));
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  click() {
    this.tone({ frequency: 620, endFrequency: 520, duration: 0.09, volume: 0.025, type: 'sine' });
  }

  confirm() {
    this.tone({ frequency: 540, endFrequency: 720, duration: 0.16, volume: 0.035 });
    this.tone({ frequency: 1080, endFrequency: 1080, duration: 0.2, volume: 0.018, delay: 0.06 });
  }

  back() {
    this.tone({ frequency: 360, endFrequency: 230, duration: 0.2, volume: 0.03, type: 'triangle' });
  }

  autopilot() {
    this.tone({ frequency: 440, endFrequency: 660, duration: 0.18, volume: 0.025 });
    this.tone({ frequency: 660, endFrequency: 880, duration: 0.2, volume: 0.022, delay: 0.12 });
  }

  detach() {
    this.noiseBurst({ duration: 0.42, volume: 0.12, frequency: 260 });
    this.tone({ frequency: 92, endFrequency: 38, duration: 0.5, volume: 0.11, type: 'sine' });
    this.tone({ frequency: 1240, endFrequency: 680, duration: 0.32, volume: 0.018, type: 'triangle', delay: 0.1 });
  }

  dock() {
    this.tone({ frequency: 140, endFrequency: 70, duration: 0.35, volume: 0.08, type: 'triangle' });
    this.tone({ frequency: 880, endFrequency: 440, duration: 0.25, volume: 0.02, delay: 0.08 });
  }

  discovery() {
    [392, 523.25, 659.25, 987.77].forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 1.15 - index * 0.1,
        volume: 0.04 - index * 0.004,
        type: index === 0 ? 'sine' : 'triangle',
        delay: index * 0.12,
      });
    });
    this.noiseBurst({ duration: 1.2, volume: 0.022, frequency: 1600, delay: 0.05 });
  }

  complete() {
    [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 2.4 - index * 0.15,
        volume: 0.036 - index * 0.003,
        type: 'triangle',
        delay: index * 0.16,
      });
    });
  }

  hullAlert() {
    this.tone({ frequency: 170, endFrequency: 120, duration: 0.24, volume: 0.05, type: 'sawtooth' });
    this.tone({ frequency: 170, endFrequency: 120, duration: 0.24, volume: 0.04, type: 'sawtooth', delay: 0.3 });
  }

  dispose() {
    if (!this.ctx) return;
    this.ctx.close().catch(() => {});
    this.ctx = null;
    this.started = false;
    this.nodes = {};
  }
}

export function createAudioEngine() {
  return new AudioEngine();
}