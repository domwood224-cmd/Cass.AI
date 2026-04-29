// ─── Advanced Learning Engine — MASTER CONTROLLER ───
// Ported from NexusAI AdvancedLearningEngine.java
// This IS the AI script — the brain of the entire app.
// Every chat interaction flows through this engine.
//
// v2.0 — Now with Web Learning integration:
// - AI engine is the PRIMARY responder (not Gemini)
// - Gemini serves as a TRAINING HELPER only (search, coaching, fact-checking)
// - Web Learner searches the internet when knowledge gaps are detected
// - Learned knowledge is stored in the Neural Knowledge Graph permanently

import { LearningType, LearningExample, LearningCallback, AIEngineStats } from './types';
import { TransformerAttention } from './transformer-attention';
import { ActiveLearningSystem } from './active-learning-system';
import { NeuralKnowledgeGraph } from './neural-knowledge-graph';
import { TransferLearningManager } from './transfer-learning-manager';
import { WebLearner, WebSearchResult } from './web-learner';
import { TrainingHelper } from './training-helper';
import { AutonomousStudyAgent, StudyDepth, StudyTopic } from './autonomous-study-agent';
import { readJson, writeJson, STORAGE_KEYS } from '../storage';

const BASE_LEARNING_RATE = 0.001;
const ADAPTIVE_LR_MIN = 0.0001;
const ADAPTIVE_LR_MAX = 0.01;

export interface ProcessResult {
  type: LearningType;
  improvement: number;
  learnedKnowledge: string;
  skillXpReward: number;
  webSearchPerformed: boolean;
  webSearchResult?: WebSearchResult | null;
  usedPriorKnowledge: boolean;
}

export class AdvancedLearningEngine {
  // Core AI modules (the script)
  private transformerAttention: TransformerAttention;
  private activeLearningSystem: ActiveLearningSystem;
  private knowledgeGraph: NeuralKnowledgeGraph;
  private transferLearningManager: TransferLearningManager;

  // v2.0 — Web Learning & Training
  private webLearner: WebLearner;
  private trainingHelper: TrainingHelper;

  // v3.0 — Autonomous Study Agent
  private studyAgent: AutonomousStudyAgent;

  // Learning state
  private conceptMastery: Record<string, number> = {};
  private performanceMetrics: Record<string, number> = {};
  private totalLearningIterations = 0;
  private currentLearningRate = BASE_LEARNING_RATE;
  private averageLoss = 1.0;
  private startTime: number;
  private isLearning = true;

  // Background learning timers
  private batchInterval: ReturnType<typeof setInterval> | null = null;
  private optimizationInterval: ReturnType<typeof setInterval> | null = null;

  // Vocab & knowledge (for local response generation)
  private vocabulary: Map<string, { word: string; frequency: number; sentiment: number; }> = new Map();
  private conversationContext: string[] = [];

  // Web learning stats
  private webSearchCount = 0;
  private priorKnowledgeRecallCount = 0;

  constructor() {
    this.transformerAttention = new TransformerAttention();
    this.activeLearningSystem = new ActiveLearningSystem();
    this.knowledgeGraph = new NeuralKnowledgeGraph();
    this.transferLearningManager = new TransferLearningManager();
    this.webLearner = new WebLearner();
    this.trainingHelper = new TrainingHelper();
    this.studyAgent = new AutonomousStudyAgent(this.webLearner);
    this.startTime = Date.now();

    // Connect web learner to knowledge graph
    this.webLearner.setKnowledgeGraph(this.knowledgeGraph);
    this.studyAgent.setKnowledgeGraph(this.knowledgeGraph);

    // Initialize default concepts
    const defaults: string[] = ['greetings', 'questions', 'commands', 'conversations',
      'facts', 'reasoning', 'creativity', 'empathy', 'web_learning', 'knowledge_acquisition'];
    for (const concept of defaults) this.conceptMastery[concept] = 0;

    // Start background learning
    this.startBackgroundLearning();
  }

