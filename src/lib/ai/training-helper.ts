// ─── Training Helper — Gemini as a TRAINING COACH ───
// Gemini is NOT the main AI. It's used here exclusively to:
// 1. Help extract structured knowledge from web search results
// 2. Coach the AI engine by suggesting better response patterns
// 3. Assist with knowledge organization and fact verification
// The AI engine (AdvancedLearningEngine) is always the primary brain.

import { GoogleGenAI } from "@google/genai";
import { getGenAI as getSharedGenAI, hasGeminiApiKey, setGeminiApiKey } from "../gemini";

export interface TrainingInsight {
  category: 'knowledge_extraction' | 'response_coaching' | 'fact_check' | 'concept_clarification';
  input: string;
  output: string;
  confidence: number;
  timestamp: number;
}

export interface KnowledgeExtraction {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: string;
}

export class TrainingHelper {
  private genAI: GoogleGenAI | null = null;
  private insights: TrainingInsight[] = [];
  private totalTrainingSessions = 0;
  private coachingEnabled = true;

  constructor() {}

  private getGenAI(): GoogleGenAI | null {
    if (!this.genAI) {
      this.genAI = getSharedGenAI();
    }
    return this.genAI;
  }

  hasAPIKey(): boolean {
    return hasGeminiApiKey();
  }

  getGenAIInstance(): GoogleGenAI | null {
    return this.getGenAI();
  }

  /** Inject a runtime API key (from user settings) */
  setApiKey(key: string): void {
    setGeminiApiKey(key);
    this.genAI = null;
  }

  // ─── Knowledge Extraction ───
  // Use Gemini to extract structured knowledge from web content

  async extractKnowledge(content: string, context: string): Promise<KnowledgeExtraction[]> {
    const ai = this.getGenAI();
    if (!ai) return [];

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Extract structured knowledge triples from this text. Return ONLY valid JSON array, no markdown.

Text: "${content}"
Context: "${context}"

Format: [{"subject": "...", "predicate": "...", "object": "...", "confidence": 0.0-1.0}]
Maximum 5 triples. Be factual and precise.`
      });

      const text = (result.text || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text);
      this.totalTrainingSessions++;

      const extractions: KnowledgeExtraction[] = [];
      for (const triple of parsed) {
        if (triple.subject && triple.predicate && triple.object) {
          extractions.push({
            subject: triple.subject,
            predicate: triple.predicate,
            object: triple.object,
            confidence: triple.confidence || 0.7,
            source: 'training_extraction',
          });
        }
      }

      this.insights.push({
        category: 'knowledge_extraction',
        input: content.substring(0, 100),
        output: `${extractions.length} triples extracted`,
        confidence: 0.8,
        timestamp: Date.now(),
      });

      return extractions;
    } catch (e) {
      console.error('[TrainingHelper] Knowledge extraction failed:', e);
      return [];
    }
  }

  // ─── Response Coaching ───
  // Gemini helps improve the AI engine's response patterns (offline training)

  async coachResponse(userInput: string, aiResponse: string): Promise<string | null> {
    const ai = this.getGenAI();
    if (!ai || !this.coachingEnabled) return null;

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an AI training coach. Analyze this conversation and suggest a ONE SENTENCE improvement tip for the AI's response. Be specific and actionable. No preamble.

User said: "${userInput}"
AI responded: "${aiResponse}"

Improvement tip (one sentence):`
      });

      const tip = (result.text || '').trim();
      this.totalTrainingSessions++;

      this.insights.push({
        category: 'response_coaching',
        input: userInput.substring(0, 100),
        output: tip,
        confidence: 0.7,
        timestamp: Date.now(),
      });

      return tip;
    } catch (e) {
      return null;
    }
  }

  // ─── Fact Verification ───
  // Quick fact check before the AI responds with uncertain information

  async verifyFact(claim: string): Promise<{ verified: boolean; correction?: string; confidence: number }> {
    const ai = this.getGenAI();
    if (!ai) return { verified: true, confidence: 0.5 };

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Fact check this claim. Reply with ONLY: YES if accurate, NO:correction if inaccurate, or UNCERTAIN if unverifiable.

Claim: "${claim}"`
      });

      const text = (result.text || '').trim().toUpperCase();
      this.totalTrainingSessions++;

      this.insights.push({
        category: 'fact_check',
        input: claim.substring(0, 100),
        output: text,
        confidence: 0.8,
        timestamp: Date.now(),
      });

      if (text.startsWith('YES')) return { verified: true, confidence: 0.9 };
      if (text.startsWith('NO:')) return { verified: false, correction: text.substring(3).trim(), confidence: 0.8 };
      return { verified: true, confidence: 0.5 }; // Uncertain = don't correct
    } catch (e) {
      return { verified: true, confidence: 0.5 };
    }
  }

  // ─── Concept Clarification ───
  // Deep-dive into a concept for better understanding

  async clarifyConcept(concept: string): Promise<string | null> {
    const ai = this.getGenAI();
    if (!ai) return null;

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Explain "${concept}" in 2-3 sentences. Be factual and precise. No preamble, no "Here's an explanation" — just the explanation directly.`
      });

      const explanation = (result.text || '').trim();
      this.totalTrainingSessions++;

      this.insights.push({
        category: 'concept_clarification',
        input: concept,
        output: explanation,
        confidence: 0.85,
        timestamp: Date.now(),
      });

      return explanation;
    } catch (e) {
      return null;
    }
  }

  // ─── Stats ───

  getTotalTrainingSessions(): number { return this.totalTrainingSessions; }
  getInsightCount(): number { return this.insights.length; }
  getRecentInsights(limit = 10): TrainingInsight[] {
    return this.insights.slice(-limit);
  }
  setCoachingEnabled(enabled: boolean): void { this.coachingEnabled = enabled; }
  isCoachingEnabled(): boolean { return this.coachingEnabled; }
}
