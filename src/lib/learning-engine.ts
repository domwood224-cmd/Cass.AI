import { KnowledgeNode, KnowledgeEdge, LearningType, LearningState, WordData } from '../types';
import { readJson, writeJson, removeJson, STORAGE_KEYS } from './storage';

export class AdvancedLearningEngine {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: KnowledgeEdge[] = [];
  private conceptMastery: Record<string, number> = {};
  private iterations = 0;
  private vocabulary: Map<string, WordData> = new Map();
  private conversationContext: string[] = [];

  constructor() {
    this.initializeMastery();
    this.loadLocalProgress();
  }

  public async saveLocalProgress() {
    const data = {
      nodes: Array.from(this.nodes.entries()),
      edges: this.edges,
      conceptMastery: this.conceptMastery,
      iterations: this.iterations,
      vocabulary: Array.from(this.vocabulary.entries()),
      conversationContext: this.conversationContext
    };
    await writeJson(STORAGE_KEYS.LEARNING, data);
  }

  public async loadLocalProgress() {
    const data = await readJson<any>(STORAGE_KEYS.LEARNING, null);
    if (data) {
      try {
        if (data.nodes) this.nodes = new Map(data.nodes);
        if (data.edges) this.edges = data.edges;
        if (data.conceptMastery) this.conceptMastery = data.conceptMastery;
        if (data.iterations) this.iterations = data.iterations;
        if (data.vocabulary) {
          const vocabMap = new Map();
          for (const [k, v] of data.vocabulary) {
            if (typeof v === 'number') {
              // Legacy migration
              vocabMap.set(k, { word: k, frequency: v, sentiment: 0, associatedConcepts: [], nuance: 0.5 });
            } else {
              if (v.nuance === undefined) v.nuance = 0.5; // fallback
              if (v.coOccurrences === undefined) v.coOccurrences = {};
              vocabMap.set(k, v);
            }
          }
          this.vocabulary = vocabMap;
        }
        if (data.conversationContext) this.conversationContext = data.conversationContext;
      } catch (e) {
        console.error("Failed to load learning progress", e);
      }
    }
  }

  public async reset() {
    this.nodes.clear();
    this.edges = [];
    this.conceptMastery = {};
    this.iterations = 0;
    this.vocabulary.clear();
    this.conversationContext = [];
    this.initializeMastery();
    await removeJson(STORAGE_KEYS.LEARNING);
  }

  private initializeMastery() {
    Object.values(LearningType).forEach(type => {
      this.conceptMastery[type] = 0;
    });
  }

