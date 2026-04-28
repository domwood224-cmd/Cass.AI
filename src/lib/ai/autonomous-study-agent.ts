// ─── Autonomous Study Agent ───
// Self-learning engine that continuously scans the web on user-defined topics.
// Tell Cassidey what to study and she learns autonomously in the background.
// Gemini is used ONLY as a web search tool — the AI engine is the brain.

import { WebLearner, WebSearchResult } from './web-learner';
import { NeuralKnowledgeGraph } from './neural-knowledge-graph';
import { getGenAI } from '../gemini';

// ─── Types ───

export interface StudyTopic {
  id: string;
  name: string;
  keywords: string[];
  depth: StudyDepth;
  status: 'active' | 'paused' | 'completed';
  addedAt: number;
  lastScanAt: number;
  totalScans: number;
  totalFactsLearned: number;
  totalEntitiesDiscovered: number;
  knowledgeGained: number; // 0-100 score
  subTopics: string[]; // Dynamically discovered sub-topics
}

export enum StudyDepth {
  SURFACE = 'SURFACE',       // Quick overview, 2-3 searches per cycle
  MODERATE = 'MODERATE',     // Balanced depth, 4-6 searches per cycle
  DEEP = 'DEEP',             // Thorough research, 8-12 searches per cycle
  EXHAUSTIVE = 'EXHAUSTIVE', // Maximum coverage, 12-16 searches per cycle
}

export interface StudyAgentStats {
  isRunning: boolean;
  activeTopics: number;
  totalTopics: number;
  totalScansCompleted: number;
  totalFactsLearned: number;
  totalEntitiesDiscovered: number;
  lastCycleAt: number;
  nextCycleAt: number;
  cycleIntervalMs: number;
  uptimeMs: number;
  currentScanTopic: string | null;
}

const DEPTH_CONFIG: Record<StudyDepth, { searchesPerCycle: number; searchDelayMs: number; label: string }> = {
  [StudyDepth.SURFACE]:    { searchesPerCycle: 2,  searchDelayMs: 5000,  label: 'Surface' },
  [StudyDepth.MODERATE]:   { searchesPerCycle: 5,  searchDelayMs: 8000,  label: 'Moderate' },
  [StudyDepth.DEEP]:       { searchesPerCycle: 8,  searchDelayMs: 12000, label: 'Deep' },
  [StudyDepth.EXHAUSTIVE]: { searchesPerCycle: 14, searchDelayMs: 15000, label: 'Exhaustive' },
};

export class AutonomousStudyAgent {
  private topics: Map<string, StudyTopic> = new Map();
  private isRunning = false;
  private cycleTimer: ReturnType<typeof setTimeout> | null = null;
  private webLearner: WebLearner;
  private knowledgeGraph: NeuralKnowledgeGraph | null = null;
  private cycleIntervalMs = 60000; // 1 minute between cycles
  private isScanning = false;
  private totalScansCompleted = 0;
  private totalFactsLearned = 0;
  private totalEntitiesDiscovered = 0;
  private lastCycleAt = 0;
  private startedAt = 0;
  private currentScanTopic: string | null = null;
  private onStatusChange: ((status: string) => void) | null = null;

  // Callbacks for UI updates
  private onTopicUpdate: ((topic: StudyTopic) => void) | null = null;
  private onScanComplete: ((topicId: string, factsLearned: number) => void) | null = null;

  constructor(webLearner: WebLearner) {
    this.webLearner = webLearner;
  }

  setKnowledgeGraph(kg: NeuralKnowledgeGraph): void {
    this.knowledgeGraph = kg;
  }

  setOnStatusChange(cb: (status: string) => void): void {
    this.onStatusChange = cb;
  }

  setOnTopicUpdate(cb: (topic: StudyTopic) => void): void {
    this.onTopicUpdate = cb;
  }

  setOnScanComplete(cb: (topicId: string, factsLearned: number) => void): void {
    this.onScanComplete = cb;
  }

  // ─── Topic Management ───

  addTopic(name: string, depth: StudyDepth = StudyDepth.MODERATE): StudyTopic {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 60);
    if (this.topics.has(id)) {
      // Reactivate if paused
      const existing = this.topics.get(id)!;
      existing.status = 'active';
      existing.depth = depth;
      this.notifyStatus?.(`Reactivated study topic: ${name}`);
      return existing;
    }

    const keywords = this.extractKeywords(name);
    const topic: StudyTopic = {
      id,
      name,
      keywords,
      depth,
      status: 'active',
      addedAt: Date.now(),
      lastScanAt: 0,
      totalScans: 0,
      totalFactsLearned: 0,
      totalEntitiesDiscovered: 0,
      knowledgeGained: 0,
      subTopics: [],
    };

