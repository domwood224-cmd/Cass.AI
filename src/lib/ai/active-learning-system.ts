// ─── Active Learning System ───
// Ported from NexusAI ActiveLearningSystem.java
// Implements smart example selection strategies to accelerate learning

import { LearningExample, LearningType } from './types';

export enum SamplingStrategy {
  UNCERTAINTY_SAMPLING = "UNCERTAINTY_SAMPLING",
  DIVERSITY_SAMPLING = "DIVERSITY_SAMPLING",
  EXPECTED_ERROR_REDUCTION = "EXPECTED_ERROR_REDUCTION",
  QUERY_BY_COMMITTEE = "QUERY_BY_COMMITTEE",
  DENSITY_WEIGHTED = "DENSITY_WEIGHTED",
  HYBRID = "HYBRID",
}

export class ActiveLearningSystem {
  private currentStrategy: SamplingStrategy = SamplingStrategy.HYBRID;
  private exampleFrequency: Map<string, number> = new Map();
  private selectedExamples: string[] = [];
  private totalSamplesSelected = 0;
  private learningEfficiency = 0;
  private averageUncertaintyReduction = 0;

  private uncertaintyWeight = 0.5;
  private diversityWeight = 0.3;
  private densityWeight = 0.2;

  calculateImportance(example: LearningExample): number {
    switch (this.currentStrategy) {
      case SamplingStrategy.UNCERTAINTY_SAMPLING:
        return this.calcUncertaintyScore(example);
      case SamplingStrategy.DIVERSITY_SAMPLING:
        return this.calcDiversityScore(example);
      case SamplingStrategy.EXPECTED_ERROR_REDUCTION:
        return this.calcExpectedErrorReduction(example);
      case SamplingStrategy.QUERY_BY_COMMITTEE:
        return this.calcCommitteeDisagreement(example);
      case SamplingStrategy.DENSITY_WEIGHTED:
        return this.calcDensityWeightedScore(example);
      case SamplingStrategy.HYBRID:
      default:
        return this.calcHybridScore(example);
    }
  }

  private calcUncertaintyScore(example: LearningExample): number {
    const uncertainty = 1.0 - example.confidence;
    const difficultyBonus = example.difficulty * 0.3;
    const noveltyBonus = this.calcNovelty(example) * 0.2;
    return uncertainty + difficultyBonus + noveltyBonus;
  }

  private calcDiversityScore(example: LearningExample): number {
    if (this.selectedExamples.length === 0) return 1.0;
    const minDist = this.selectedExamples.length;
    return 1.0 / (1.0 + minDist * 0.01);
  }

  private calcExpectedErrorReduction(example: LearningExample): number {
    const potentialReduction = example.difficulty * example.relevance;
    const coverageBonus = this.calcCoverageBonus(example);
    return potentialReduction * (1.0 + coverageBonus);
  }

  private calcCommitteeDisagreement(example: LearningExample): number {
    const votes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const bias = (i - 2) * 0.1;
      votes.push(Math.max(0, Math.min(1, example.confidence + bias + (Math.random() - 0.5) * 0.2)));
    }
    const mean = votes.reduce((a, b) => a + b, 0) / votes.length;
    const variance = votes.reduce((a, v) => a + (v - mean) ** 2, 0) / votes.length;
    return Math.sqrt(variance);
  }

  private calcDensityWeightedScore(example: LearningExample): number {
    const density = 0.3 + Math.random() * 0.7;
    const uncertainty = 1.0 - example.confidence;
    return density * 0.4 + uncertainty * 0.6;
  }

  private calcHybridScore(example: LearningExample): number {
    const uncertaintyScore = this.calcUncertaintyScore(example) * this.uncertaintyWeight;
    const diversityScore = this.calcDiversityScore(example) * this.diversityWeight;
    const densityScore = this.calcDensityWeightedScore(example) * this.densityWeight;
    const relevanceBonus = example.relevance * 0.1;
    const recencyPenalty = this.calcRecencyPenalty(example) * 0.1;
    return uncertaintyScore + diversityScore + densityScore + relevanceBonus - recencyPenalty;
  }

  private calcNovelty(example: LearningExample): number {
    const sig = this.generateSignature(example);
    const freq = this.exampleFrequency.get(sig) ?? 0;
    return 1.0 / (1.0 + freq);
  }

  private calcCoverageBonus(example: LearningExample): number {
    const typeDist: Record<string, number> = {};
    const normalized = Math.random(); // Simplified
    return Math.max(0, 1.0 - normalized) * 0.5;
  }

  private calcRecencyPenalty(example: LearningExample): number {
    const ageHours = (Date.now() - example.timestamp) / (1000 * 60 * 60);
    return Math.min(ageHours / 168.0, 1.0);
  }

  private generateSignature(example: LearningExample): string {
    return example.learningType + "_" + (example.input.length > 20 ? example.input.substring(0, 20) : example.input);
  }

  selectExamplesForLearning(pool: LearningExample[], maxPerBatch = 50): LearningExample[] {
    const scored = pool.map(e => ({ example: e, score: this.calculateImportance(e) }));
    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, Math.min(maxPerBatch, pool.length));

    for (const { example } of selected) {
      const sig = this.generateSignature(example);
      this.selectedExamples.push(sig);
      this.exampleFrequency.set(sig, (this.exampleFrequency.get(sig) ?? 0) + 1);
      this.totalSamplesSelected++;
    }

    if (this.selectedExamples.length > 1000) {
      this.selectedExamples = this.selectedExamples.slice(-500);
    }

    return selected.map(s => s.example);
  }

  updateWithBatch(batch: LearningExample[]): void {
    for (const example of batch) {
      this.learningEfficiency = this.calcLearningEfficiency();
    }
    this.adaptStrategy();
  }

  private calcLearningEfficiency(): number {
    if (this.totalSamplesSelected === 0) return 0;
    return this.averageUncertaintyReduction / this.totalSamplesSelected;
  }

  private adaptStrategy(): void {
    if (this.learningEfficiency < 0.001) {
      const strategies = [SamplingStrategy.HYBRID, SamplingStrategy.UNCERTAINTY_SAMPLING, SamplingStrategy.DIVERSITY_SAMPLING];
      const currentIdx = strategies.indexOf(this.currentStrategy);
      this.currentStrategy = strategies[(currentIdx + 1) % strategies.length];
    }
  }

  setStrategy(strategy: SamplingStrategy): void { this.currentStrategy = strategy; }
  getCurrentStrategy(): string { return this.currentStrategy; }
  getTotalSamplesSelected(): number { return this.totalSamplesSelected; }
  getLearningEfficiency(): number { return this.learningEfficiency; }
}