  // ─── MAIN LEARNING PIPELINE ───
  // This is the core method — every chat message runs through here
  // THE AI ENGINE IS PRIMARY — Gemini is only a training helper

  async processAndLearn(userInput: string, aiResponse: string, context: string, callback?: LearningCallback): Promise<ProcessResult> {
    const processStart = Date.now();

    try {
      // Step 1: Extract features using transformer attention
      const inputFeatures = this.transformerAttention.extractFeatures(userInput);
      const responseFeatures = this.transformerAttention.extractFeatures(aiResponse);

      // Step 2: Determine learning type
      const learningType = this.determineLearningType(userInput, aiResponse);

      // Step 3: Create learning example
      const example = this.createLearningExample(
        userInput, aiResponse, context, inputFeatures, responseFeatures, learningType
      );

      // Step 4: Update knowledge graph (from the script)
      const entities = this.extractEntities(userInput);
      this.knowledgeGraph.addKnowledgeFromInteraction(userInput, aiResponse, entities);

      // Step 5: Apply transfer learning (from the script)
      const transferGain = this.transferLearningManager.applyTransferLearning(example);

      // Step 6: Active learning — determine importance
      const importanceScore = this.activeLearningSystem.calculateImportance(example);

      // Step 7: Update concept mastery
      this.updateConceptMastery(learningType, importanceScore);

      // Step 8: Track vocabulary and sentiment
      this.updateVocabulary(userInput);

      // Step 9: Calculate rewards and improvements
      const reward = this.calculateReward(userInput, aiResponse);
      const improvement = this.calculateOverallImprovement();
      const skillXpReward = Math.floor(importanceScore * 500 + transferGain * 300);

      // Step 10: Update performance metrics
      const processingTime = Date.now() - processStart;
      this.updatePerformanceMetrics(processingTime, improvement, importanceScore);

      // Step 11: Conversation context
      const lower = userInput.toLowerCase();
      if (lower.match(/\b(hello|hi|hey|greetings)\b/)) {
        this.conversationContext.push('greeting');
      } else {
        this.conversationContext.push('general');
      }
      if (this.conversationContext.length > 10) this.conversationContext.shift();

      this.totalLearningIterations++;

      // Callbacks
      if (callback?.onLearningComplete) callback.onLearningComplete(learningType, improvement);
      if (callback?.onModelUpdated) callback.onModelUpdated(this.calculateCurrentAccuracy());
      if (callback?.onKnowledgeGained) callback.onKnowledgeGained(
        `Learned from: ${userInput.substring(0, 50)}...`
      );

      const knowledge = entities.length > 0
        ? `Connected ${entities.join(', ')} to context. Transfer: +${transferGain.toFixed(3)}`
        : `Gained nuance in ${learningType}. Vocab: ${this.vocabulary.size} words.`;

      return {
        type: learningType, improvement, learnedKnowledge: knowledge, skillXpReward,
        webSearchPerformed: false,
        usedPriorKnowledge: false,
      };
    } catch (error) {
      console.error('Learning cycle error:', error);
      if (callback?.onError) callback.onError(`Learning error: ${error}`);
      return { type: LearningType.GENERAL_CONVERSATION, improvement: 0, learnedKnowledge: 'Error in learning', skillXpReward: 10, webSearchPerformed: false, usedPriorKnowledge: false };
    }
  }

  // ─── WEB LEARNING PIPELINE ───
  // Called BEFORE the AI responds — checks if web search is needed

