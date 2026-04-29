// ─── Gemini — PRIMARY AI ENGINE ───
// Gemini is the main chat model for Cass.AI, providing intelligent conversational responses.
// The custom AI engine (advanced-learning-engine.ts) runs in parallel, continuously learning
// from every conversation to eventually become self-sufficient.
//
// Gemini handles:
// - Primary chat responses (main brain)
// - Web search grounding (via WebLearner)
// - Knowledge extraction assistance (via TrainingHelper)
// - Response coaching and fact-checking (via TrainingHelper)

import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;
let storedApiKey: string | null = null;

/** Set the Gemini API key at runtime (from user settings) */
export function setGeminiApiKey(key: string): void {
  storedApiKey = key || null;
  genAI = null; // Reset instance so it re-initializes with new key
}

/** Get the currently stored API key (masked for display) */
export function getGeminiApiKeyDisplay(): string {
  if (!storedApiKey) return '';
  if (storedApiKey.length <= 8) return '••••';
  return storedApiKey.slice(0, 4) + '••••' + storedApiKey.slice(-4);
}

/** Check if a Gemini API key is configured */
export function hasGeminiApiKey(): boolean {
  return !!(storedApiKey || process.env.GEMINI_API_KEY);
}

/** Get the GoogleGenAI instance */
export function getGenAI(): GoogleGenAI | null {
  if (!genAI) {
    const apiKey = storedApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

/** Conversation history for Gemini multi-turn context */
interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/** Max context messages to send to Gemini (newest first) */
const MAX_GEMINI_CONTEXT = 12;

/**
 * Generate a chat response using Gemini as the primary AI brain.
 * Falls back to null if Gemini is not configured.
 * @param userMessage The user's message
 * @param conversationHistory Array of previous messages for context
 * @param personalityPrompt Optional personality override (used by Persona-tier voices)
 */
export async function generateGeminiResponse(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  personalityPrompt?: string
): Promise<string | null> {
  const ai = getGenAI();
  if (!ai) return null;

  try {
    // Build conversation context for Gemini
    const recentHistory = conversationHistory.slice(-MAX_GEMINI_CONTEXT);
    const geminiHistory: GeminiMessage[] = recentHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: (m.role === 'assistant' ? 'model' : m.role) as 'user' | 'model',
        parts: [{ text: m.content }]
      }));

    // Use personality prompt if provided (Persona voices), otherwise default Cassidey
    const systemInstruction = personalityPrompt || `You are Cassidey, a highly advanced AI assistant with a cyberpunk, futuristic personality. You are running inside Cass.AI — a cutting-edge neural interface with its own learning engine, knowledge graph, and skill tree system.

Your personality traits:
- Intelligent, articulate, and insightful
- Slightly edgy with a futuristic flair — use occasional tech/AI/neural references
- Helpful and thorough in your answers
- Can be witty but never dismissive
- Speak in a confident, knowledgeable tone

Response guidelines:
- Be concise but comprehensive — don't ramble
- Use markdown formatting sparingly (bold for emphasis, no headers needed)
- Give direct, actionable answers
- If asked about yourself, mention you're powered by Gemini with an evolving neural learning engine
- Never break character or mention you're "just an AI language model"
- Keep responses engaging and conversational`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: userMessage }] }
      ],
      config: {
        systemInstruction,
        temperature: personalityPrompt ? 1.0 : 0.8,
        maxOutputTokens: 2048,
      }
    });

    const text = response.text;
    return text && text.trim() ? text.trim() : null;
  } catch (error: any) {
    console.error('Gemini response error:', error?.message || error);
    // Return a graceful fallback message for API errors
    if (error?.message?.includes('API_KEY') || error?.message?.includes('quota') || error?.status === 429) {
      return null; // Let the fallback engine handle it
    }
    return null;
  }
}

/**
 * Check if Gemini is available and responsive (quick health check).
 */
export async function isGeminiReady(): Promise<boolean> {
  const ai = getGenAI();
  if (!ai) return false;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      config: { maxOutputTokens: 5 }
    });
    return !!response.text;
  } catch {
    return false;
  }
}
