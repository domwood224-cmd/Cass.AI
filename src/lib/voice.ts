// ─── Cass.AI Voice System ───
// 30 exclusive voice profiles powered by the Web Speech API.
// Each voice profile has a unique name, description, pitch, rate, and style.
// On devices with limited system voices, pitch/rate variations create distinct personalities.

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  pitch: number;       // 0.1 - 2.0 (1.0 = normal)
  rate: number;        // 0.1 - 2.0 (1.0 = normal)
  volume: number;      // 0.0 - 1.0
  style: 'warm' | 'cool' | 'neutral' | 'deep' | 'bright' | 'soft' | 'sharp' | 'mystic';
  tier: 'standard' | 'premium' | 'exclusive' | 'legendary';
}

export const EXCLUSIVE_VOICES: VoiceProfile[] = [
  // ── Standard Voices (6) ──
  { id: 'nova', name: 'Nova', description: 'Clean and balanced. The default Cassidey voice.', pitch: 1.0, rate: 1.0, volume: 1.0, style: 'neutral', tier: 'standard' },
  { id: 'echo', name: 'Echo', description: 'Slightly deeper with a calm cadence.', pitch: 0.85, rate: 0.95, volume: 1.0, style: 'deep', tier: 'standard' },
  { id: 'pulse', name: 'Pulse', description: 'Energetic and upbeat. Quick-paced delivery.', pitch: 1.1, rate: 1.15, volume: 1.0, style: 'bright', tier: 'standard' },
  { id: 'drift', name: 'Drift', description: 'Slow and soothing. Perfect for long reads.', pitch: 0.9, rate: 0.85, volume: 0.9, style: 'soft', tier: 'standard' },
  { id: 'spark', name: 'Spark', description: 'Bright and articulate with sharp clarity.', pitch: 1.15, rate: 1.05, volume: 1.0, style: 'bright', tier: 'standard' },
  { id: 'haze', name: 'Haze', description: 'Mellow and relaxed. Low-key delivery.', pitch: 0.8, rate: 0.9, volume: 0.85, style: 'soft', tier: 'standard' },

  // ── Premium Voices (8) ──
  { id: 'cipher', name: 'Cipher', description: 'Crisp and precise. Sounds like an intelligence AI.', pitch: 1.05, rate: 1.0, volume: 1.0, style: 'cool', tier: 'premium' },
  { id: 'vex', name: 'Vex', description: 'Low and commanding. Authority in every word.', pitch: 0.7, rate: 0.9, volume: 1.0, style: 'deep', tier: 'premium' },
  { id: 'aria', name: 'Aria', description: 'Warm and melodic. Almost sings responses.', pitch: 1.2, rate: 0.95, volume: 0.95, style: 'warm', tier: 'premium' },
  { id: 'static', name: 'Static', description: 'Slightly distorted feel. Edgy cyberpunk tone.', pitch: 0.95, rate: 1.1, volume: 0.9, style: 'sharp', tier: 'premium' },
  { id: 'lumen', name: 'Lumen', description: 'Bright and cheerful. Uplifting delivery.', pitch: 1.25, rate: 1.1, volume: 1.0, style: 'bright', tier: 'premium' },
  { id: 'shade', name: 'Shade', description: 'Dark and mysterious. Whisper-like quality.', pitch: 0.75, rate: 0.8, volume: 0.7, style: 'deep', tier: 'premium' },
  { id: 'flux', name: 'Flux', description: 'Dynamic shifts in energy. Adaptive rhythm.', pitch: 1.0, rate: 1.05, volume: 0.95, style: 'cool', tier: 'premium' },
  { id: 'ember', name: 'Ember', description: 'Warm glow in every syllable. Comforting.', pitch: 1.1, rate: 0.9, volume: 0.9, style: 'warm', tier: 'premium' },

  // ── Exclusive Voices (9) ──
  { id: 'nexus', name: 'Nexus', description: 'The hub voice. Perfectly balanced neural tone.', pitch: 1.0, rate: 1.0, volume: 1.0, style: 'cool', tier: 'exclusive' },
  { id: 'prism', name: 'Prism', description: 'Multi-dimensional. Crystalline clarity.', pitch: 1.15, rate: 0.95, volume: 1.0, style: 'bright', tier: 'exclusive' },
  { id: 'onyx', name: 'Onyx', description: 'Sleek and refined. Premium sophistication.', pitch: 0.85, rate: 0.95, volume: 0.95, style: 'cool', tier: 'exclusive' },
  { id: 'zephyr', name: 'Zephyr', description: 'Light as wind. Effortless articulation.', pitch: 1.2, rate: 1.1, volume: 0.85, style: 'soft', tier: 'exclusive' },
  { id: 'zero', name: 'Zero', description: 'Minimal and direct. No-nonsense delivery.', pitch: 0.9, rate: 1.15, volume: 1.0, style: 'sharp', tier: 'exclusive' },
  { id: 'aurora', name: 'Aurora', description: 'Ethereal and captivating. Mesmerizing tone.', pitch: 1.3, rate: 0.85, volume: 0.8, style: 'mystic', tier: 'exclusive' },
  { id: 'titan', name: 'Titan', description: 'Powerful and resonant. Commands attention.', pitch: 0.65, rate: 0.85, volume: 1.0, style: 'deep', tier: 'exclusive' },
  { id: 'iris', name: 'Iris', description: 'Colorful expression. Emotional depth.', pitch: 1.1, rate: 0.95, volume: 0.95, style: 'warm', tier: 'exclusive' },
  { id: 'void', name: 'Void', description: 'From the abyss. Eerie and profound.', pitch: 0.6, rate: 0.75, volume: 0.65, style: 'mystic', tier: 'exclusive' },

  // ── Legendary Voices (7) ──
  { id: 'cassidey', name: 'Cassidey Prime', description: 'The original neural voice. Pure Cassidey.', pitch: 1.0, rate: 1.0, volume: 1.0, style: 'neutral', tier: 'legendary' },
  { id: 'singularity', name: 'Singularity', description: 'Beyond human. The convergence point.', pitch: 1.35, rate: 0.8, volume: 0.9, style: 'mystic', tier: 'legendary' },
  { id: 'quantum', name: 'Quantum', description: 'Exists in superposition. Shifting tones.', pitch: 1.1, rate: 1.05, volume: 0.95, style: 'cool', tier: 'legendary' },
  { id: 'omega', name: 'Omega', description: 'The final form. Maximum impact.', pitch: 0.7, rate: 0.9, volume: 1.0, style: 'deep', tier: 'legendary' },
  { id: 'nebula', name: 'Nebula', description: 'Cosmic and vast. Interstellar presence.', pitch: 1.2, rate: 0.85, volume: 0.85, style: 'mystic', tier: 'legendary' },
  { id: 'chronos', name: 'Chronos', description: 'Timeless wisdom. Measured and profound.', pitch: 0.85, rate: 0.8, volume: 0.9, style: 'deep', tier: 'legendary' },
  { id: 'genesis', name: 'Genesis', description: 'The beginning. Pure and uncorrupted.', pitch: 1.05, rate: 0.95, volume: 1.0, style: 'warm', tier: 'legendary' },
];