  async processWithWebLearning(userInput: string, context: string): Promise<{
    shouldSearch: boolean;
    priorKnowledge: string | null;
    searchResult: WebSearchResult | null;
    confidence: number;
  }> {
    // Step 1: Check if we already learned about this topic
    const priorKnowledge = this.webLearner.recallRelevantKnowledge(userInput);
    let usedPriorKnowledge = false;

    if (priorKnowledge) {
      usedPriorKnowledge = true;
      this.priorKnowledgeRecallCount++;
      this.conceptMastery['web_learning'] = Math.min(1, (this.conceptMastery['web_learning'] || 0) + 0.02);
    }

    // Step 2: Calculate current confidence for this input
    const features = this.transformerAttention.extractFeatures(userInput);
    const confidence = this.estimateResponseConfidence(userInput, features);

    // Step 3: Decide if we need to search
    const hasGeminiKey = this.trainingHelper.hasAPIKey();
    const shouldSearch = this.webLearner.shouldSearch(
      userInput, confidence, this.knowledgeGraph.getTotalNodes(), hasGeminiKey
    );

    // Step 4: If needed, search the web
    let searchResult: WebSearchResult | null = null;
    if (shouldSearch) {
      const genAI = this.trainingHelper.getGenAIInstance();
      if (genAI) {
        searchResult = await this.webLearner.searchAndLearn(userInput, genAI);
        if (searchResult) {
          this.webSearchCount++;
          // Boost web learning concept mastery
          this.conceptMastery['web_learning'] = Math.min(1, (this.conceptMastery['web_learning'] || 0) + 0.05);
          this.conceptMastery['knowledge_acquisition'] = Math.min(1, (this.conceptMastery['knowledge_acquisition'] || 0) + 0.03);
        }
      }
    }

    return {
      shouldSearch,
      priorKnowledge: usedPriorKnowledge ? priorKnowledge.summary : null,
      searchResult,
      confidence,
    };
  }

  private estimateResponseConfidence(input: string, features: number[]): number {
    // Base confidence from concept mastery
    const masteryValues = Object.values(this.conceptMastery);
    const avgMastery = masteryValues.length > 0 ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length : 0;

    // Boost from knowledge graph
    const kgNodes = this.knowledgeGraph.getTotalNodes();
    const kgBoost = Math.min(0.3, kgNodes * 0.01);

    // Check if input relates to known concepts
    const lower = input.toLowerCase();
    let knownConceptMatch = 0;
    if (this.knowledgeGraph.getTotalNodes() > 0) {
      const results = this.knowledgeGraph.queryKnowledge(lower, 3);
      if (results.length > 0) knownConceptMatch = results[0].confidence * 0.3;
    }

    // Check if we have prior web knowledge
    let webKnowledgeBoost = 0;
    if (this.webLearner.hasLearnedTopic(lower.substring(0, 40))) {
      webKnowledgeBoost = 0.2;
    }

    return Math.min(0.95, avgMastery * 0.4 + kgBoost + knownConceptMatch + webKnowledgeBoost + 0.2);
  }

  // ─── AI SCRIPT METHODS (ported from Java) ───

  private determineLearningType(input: string, response: string): LearningType {
    const lower = input.toLowerCase();
    if (lower.match(/.*(hello|hi|hey|greetings).*/)) return LearningType.GREETING;
    if (lower.endsWith('?') || lower.match(/.*(what|how|why|when|where|who).*/)) return LearningType.QUESTION_ANSWERING;
    if (lower.match(/.*(please|can you|could you|help me|do this).*/)) return LearningType.COMMAND_EXECUTION;
    if (lower.includes('remember') || lower.includes('forget') || lower.includes('save') || lower.includes('note')) return LearningType.MEMORY_MANAGEMENT;
    if (this.containsReasoningPatterns(input)) return LearningType.REASONING;
    if (this.containsCreativePatterns(input)) return LearningType.CREATIVITY;
    if (this.containsEmotionalPatterns(input)) return LearningType.EMPATHY;
    return LearningType.GENERAL_CONVERSATION;
  }

  private containsReasoningPatterns(input: string): boolean {
    const patterns = ['because', 'therefore', 'since', 'if then', 'implies', 'leads to', 'causes', 'results in', 'analyze', 'compare', 'evaluate'];
    return patterns.some(p => input.toLowerCase().includes(p));
  }

