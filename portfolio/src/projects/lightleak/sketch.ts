import type { Track } from "./catalog";
import { hash } from "./recommend";

/**
 * "Mood sketches": because this prototype has no licensed previews, each track
 * can play a short generated chord loop that hints at its key, tempo and mood.
 * It is not the song, and the interface says so.
 */
let ctx: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;

const MINOR_MOODS = ["melancholic", "mysterious", "cinematic"];

export function stopSketch() {
  stopCurrent?.();
  stopCurrent = null;
}

export function playSketch(track: Track, onEnd: () => void): boolean {
  stopSketch();
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx = ctx ?? new AC();
  void ctx.resume();
  const ac = ctx;
  const root = 48 + Math.floor(hash(track.id) * 12); // MIDI note C3..B3
  const minor = MINOR_MOODS.includes(track.moods[0]);
  const third = minor ? 3 : 4;
  const progression = minor ? [0, 8, 3, 10] : [0, 7, 9, 5];
  const bpm = 64 + track.energy * 70;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

  const master = ac.createGain();
  master.gain.value = 0.0001;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900 + track.energy * 2600;
  master.connect(filter).connect(ac.destination);
  const now = ac.currentTime + 0.05;
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.4);
  const total = bar * progression.length;
  master.gain.setValueAtTime(0.18, now + total - 0.6);
  master.gain.exponentialRampToValueAtTime(0.0001, now + total);

  const oscs: OscillatorNode[] = [];
  progression.forEach((step, i) => {
    const start = now + i * bar;
    [0, third, 7, 12].forEach((interval, v) => {
      const o = ac.createOscillator();
      o.type = track.energy > 0.6 ? "sawtooth" : v === 0 ? "triangle" : "sine";
      o.frequency.value = freq(root + step + interval);
      const g = ac.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(v === 0 ? 0.5 : 0.28, start + 0.08);
      g.gain.linearRampToValueAtTime(0.0, start + bar - 0.02);
      o.connect(g).connect(master);
      o.start(start);
      o.stop(start + bar);
      oscs.push(o);
    });
    // a soft pulse so energy is audible
    const beats = track.energy > 0.5 ? 8 : 4;
    for (let b = 0; b < beats; b++) {
      const t = start + (bar / beats) * b;
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = freq(root + step - 12);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.3, bar / beats));
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.35);
      oscs.push(o);
    }
  });
  const timer = window.setTimeout(() => {
    stopCurrent = null;
    onEnd();
  }, total * 1000 + 100);
  stopCurrent = () => {
    window.clearTimeout(timer);
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.15);
    oscs.forEach((o) => {
      try {
        o.stop(ac.currentTime + 0.2);
      } catch {
        /* already stopped */
      }
    });
    onEnd();
  };
  return true;
}
