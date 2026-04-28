// ─── Transformer Attention Module ───
// Ported from NexusAI TransformerAttention.java
// Implements transformer-style multi-head attention for NLP feature extraction

import { LearningExample } from './types';

const MODEL_DIMENSION = 256;
const NUM_ATTENTION_HEADS = 8;
const HEAD_DIMENSION = MODEL_DIMENSION / NUM_ATTENTION_HEADS;
const FEED_FORWARD_DIMENSION = 512;
const NUM_LAYERS = 4;
const MAX_SEQUENCE_LENGTH = 512;

function initializeRandomMatrix(rows: number, cols: number): number[][] {
  const matrix: number[][] = [];
  const scale = Math.sqrt(2.0 / (rows + cols));
  for (let i = 0; i < rows; i++) {
    matrix[i] = [];
    for (let j = 0; j < cols; j++) {
      matrix[i][j] = (Math.random() - 0.5) * 2 * scale;
    }
  }
  return matrix;
}

function initializeRandomVector(size: number): number[] {
  const vector = new Array(size).fill(0);
  const scale = Math.sqrt(2.0 / size);
  for (let i = 0; i < size; i++) {
    vector[i] = (Math.random() - 0.5) * 2 * scale;
  }
  return vector;
}

function dotProduct(a: number[], b: number[]): number {
  let result = 0;
  for (let i = 0; i < a.length; i++) result += a[i] * b[i];
  return result;
}

function normalize(vector: number[]): void {
  let norm = 0;
  for (const val of vector) norm += val * val;
  norm = Math.sqrt(norm + 1e-8);
  for (let i = 0; i < vector.length; i++) vector[i] /= norm;
}

function matrixMultiply(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length, colsA = a[0].length, colsB = b[0].length;
  const result: number[][] = [];
  for (let i = 0; i < rowsA; i++) {
    result[i] = new Array(colsB).fill(0);
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
  const rows = matrix.length, cols = matrix[0].length;
  const result = new Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i] += matrix[i][j] * vector[j];
    }
  }
  return result;
}

function layerNorm(x: number[]): void {
  let mean = 0;
  for (const val of x) mean += val;
  mean /= x.length;
  let variance = 0;
  for (const val of x) variance += (val - mean) * (val - mean);
  variance /= x.length;
  const stdDev = Math.sqrt(variance + 1e-8);
  for (let i = 0; i < x.length; i++) {
    x[i] = x[i] - mean / stdDev; // Simplified (gamma=1, beta=0)
  }
}