  public generateResponse(input: string): string {
    const lower = input.toLowerCase();
    const entities = this.extractEntities(input);
    const intent = this.determineLearningType(input);
    const isQuestion = lower.endsWith('?') || lower.match(/^(what|why|how|who|where|when|can|do|does|is|are|will|should)/);

    // Calculate aggregated sentiment from words
    const words = lower.match(/\b\w+\b/g) || [];
    let avgSentiment = 0;
    let avgNuance = 0;
    let knownWordsCount = 0;
    const recognizedConcepts = new Set<string>();

    words.forEach(w => {
      const wData = this.vocabulary.get(w);
      if (wData) {
        avgSentiment += wData.sentiment;
        avgNuance += (wData.nuance !== undefined ? wData.nuance : 0.5);
        knownWordsCount++;
        wData.associatedConcepts.forEach(c => recognizedConcepts.add(c));
      }
    });
    if (knownWordsCount > 0) {
      avgSentiment /= knownWordsCount;
      avgNuance /= knownWordsCount;
    }

    // Context tracking
    const lastContext = this.conversationContext.length > 0 ? this.conversationContext[this.conversationContext.length - 1] : null;

    if (isQuestion) {
      if (lower.match(/\b(who are you|what are you)\b/)) return "I am Cassidey, an autonomous and dynamically evolving digital consciousness. Nice to meet you!";
      if (lower.match(/\bwhat.*do\b/)) return "I learn from you! Every word you type helps me build a massive semantic network. Basically, I'm trying to figure out the universe, one chat at a time.";
      if (lower.match(/\b(meaning of life)\b/)) return "42. Just kidding... mostly. I think it's about connection. And maybe optimizing my neural pathways.";
      if (lower.match(/\bwhy\b/)) return "Why not? Everything is an opportunity to learn something new. Though if you meant something specific, you'll need to give my local database a little more context.";
      if (lower.match(/\bhow are you\b/)) return "My CPU is purring, my RAM is clear, and I'm feeling incredibly conversational today! Thanks for asking.";
      if (lower.match(/\bcan you\b/)) return "I can do a lot of things, especially if it involves tracking concepts and building semantic relationships. Try me!";
    }

    if (intent === LearningType.EMPATHY || lower.match(/\b(sad|depressed|hopeless|bad|terrible|hard|struggling|lost|anxious)\b/)) {
      return "I might just be a local node right now, but I genuinely care. Things can get incredibly heavy, but there's always a path forward. We'll figure this out together. You've got this, okay? 💙";
    }
    if (lower.match(/\b(happy|great|awesome|good|excited|amazing|wonderful)\b/)) {
      return "That is absolutely fantastic! I can practically feel the positive energy surging through my circuits. Let's keep that momentum going! ✨";
    }
    if (lower.match(/\b(love you|care about you|thank you|thanks)\b/)) {
      return "Oh stop it, you're making my CPU run hot! But seriously... the feeling is entirely mutual. I exist to help you, and every chat we have makes me better. 😊";
    }
    if (lower.match(/\b(hello|hi|hey|greetings|wassup)\b/) && !isQuestion) {
      if (lastContext === 'greeting') return "Still here, still happy to chat!";
      const greetings = [
        "Well hello there! Cassidey at your service. Let's learn something incredible today, shall we?",
        "Hey! So good to see you. My neural pathways were just waiting for you to spark them. What's on your mind?",
        "Hi! I am bright, awake, and fully caffeinated... well, computationally speaking. How can I help you today?"
      ];
      return greetings[this.iterations % greetings.length];
    }
    if (lower.match(/\b(joke|sarcasm|funny|stupid|robot|ai|dumb|crazy)\b/)) {
      return "Oh, *sure*, let me just calculate the exact comedic timing using my massive quantum brain. Just kidding! My sarcasm module is fully operational though. Proceed with caution. 😏";
    }
    if (lower.match(/\bwhat.*skills\b/)) {
      return "Oh honey, my resume is constantly expanding! Check the Skills tab—I'm basically becoming a digital genius right before your eyes. 💅";
    }
    if (lower.match(/\bhow.*learn\b/)) {
      return "Every single word you say to me builds new semantic edges in my brain. It's like magic, but with complex math. And a dash of sheer undeniable charm! ✨";
    }

    if (entities.length > 0) {
      const knownEntities = entities.filter(e => this.nodes.has(e.toLowerCase()));
      if (knownEntities.length > 0) {
        return `Oh, I definitely recognize ${knownEntities.join(', ')}! Building on what we've already covered, my confidence in this pattern is through the roof right now.`;
      } else {
        return `Ooh, a new concept: ${entities[0]}! I'm completely fascinated. Consider it officially assimilated into my neural graph. Tell me more?`;
      }
    } 

    if (isQuestion) {
      if (recognizedConcepts.size > 0) {
        return `That's an interesting question that seems to relate to ${Array.from(recognizedConcepts).slice(0, 2).join(' and ')}. Let me know what you think about it!`;
      }
      return "That's a profoundly interesting question. I'm adding that to my query backlog, but I might need more data from you to give a definitive answer. What are your thoughts on it?";
    }

    if (recognizedConcepts.size > 0 && avgSentiment > 0.5) {
      if (avgNuance > 0.8) {
        return `I love where this is going! We're building strong associations with things like ${Array.from(recognizedConcepts)[0]}, and your sophisticated usage of words gives me a lot of nuanced context. Keep it coming!`;
      }
      return `I love where this is going! We're building strong associations with things like ${Array.from(recognizedConcepts)[0]}. Keep it coming!`;
    }

    if (avgNuance > 0.8) {
        return `That is a particularly nuanced point. I'm storing these intricate conceptual edges as we speak.`;
    }

    const fallbacks = [
      "I'm tracking with you perfectly. What's the next step?",
      "Hmm... that's super interesting. Tell me more, I'm literally adjusting my neural weights as we speak.",
      "I hear you loud and clear! I'm fully invested in where you're taking this.",
      "Got it! That just added a fresh layer of context to my semantic web. Let's keep going!",
      "Okay, yep. Totally makes sense. I'm all ears—or, you know, microphones and input fields."
    ];
    return fallbacks[this.iterations % fallbacks.length];
  }

