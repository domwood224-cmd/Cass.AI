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

export function getGenAI(): GoogleGenAI | null {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}