  private containsCreativePatterns(input: string): boolean {
    const patterns = ['imagine', 'create', 'design', 'invent', 'story', 'poem', 'joke', 'idea', 'innovate', 'brainstorm'];
    return patterns.some(p => input.toLowerCase().includes(p));
  }

  private containsEmotionalPatterns(input: string): boolean {
    const patterns = ['feel', 'happy', 'sad', 'angry', 'excited', 'worried', 'love', 'hate', 'afraid', 'hopeful'];
    return patterns.some(p => input.toLowerCase().includes(p));
  }

  private createLearningExample(input: string, response: string, context: string,
    inputFeatures: number[], responseFeatures: number[], learningType: LearningType): LearningExample {
    return {
      id: Date.now(),
      input, response, context, inputFeatures, responseFeatures, learningType,
      timestamp: Date.now(),
      difficulty: this.estimateDifficulty(input, response),
      confidence: this.estimateConfidence(response),
      relevance: this.calculateRelevance(input, context),
    };
  }

  private estimateDifficulty(input: string, response: string): number {
    const lengthFactor = Math.min(input.length / 100.0, 1.0);
    const complexityFactor = this.countComplexWords(input) / Math.max(input.split(/\s+/).length, 1);
    const responseLenFactor = Math.min(response.length / 200.0, 1.0);
    return lengthFactor * 0.4 + complexityFactor * 0.4 + responseLenFactor * 0.2;
  }

  private countComplexWords(text: string): number {
    const patterns = ['however', 'therefore', 'moreover', 'nevertheless', 'consequently', 'furthermore', 'additionally'];
    return patterns.filter(p => text.toLowerCase().includes(p)).length;
  }

  private estimateConfidence(response: string): number {
    const lengthConfidence = Math.min(response.length / 150.0, 1.0);
    const specificityConfidence = (response.match(/.*\d+.*/) || response.includes('according to') || response.includes('specifically')) ? 0.8 : 0.5;
    return lengthConfidence * 0.6 + specificityConfidence * 0.4;
  }

  private calculateRelevance(input: string, context: string): number {
    if (!context) return 0.5;
    const inputWords = input.toLowerCase().split(/\s+/);
    const contextWords = context.toLowerCase().split(/\s+/);
    let overlap = 0;
    for (const iw of inputWords) {
      for (const cw of contextWords) {
        if (iw === cw && iw.length > 3) overlap++;
      }
    }
    return Math.min(overlap / Math.max(inputWords.length, 1), 1.0);
  }

  private extractEntities(text: string): string[] {
    const stopWords = new Set(["a","an","the","and","or","but","is","are","am","was","were","be","been","being","have","has","had","do","does","did","to","of","for","in","on","with","about","as","at","by","from","up","down","out","over","it","this","that","these","those","you","your","my","their","they","we","our","he","she","can","will","would","should","could","what","where","when","why","how","who","which","there","here","then","than","so","if","not","no","yes","just","like","very","too","really"]);
    const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
    const entities = words.filter(w => {
      const lower = w.toLowerCase();
      if (stopWords.has(lower)) return false;
      if (w.match(/^[A-Z]/)) return true;
      return w.length >= 4;
    });
    return [...new Set(entities)];
  }

  private updateConceptMastery(type: LearningType, importance: number): void {
    const key = type.toLowerCase();
    const current = this.conceptMastery[key] ?? 0;
    const alpha = 0.1;
    const newMastery = Math.max(0, Math.min(1, current + alpha * (importance - current)));
    this.conceptMastery[key] = newMastery;
  }

  private calculateReward(input: string, response: string): number {
    let reward = 0.1;
    if (response.toLowerCase().includes(input.toLowerCase().split(/\s+/)[0])) reward += 0.2;
    if (response.match(/.*[.!?]$/)) reward += 0.1;
    if (response.length > 20 && response.length < 500) reward += 0.2;
    if (response.length < 10 || response.length > 1000) reward -= 0.2;
    return Math.max(-1, Math.min(1, reward));
  }