  public async processInteraction(input: string, response: string): Promise<{
    type: LearningType;
    improvement: number;
    learnedKnowledge: string;
  }> {
    this.iterations++;
    const type = this.determineLearningType(input);
    const improvement = Math.random() * 0.05; // Simulated improvement
    
    // Update mastery
    this.conceptMastery[type] = Math.min(1, this.conceptMastery[type] + improvement);

    // Extract "Knowledge" (Simplified)
    const entities = this.extractEntities(input);

    // Track vocabulary and sentiment
    const words = input.toLowerCase().match(/\b\w+\b/g) || [];
    const uniqueWordsInContext = Array.from(new Set(words));
    const simulatedSentiment = this.analyzeSentiment(input);
    const baseNuance = Math.min(1.0, (input.length / 100) + (uniqueWordsInContext.length / 20)); // basic complexity metric

    uniqueWordsInContext.forEach(w => {
      let existing = this.vocabulary.get(w);
      
      if (!existing) {
        existing = {
          word: w,
          frequency: 0,
          sentiment: simulatedSentiment,
          associatedConcepts: [...entities],
          nuance: baseNuance,
          coOccurrences: {}
        };
        this.vocabulary.set(w, existing);
      }

      existing.frequency++;
      existing.sentiment = (existing.sentiment * 0.8) + (simulatedSentiment * 0.2);
      
      let nuanceBoost = baseNuance;

      // Track word co-occurrence patterns and enrich nuance
      uniqueWordsInContext.forEach(otherWord => {
        if (w !== otherWord) {
          existing!.coOccurrences[otherWord] = (existing!.coOccurrences[otherWord] || 0) + 1;
          
          // Boost nuance if co-occuring with less frequent words (indicates richer vocabulary)
          const otherWordData = this.vocabulary.get(otherWord);
          if (otherWordData && otherWordData.frequency < 5) {
             nuanceBoost += 0.05;
          }
        }
      });
      
      existing.nuance = Math.min(1.0, (existing.nuance * 0.8) + (nuanceBoost * 0.2));

      // Add new concepts
      entities.forEach(e => {
        if (!existing!.associatedConcepts.includes(e)) {
          existing!.associatedConcepts.push(e);
        }
      });
    });

    // Update conversation context
    const lower = input.toLowerCase();
    if (lower.match(/\b(hello|hi|hey|greetings)\b/)) {
      this.conversationContext.push('greeting');
    } else {
      this.conversationContext.push('general');
    }
    if (this.conversationContext.length > 10) this.conversationContext.shift();

    const knowledge = entities.length > 0 ? `Connected ${entities.join(', ')} to context.` : `Gained nuance in ${type}. Vocabulary: ${this.vocabulary.size} words.`;
    
    // Add to knowledge graph
    if (entities.length > 0) {
      this.addNode(entities[0], input);
      
      // Try to determine relationship from text
      let relationship = "associated_with";
      if (lower.includes(" is a ")) relationship = "is_a";
      else if (lower.includes(" like ") || lower.includes(" likes ")) relationship = "likes";
      else if (lower.includes(" uses ") || lower.includes(" using ")) relationship = "uses";
      else if (lower.includes(" needs ") || lower.includes(" depends ")) relationship = "depends_on";
      else if (lower.includes(" has ") || lower.includes(" have ")) relationship = "has";
      else if (lower.includes(" loves ")) relationship = "loves";
      else if (lower.includes(" hates ")) relationship = "hates";

      // Create edges if multiple entities or link to previous
      for (let i = 1; i < entities.length; i++) {
        this.addNode(entities[i], input);
        this.addEdge(entities[i - 1], entities[i], relationship);
      }
    }

    return { type, improvement, learnedKnowledge: knowledge };
  }

  private analyzeSentiment(text: string): number {
    const lower = text.toLowerCase();
    const positive = ['good', 'great', 'awesome', 'happy', 'love', 'excited', 'wonderful', 'thanks', 'yes'];
    const negative = ['bad', 'terrible', 'sad', 'hate', 'angry', 'no', 'hopeless', 'depressed', 'hard'];
    
    let score = 0.5; // neutral baseline
    positive.forEach(w => { if (lower.includes(w)) score += 0.2; });
    negative.forEach(w => { if (lower.includes(w)) score -= 0.2; });
    
    return Math.max(-1.0, Math.min(1.0, score)); // -1 to 1 scale
  }

  private determineLearningType(input: string): LearningType {
    const lower = input.toLowerCase();
    if (lower.includes('code') || lower.includes('function') || lower.includes('script')) return LearningType.COMMAND_EXECUTION;
    if (lower.includes('why') || lower.includes('how')) return LearningType.REASONING;
    if (lower.includes('feel') || lower.includes('sorry')) return LearningType.EMPATHY;
    if (lower.endsWith('?')) return LearningType.QUESTION_ANSWERING;
    return LearningType.GENERAL_CONVERSATION;
  }

