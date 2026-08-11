type Tone = {
  frequency: number;
  duration: number;
  delay?: number;
  type?: OscillatorType;
  gain?: number;
};

let audioContext: AudioContext | null = null;
let soundEnabled = true;
let soundVolume = 0.34;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !soundEnabled) return null;
  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === "suspended") void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

function playTones(tones: Tone[]): void {
  const context = getAudioContext();
  if (!context) return;

  const start = context.currentTime;
  tones.forEach(({ frequency, duration, delay = 0, type = "sine", gain = 0.18 }) => {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const time = start + delay;
    const peak = Math.max(0.001, soundVolume * gain);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(peak, time + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  });
}

export const soundManager = {
  playTap: () => playTones([{ frequency: 190, duration: 0.055, type: "sine", gain: 0.2 }]),
  playSelect: () => playTones([{ frequency: 540, duration: 0.085, type: "triangle", gain: 0.22 }]),
  playToggle: () => playTones([{ frequency: 320, duration: 0.07, type: "sine", gain: 0.16 }]),
  playSuccess: () => playTones([
    { frequency: 210, duration: 0.07, type: "sine", gain: 0.12 },
    { frequency: 560, duration: 0.24, delay: 0.16, type: "sine", gain: 0.18 },
    { frequency: 820, duration: 0.36, delay: 0.4, type: "triangle", gain: 0.15 },
  ]),
  playMilestone: () => playTones([
    { frequency: 440, duration: 0.22, type: "sine", gain: 0.16 },
    { frequency: 660, duration: 0.24, delay: 0.18, type: "sine", gain: 0.17 },
    { frequency: 880, duration: 0.46, delay: 0.38, type: "triangle", gain: 0.16 },
  ]),
  playTimerStart: () => playTones([
    { frequency: 180, duration: 0.16, type: "sine", gain: 0.14 },
    { frequency: 250, duration: 0.22, delay: 0.16, type: "sine", gain: 0.14 },
  ]),
  playTimerEnd: () => playTones([
    { frequency: 470, duration: 0.2, type: "sine", gain: 0.14 },
    { frequency: 350, duration: 0.25, delay: 0.2, type: "sine", gain: 0.14 },
  ]),
  setEnabled: (enabled: boolean) => {
    soundEnabled = enabled;
  },
  setVolume: (volume: number) => {
    soundVolume = Math.min(1, Math.max(0, volume));
  },
  isEnabled: () => soundEnabled,
};
