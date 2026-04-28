// ─── Neural Knowledge Graph ───
// Ported from NexusAI NeuralKnowledgeGraph.java
// Implements a neural knowledge graph with embeddings, relationships, and reasoning

import { KnowledgeNodeData, KnowledgeEdgeData, KnowledgeTriple } from './types';

interface KGNode {
  id: number;
  label: string;
  created: number;
  lastAccessed: number;
  accessCount: number;
}

interface KGEdge {
  source: number;
  target: number;
  predicate: string;
  confidence: number;
  timestamp: number;
}

interface NodeSimilarity {
  label: string;
  similarity: number;
}

const EMBEDDING_DIM = 128;

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i];
  }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB) + 1e-8);
}

function normalizeVec(v: number[]): void {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm + 1e-8);
  for (let i = 0; i < v.length; i++) v[i] /= norm;
}

export class NeuralKnowledgeGraph {
  private nodes: Map<string, KGNode> = new Map();
  private adjacencyList: Map<string, Set<KGEdge>> = new Map();
  private nodeEmbeddings: Map<string, number[]> = new Map();
  private nodeIdCounter = 0;
  private totalEdges = 0;
  private lastUpdateTime = 0;

  constructor() {}

  addKnowledge(subject: string, predicate: string, object: string, confidence: number): void {
    const subjectNode = this.getOrCreateNode(subject);
    const objectNode = this.getOrCreateNode(object);

    const edge: KGEdge = {
      source: subjectNode.id, target: objectNode.id,
      predicate, confidence, timestamp: Date.now()
    };

    this.addEdge(subject, edge);
    this.updateEmbeddings(subjectNode, objectNode, edge);
    this.totalEdges++;
    this.lastUpdateTime = Date.now();
  }

  addKnowledgeFromInteraction(input: string, output: string, entities: string[]): void {
    const relation = this.inferRelation(input, output);
    this.addKnowledge(this.sanitize(input), relation, this.sanitize(output), 0.9);

    if (entities) {
      for (const entity of entities) {
        this.addKnowledge(this.sanitize(entity), 'mentioned_in', this.sanitize(input), 0.7);
      }
    }
  }

  private inferRelation(input: string, output: string): string {
    const lower = input.toLowerCase();
    if (lower.includes(' is ') || lower.includes(' are ')) return 'is_a';
    if (lower.includes(' has ') || lower.includes(' have ')) return 'has_property';
    if (lower.includes(' can ')) return 'can_do';
    if (lower.includes('located') || lower.includes(' in ')) return 'located_in';
    if (lower.includes('created') || lower.includes(' made ')) return 'created_by';
    if (lower.includes('part of') || lower.includes(' belongs to')) return 'part_of';
    if (output.startsWith('because') || output.startsWith('due to')) return 'caused_by';
    if (output.startsWith('result') || output.includes(' leads to')) return 'results_in';
    return 'related_to';
  }

  private sanitize(entity: string): string {
    return entity.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_').substring(0, 50);
  }

  private getOrCreateNode(label: string): KGNode {
    const sanitized = this.sanitize(label);
    if (this.nodes.has(sanitized)) {
      const node = this.nodes.get(sanitized)!;
      node.accessCount++;
      node.lastAccessed = Date.now();
      return node;
    }
    const newNode: KGNode = {
      id: this.nodeIdCounter++, label: sanitized,
      created: Date.now(), lastAccessed: Date.now(), accessCount: 1
    };
    this.nodes.set(sanitized, newNode);
    this.adjacencyList.set(sanitized, new Set());
    this.nodeEmbeddings.set(sanitized, this.initEmbedding());
    return newNode;
  }

  private initEmbedding(): number[] {
    return Array.from({ length: EMBEDDING_DIM }, () => (Math.random() - 0.5) * 0.2);
  }

  private addEdge(sourceLabel: string, edge: KGEdge): void {
    if (!this.adjacencyList.has(sourceLabel)) {
      this.adjacencyList.set(sourceLabel, new Set());
    }
    this.adjacencyList.get(sourceLabel)!.add(edge);
  }

