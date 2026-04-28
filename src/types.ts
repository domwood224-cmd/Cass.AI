import { 
  Brain, 
  Code, 
  Terminal, 
  Github, 
  FileText, 
  Youtube, 
  Settings, 
  MessageSquare,
  Sparkles,
  Zap,
  TrendingUp,
  Search
} from 'lucide-react';

export enum SkillCategory {
  AI_LEARNING = "AI Learning",
  CODING = "Coding",
  TERMUX = "Termux",
  GITHUB = "GitHub",
  PDF_ANALYSIS = "PDF Analysis",
  YOUTUBE_LEARNING = "YouTube Learning",
  SYSTEM = "System",
  COMMUNICATION = "Communication",
  CREATIVITY = "Creativity",
  PHILOSOPHY = "Philosophy",
  GAME_THEORY = "Game Theory"
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  prerequisites: string[];
  children: string[];
  abilities: string[];
  level: number;
  xp: number;
}

export enum LearningType {
  GREETING = "GREETING",
  QUESTION_ANSWERING = "QUESTION_ANSWERING",
  COMMAND_EXECUTION = "COMMAND_EXECUTION",
  MEMORY_MANAGEMENT = "MEMORY_MANAGEMENT",
  REASONING = "REASONING",
  CREATIVITY = "CREATIVITY",
  EMPATHY = "EMPATHY",
  GENERAL_CONVERSATION = "GENERAL_CONVERSATION"
}

export interface KnowledgeNode {
  id: string;
  label: string;
  created: number;
  lastAccessed: number;
  accessCount: number;
  importance: number;
  content?: string;
  category?: string;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  predicate: string;
  confidence: number;
  timestamp: number;
}

export interface WordData {
  word: string;
  frequency: number;
  sentiment: number;
  associatedConcepts: string[];
  nuance: number;
  coOccurrences: Record<string, number>;
}

export interface LearningState {
  totalIterations: number;
  accuracy: number;
  learningRate: number;
  averageMastery: number;
  conceptMastery: Record<string, number>;
  uptime: number;
}

// ─── AI Engine State (from the script) ───
export interface AIEngineState {
  currentLearningRate: number;
  totalLearningIterations: number;
  currentAccuracy: number;
  averageMastery: number;
  conceptMastery: Record<string, number>;
  lastImprovement: number;
  lastProcessingTime: number;
  transferSuccessRate: number;
  averageTransferBenefit: number;
  knowledgeGraphNodes: number;
  knowledgeGraphEdges: number;
  activeLearningStrategy: string;
  learningEfficiency: number;
  transformerVocabSize: number;
  attentionCacheSize: number;
}
