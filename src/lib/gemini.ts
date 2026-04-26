import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getApiKey(): string | null {
  // Check localStorage first (set via Setup tab)
  const stored = localStorage.getItem('cassidey_gemini_key');
  if (stored) return stored;
  // Fall back to Vite env var
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || null;
}

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export function isGeminiConfigured(): boolean {
  return !!getApiKey();
}

export function setGeminiApiKey(key: string): void {
  if (key && key.trim()) {
    localStorage.setItem('cassidey_gemini_key', key.trim());
  } else {
    localStorage.removeItem('cassidey_gemini_key');
  }
  genAI = null; // Reset so it re-initializes with new key
}

export function getStoredGeminiKey(): string | null {
  return localStorage.getItem('cassidey_gemini_key');
}

export async function chatWithCassidey(prompt: string, context: string = ""): Promise<string> {
  try {
    const ai = getGenAI();
    const fullPrompt = `Context: ${context}\n\nUser: ${prompt}\n\nCassidey:`;
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt
    });
    return result.text || "I received an empty response. My local learning engine is still active!";
  } catch (error) {
    console.error("Gemini Error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("API_KEY") || errMsg.includes("not configured")) {
      return "Gemini isn't configured yet. Go to Setup to add your API key, or I'll keep learning locally!";
    }
    return "I'm having trouble reaching Gemini right now, but my local learning engine is still fully active. Try again shortly!";
  }
}
