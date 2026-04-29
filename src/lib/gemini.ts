// ─── Gemini — TRAINING HELPER ONLY ───
// Gemini is NOT the main chat model. The custom AI engine (advanced-learning-engine.ts) IS the brain.
// This file provides Gemini utility for TRAINING purposes ONLY:
// - Web search grounding (via WebLearner)
// - Knowledge extraction assistance (via TrainingHelper)
// - Response coaching and fact-checking (via TrainingHelper)
//
// DO NOT use this for primary chat responses. Use aiEngine.generateResponse() instead.

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
