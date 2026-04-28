// ─── Web Learner — Internet Search & Knowledge Acquisition ───
// Allows the AI to search the web when it encounters knowledge gaps,
// extract facts, store them in the Neural Knowledge Graph, and
// use that knowledge for all future responses.
// Gemini is used here ONLY as a search tool / training helper — NOT as the brain.

import { NeuralKnowledgeGraph } from './neural-knowledge-graph';

export interface WebSearchResult {
  query: string;
  summary: string;
  learnedFacts: string[];
  entities: string[];
  confidence: number;
  timestamp: number;
  searchDuration: number;
}

export interface LearnedTopic {
  topic: string;
  summary: string;
  facts: string[];
  entities: string[];
  lastUpdated: number;
  accessCount: number;
  confidence: number;
  source: string;
}

export class WebLearner {
  private learnedTopics: Map<string, LearnedTopic> = new Map();
  private searchHistory: WebSearchResult[] = [];
  private knowledgeGraph: NeuralKnowledgeGraph | null = null;
  private totalSearches = 0;
  private successfulSearches = 0;
  private isSearching = false;
  private searchGCache: Map<string, number> = new Map(); // G-key availability cache

  constructor() {}

  setKnowledgeGraph(kg: NeuralKnowledgeGraph): void {
    this.knowledgeGraph = kg;
  }

  // ─── Knowledge Gap Detection ───
  // Determines if the AI should search the web based on confidence and context

  shouldSearch(input: string, engineConfidence: number, kgNodeCount: number, hasGeminiKey: boolean): boolean {
    if (this.isSearching) return false;
    if (!hasGeminiKey) return false;

    const lower = input.toLowerCase().trim();
    const isQuestion = lower.endsWith('?') || /^(what|who|when|where|how|why|which|can you|do you|is it|are there)\b/.test(lower);
    const isFactQuery = /^(what is|what are|who is|who was|when was|when did|where is|where was|how does|how do|how many|how old|what year|what time|what causes|what is the|tell me about|explain|define|describe)\b/.test(lower);

    // Already learned this topic recently — no need to search again
    if (this.hasLearnedTopic(lower.substring(0, 40))) {
      const topic = this.getLearnedTopic(lower.substring(0, 40));
      if (topic && (Date.now() - topic.lastUpdated) < 3600000) return false; // 1 hour cache
    }

    // Strong signals to search
    if (isFactQuery && engineConfidence < 0.6) return true;
    if (isQuestion && kgNodeCount < 10 && engineConfidence < 0.8) return true;
    if (isQuestion && engineConfidence < 0.3) return true;
    if (lower.includes('look up') || lower.includes('search for') || lower.includes('find out')) return true;
    if (lower.includes("i don't know") || lower.includes('not sure') && isQuestion) return true;

    // Medium signals — search if AI is uncertain
    if (isQuestion && engineConfidence < 0.5) return true;

    return false;
  }

  // ─── Web Search via Gemini (as a TOOL, not the brain) ───

  async searchAndLearn(query: string, genAI: any): Promise<WebSearchResult | null> {
    this.isSearching = true;
    this.totalSearches++;
    const startTime = Date.now();

    try {
      // Use Gemini with Google Search grounding as a research tool
      const searchPrompt = `You are a factual research tool. Search the web and provide accurate, concise information about the following query.

Query: "${query}"

Return your response in this EXACT format — no extra text, no markdown, no preamble:
SUMMARY: [2-3 sentence factual summary]
FACT: [key fact 1]
FACT: [key fact 2]
FACT: [key fact 3]
FACT: [additional facts, up to 7 total]
ENTITIES: [comma-separated key entities mentioned]

Rules:
- Only include verified, factual information
- Be concise — no filler words
- If the query is ambiguous, cover the most common interpretation
- Include specific numbers, dates, and names when available`;

      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const text = result.text || "";
      const parsed = this.parseSearchResult(text, query);
      parsed.searchDuration = Date.now() - startTime;

      // Store in Neural Knowledge Graph (THE BRAIN remembers)
      if (this.knowledgeGraph && parsed.learnedFacts.length > 0) {
        this.storeInKnowledgeGraph(query, parsed);
        this.successfulSearches++;
      }

      // Cache the learned topic for future recall
      const cacheKey = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().substring(0, 50);
      this.learnedTopics.set(cacheKey, {
        topic: query,
        summary: parsed.summary,
        facts: parsed.learnedFacts,
        entities: parsed.entities,
        lastUpdated: Date.now(),
        accessCount: 1,
        confidence: parsed.confidence,
        source: 'web_search',
      });

      this.searchHistory.push(parsed);
      if (this.searchHistory.length > 200) this.searchHistory = this.searchHistory.slice(-100);

      console.log(`[WebLearner] Searched: "${query}" → ${parsed.learnedFacts.length} facts, ${parsed.entities.length} entities (${parsed.searchDuration}ms)`);

      return parsed;

    } catch (error) {
      console.error('[WebLearner] Search failed:', error);
      return null;
    } finally {
      this.isSearching = false;
    }
  }

  // ─── Response Enhancement ───
  // Take the AI engine's local response and enhance it with web-learned knowledge

