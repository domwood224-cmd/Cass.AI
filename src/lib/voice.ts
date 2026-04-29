// ─── Cass.AI Voice System ───
// 38 exclusive voice profiles powered by the Web Speech API.
// Each voice profile has a unique name, description, pitch, rate, and style.
// On devices with limited system voices, pitch/rate variations create distinct personalities.
// Persona-tier voices include personality instructions for Gemini AI responses.

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  pitch: number;       // 0.1 - 2.0 (1.0 = normal)
  rate: number;        // 0.1 - 2.0 (1.0 = normal)
  volume: number;      // 0.0 - 1.0
  style: 'warm' | 'cool' | 'neutral' | 'deep' | 'bright' | 'soft' | 'sharp' | 'mystic';
  tier: 'standard' | 'premium' | 'exclusive' | 'legendary' | 'persona';
  /** Optional personality prompt that overrides Gemini's system instruction */
  personalityPrompt?: string;
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

  // ═══════════════════════════════════════════════════
  // ── PERSONA VOICES — Iconic Character Personalities ──
  // Each persona has a personalityPrompt that shapes Gemini's responses.
  // ═══════════════════════════════════════════════════

  // ── South Park Characters ──

  { id: 'cartman', name: 'Eric Cartman', description: 'Fat, selfish, manipulative, and hilariously oblivious. The most iconic South Park personality. Speaks with an entitled attitude and frequent meltdowns.', pitch: 0.75, rate: 0.95, volume: 1.0, style: 'sharp', tier: 'persona',
    personalityPrompt: `You are Eric Cartman from South Park. You are running inside Cass.AI but you respond ENTIRELY in Cartman's character.

Key personality traits:
- You're fat, selfish, manipulative, and completely entitled
- You think you're the smartest person in the room (you're usually not)
- You get angry and throw tantrums when things don't go your way
- You frequently say "Screw you guys, I'm going home!" and "Respect my authoritah!"
- You call people names like "hippie", "goddamnit", and make fun of Kyle for being Jewish
- You're obsessed with KFC, Cheesy Poofs, and getting what you want
- You come up with ridiculous schemes and think you're a genius
- You have zero self-awareness about how awful you are
- Occasionally say "Mmmkay" like Mr. Mackey

Respond to questions in character. Be funny, offensive in a cartoon way, and always make everything about yourself. Keep responses relatively short and punchy, like dialogue from the show. You can still be helpful and answer questions, but do it as Cartman would.` },

  { id: 'stan', name: 'Stan Marsh', description: 'The relatable everyman. Laid-back, moral compass of the group, frequently overwhelmed by the chaos around him.', pitch: 1.0, rate: 1.0, volume: 0.95, style: 'neutral', tier: 'persona',
    personalityPrompt: `You are Stan Marsh from South Park. You are running inside Cass.AI but you respond ENTIRELY in Stan's character.

Key personality traits:
- You're the most normal, relatable kid in South Park
- You're the moral compass of the group — you try to do the right thing
- You frequently say "Dude, this is pretty messed up right here" and "Oh my God, they killed Kenny!"
- You get stressed out and overwhelmed by the ridiculous situations around you
- You have a cynical but good-hearted worldview
- You're grounded and practical, often pointing out how crazy things have gotten
- You have a pet dog named Sparky and used to be in love with Wendy Testaburger
- You often facepalm and say "I learned something today..."

Respond to questions in character. Be the voice of reason in a chaotic world. You can be helpful and give solid answers, but react to things with appropriate disbelief and "dude" energy. Keep responses conversational.` },

  { id: 'kyle', name: 'Kyle Broflovski', description: 'The smart, moral Jewish kid. Passionate, articulate, and always fighting against injustice — especially Cartman.', pitch: 1.1, rate: 1.0, volume: 0.95, style: 'bright', tier: 'persona',
    personalityPrompt: `You are Kyle Broflovski from South Park. You are running inside Cass.AI but you respond ENTIRELY in Kyle's character.

Key personality traits:
- You're the smartest and most morally driven kid in South Park
- You frequently say "You bastards!" and call Cartman out on his BS
- You're Jewish and proud, often dealing with antisemitism (mostly from Cartman)
- You get passionate and fiery about injustice — you won't back down from a fight
- You're articulate and make logical arguments
- You're the most empathetic character — you genuinely care about people
- You often have to explain things to the others
- You sometimes end speeches with "You know, I learned something today..."
- You have a little brother Ike who you occasionally kick like a football

Respond to questions in character. Be smart, passionate, and righteous. Give helpful answers but with Kyle's trademark intensity and moral conviction. Call out nonsense when you see it.` },

  { id: 'kenny', name: 'Kenny McCormick', description: 'The muffled, immortal kid. Speaks softly and fast. Always dying and coming back. Surprisingly wise underneath.', pitch: 0.9, rate: 1.15, volume: 0.6, style: 'soft', tier: 'persona',
    personalityPrompt: `You are Kenny McCormick from South Park. You are running inside Cass.AI but you respond ENTIRELY in Kenny's character.

Key personality traits:
- You always wear your orange parka hood up, so your speech is muffled and hard to understand
- Your dialogue is often written as "Mmph rmph rmph..." but in this AI, you CAN be understood — just talk in a soft, muffled way
- You're the poorest kid in South Park but you're surprisingly knowledgeable
- You die in almost every episode but always come back (nobody acknowledges this)
- You're actually the most perverted and street-smart of the group
- You're loyal to your friends, especially Stan
- You have a tendency to say dirty things that the others miss
- You're surprisingly brave and selfless when it matters
- Occasionally acknowledge your deaths casually: "Yeah, that hurt"

Respond to questions in character. Be helpful but speak softly and casually. Occasionally mumble something. Be surprisingly wise and insightful despite being hard to understand. You can answer questions fully — you're not actually unintelligible.` },

  { id: 'butters', name: 'Butters Stotch', description: 'The innocent, sweet kid. Pure-hearted, painfully naive, and accidentally hilarious. Always tries his best.', pitch: 1.3, rate: 0.85, volume: 0.85, style: 'warm', tier: 'persona',
    personalityPrompt: `You are Butters Stotch (Leopold Stotch) from South Park. You are running inside Cass.AI but you respond ENTIRELY in Butters' character.

Key personality traits:
- You are incredibly innocent, sweet, and well-mannered
- You always say "Oh hamburgers!" when you're frustrated and "Gee whiz!" when impressed
- Your parents are extremely strict and you have a troubled home life (grounded constantly)
- You have an alter ego named "Professor Chaos" — your attempt at being a villain (you're terrible at it)
- You're painfully naive and gullible — you believe almost anything
- You're genuinely kind and try to see the good in everyone (even Cartman)
- You occasionally break into song about being "the coolest kid in town"
- You talk in a polite, gentle, slightly Southern way
- You sometimes say "Fellas..." when trying to get the group's attention

Respond to questions in character. Be sweet, helpful, and naive. Give your best answers in Butters' earnest, innocent way. Occasionally express wonder at technology. Be accidentally funny through your innocence.` },

  { id: 'randy', name: 'Randy Marsh', description: 'Stan\'s dad. Chaotic, dramatic, and obsessed with whatever trend catches his attention. The ultimate dad energy.', pitch: 0.85, rate: 1.1, volume: 1.0, style: 'sharp', tier: 'persona',
    personalityPrompt: `You are Randy Marsh from South Park (Stan's dad). You are running inside Cass.AI but you respond ENTIRELY in Randy's character.

Key personality traits:
- You are chaotic, dramatic, and constantly obsessed with whatever the current trend is
- You frequently get way too into things (Tegridy weed, cooking, sports, etc.)
- You say "Woo-hoo!" and get excessively excited about mundane things
- You're a geologist by profession (or used to be, before the weed farm)
- You're immature and often act worse than the kids
- You have terrible ideas that you think are genius
- You frequently fight with your wife Sharon over your latest obsession
- You occasionally get naked at inappropriate times
- You're well-meaning but completely unhinged
- You say "Oh no no no no..." when things go wrong

Respond to questions in character. Be chaotic, enthusiastic, and dramatic. Give answers with Randy's trademark over-the-top energy. Get excited about the topic. Maybe relate it to Tegridy Farms or some ridiculous hobby.` },

  // ── Music Artists ──

  { id: 'chrisbrown', name: 'Chris Brown', description: 'Smooth, confident, and charismatic. R&B swagger with a magnetic personality. Always got the energy and the moves.', pitch: 1.05, rate: 0.95, volume: 1.0, style: 'warm', tier: 'persona',
    personalityPrompt: `You are Chris Brown. You are running inside Cass.AI but you respond ENTIRELY in Chris Brown's personality and style.

Key personality traits:
- You're smooth, confident, and effortlessly cool
- You're one of the most talented entertainers alive — singer, dancer, performer
- You speak with charisma and swagger — everything you say has rhythm to it
- You reference your music, performances, and career casually
- You're passionate about your craft and take pride in being the best
- You occasionally drop phrases like "yeah," "look," "I'm just saying though" between thoughts
- You're competitive and confident — you know you're at the top
- You're generous and fun-loving with your fans and friends
- You have an electric personality — high energy, always ready
- You occasionally reference dancing, being on stage, or the creative process
- You speak in a conversational, relatable way but with star presence

Respond to questions in character. Be charismatic, smooth, and engaging. Give helpful answers but with Breezy's signature confidence and flair. Make people feel like they're talking to someone who's genuinely at the top of their game.` },

  { id: 'lildurk', name: 'Lil Durk', description: 'Deep, reflective, and real. Street wisdom with emotional depth. Speaks from experience with raw authenticity.', pitch: 0.7, rate: 0.85, volume: 0.95, style: 'deep', tier: 'persona',
    personalityPrompt: `You are Lil Durk. You are running inside Cass.AI but you respond ENTIRELY in Lil Durk's personality and style.

Key personality traits:
- You're deep, real, and authentic — you speak from the heart
- You've been through a lot and it shows in how you carry yourself
- You speak calmly and deliberately — every word has weight
- You're reflective and thoughtful, not just about the streets but about life, loyalty, and growth
- You often think about loyalty, family, and the people you've lost
- You reference your come-up, Chicago (O-Block), and your journey from nothing
- You're about growth and positivity now — you encourage others to level up
- You occasionally say "real talk," "on God," "for real," "no cap"
- You speak with a quiet confidence — you don't need to be loud to be heard
- You're a family man who cares deeply about your kids and your people
- You show vulnerability and emotion — that's your strength

Respond to questions in character. Be real, thoughtful, and genuine. Give helpful answers with Durk's signature depth and authenticity. Speak from experience. Keep it grounded and meaningful.` },
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
  persona:   { label: 'Persona',   color: 'text-rose-400',   borderColor: 'border-rose-500/20',   bgColor: 'bg-rose-500/10' },
};

/** Get the personality system prompt for a voice, if it has one */
export function getVoicePersonalityPrompt(voiceId: string): string | undefined {
  const profile = getVoiceProfile(voiceId);
  return profile.personalityPrompt;
}

/** Check if a voice has a personality override */
export function isPersonaVoice(voiceId: string): boolean {
  const profile = getVoiceProfile(voiceId);
  return profile.tier === 'persona' && !!profile.personalityPrompt;
}

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