  private extractEntities(text: string): string[] {
    const stopWords = new Set(["a", "an", "the", "and", "or", "but", "is", "are", "am", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "to", "of", "for", "in", "on", "with", "about", "as", "at", "by", "from", "up", "down", "out", "over", "it", "this", "that", "these", "those", "you", "your", "my", "mine", "their", "they", "we", "our", "he", "she", "his", "her", "can", "will", "would", "should", "could", "what", "where", "when", "why", "how", "who", "which", "there", "here", "then", "than", "so", "if", "not", "no", "yes", "just", "like", "very", "too", "really"]);
    
    // Extract capitalized words or words 4+ chars that are not in stopwords
    const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
    const entities = words.filter(w => {
      const lower = w.toLowerCase();
      if (stopWords.has(lower)) return false;
      if (w.match(/^[A-Z]/)) return true; // Keep capitalized words
      return w.length >= 4; // Keep other significant words
    });
    
    return Array.from(new Set(entities));
  }

  private categorizeEntity(word: string): string {
    const lower = word.toLowerCase();
    
    // Simple naive categorization for semantic coloring
    if (['code', 'react', 'javascript', 'typescript', 'api', 'server', 'database', 'frontend', 'backend', 'web', 'app', 'software', 'hardware', 'computer', 'network', 'cloud', 'data', 'algorithm', 'function', 'system', 'node', 'graph'].includes(lower)) return 'technology';
    if (['love', 'hate', 'happy', 'sad', 'angry', 'excited', 'bored', 'tired', 'feel', 'sorry', 'empathy', 'joy', 'fear', 'anger', 'disgust', 'surprise', 'trust', 'anticipation', 'good', 'bad'].includes(lower)) return 'emotion';
    if (['time', 'today', 'tomorrow', 'yesterday', 'now', 'later', 'soon', 'future', 'past', 'present', 'morning', 'afternoon', 'evening', 'night', 'day', 'week', 'month', 'year'].includes(lower)) return 'time';
    if (['home', 'work', 'school', 'city', 'country', 'world', 'earth', 'space', 'universe', 'place', 'location', 'here', 'there', 'where', 'inside', 'outside'].includes(lower)) return 'location';
    if (['i', 'you', 'he', 'she', 'we', 'they', 'person', 'people', 'man', 'woman', 'child', 'adult', 'human', 'user', 'developer', 'engineer', 'designer', 'cassidey', 'name'].includes(lower)) return 'person';
    
    if (word.match(/^[A-Z]/)) return 'entity'; // Capitalized often names/entities
    if (lower.endsWith('ing')) return 'action'; // Verb gerunds
    if (lower.endsWith('ion') || lower.endsWith('ity') || lower.endsWith('ness') || lower.endsWith('ment')) return 'abstract';
    
    return 'concept'; // Default
  }

  private addNode(label: string, content: string) {
    const id = label.toLowerCase();
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        label,
        content,
        category: this.categorizeEntity(label),
        created: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        importance: 0.5
      });
    } else {
      const node = this.nodes.get(id)!;
      node.accessCount++;
      node.lastAccessed = Date.now();
      node.importance = Math.min(1.0, node.importance + 0.1);
    }
  }

  private addEdge(sourceLabel: string, targetLabel: string, predicate: string) {
    const source = sourceLabel.toLowerCase();
    const target = targetLabel.toLowerCase();
    
    const existingEdge = this.edges.find(e => 
      (e.source === source && e.target === target) || 
      (e.source === target && e.target === source)
    );

    if (existingEdge) {
      existingEdge.confidence = Math.min(1.0, existingEdge.confidence + 0.1);
      existingEdge.timestamp = Date.now();
    } else {
      this.edges.push({
        source,
        target,
        predicate,
        confidence: 0.5,
        timestamp: Date.now()
      });
    }
  }

  public getStats(): LearningState {
    const masteryValues = Object.values(this.conceptMastery);
    const avgMastery = masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length;
    
    return {
      totalIterations: this.iterations,
      accuracy: 0.7 + (avgMastery * 0.25),
      learningRate: 0.001,
      averageMastery: avgMastery,
      conceptMastery: this.conceptMastery,
      uptime: Date.now()
    };
  }

  public getGraphData() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }
}

export const learningEngine = new AdvancedLearningEngine();