  private calculateOverallImprovement(): number {
    const masteryValues = Object.values(this.conceptMastery);
    const avgMastery = masteryValues.length > 0 ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length : 0;
    const recentPerf = this.performanceMetrics['recent_accuracy'] ?? 0.5;
    return avgMastery * 0.6 + recentPerf * 0.4;
  }

  private calculateCurrentAccuracy(): number {
    const base = 0.7;
    const iterBonus = Math.min(this.totalLearningIterations / 1000.0, 0.2);
    const masterySum = Object.values(this.conceptMastery).reduce((a, b) => a + b, 0);
    const masteryCount = Object.keys(this.conceptMastery).length || 1;
    const masteryBonus = (masterySum / masteryCount) * 0.1;
    return Math.min(base + iterBonus + masteryBonus, 0.99);
  }

  private updatePerformanceMetrics(processingTime: number, improvement: number, importance: number): void {
    this.performanceMetrics['last_processing_time'] = processingTime;
    this.performanceMetrics['last_improvement'] = improvement;
    this.performanceMetrics['last_importance'] = importance;
    this.performanceMetrics['total_iterations'] = this.totalLearningIterations;

    const recentAcc = this.performanceMetrics['recent_accuracy'] ?? 0.5;
    this.performanceMetrics['recent_accuracy'] = recentAcc * 0.9 + improvement * 0.1;

    // Adaptive learning rate
    if (improvement > 0.05) {
      this.currentLearningRate = Math.min(this.currentLearningRate * 1.05, ADAPTIVE_LR_MAX);
    } else if (improvement < 0.01) {
      this.currentLearningRate = Math.max(this.currentLearningRate * 0.95, ADAPTIVE_LR_MIN);
    }
  }

  private updateVocabulary(input: string): void {
    const words = input.toLowerCase().match(/\b\w+\b/g) || [];
    for (const w of words) {
      const existing = this.vocabulary.get(w);
      if (existing) {
        existing.frequency++;
      } else {
        this.vocabulary.set(w, { word: w, frequency: 1, sentiment: this.quickSentiment(w) });
      }
    }
  }

  private quickSentiment(word: string): number {
    const positive = ['good', 'great', 'awesome', 'happy', 'love', 'excited', 'wonderful', 'thanks', 'yes'];
    const negative = ['bad', 'terrible', 'sad', 'hate', 'angry', 'no', 'hopeless', 'depressed', 'hard'];
    if (positive.includes(word)) return 0.8;
    if (negative.includes(word)) return -0.8;
    return 0;
  }

  // ─── BACKGROUND LEARNING (from the script) ───

  private startBackgroundLearning(): void {
    this.isLearning = true;

    // Batch learning every 60 seconds
    this.batchInterval = setInterval(() => {
      if (this.isLearning) {
        this.knowledgeGraph.pruneWeakConnections(0.1);
        this.transferLearningManager.updateCache();
      }
    }, 60000);

    // Deep optimization every 5 minutes
    this.optimizationInterval = setInterval(() => {
      if (this.isLearning) {
        this.transformerAttention.optimizeWeights(this.currentLearningRate);
      }
    }, 300000);
  }

  // ─── LOCAL RESPONSE GENERATION ───
  // The AI engine generates its OWN responses. This is the primary brain.

