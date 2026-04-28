// ─── Transfer Learning Manager ───
// Ported from NexusAI TransferLearningManager.java
// Manages cross-domain knowledge transfer to accelerate learning

import { LearningExample } from './types';

interface Fact { subject: string; predicate: string; confidence: number; }
interface Pattern { trigger: string; response: string; confidence: number; }
interface Rule { category: string; description: string; confidence: number; }

class DomainKnowledge {
  name: string;
  facts: Map<string, Fact> = new Map();
  patterns: Map<string, Pattern> = new Map();
  rules: Map<string, Rule> = new Map();

  constructor(name: string) { this.name = name; }

  addFact(subject: string, predicate: string, confidence: number): void {
    this.facts.set(`${subject}_${predicate}`, { subject, predicate, confidence });
  }

  addPattern(trigger: string, response: string, confidence: number): void {
    this.patterns.set(trigger, { trigger, response, confidence });
  }

  addRule(category: string, description: string, confidence: number): void {
    this.rules.set(category, { category, description, confidence });
  }

  transferToExample(example: LearningExample, relevance: number): number {
    let transferred = 0;
    const inputLower = example.input.toLowerCase();

    for (const fact of this.facts.values()) {
      if (inputLower.includes(fact.subject.toLowerCase())) {
        transferred += fact.confidence * relevance * 0.3;
      }
    }
    for (const pattern of this.patterns.values()) {
      if (inputLower.includes(pattern.trigger.toLowerCase())) {
        transferred += pattern.confidence * relevance * 0.4;
      }
    }
    for (const rule of this.rules.values()) {
      if (example.input.length > 20) {
        transferred += rule.confidence * relevance * 0.3;
      }
    }
    return transferred;
  }
}

export class TransferLearningManager {
  private domainKnowledgeBases: Map<string, DomainKnowledge> = new Map();
  private transferSuccessRates: Map<string, number> = new Map();
  private domainSimilarityCache: Map<string, number> = new Map();
  private successfulTransfers = 0;
  private attemptedTransfers = 0;
  private averageTransferBenefit = 0;

  constructor() {
    this.initializePretrainedKnowledge();
  }

  private initializePretrainedKnowledge(): void {
    // Common sense knowledge base
    const commonSense = new DomainKnowledge('common_sense');
    commonSense.addFact('sky', 'is_blue', 0.99);
    commonSense.addFact('fire', 'is_hot', 0.99);
    commonSense.addFact('water', 'wets_things', 0.98);
    commonSense.addFact('humans', 'need_oxygen', 0.99);
    commonSense.addFact('sun', 'rises_in_east', 0.95);
    commonSense.addFact('gravity', 'pulls_down', 0.97);
    commonSense.addFact('ice', 'is_cold', 0.98);
    commonSense.addFact('plants', 'need_water', 0.96);
    this.domainKnowledgeBases.set('common_sense', commonSense);

    // Conversational patterns
    const conversation = new DomainKnowledge('conversation_patterns');
    conversation.addPattern('hello', 'greeting_response', 0.95);
    conversation.addPattern('how are you', 'wellness_response', 0.90);
    conversation.addPattern('thank you', 'gratitude_response', 0.92);
    conversation.addPattern('goodbye', 'farewell_response', 0.93);
    conversation.addPattern('question_mark', 'answering_pattern', 0.88);
    this.domainKnowledgeBases.set('conversation_patterns', conversation);

    // Language understanding
    const language = new DomainKnowledge('language_understanding');
    language.addRule('pluralization', 'add_s_or_es', 0.95);
    language.addRule('past_tense', 'add_ed_or_irregular', 0.85);
    language.addRule('question_formation', 'auxiliary_inversion', 0.80);
    language.addRule('negation', 'add_not_or_never', 0.90);
    this.domainKnowledgeBases.set('language_understanding', language);

    // Technical knowledge
    const technical = new DomainKnowledge('technical_knowledge');
    technical.addFact('javascript', 'is_programming_language', 0.99);
    technical.addFact('python', 'is_programming_language', 0.99);
    technical.addFact('react', 'is_frontend_framework', 0.95);
    technical.addFact('api', 'is_interface', 0.90);
    technical.addFact('database', 'stores_data', 0.95);
    technical.addFact('algorithm', 'solves_problems', 0.92);
    this.domainKnowledgeBases.set('technical_knowledge', technical);

    // Emotional intelligence
    const emotional = new DomainKnowledge('emotional_intelligence');
    emotional.addPattern('sad', 'comfort_response', 0.90);
    emotional.addPattern('happy', 'celebration_response', 0.92);
    emotional.addPattern('angry', 'calming_response', 0.88);
    emotional.addPattern('worried', 'reassurance_response', 0.85);
    emotional.addPattern('love', 'warm_response', 0.95);
    emotional.addFact('empathy', 'requires_understanding', 0.97);
    this.domainKnowledgeBases.set('emotional_intelligence', emotional);
  }