    this.topics.set(id, topic);
    this.notifyStatus?.(`New study topic added: ${name} (${DEPTH_CONFIG[depth].label} depth)`);
    return topic;
  }

  removeTopic(id: string): boolean {
    const topic = this.topics.get(id);
    if (!topic) return false;
    topic.status = 'completed';
    this.topics.delete(id);
    this.notifyStatus?.(`Stopped studying: ${topic.name}`);
    return true;
  }

  pauseTopic(id: string): boolean {
    const topic = this.topics.get(id);
    if (!topic) return false;
    topic.status = 'paused';
    this.notifyStatus?.(`Paused study of: ${topic.name}`);
    return true;
  }

  resumeTopic(id: string): boolean {
    const topic = this.topics.get(id);
    if (!topic) return false;
    topic.status = 'active';
    this.notifyStatus?.(`Resumed study of: ${topic.name}`);
    return true;
  }

  setTopicDepth(id: string, depth: StudyDepth): boolean {
    const topic = this.topics.get(id);
    if (!topic) return false;
    topic.depth = depth;
    return true;
  }

  setInterval(ms: number): void {
    this.cycleIntervalMs = Math.max(10000, Math.min(600000, ms)); // 10s min, 10min max
    if (this.isRunning) {
      this.stopCycle();
      this.startCycle();
    }
  }

  getTopics(): StudyTopic[] {
    return Array.from(this.topics.values());
  }

  getActiveTopics(): StudyTopic[] {
    return this.getTopics().filter(t => t.status === 'active');
  }

  getTopic(id: string): StudyTopic | undefined {
    return this.topics.get(id);
  }

  // ─── Autonomous Study Engine ───

  start(): void {
    if (this.isRunning) return;
    if (this.getActiveTopics().length === 0) {
      this.notifyStatus?.('No active topics to study. Add a topic first.');
      return;
    }
    this.isRunning = true;
    this.startedAt = this.startedAt || Date.now();
    this.notifyStatus?.('Autonomous study agent activated');
    console.log('[StudyAgent] Started autonomous study engine');
    this.startCycle();
  }

  stop(): void {
    this.isRunning = false;
    this.stopCycle();
    this.currentScanTopic = null;
    this.notifyStatus?.('Autonomous study agent deactivated');
    console.log('[StudyAgent] Stopped autonomous study engine');
  }

  async runSingleScan(topicId?: string): Promise<{ topicName: string; factsLearned: number; entities: number } | null> {
    const genAI = getGenAI();
    if (!genAI) {
      this.notifyStatus?.('No Gemini key — autonomous study requires web access');
      return null;
    }

    const activeTopics = topicId
      ? this.getTopics().filter(t => t.id === topicId)
      : this.getActiveTopics();

    if (activeTopics.length === 0) return null;

    const topic = activeTopics[Math.floor(Math.random() * activeTopics.length)];
    if (!topic) return null;

    this.isScanning = true;
    this.currentScanTopic = topic.name;
    this.notifyStatus?.(`Scanning: ${topic.name}...`);

    const config = DEPTH_CONFIG[topic.depth];
    let cycleFacts = 0;
    let cycleEntities = 0;

    // Generate diverse search queries for this topic
    const queries = this.generateSearchQueries(topic, config.searchesPerCycle);

    for (let i = 0; i < queries.length; i++) {
      try {
        const result = await this.webLearner.searchAndLearn(queries[i], genAI);
        if (result) {
          cycleFacts += result.learnedFacts.length;
          cycleEntities += result.entities.length;

          // Discover sub-topics from entities
          for (const entity of result.entities) {
            const entLower = entity.toLowerCase();
            if (!topic.subTopics.includes(entLower) && entLower !== topic.name.toLowerCase()) {
              topic.subTopics.push(entLower);
              if (topic.subTopics.length > 20) topic.subTopics = topic.subTopics.slice(-20);
            }
          }
        }
        // Delay between searches to avoid rate limits
        if (i < queries.length - 1) {
          await this.sleep(config.searchDelayMs);
        }
      } catch (e) {
        console.log(`[StudyAgent] Search "${queries[i]}" failed:`, e);
      }
    }

    // Update topic stats
    topic.totalScans++;
    topic.totalFactsLearned += cycleFacts;
    topic.totalEntitiesDiscovered += cycleEntities;
    topic.lastScanAt = Date.now();
    topic.knowledgeGained = Math.min(100, topic.knowledgeGained + cycleFacts * 2 + cycleEntities);

    // Update global stats
    this.totalScansCompleted++;
    this.totalFactsLearned += cycleFacts;
    this.totalEntitiesDiscovered += cycleEntities;
    this.lastCycleAt = Date.now();

    this.isScanning = false;
    this.currentScanTopic = null;

    this.notifyStatus?.(`Scan complete: ${topic.name} — ${cycleFacts} facts, ${cycleEntities} entities`);
    this.onTopicUpdate?.(topic);
    this.onScanComplete?.(topic.id, cycleFacts);

    console.log(`[StudyAgent] Topic "${topic.name}": ${cycleFacts} facts, ${cycleEntities} entities (scan #${topic.totalScans})`);

    return { topicName: topic.name, factsLearned: cycleFacts, entities: cycleEntities };
  }

  // ─── Query Generation ───
  // Creates diverse, intelligent search queries for a given topic

  private generateSearchQueries(topic: StudyTopic, count: number): string[] {
    const queries: string[] = [];
    const name = topic.name;

    // Base queries
    const basePatterns = [
      `${name}: comprehensive overview and key concepts`,
      `latest research and developments in ${name}`,
      `fundamental principles and theories of ${name}`,
      `practical applications of ${name} in real world`,
      `history and evolution of ${name}`,
      `${name} current challenges and future directions`,
      `advanced concepts in ${name} for experts`,
      `${name} key figures, discoveries, and breakthroughs`,
      `how ${name} impacts society and technology`,
      `common misconceptions about ${name}`,
      `${name} comparison and analysis`,
      `beginner to expert guide on ${name}`,
      `${name} case studies and examples`,
      `criticisms and limitations of ${name}`,
      `${name} interdisciplinary connections`,
    ];

    // Mix base queries with sub-topic queries
    for (const pattern of basePatterns) {
      if (queries.length >= count) break;
      queries.push(pattern);
    }

    // Add sub-topic queries if we have discovered some
    if (topic.subTopics.length > 0) {
      const shuffled = [...topic.subTopics].sort(() => Math.random() - 0.5);
      for (const sub of shuffled) {
        if (queries.length >= count) break;
        queries.push(`${sub} in context of ${name}`);
      }
    }

    // Shuffle for variety
    return queries.sort(() => Math.random() - 0.5).slice(0, count);
  }

  // ─── Cycle Management ───

  private startCycle(): void {
    this.stopCycle();
    const tick = async () => {
      if (!this.isRunning) return;
      try {
        await this.runSingleScan();
      } catch (e) {
        console.error('[StudyAgent] Cycle error:', e);
      }
      if (this.isRunning) {
        this.cycleTimer = setTimeout(tick, this.cycleIntervalMs);
      }
    };
    // Run first scan immediately with small delay
    this.cycleTimer = setTimeout(tick, 2000);
  }

  private stopCycle(): void {
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer);
      this.cycleTimer = null;
    }
  }

  // ─── Stats ───

  getStats(): StudyAgentStats {
    return {
      isRunning: this.isRunning,
      activeTopics: this.getActiveTopics().length,
      totalTopics: this.topics.size,
      totalScansCompleted: this.totalScansCompleted,
      totalFactsLearned: this.totalFactsLearned,
      totalEntitiesDiscovered: this.totalEntitiesDiscovered,
      lastCycleAt: this.lastCycleAt,
      nextCycleAt: this.isRunning ? this.lastCycleAt + this.cycleIntervalMs : 0,
      cycleIntervalMs: this.cycleIntervalMs,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      currentScanTopic: this.currentScanTopic,
    };
  }

  // ─── Utility ───

  private extractKeywords(name: string): string[] {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private notifyStatus(msg: string): void {
    this.onStatusChange?.(msg);
  }

  // ─── Persistence ───

  exportState(): string {
    const data = {
      topics: Array.from(this.topics.values()),
      totalScansCompleted: this.totalScansCompleted,
      totalFactsLearned: this.totalFactsLearned,
      totalEntitiesDiscovered: this.totalEntitiesDiscovered,
      cycleIntervalMs: this.cycleIntervalMs,
      lastCycleAt: this.lastCycleAt,
    };
    return JSON.stringify(data);
  }

  importState(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data && data.topics) {
        this.topics.clear();
        for (const t of data.topics) {
          this.topics.set(t.id, t);
        }
        this.totalScansCompleted = data.totalScansCompleted || 0;
        this.totalFactsLearned = data.totalFactsLearned || 0;
        this.totalEntitiesDiscovered = data.totalEntitiesDiscovered || 0;
        this.cycleIntervalMs = data.cycleIntervalMs || 60000;
        this.lastCycleAt = data.lastCycleAt || 0;
        return true;
      }
      return false;
    } catch (e) {
      console.error('[StudyAgent] Failed to import state:', e);
      return false;
    }
  }

  reset(): void {
    this.stop();
    this.topics.clear();
    this.totalScansCompleted = 0;
    this.totalFactsLearned = 0;
    this.totalEntitiesDiscovered = 0;
    this.lastCycleAt = 0;
    this.startedAt = 0;
    this.currentScanTopic = null;
  }
}