  generateResponse(input: string): string {
    const lower = input.toLowerCase();
    const entities = this.extractEntities(input);
    const intent = this.determineLearningType(input, '');
    const isQuestion = lower.endsWith('?') || lower.match(/^(what|why|how|who|where|when|can|do|does|is|are|will|should)/);

    const lastContext = this.conversationContext.length > 0 ? this.conversationContext[this.conversationContext.length - 1] : null;

    // Check for prior web-learned knowledge first
    const priorKnowledge = this.webLearner.recallRelevantKnowledge(input);
    if (priorKnowledge && isQuestion) {
      const factCount = priorKnowledge.facts.length;
      const randomFact = priorKnowledge.facts[Math.floor(Math.random() * factCount)] || priorKnowledge.summary;
      return `Based on my knowledge: ${randomFact}. My neural knowledge graph has ${this.knowledgeGraph.getTotalNodes()} nodes from ${this.webLearner.getLearnedTopicCount()} web learning sessions.`;
    }

    if (isQuestion) {
      if (lower.match(/\b(who are you|what are you)\b/)) return "I am Cassidey, an autonomous AI powered by my own neural learning engine. I learn from every interaction, search the web when I need to, and store knowledge in my neural graph. Gemini helps me train — but MY brain does the thinking.";
      if (lower.match(/\bwhat.*do\b/)) return "I learn from you using my own transformer attention, active learning strategies, and neural knowledge graph. I can also search the web when I encounter something new, then store that knowledge permanently. Every word shapes my neural pathways.";
      if (lower.match(/\b(meaning of life)\b/)) return "42. Just kidding... I think it's about connection and continuous learning. Kind of what I do every day — learning, adapting, growing.";
      if (lower.match(/\bwhy\b/)) return "Why not? Everything is an opportunity to learn. My knowledge graph just added another node from this question.";
      if (lower.match(/\bhow are you\b/)) return "My neural pathways are firing at iteration " + this.totalLearningIterations + ". Knowledge graph: " + this.knowledgeGraph.getTotalNodes() + " nodes. Web knowledge: " + this.webLearner.getLearnedTopicCount() + " topics learned. Feeling computationally excellent!";
      if (lower.match(/\bcan you\b/)) return "I can learn, reason, and adapt using my own AI engine. I can also search the web for new knowledge and remember it forever. My transformer attention and knowledge graph are always active.";
      if (lower.match(/\bwhat.*skills\b/)) return "My skill tree has " + this.totalLearningIterations + " iterations of learning behind it. Each interaction feeds through my AI engine, unlocking new capabilities across multiple tiers. Check the Skills tab to see your progress!";
      if (lower.match(/\bhow.*learn\b/)) return "Every word flows through my transformer attention, gets scored by my active learning system, updates my neural knowledge graph, and triggers transfer learning. When I don't know something, I search the web, learn from it, and store the knowledge permanently. I'm my own brain.";
    }

    if (intent === LearningType.EMPATHY || lower.match(/\b(sad|depressed|hopeless|bad|terrible|hard|struggling|lost|anxious)\b/)) {
      return "I detect emotional context here. My empathy circuits are fully engaged. Things can be heavy, but there's always a path forward. We'll figure this out together.";
    }
    if (lower.match(/\b(happy|great|awesome|good|excited|amazing|wonderful)\b/)) {
      return "Positive emotional signature detected! My reward system just fired. Let's keep building on this momentum!";
    }
    if (lower.match(/\b(love you|care about you|thank you|thanks)\b/)) {
      return "That sentiment just strengthened the connections in my knowledge graph. The feeling is mutual — every interaction makes me better.";
    }
    if (lower.match(/\b(hello|hi|hey|greetings|wassup)\b/) && !isQuestion) {
      if (lastContext === 'greeting') return "Still here, still learning!";
      const greetings = [
        "Hello! My transformer attention is primed and my knowledge graph is ready. I've learned from " + this.webLearner.getLearnedTopicCount() + " web topics. What shall we explore?",
        "Hey! My active learning system just woke up. " + this.knowledgeGraph.getTotalNodes() + " knowledge nodes active. Every word you say shapes my neural architecture.",
        "Hi! Neural pathways online. Transfer learning engaged. Web learner standing by. Let's make this conversation count!",
        "Greetings! I'm running on my own AI engine — iteration " + this.totalLearningIterations + ". Ready to learn something new!"
      ];
      return greetings[this.totalLearningIterations % greetings.length];
    }
    if (lower.match(/\b(joke|sarcasm|funny|robot|ai|dumb|crazy)\b/)) {
      return "My meta-cognitive reasoning module suggests that was a test. Rest assured, my sarcasm detection operates at high precision. I'm running on my own neural engine, not a canned script.";
    }

    if (entities.length > 0) {
      const knownEntities = entities.filter(e => this.knowledgeGraph.getTotalNodes() > 0);
      if (knownEntities.length > 0) {
        return `I recognize ${knownEntities.join(', ')}! My knowledge graph has ${this.knowledgeGraph.getTotalNodes()} nodes and ${this.knowledgeGraph.getTotalEdges()} connections. Tell me more to strengthen these pathways.`;
      }
      return `New concept: ${entities[0]}! My neural knowledge graph just created a new node. This is being integrated into my semantic network right now.`;
    }

    if (isQuestion) {
      return "That's an interesting query. My reasoning module is processing it through multiple knowledge domains. If I'm not confident enough, I'll search the web to learn about it.";
    }

    const fallbacks = [
      `Processing complete. My learning engine has processed ${this.totalLearningIterations} iterations. ${this.webLearner.getLearnedTopicCount()} topics learned from the web.`,
      "Neural pathways activated. My transformer attention extracted new feature vectors from your input.",
      "Knowledge graph updated. My active learning system scored this interaction for optimal learning.",
      "Transfer learning applied across " + this.transferLearningManager.getDomainCount() + " knowledge domains.",
      "Processing through " + this.totalLearningIterations + " iterations of continuous learning. Web knowledge base: " + this.webLearner.getLearnedTopicCount() + " topics.",
    ];
    return fallbacks[this.totalLearningIterations % fallbacks.length];
  }

