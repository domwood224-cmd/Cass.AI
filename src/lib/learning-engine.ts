// ─── Learning Engine (now wraps the AI script engine) ───
// The real AI logic lives in ./ai/advanced-learning-engine.ts
// This file re-exports for backward compatibility

export { aiEngine as learningEngine, AdvancedLearningEngine } from './ai';
export type { AIEngineStats as LearningState } from './ai/types';