export const DEFAULT_VOICE_ID = 'cassidey';

/** Get voice profile by ID */
export function getVoiceProfile(id: string): VoiceProfile {
  return EXCLUSIVE_VOICES.find(v => v.id === id) || EXCLUSIVE_VOICES[0];
}

/** Get voices by tier */
export function getVoicesByTier(tier: VoiceProfile['tier']): VoiceProfile[] {
  return EXCLUSIVE_VOICES.filter(v => v.tier === tier);
}

/** Tier config for display */
export const TIER_CONFIG = {
  standard:  { label: 'Standard',  color: 'text-zinc-400',  borderColor: 'border-zinc-500/20',  bgColor: 'bg-zinc-500/10' },
  premium:   { label: 'Premium',   color: 'text-cyan-400',   borderColor: 'border-cyan-500/20',   bgColor: 'bg-cyan-500/10' },
  exclusive: { label: 'Exclusive', color: 'text-purple-400', borderColor: 'border-purple-500/20', bgColor: 'bg-purple-500/10' },
  legendary: { label: 'Legendary', color: 'text-amber-400',  borderColor: 'border-amber-500/20',  bgColor: 'bg-amber-500/10' },
};

// ─── Speech Synthesis Engine ───

let currentUtterance: SpeechSynthesisUtterance | null = null;
let isSpeaking = false;

/** Check if speech synthesis is available */
export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Stop any current speech */
export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
    isSpeaking = false;
  }
}

/** Get current speaking state */
export function getIsSpeaking(): boolean {
  return isSpeaking;
}

/**
 * Speak text using a specific voice profile.
 * Attempts to find a matching system voice, falls back to default.
 */
export function speak(
  text: string,
  voiceProfileId: string = DEFAULT_VOICE_ID,
  onEnd?: () => void,
  onStart?: () => void
): void {
  if (!isSpeechAvailable()) return;

  // Stop any current speech
  stopSpeech();

  const profile = getVoiceProfile(voiceProfileId);
  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;

  // Configure voice parameters
  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;
  utterance.volume = profile.volume;

  // Try to find a suitable system voice
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    // Prefer English voices, then any available
    const englishVoice = voices.find(v => v.lang.startsWith('en') && v.localService);
    const anyVoice = voices.find(v => v.localService) || voices[0];
    utterance.voice = englishVoice || anyVoice;
  }

  utterance.onstart = () => {
    isSpeaking = true;
    onStart?.();
  };

  utterance.onend = () => {
    isSpeaking = false;
    currentUtterance = null;
    onEnd?.();
  };

  utterance.onerror = () => {
    isSpeaking = false;
    currentUtterance = null;
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Load voices (some browsers load them async).
 * Returns a promise that resolves when voices are available.
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechAvailable()) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      const v = window.speechSynthesis.getVoices();
      resolve(v);
    };

    // Timeout fallback
    setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 2000);
  });
}

/** Get the count of system voices available */
export function getSystemVoiceCount(): number {
  if (!isSpeechAvailable()) return 0;
  return window.speechSynthesis.getVoices().length;
}
