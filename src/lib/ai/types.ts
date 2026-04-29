// ─── AI Engine Types (ported from NexusAI Java) ───

export enum LearningType {
  GREETING = "GREETING",
  QUESTION_ANSWERING = "QUESTION_ANSWERING",
  COMMAND_EXECUTION = "COMMAND_EXECUTION",
  MEMORY_MANAGEMENT = "MEMORY_MANAGEMENT",
  REASONING = "REASONING",
  CREATIVITY = "CREATIVITY",
  EMPATHY = "EMPATHY",
  GENERAL_CONVERSATION = "GENERAL_CONVERSATION",
}

export interface LearningExample {
  id: number;
  input: string;
  response: string;
  context: string;
  inputFeatures: number[];
  responseFeatures: number[];
  learningType: LearningType;
  timestamp: number;
  difficulty: number;
  confidence: number;
  relevance: number;
}

export interface LearningExperience {
  example: LearningExample;
  importance: number;
  reward: number;
}

export interface KnowledgeNodeData {
  id: number;
  label: string;
  created: number;
  lastAccessed: number;
  accessCount: number;
}

export interface KnowledgeEdgeData {
  source: number;
  target: number;
  predicate: string;
  confidence: number;
  timestamp: number;
}

export interface KnowledgeTriple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

export interface LearningCallback {
  onLearningComplete?: (learnedConcept: string, improvement: number) => void;
  onModelUpdated?: (newAccuracy: number) => void;
  onKnowledgeGained?: (knowledgeDescription: string) => void;
  onError?: (error: string) => void;
}

export interface AIEngineStats {
  currentLearningRate: number;
  totalLearningIterations: number;
  currentAccuracy: number;
  averageMastery: number;
  bufferSize: number;
  experienceReplaySize: number;
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