  private updateEmbeddings(subject: KGNode, obj: KGNode, edge: KGEdge): void {
    const sEmb = this.nodeEmbeddings.get(subject.label);
    const oEmb = this.nodeEmbeddings.get(obj.label);
    if (!sEmb || !oEmb) return;
    const lr = 0.1 * edge.confidence;
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      const diff = oEmb[i] - sEmb[i];
      sEmb[i] += lr * diff * 0.5;
      oEmb[i] -= lr * diff * 0.3;
    }
    normalizeVec(sEmb);
    normalizeVec(oEmb);
  }

  queryKnowledge(query: string, maxResults = 10): KnowledgeTriple[] {
    const results: KnowledgeTriple[] = [];
    const sanitized = this.sanitize(query);

    // Direct lookups
    if (this.adjacencyList.has(sanitized)) {
      for (const edge of this.adjacencyList.get(sanitized)!) {
        const targetNode = this.getNodeById(edge.target);
        if (targetNode) {
          results.push({ subject: sanitized, predicate: edge.predicate, object: targetNode.label, confidence: edge.confidence });
          if (results.length >= maxResults) return results;
        }
      }
    }

    // Semantic search
    if (this.nodeEmbeddings.has(sanitized)) {
      const queryEmb = this.nodeEmbeddings.get(sanitized)!;
      const similarities: NodeSimilarity[] = [];
      for (const [label, emb] of this.nodeEmbeddings.entries()) {
        if (label !== sanitized) {
          similarities.push({ label, similarity: cosineSim(queryEmb, emb) });
        }
      }
      similarities.sort((a, b) => b.similarity - a.similarity);
      for (const sim of similarities) {
        if (sim.similarity > 0.5) {
          results.push({ subject: sanitized, predicate: 'semantically_similar_to', object: sim.label, confidence: sim.similarity });
          if (results.length >= maxResults) break;
        }
      }
    }

    return results;
  }

  getImportantKnowledge(limit: number): { concept: string; content: string; confidence: number; importance: number }[] {
    const nodeList = Array.from(this.nodes.values());
    nodeList.sort((a, b) => this.calcImportance(b) - this.calcImportance(a));

    return nodeList.slice(0, limit).map(node => ({
      concept: node.label,
      content: this.getNodeContent(node),
      confidence: this.calcImportance(node),
      importance: node.accessCount / Math.max(1, (Date.now() - node.created) / 3600000),
    }));
  }

  private calcImportance(node: KGNode): number {
    const accessScore = Math.log(node.accessCount + 1) / 10.0;
    const recencyScore = 1.0 / (1.0 + (Date.now() - node.lastAccessed) / 86400000.0);
    const connectivityScore = (this.adjacencyList.get(node.label)?.size ?? 0) / 10.0;
    return accessScore * 0.4 + recencyScore * 0.3 + connectivityScore * 0.3;
  }

  private getNodeContent(node: KGNode): string {
    let content = `Concept: ${node.label}\n`;
    const edges = this.adjacencyList.get(node.label);
    if (edges) {
      content += 'Relationships:\n';
      for (const edge of edges) {
        const target = this.getNodeById(edge.target);
        if (target) content += `  - ${edge.predicate} -> ${target.label} (${(edge.confidence * 100).toFixed(0)}%)\n`;
      }
    }
    return content;
  }

  private getNodeById(id: number): KGNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.id === id) return node;
    }
    return undefined;
  }

  strengthenConnection(concept1: string, concept2: string, amount: number): void {
    const c1 = this.sanitize(concept1), c2 = this.sanitize(concept2);
    const edges = this.adjacencyList.get(c1);
    if (!edges) return;
    for (const edge of edges) {
      const target = this.getNodeById(edge.target);
      if (target && target.label === c2) {
        edge.confidence = Math.min(1.0, edge.confidence + amount);
        edge.timestamp = Date.now();
        break;
      }
    }
  }

  weakenConnection(concept1: string, concept2: string, amount: number): void {
    const c1 = this.sanitize(concept1), c2 = this.sanitize(concept2);
    const edges = this.adjacencyList.get(c1);
    if (!edges) return;
    for (const edge of edges) {
      const target = this.getNodeById(edge.target);
      if (target && target.label === c2) {
        edge.confidence = Math.max(0.0, edge.confidence - amount);
        break;
      }
    }
  }

  pruneWeakConnections(threshold: number): void {
    let pruned = 0;
    for (const edges of this.adjacencyList.values()) {
      const before = edges.size;
      edges.forEach(edge => { if (edge.confidence < threshold) edges.delete(edge); });
      pruned += before - edges.size;
    }
    this.totalEdges -= pruned;
  }

  findPath(start: string, end: string, maxLength: number): KnowledgeTriple[] {
    const path: KnowledgeTriple[] = [];
    const s = this.sanitize(start), e = this.sanitize(end);
    if (!this.nodes.has(s) || !this.nodes.has(e)) return path;

    const queue: { label: string; path: KnowledgeTriple[] }[] = [{ label: s, path: [] }];
    const visited = new Set<string>([s]);

    while (queue.length > 0 && path.length === 0) {
      const current = queue.shift()!;
      if (current.path.length >= maxLength) continue;

      const edges = this.adjacencyList.get(current.label);
      if (edges) {
        for (const edge of edges) {
          const target = this.getNodeById(edge.target);
          if (!target) continue;
          if (target.label === e) {
            path.push(...current.path, { subject: current.label, predicate: edge.predicate, object: target.label, confidence: edge.confidence });
            break;
          }
          if (!visited.has(target.label)) {
            visited.add(target.label);
            queue.push({
              label: target.label,
              path: [...current.path, { subject: current.label, predicate: edge.predicate, object: target.label, confidence: edge.confidence }]
            });
          }
        }
      }
    }
    return path;
  }

  getGraphData(): { nodes: { id: string; label: string; created: number; lastAccessed: number; accessCount: number; importance: number; category?: string }[]; edges: { source: string; target: string; predicate: string; confidence: number; timestamp: number }[] } {
    const nodeArray = Array.from(this.nodes.values()).map(node => ({
      id: node.label, label: node.label, created: node.created,
      lastAccessed: node.lastAccessed, accessCount: node.accessCount,
      importance: this.calcImportance(node)
    }));

    const edgeArray: { source: string; target: string; predicate: string; confidence: number; timestamp: number }[] = [];
    for (const [source, edges] of this.adjacencyList.entries()) {
      for (const edge of edges) {
        const target = this.getNodeById(edge.target);
        if (target) {
          edgeArray.push({ source, target: target.label, predicate: edge.predicate, confidence: edge.confidence, timestamp: edge.timestamp });
        }
      }
    }

    return { nodes: nodeArray, edges: edgeArray };
  }

  getTotalNodes(): number { return this.nodes.size; }
  getTotalEdges(): number { return this.totalEdges; }
  getLastUpdateTime(): number { return this.lastUpdateTime; }

  // ─── Persistence (save/load from SD card) ───

  exportData(): string {
    const nodes = Array.from(this.nodes.entries());
    const edges: { source: string; target: string; edge: KGEdge }[] = [];
    for (const [source, edgeSet] of this.adjacencyList.entries()) {
      for (const edge of edgeSet) {
        edges.push({ source, target: String(edge.target), edge });
      }
    }
    // Serialize embeddings (trimmed for storage size)
    const embeddings: Record<string, number[]> = {};
    for (const [k, v] of this.nodeEmbeddings.entries()) {
      embeddings[k] = v;
    }
    return JSON.stringify({ nodes, edges, embeddings, nodeIdCounter: this.nodeIdCounter, totalEdges: this.totalEdges, lastUpdateTime: this.lastUpdateTime });
  }

  importData(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!data || !data.nodes) return false;

      this.nodes.clear();
      this.adjacencyList.clear();
      this.nodeEmbeddings.clear();
      this.nodeIdCounter = data.nodeIdCounter || 0;
      this.totalEdges = data.totalEdges || 0;
      this.lastUpdateTime = data.lastUpdateTime || 0;

      for (const [label, node] of data.nodes as [string, KGNode][]) {
        this.nodes.set(label, node);
      }
      for (const { source, edge } of data.edges as { source: string; target: string; edge: KGEdge }[]) {
        if (!this.adjacencyList.has(source)) this.adjacencyList.set(source, new Set());
        this.adjacencyList.get(source)!.add(edge);
      }
      if (data.embeddings) {
        for (const [k, v] of Object.entries(data.embeddings)) {
          this.nodeEmbeddings.set(k, v as number[]);
        }
      }
      console.log(`[KnowledgeGraph] Loaded ${this.nodes.size} nodes, ${this.totalEdges} edges`);
      return true;
    } catch (e) {
      console.error('[KnowledgeGraph] Failed to import data:', e);
      return false;
    }
  }
}