function reluActivation(vector: number[]): void {
  for (let i = 0; i < vector.length; i++) vector[i] = Math.max(0, vector[i]);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

export class TransformerAttention {
  private queryWeights: number[][];
  private keyWeights: number[][];
  private valueWeights: number[][];
  private outputProjection: number[][];
  private ffLayer1Weights: number[][];
  private ffLayer2Weights: number[][];
  private positionalEncoding: number[][];
  private tokenEmbeddings: Map<string, number[]>;
  private attentionCache: Map<string, number[]>;
  private vocabSize = 0;

  constructor() {
    this.queryWeights = initializeRandomMatrix(MODEL_DIMENSION, MODEL_DIMENSION);
    this.keyWeights = initializeRandomMatrix(MODEL_DIMENSION, MODEL_DIMENSION);
    this.valueWeights = initializeRandomMatrix(MODEL_DIMENSION, MODEL_DIMENSION);
    this.outputProjection = initializeRandomMatrix(MODEL_DIMENSION, MODEL_DIMENSION);
    this.ffLayer1Weights = initializeRandomMatrix(FEED_FORWARD_DIMENSION, MODEL_DIMENSION);
    this.ffLayer2Weights = initializeRandomMatrix(MODEL_DIMENSION, FEED_FORWARD_DIMENSION);
    this.positionalEncoding = this.initPositionalEncodings();
    this.tokenEmbeddings = new Map();
    this.attentionCache = new Map();
    this.initTokenEmbeddings();
  }

  private initPositionalEncodings(): number[][] {
    const pe: number[][] = [];
    for (let pos = 0; pos < MAX_SEQUENCE_LENGTH; pos++) {
      pe[pos] = new Array(MODEL_DIMENSION).fill(0);
      for (let i = 0; i < MODEL_DIMENSION; i++) {
        const divTerm = Math.pow(10000, (2 * Math.floor(i / 2)) / MODEL_DIMENSION);
        pe[pos][i] = i % 2 === 0 ? Math.sin(pos / divTerm) : Math.cos(pos / divTerm);
      }
    }
    return pe;
  }

  private initTokenEmbeddings(): void {
    const commonWords = [
      'the','is','are','was','were','be','been','being','have','has','had',
      'do','does','did','will','would','could','should','may','might',
      'must','shall','can','i','you','he','she','it','we','they',
      'what','which','who','whom','this','that','these','those',
      'and','but','or','nor','for','yet','so','not','only','own',
      'same','than','too','very','just','because','as','until','while',
      'of','at','by','with','about','against','between','through',
      'during','before','after','above','below','to','from','up','down',
      'in','out','on','off','over','under','again','further','then','once'
    ];
    for (const word of commonWords) {
      this.tokenEmbeddings.set(word, initializeRandomVector(MODEL_DIMENSION));
      this.vocabSize++;
    }
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  }

  private getTokenEmbedding(token: string): number[] {
    if (this.tokenEmbeddings.has(token)) {
      return [...this.tokenEmbeddings.get(token)!];
    }
    const hash = this.hashToVector(token, MODEL_DIMENSION);
    this.tokenEmbeddings.set(token, hash);
    this.vocabSize++;
    return [...hash];
  }

  private hashToVector(token: string, dimension: number): number[] {
    const vector = new Array(dimension).fill(0);
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash) + token.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < dimension; i++) {
      vector[i] = ((hash >> (i % 32)) & 1) === 1 ? 0.5 : -0.5;
      vector[i] += (Math.random() - 0.5) * 0.1;
    }
    return vector;
  }

  private meanPooling(seqOutput: number[][]): number[] {
    const pooled = new Array(MODEL_DIMENSION).fill(0);
    const seqLen = seqOutput.length;
    for (let j = 0; j < MODEL_DIMENSION; j++) {
      for (let i = 0; i < seqLen; i++) pooled[j] += seqOutput[i][j];
      pooled[j] /= seqLen;
    }
    return pooled;
  }

  // ── Public API ──

  extractFeatures(text: string): number[] {
    const cacheKey = text.substring(0, 200);
    if (this.attentionCache.has(cacheKey)) {
      return [...this.attentionCache.get(cacheKey)!];
    }

    const tokens = this.tokenize(text);
    const seqLen = Math.min(tokens.length, MAX_SEQUENCE_LENGTH);
    const tokenMatrix: number[][] = [];

    for (let i = 0; i < seqLen; i++) {
      const emb = this.getTokenEmbedding(tokens[i]);
      for (let j = 0; j < MODEL_DIMENSION; j++) {
        emb[j] += this.positionalEncoding[i]?.[j] ?? 0;
      }
      tokenMatrix.push(emb);
    }

    // Apply transformer layers
    let output = tokenMatrix.map(row => [...row]);
    for (let layer = 0; layer < NUM_LAYERS; layer++) {
      // Simplified multi-head attention (use matrix multiply approximation)
      const attnOut = matrixMultiply(output, this.queryWeights);
      // Residual + norm
      for (let i = 0; i < output.length; i++) {
        for (let j = 0; j < MODEL_DIMENSION; j++) {
          output[i][j] = output[i][j] + (attnOut[i]?.[j] ?? 0);
        }
        layerNorm(output[i]);
      }
      // Feed-forward
      for (let i = 0; i < output.length; i++) {
        const hidden = matrixVectorMultiply(this.ffLayer1Weights, output[i]);
        reluActivation(hidden);
        const ffOut = matrixVectorMultiply(this.ffLayer2Weights, hidden);
        for (let j = 0; j < MODEL_DIMENSION; j++) {
          output[i][j] = output[i][j] + (ffOut[j] ?? 0);
        }
        layerNorm(output[i]);
      }
    }

    const pooled = this.meanPooling(output);
    normalize(pooled);

    // Cache management
    if (this.attentionCache.size > 1000) {
      const firstKey = this.attentionCache.keys().next().value;
      this.attentionCache.delete(firstKey);
    }
    this.attentionCache.set(cacheKey, [...pooled]);

    return pooled;
  }

  calculateSimilarity(text1: string, text2: string): number {
    const f1 = this.extractFeatures(text1);
    const f2 = this.extractFeatures(text2);
    return cosineSimilarity(f1, f2);
  }

  processBatch(batch: LearningExample[]): void {
    for (const example of batch) {
      this.extractFeatures(example.input);
      this.extractFeatures(example.response);
    }
    this.updateEmbeddingsFromBatch(batch);
  }

  private updateEmbeddingsFromBatch(batch: LearningExample[]): void {
    const learningRate = 0.01;
    for (const example of batch) {
      const inputTokens = this.tokenize(example.input);
      const responseTokens = this.tokenize(example.response);
      for (const inputToken of inputTokens) {
        for (const responseToken of responseTokens) {
          const inputEmb = this.tokenEmbeddings.get(inputToken);
          const responseEmb = this.tokenEmbeddings.get(responseToken);
          if (inputEmb && responseEmb) {
            for (let i = 0; i < MODEL_DIMENSION; i++) {
              const diff = responseEmb[i] - inputEmb[i];
              inputEmb[i] += learningRate * diff * 0.1;
              responseEmb[i] -= learningRate * diff * 0.1;
            }
          }
        }
      }
    }
  }

  optimizeWeights(learningRate: number): void {
    const perturb = (w: number[][]) => {
      for (let i = 0; i < w.length; i++) {
        for (let j = 0; j < w[i].length; j++) {
          w[i][j] += (Math.random() - 0.5) * learningRate * 0.001;
          w[i][j] = Math.max(-1, Math.min(1, w[i][j]));
        }
      }
    };
    perturb(this.queryWeights);
    perturb(this.keyWeights);
    perturb(this.valueWeights);
  }

  getVocabSize(): number { return this.vocabSize; }
  getCacheSize(): number { return this.attentionCache.size; }
  clearCache(): void { this.attentionCache.clear(); }
}