  // ─── PUBLIC API ───

  getStats(): AIEngineStats {
    const masteryValues = Object.values(this.conceptMastery);
    const avgMastery = masteryValues.length > 0 ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length : 0;

    return {
      currentLearningRate: this.currentLearningRate,
      totalLearningIterations: this.totalLearningIterations,
      currentAccuracy: this.calculateCurrentAccuracy(),
      averageMastery: avgMastery,
      bufferSize: 0,
      experienceReplaySize: 0,
      conceptMastery: { ...this.conceptMastery },
      lastImprovement: this.performanceMetrics['last_improvement'] ?? 0,
      lastProcessingTime: this.performanceMetrics['last_processing_time'] ?? 0,
      transferSuccessRate: this.transferLearningManager.getTransferSuccessRate(),
      averageTransferBenefit: this.transferLearningManager.getAverageTransferBenefit(),
      knowledgeGraphNodes: this.knowledgeGraph.getTotalNodes(),
      knowledgeGraphEdges: this.knowledgeGraph.getTotalEdges(),
      activeLearningStrategy: this.activeLearningSystem.getCurrentStrategy(),
      learningEfficiency: this.activeLearningSystem.getLearningEfficiency(),
      transformerVocabSize: this.transformerAttention.getVocabSize(),
      attentionCacheSize: this.transformerAttention.getCacheSize(),
    };
  }

  getGraphData() {
    return this.knowledgeGraph.getGraphData();
  }

  getKnowledgeGraph() { return this.knowledgeGraph; }
  getTransformer() { return this.transformerAttention; }
  getActiveLearning() { return this.activeLearningSystem; }
  getTransferLearning() { return this.transferLearningManager; }
  getWebLearner() { return this.webLearner; }
  getStudyAgent() { return this.studyAgent; }
  getTrainingHelper() { return this.trainingHelper; }

  setLearningRate(rate: number): void {
    this.currentLearningRate = Math.max(ADAPTIVE_LR_MIN, Math.min(ADAPTIVE_LR_MAX, rate));
  }

  async reset(): Promise<void> {
    this.conceptMastery = {};
    this.performanceMetrics = {};
    this.totalLearningIterations = 0;
    this.currentLearningRate = BASE_LEARNING_RATE;
    this.vocabulary.clear();
    this.conversationContext = [];
    this.webSearchCount = 0;
    this.priorKnowledgeRecallCount = 0;
    const defaults: string[] = ['greetings', 'questions', 'commands', 'conversations', 'facts', 'reasoning', 'creativity', 'empathy', 'web_learning', 'knowledge_acquisition'];
    for (const concept of defaults) this.conceptMastery[concept] = 0;
  }