  enhanceResponse(localResponse: string, query: string): string {
    const cacheKey = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().substring(0, 50);
    const topic = this.learnedTopics.get(cacheKey);

    if (!topic) return localResponse;

    // If we have high-confidence web knowledge about this topic, enhance the response
    if (topic.confidence > 0.6 && topic.summary) {
      return `${localResponse}\n\n[Web Knowledge] ${topic.summary}`;
    }

    return localResponse;
  }

  // ─── Knowledge Recall ───
  // Check if we have prior web-learned knowledge relevant to the input

  recallRelevantKnowledge(input: string): LearnedTopic | null {
    const lower = input.toLowerCase();
    const words = lower.replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 3);

    let bestMatch: LearnedTopic | null = null;
    let bestScore = 0;

    for (const [key, topic] of this.learnedTopics.entries()) {
      let score = 0;
      for (const word of words) {
        if (key.includes(word)) score += 1;
        if (topic.summary.toLowerCase().includes(word)) score += 0.5;
        for (const fact of topic.facts) {
          if (fact.toLowerCase().includes(word)) score += 0.3;
        }
      }
      // Boost by confidence and recency
      const recencyBoost = Math.max(0, 1 - (Date.now() - topic.lastUpdated) / 86400000); // 24h decay
      score *= topic.confidence * (0.5 + recencyBoost * 0.5);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = topic;
      }
    }

    if (bestMatch && bestScore > 1.5) {
      bestMatch.accessCount++;
      return bestMatch;
    }
    return null;
  }

  // ─── Internal Parsing ───

  private parseSearchResult(text: string, query: string): WebSearchResult {
    const lines = text.split('\n');
    let summary = '';
    const facts: string[] = [];
    const entities: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().startsWith('SUMMARY:')) {
        summary = trimmed.substring(8).trim();
      } else if (trimmed.toUpperCase().startsWith('FACT:')) {
        const fact = trimmed.substring(5).trim();
        if (fact.length > 5) facts.push(fact);
      } else if (trimmed.toUpperCase().startsWith('ENTITIES:')) {
        const entityStr = trimmed.substring(9).trim();
        const parsed = entityStr.split(',').map(e => e.trim()).filter(e => e.length > 1);
        entities.push(...parsed);
      }
    }

    // Fallback parsing if format wasn't followed
    if (!summary && text.length > 0) {
      summary = text.substring(0, 300).trim();
    }
    if (facts.length === 0 && text.length > 50) {
      // Extract sentences as facts
      const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
      facts.push(...sentences.slice(0, 5));
    }

    const confidence = Math.min(0.95, 0.55 + facts.length * 0.08 + (summary.length > 50 ? 0.1 : 0));

    return {
      query,
      summary,
      learnedFacts: facts.slice(0, 10),
      entities,
      confidence,
      timestamp: Date.now(),
      searchDuration: 0,
    };
  }

  private storeInKnowledgeGraph(query: string, result: WebSearchResult): void {
    if (!this.knowledgeGraph) return;

    const queryConcept = query.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);

    // Store the query as a concept
    this.knowledgeGraph.addKnowledge(queryConcept, 'is_about', result.summary.substring(0, 80).replace(/[^a-z0-9 ]/g, '_'), result.confidence * 0.9);

    // Store each fact as a knowledge triple
    for (let i = 0; i < result.learnedFacts.length; i++) {
      const fact = result.learnedFacts[i];
      const factConcept = fact.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
      if (factConcept.length > 5) {
        this.knowledgeGraph.addKnowledge(queryConcept, 'fact_' + i, factConcept, result.confidence * 0.85);
      }
    }

    // Store entity relationships
    for (const entity of result.entities) {
      const entityConcept = entity.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
      if (entityConcept.length > 2) {
        this.knowledgeGraph.addKnowledge(entityConcept, 'related_to', queryConcept, 0.75);
      }
    }
  }

  // ─── Public Queries ───

  hasLearnedTopic(topic: string): boolean {
    const key = topic.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().substring(0, 50);
    return this.learnedTopics.has(key);
  }

  getLearnedTopic(topic: string): LearnedTopic | undefined {
    const key = topic.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().substring(0, 50);
    return this.learnedTopics.get(key);
  }

  getTotalSearches(): number { return this.totalSearches; }
  getSuccessfulSearches(): number { return this.successfulSearches; }
  getLearnedTopicCount(): number { return this.learnedTopics.size; }
  isCurrentlySearching(): boolean { return this.isSearching; }
  getSearchHistory(): WebSearchResult[] { return [...this.searchHistory]; }
  getSearchSuccessRate(): number {
    return this.totalSearches === 0 ? 0 : this.successfulSearches / this.totalSearches;
  }

  // Export/import learned topics for persistence
  exportLearnedTopics(): string {
    const data = Array.from(this.learnedTopics.entries()).map(([k, v]) => ({ key: k, ...v }));
    return JSON.stringify({ topics: data, totalSearches: this.totalSearches, successfulSearches: this.successfulSearches });
  }

  importLearnedTopics(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data && data.topics) {
        for (const t of data.topics) {
          const { key, ...topic } = t;
          this.learnedTopics.set(key, topic);
        }
        this.totalSearches = data.totalSearches || 0;
        this.successfulSearches = data.successfulSearches || 0;
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to import learned topics:', e);
      return false;
    }
  }
}