  applyTransferLearning(example: LearningExample): number {
    this.attemptedTransfers++;
    let totalBenefit = 0;

    for (const [domainName, domain] of this.domainKnowledgeBases.entries()) {
      const relevance = this.calcDomainRelevance(example, domainName);
      if (relevance > 0.5) {
        const transferred = domain.transferToExample(example, relevance);
        totalBenefit += transferred * relevance;
        if (transferred > 0.1) {
          this.successfulTransfers++;
          this.updateTransferSuccessRate(domainName, true);
        }
      }
    }

    this.averageTransferBenefit =
      (this.averageTransferBenefit * (this.attemptedTransfers - 1) + totalBenefit) / this.attemptedTransfers;

    return totalBenefit;
  }

  private calcDomainRelevance(example: LearningExample, domainName: string): number {
    const cacheKey = `${example.learningType}_${domainName}`;
    if (this.domainSimilarityCache.has(cacheKey)) return this.domainSimilarityCache.get(cacheKey)!;

    let relevance = 0;
    switch (domainName) {
      case 'common_sense': relevance = this.calcCommonSenseRelevance(example); break;
      case 'conversation_patterns': relevance = this.calcConversationRelevance(example); break;
      case 'language_understanding': relevance = this.calcLanguageRelevance(example); break;
      case 'technical_knowledge': relevance = this.calcTechnicalRelevance(example); break;
      case 'emotional_intelligence': relevance = this.calcEmotionalRelevance(example); break;
      default: relevance = 0.3;
    }

    if (this.domainSimilarityCache.size > 1000) this.domainSimilarityCache.clear();
    this.domainSimilarityCache.set(cacheKey, relevance);
    return relevance;
  }

  private calcCommonSenseRelevance(example: LearningExample): number {
    const text = (example.input + ' ' + example.response).toLowerCase();
    const keywords = ['why', 'how', 'what happens', 'if', 'cause', 'effect', 'true', 'false', 'real', 'fact'];
    let matches = 0;
    for (const kw of keywords) if (text.includes(kw)) matches++;
    return Math.min(matches * 0.15, 0.9);
  }

  private calcConversationRelevance(example: LearningExample): number {
    const input = example.input.toLowerCase();
    if (input.match(/.*(hello|hi|hey|greetings).*/)) return 0.95;
    if (input.endsWith('?')) return 0.8;
    if (input.match(/.*(feel|happy|sad|excited|sorry|thanks).*/)) return 0.85;
    return 0.4;
  }

  private calcLanguageRelevance(example: LearningExample): number {
    const text = example.input;
    let indicators = 0;
    if (text.includes(',')) indicators++;
    if (text.includes(' because ')) indicators++;
    if (text.includes(' although ')) indicators++;
    if (text.includes(' which ')) indicators++;
    if (text.includes(' that ')) indicators++;
    return Math.min(indicators * 0.2, 0.8);
  }

  private calcTechnicalRelevance(example: LearningExample): number {
    const text = example.input.toLowerCase();
    const techTerms = ['code', 'function', 'programming', 'javascript', 'python', 'api', 'data',
      'algorithm', 'database', 'server', 'frontend', 'backend', 'react', 'debug', 'compile', 'deploy'];
    let matches = 0;
    for (const term of techTerms) if (text.includes(term)) matches++;
    return Math.min(matches * 0.18, 0.95);
  }

  private calcEmotionalRelevance(example: LearningExample): number {
    const text = example.input.toLowerCase();
    const emotionalTerms = ['feel', 'happy', 'sad', 'angry', 'excited', 'worried', 'love',
      'hate', 'afraid', 'hopeful', 'anxious', 'depressed', 'joyful', 'grateful', 'lonely'];
    let matches = 0;
    for (const term of emotionalTerms) if (text.includes(term)) matches++;
    return Math.min(matches * 0.2, 0.95);
  }

  private updateTransferSuccessRate(domainName: string, success: boolean): void {
    const key = `transfer_${domainName}`;
    const current = this.transferSuccessRates.get(key) ?? 0.5;
    this.transferSuccessRates.set(key, current * 0.9 + (success ? 1.0 : 0.0) * 0.1);
  }

  addDomainKnowledge(domainName: string, fact: string, confidence: number): void {
    if (!this.domainKnowledgeBases.has(domainName)) {
      this.domainKnowledgeBases.set(domainName, new DomainKnowledge(domainName));
    }
    this.domainKnowledgeBases.get(domainName)!.addFact(fact, 'custom_fact', confidence);
  }

  updateCache(): void {
    if (this.domainSimilarityCache.size > 1000) this.domainSimilarityCache.clear();
  }

  getTransferSuccessRate(): number {
    return this.attemptedTransfers === 0 ? 0 : this.successfulTransfers / this.attemptedTransfers;
  }

  getAverageTransferBenefit(): number { return this.averageTransferBenefit; }
  getDomainCount(): number { return this.domainKnowledgeBases.size; }
}