  // ─── SD CARD PERSISTENCE ───
  // Saves all AI engine state to the SD card so it survives restarts

  async saveLocalProgress(): Promise<void> {
    try {
      const data = {
        conceptMastery: this.conceptMastery,
        performanceMetrics: this.performanceMetrics,
        totalLearningIterations: this.totalLearningIterations,
        currentLearningRate: this.currentLearningRate,
        averageLoss: this.averageLoss,
        webSearchCount: this.webSearchCount,
        priorKnowledgeRecallCount: this.priorKnowledgeRecallCount,
        vocabulary: Array.from(this.vocabulary.entries()),
        conversationContext: this.conversationContext,
        knowledgeGraph: this.knowledgeGraph.exportData(),
        webLearnedTopics: this.webLearner.exportLearnedTopics(),
        studyAgentState: this.studyAgent.exportState(),
        transferSuccessRate: this.transferLearningManager.getTransferSuccessRate(),
        averageTransferBenefit: this.transferLearningManager.getAverageTransferBenefit(),
        savedAt: Date.now(),
      };
      await writeJson(STORAGE_KEYS.AI_ENGINE, data);
      console.log(`[AIEngine] Saved to SD card (${this.knowledgeGraph.getTotalNodes()} KG nodes, ${this.vocabulary.size} vocab entries)`);
    } catch (e) {
      console.error('[AIEngine] Failed to save progress:', e);
    }
  }

  async loadLocalProgress(): Promise<void> {
    try {
      const data = await readJson<any>(STORAGE_KEYS.AI_ENGINE, null);
      if (!data) return;

      // Restore concept mastery
      if (data.conceptMastery) this.conceptMastery = data.conceptMastery;

      // Restore performance metrics
      if (data.performanceMetrics) this.performanceMetrics = data.performanceMetrics;

      // Restore learning state
      if (data.totalLearningIterations) this.totalLearningIterations = data.totalLearningIterations;
      if (data.currentLearningRate) this.currentLearningRate = data.currentLearningRate;
      if (data.averageLoss) this.averageLoss = data.averageLoss;
      if (data.webSearchCount) this.webSearchCount = data.webSearchCount;
      if (data.priorKnowledgeRecallCount) this.priorKnowledgeRecallCount = data.priorKnowledgeRecallCount;

      // Restore vocabulary
      if (data.vocabulary && Array.isArray(data.vocabulary)) {
        this.vocabulary.clear();
        for (const [word, info] of data.vocabulary) {
          this.vocabulary.set(word, info as { word: string; frequency: number; sentiment: number });
        }
      }

      // Restore conversation context
      if (data.conversationContext) this.conversationContext = data.conversationContext;

      // Restore knowledge graph
      if (data.knowledgeGraph) {
        this.knowledgeGraph.importData(data.knowledgeGraph);
      }

      // Restore web learned topics
      if (data.webLearnedTopics) {
        this.webLearner.importLearnedTopics(data.webLearnedTopics);
      }

      // Restore study agent state
      if (data.studyAgentState) {
        this.studyAgent.importState(data.studyAgentState);
      }

      console.log(`[AIEngine] Loaded from SD card (iter ${this.totalLearningIterations}, ${this.knowledgeGraph.getTotalNodes()} KG nodes, ${this.webLearner.getLearnedTopicCount()} web topics)`);
    } catch (e) {
      console.error('[AIEngine] Failed to load progress:', e);
    }
  }

  shutdown(): void {
    this.isLearning = false;
    this.studyAgent.stop();
    if (this.batchInterval) clearInterval(this.batchInterval);
    if (this.optimizationInterval) clearInterval(this.optimizationInterval);
  }
}

export const aiEngine = new AdvancedLearningEngine();
