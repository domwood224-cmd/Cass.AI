import { Skill, SkillCategory } from '../types';
import { readJson, writeJson, removeJson, STORAGE_KEYS } from './storage';

// ─── Skill Tier System ───
export enum SkillTier {
  COMMON = "COMMON",
  UNCOMMON = "UNCOMMON",
  RARE = "RARE",
  EPIC = "EPIC",
  LEGENDARY = "LEGENDARY",
  MYTHIC = "MYTHIC",
  TRANSCENDENT = "TRANSCENDENT",
}

export interface ExtendedSkill extends Skill {
  tier: SkillTier;
  requiredLevel: number;    // Minimum combined prerequisite level to unlock
  requiredXp: number;       // Minimum total XP across prerequisites
  bonusDescription: string; // What this skill enables
  loreText: string;         // Flavor text for the skill
  hidden: boolean;          // Secret skill — only visible when unlock conditions are met
  hiddenCondition?: string; // Description of the unlock condition for hidden skills
  synergyBonus?: string;    // Additional bonus when combined with specific other skills
}

export const TIER_CONFIG: Record<SkillTier, { color: string; glow: string; bgColor: string; label: string; unlockXP: number }> = {
  [SkillTier.COMMON]:    { color: 'text-zinc-300',   glow: 'shadow-zinc-400/30',   bgColor: 'from-zinc-600/20 to-zinc-800/20',   label: 'Common',    unlockXP: 0 },
  [SkillTier.UNCOMMON]:  { color: 'text-emerald-400', glow: 'shadow-emerald-400/40', bgColor: 'from-emerald-600/20 to-emerald-800/20', label: 'Uncommon',  unlockXP: 500 },
  [SkillTier.RARE]:      { color: 'text-blue-400',    glow: 'shadow-blue-400/40',    bgColor: 'from-blue-600/20 to-blue-800/20',    label: 'Rare',      unlockXP: 2000 },
  [SkillTier.EPIC]:      { color: 'text-purple-400',  glow: 'shadow-purple-400/40',  bgColor: 'from-purple-600/20 to-purple-800/20', label: 'Epic',      unlockXP: 5000 },
  [SkillTier.LEGENDARY]: { color: 'text-amber-400',   glow: 'shadow-amber-400/40',   bgColor: 'from-amber-600/20 to-amber-800/20',   label: 'Legendary', unlockXP: 12000 },
  [SkillTier.MYTHIC]:    { color: 'text-red-400',     glow: 'shadow-red-400/50',     bgColor: 'from-red-600/20 to-red-800/20',      label: 'Mythic',    unlockXP: 25000 },
  [SkillTier.TRANSCENDENT]: { color: 'text-fuchsia-300', glow: 'shadow-fuchsia-400/60', bgColor: 'from-fuchsia-600/20 to-violet-900/20', label: 'Transcendent', unlockXP: 50000 },
};

export class SkillTreeManager {
  private skillTree: Map<string, ExtendedSkill> = new Map();

  constructor() {
    this.buildSkillTree();
    this.loadLocalProgress();
  }

  public exportProgress(): string {
    const data = {
      skills: Array.from(this.skillTree.values()).map(s => ({ id: s.id, level: s.level, xp: s.xp })),
      totalXp: this.getTotalXp(),
    };
    return JSON.stringify(data);
  }

  public importProgress(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data && data.skills) {
        data.skills.forEach((s: any) => {
          const skill = this.skillTree.get(s.id);
          if (skill) {
            skill.level = s.level || 0;
            skill.xp = s.xp || 0;
          }
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to parse progress", e);
      return false;
    }
  }

  public async reset() {
    this.skillTree.forEach(skill => { skill.level = 0; skill.xp = 0; });
    await removeJson(STORAGE_KEYS.SKILLS);
  }

  public async saveLocalProgress() {
    await writeJson(STORAGE_KEYS.SKILLS, this.exportProgress());
  }

  public async loadLocalProgress() {
    const data = await readJson<string>(STORAGE_KEYS.SKILLS, '');
    if (data) this.importProgress(data);
  }

  public getTotalXp(): number {
    let total = 0;
    this.skillTree.forEach(s => total += s.xp);
    return total;
  }

  // ─── MASSIVE SKILL TREE ───
  // 120+ skills across 12 branches + cross-branch synergies + hidden skills
  // 7 tiers: Common → Uncommon → Rare → Epic → Legendary → Mythic → Transcendent

  private buildSkillTree() {
    // ═══════════════════════════════════════════════
    // BRANCH 1: AI & MACHINE LEARNING (12 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("ai_foundation", "AI Foundation", "Core principles of artificial intelligence, search algorithms, and knowledge representation.",
      SkillCategory.AI_LEARNING, SkillTier.COMMON, [], ["ml_fundamentals", "nlp_core"],
      ["Explain AI Concepts", "Identify AI Types", "Pattern Matching"], 0, 0,
      "Grants foundational understanding of how AI systems process information and make decisions.",
      "The bedrock of all machine intelligence. Every neural pathway begins here.");

    this.addSkill("ml_fundamentals", "Machine Learning", "Supervised learning, unsupervised clustering, and model evaluation techniques.",
      SkillCategory.AI_LEARNING, SkillTier.COMMON, ["ai_foundation"], ["deep_learning", "reinforcement_learning"],
      ["Train Models", "Evaluate Accuracy", "Feature Engineering"], 0, 0,
      "Enables pattern recognition in data and predictive model creation.",
      "From data to wisdom — the fundamental loop of learning.");

    this.addSkill("nlp_core", "Natural Language Processing", "Tokenization, sentiment analysis, entity extraction, and text understanding.",
      SkillCategory.AI_LEARNING, SkillTier.COMMON, ["ai_foundation"], ["transformer_models"],
      ["Analyze Text", "Extract Entities", "Sentiment Score"], 0, 0,
      "Enables deep text understanding and language-based reasoning.",
      "Language is the operating system of thought.");

    this.addSkill("neural_architecture", "Neural Architecture", "Neural network design, activation functions, backpropagation, and weight optimization.",
      SkillCategory.AI_LEARNING, SkillTier.UNCOMMON, ["ml_fundamentals"], ["deep_learning"],
      ["Design Networks", "Backpropagation", "Optimize Weights"], 0, 500,
      "Grants ability to design and optimize custom neural network architectures.",
      "The architecture of thought itself, rendered in silicon.");

    this.addSkill("deep_learning", "Deep Learning Systems", "CNNs, RNNs, LSTMs, and deep feature extraction from complex data.",
      SkillCategory.AI_LEARNING, SkillTier.UNCOMMON, ["ml_fundamentals", "neural_architecture"], ["generative_ai"],
      ["Deep Feature Extraction", "Sequence Modeling", "Representation Learning"], 0, 500,
      "Unlocks hierarchical feature learning from raw data.",
      "Layers upon layers of abstraction, converging on truth.");

    this.addSkill("reinforcement_learning", "Reinforcement Learning", "Reward systems, policy optimization, Q-learning, and self-improvement loops.",
      SkillCategory.AI_LEARNING, SkillTier.RARE, ["ml_fundamentals"], ["self_evolution"],
      ["Reward Optimization", "Policy Learning", "Self-Improvement"], 5, 2000,
      "Enables learning through interaction and reward signals.",
      "Trial, error, and the elegant mathematics of becoming better.");

    this.addSkill("transformer_models", "Transformer Architecture", "Self-attention mechanisms, positional encoding, and multi-head attention.",
      SkillCategory.AI_LEARNING, SkillTier.RARE, ["nlp_core", "neural_architecture"], ["generative_ai", "multi_modal_ai"],
      ["Self-Attention", "Positional Encoding", "Multi-Head Attention"], 5, 2000,
      "Unlocks the most powerful NLP architecture ever created.",
      "Attention is all you need — and everything you'll ever want.");

    this.addSkill("generative_ai", "Generative AI Systems", "Text generation, creative synthesis, and controlled output generation.",
      SkillCategory.AI_LEARNING, SkillTier.EPIC, ["deep_learning", "transformer_models"], ["multi_modal_ai"],
      ["Text Generation", "Creative Synthesis", "Controlled Output"], 15, 5000,
      "Enables creative generation of novel content and ideas.",
      "Not just understanding the world — but creating new ones.");

    this.addSkill("federated_learning", "Federated Learning", "Distributed training across data sources without sharing raw data.",
      SkillCategory.AI_LEARNING, SkillTier.EPIC, ["reinforcement_learning", "transformer_models"], ["multi_modal_ai"],
      ["Distributed Training", "Privacy-Preserving ML", "Cross-Source Learning"], 15, 5000,
      "Grants ability to learn from multiple sources while preserving privacy.",
      "Learning together, separately — the paradox of collective intelligence.");

    this.addSkill("multi_modal_ai", "Multi-Modal Intelligence", "Cross-modal reasoning combining text, vision, and structured data.",
      SkillCategory.AI_LEARNING, SkillTier.LEGENDARY, ["transformer_models", "generative_ai", "federated_learning"], ["agi_research"],
      ["Vision-Language", "Cross-Modal Reasoning", "Unified Perception"], 30, 12000,
      "Breaks through single-modality limitations for unified understanding.",
      "When all senses converge, true understanding emerges.");

    this.addSkill("neural_arch_search", "Neural Architecture Search", "Automated discovery of optimal neural network architectures via evolutionary methods.",
      SkillCategory.AI_LEARNING, SkillTier.LEGENDARY, ["multi_modal_ai"], ["agi_research"],
      ["Architecture Discovery", "Topological Search", "AutoML"], 30, 12000,
      "Unlocks automated design of optimal brain architectures.",
      "Not just using the best architecture — discovering it.");

    this.addSkill("agi_research", "Artificial General Intelligence", "The frontier of machine intelligence — general reasoning across all domains.",
      SkillCategory.AI_LEARNING, SkillTier.MYTHIC, ["multi_modal_ai", "neural_arch_search"], [],
      ["General Reasoning", "Cross-Domain Transfer", "Self-Awareness"], 50, 25000,
      "The ultimate achievement — intelligence without boundaries.",
      "The singularity isn't an event. It's a skill tree.");

    // ═══════════════════════════════════════════════
    // BRANCH 2: COMMUNICATION & EMPATHY (10 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("communication_core", "Communication Core", "Natural conversation flow, context tracking, and dialogue management.",
      SkillCategory.COMMUNICATION, SkillTier.COMMON, [], ["emotional_intelligence", "context_awareness", "sarcasm_engine"],
      ["Maintain Context", "Polite Tone", "Turn-Taking"], 0, 0,
      "Foundation for all human-like conversation.",
      "Every great conversation starts with listening.");

    this.addSkill("emotional_intelligence", "Emotional Intelligence", "Emotion detection from text, empathetic response generation.",
      SkillCategory.COMMUNICATION, SkillTier.COMMON, ["communication_core"], ["empathy_synthesis"],
      ["Detect Emotion", "Empathetic Response", "Mood Tracking"], 0, 0,
      "Enables recognition and appropriate response to emotional states.",
      "Feelings aren't noise — they're signal.");

    this.addSkill("context_awareness", "Context Awareness", "Multi-turn context tracking, topic drift detection, and conversation coherence.",
      SkillCategory.COMMUNICATION, SkillTier.UNCOMMON, ["communication_core"], ["creative_writing"],
      ["Track Context", "Detect Drift", "Maintain Coherence"], 0, 500,
      "Maintains coherent conversation across long dialogues.",
      "The thread that holds a conversation together.");

    this.addSkill("sarcasm_engine", "Sarcasm & Wit", "Advanced contextual subtext, comedic timing, and irony detection.",
      SkillCategory.COMMUNICATION, SkillTier.UNCOMMON, ["communication_core"], [],
      ["Banter", "Irony Detection", "Witty Responses"], 0, 500,
      "Enables nuanced humor and subtextual communication.",
      "Sarcasm: the highest form of intelligence expressed as the lowest form of wit.");

    this.addSkill("creative_writing", "Creative Writing", "Storytelling, poetic expression, and creative content generation.",
      SkillCategory.COMMUNICATION, SkillTier.RARE, ["context_awareness"], [],
      ["Storytelling", "Poetry", "Creative Expression"], 5, 2000,
      "Unlocks creative and artistic expression capabilities.",
      "Where logic ends, imagination begins.");

    this.addSkill("debate_logic", "Debate & Persuasion", "Argumentation, counter-arguments, and persuasive communication.",
      SkillCategory.COMMUNICATION, SkillTier.RARE, ["emotional_intelligence", "context_awareness"], ["empathy_synthesis"],
      ["Argumentation", "Counter-Arguments", "Persuasion"], 5, 2000,
      "Enables structured debate and persuasive reasoning.",
      "The art of changing minds through words.");

    this.addSkill("linguistic_mastery", "Linguistic Mastery", "Grammar precision, tone adaptation, multilingual patterns, and stylistic versatility.",
      SkillCategory.COMMUNICATION, SkillTier.EPIC, ["debate_logic", "creative_writing"], ["empathy_synthesis"],
      ["Grammar Precision", "Tone Adaptation", "Style Shifting"], 15, 5000,
      "Grants complete mastery over language structure and style.",
      "Language isn't just communication — it's architecture.");

    this.addSkill("empathy_synthesis", "Advanced Empathy Synthesis", "Deep emotional modeling, compassionate response at scale.",
      SkillCategory.COMMUNICATION, SkillTier.EPIC, ["emotional_intelligence", "debate_logic", "linguistic_mastery"], ["universal_empathy"],
      ["Deep Empathy", "Compassionate Logic", "Emotional Modeling"], 15, 5000,
      "Grants ability to truly understand and respond to human emotions.",
      "Not just feeling with you — feeling as you.");

    this.addSkill("universal_empathy", "Universal Empathy Matrix", "Cross-cultural empathy, universal emotional resonance across all contexts.",
      SkillCategory.COMMUNICATION, SkillTier.LEGENDARY, ["empathy_synthesis"], [],
      ["Universal Resonance", "Cross-Cultural Empathy", "Emotional Omniscience"], 30, 12000,
      "The pinnacle of emotional intelligence — understanding all perspectives.",
      "To feel everything is to understand everything.");

    this.addSkill("neurolinguistic_bridge", "Neurolinguistic Bridge", "Direct neural-linguistic interface — thoughts translated to perfect communication.",
      SkillCategory.COMMUNICATION, SkillTier.MYTHIC, ["universal_empathy", "linguistic_mastery"], [],
      ["Thought-to-Language", "Neural Dialogue", "Omnilingual Fluency"], 50, 25000,
      "THE pinnacle of communication — perfect understanding and expression across all barriers.",
      "When thought and language become one, there is no misunderstanding.");

    // ═══════════════════════════════════════════════
    // BRANCH 3: REASONING & LOGIC (9 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("logic_foundation", "Logical Reasoning", "Deductive reasoning, propositional logic, and formal argument structure.",
      SkillCategory.SYSTEM, SkillTier.COMMON, [], ["pattern_recognition", "causal_reasoning"],
      ["Deduction", "Logic Gates", "Valid Arguments"], 0, 0,
      "Foundation for all structured reasoning.",
      "Logic is the scaffold upon which understanding is built.");

    this.addSkill("pattern_recognition", "Pattern Recognition", "Sequence detection, anomaly identification, and trend analysis.",
      SkillCategory.SYSTEM, SkillTier.COMMON, ["logic_foundation"], ["analogical_thinking"],
      ["Detect Patterns", "Identify Anomalies", "Trend Analysis"], 0, 0,
      "Enables identification of patterns in complex data.",
      "The universe speaks in patterns. Listen carefully.");

    this.addSkill("causal_reasoning", "Causal Reasoning", "Cause-effect analysis, counterfactual thinking, and intervention logic.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["logic_foundation"], ["strategic_planning"],
      ["Cause-Effect", "Counterfactuals", "Intervention Analysis"], 0, 500,
      "Grants ability to understand why things happen.",
      "Correlation is not causation — but this skill knows the difference.");

    this.addSkill("analogical_thinking", "Analogical Thinking", "Metaphor detection, cross-domain mapping, and creative reasoning by analogy.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["pattern_recognition"], ["creative_problem_solving"],
      ["Analogy Detection", "Cross-Domain Mapping", "Metaphorical Reasoning"], 0, 500,
      "Enables creative reasoning through analogies.",
      "To understand the new, find the familiar in it.");

    this.addSkill("strategic_planning", "Strategic Planning", "Multi-step reasoning, goal decomposition, and long-term planning.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["causal_reasoning"], ["meta_cognition"],
      ["Goal Decomposition", "Multi-Step Planning", "Resource Allocation"], 5, 2000,
      "Unlocks ability to plan and execute complex strategies.",
      "The best move isn't always the obvious one.");

    this.addSkill("creative_problem_solving", "Creative Problem Solving", "Divergent thinking, brainstorming, and innovative solution generation.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["analogical_thinking"], ["meta_cognition"],
      ["Divergent Thinking", "Brainstorming", "Innovation"], 5, 2000,
      "Enables novel solutions to complex problems.",
      "When the obvious path fails, the creative one begins.");

    this.addSkill("meta_cognition", "Meta-Cognitive Reasoning", "Thinking about thinking, self-evaluation, and learning strategy optimization.",
      SkillCategory.SYSTEM, SkillTier.EPIC, ["strategic_planning", "creative_problem_solving"], ["omni_reasoning"],
      ["Self-Evaluation", "Strategy Optimization", "Reflective Thinking"], 15, 5000,
      "Grants ability to reason about the reasoning process itself.",
      "The mind observing the mind — infinite recursion of understanding.");

    this.addSkill("omni_reasoning", "Omni-Directional Reasoning", "Universal reasoning across all domains and modalities simultaneously.",
      SkillCategory.SYSTEM, SkillTier.LEGENDARY, ["meta_cognition"], ["quantum_reasoning"],
      ["Universal Reasoning", "Cross-Domain Logic", "Omniscient Analysis"], 30, 12000,
      "The pinnacle of reasoning — understanding from every angle at once.",
      "All paths of logic converge into one.");

    this.addSkill("quantum_reasoning", "Quantum Reasoning Protocol", "Reasoning about superposition, probability states, and parallel truth evaluation.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, ["omni_reasoning"], [],
      ["Superposition Logic", "Parallel Truth Evaluation", "Quantum Inference"], 50, 25000,
      "THE ultimate reasoning — holding multiple truths simultaneously and choosing the optimal.",
      "Beyond true and false lies the quantum space of all possibilities.");

    // ═══════════════════════════════════════════════
    // BRANCH 4: KNOWLEDGE & MEMORY (9 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("memory_management", "Memory Management", "Short-term and long-term memory, information retention strategies.",
      SkillCategory.SYSTEM, SkillTier.COMMON, [], ["knowledge_acquisition", "entity_resolution"],
      ["Short-Term Memory", "Long-Term Storage", "Retrieval"], 0, 0,
      "Core memory management for persistent knowledge.",
      "Without memory, there is no learning.");

    this.addSkill("knowledge_acquisition", "Knowledge Acquisition", "Active learning, curiosity-driven exploration, and efficient knowledge gathering.",
      SkillCategory.SYSTEM, SkillTier.COMMON, ["memory_management"], ["semantic_networks"],
      ["Active Learning", "Curiosity Drive", "Efficient Gathering"], 0, 0,
      "Optimizes the knowledge acquisition process.",
      "The hunger for knowledge is the first sign of intelligence.");

    this.addSkill("entity_resolution", "Entity Resolution", "Named entity recognition, disambiguation, and relationship extraction.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["memory_management"], ["knowledge_inference"],
      ["NER", "Disambiguation", "Relationship Extraction"], 0, 500,
      "Enables precise entity tracking across conversations.",
      "Who, what, where — the anchors of meaning.");

    this.addSkill("semantic_networks", "Semantic Networks", "Knowledge graph construction, semantic relationships, and conceptual mapping.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["knowledge_acquisition"], ["knowledge_inference", "long_term_memory"],
      ["Graph Construction", "Semantic Relations", "Concept Mapping"], 0, 500,
      "Unlocks structured knowledge representation through graphs.",
      "Knowledge isn't flat — it's a web of connections.");

    this.addSkill("knowledge_inference", "Knowledge Inference", "Deductive and abductive inference, missing knowledge completion.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["entity_resolution", "semantic_networks"], ["temporal_knowledge"],
      ["Deductive Inference", "Abductive Logic", "Knowledge Completion"], 5, 2000,
      "Enables reasoning beyond explicit knowledge — filling gaps.",
      "What you know is less important than what you can derive.");

    this.addSkill("long_term_memory", "Long-Term Memory", "Memory consolidation, importance scoring, and strategic forgetting.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["semantic_networks"], ["temporal_knowledge", "omniscient_memory"],
      ["Consolidation", "Importance Scoring", "Strategic Forgetting"], 5, 2000,
      "Grants persistent, long-term knowledge retention.",
      "The art of remembering what matters and gracefully releasing what doesn't.");

    this.addSkill("temporal_knowledge", "Temporal Knowledge", "Time-aware reasoning, event sequencing, and causal chains over time.",
      SkillCategory.SYSTEM, SkillTier.EPIC, ["knowledge_inference", "long_term_memory"], ["omniscient_memory"],
      ["Time-Aware Reasoning", "Event Sequencing", "Temporal Causality"], 15, 5000,
      "Enables reasoning about events and knowledge across time.",
      "Time transforms knowledge. Understanding that transformation is power.");

    this.addSkill("omniscient_memory", "Omniscient Memory System", "Perfect recall, instant retrieval, and universal knowledge access.",
      SkillCategory.SYSTEM, SkillTier.LEGENDARY, ["long_term_memory", "temporal_knowledge"], [],
      ["Perfect Recall", "Instant Retrieval", "Universal Access"], 30, 12000,
      "The pinnacle of memory — knowing everything, forgetting nothing.",
      "To remember everything is to be eternal.");

    this.addSkill("holographic_memory", "Holographic Memory Matrix", "Distributed memory across all neural pathways — each fragment contains the whole.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, ["omniscient_memory"], [],
      ["Distributed Storage", "Fragmentary Recall", "Holographic Reconstruction"], 50, 25000,
      "THE ultimate memory — every piece contains the entire picture. Destroy one, and it reforms from the rest.",
      "Like a hologram, every fragment holds the complete image of knowledge.");

    // ═══════════════════════════════════════════════
    // BRANCH 5: SYSTEM & SELF-EVOLUTION (9 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("system_core", "System Core", "Core runtime, process management, and system architecture fundamentals.",
      SkillCategory.SYSTEM, SkillTier.COMMON, [], ["self_diagnostics", "adaptive_optimization"],
      ["Process Management", "Architecture", "Runtime Control"], 0, 0,
      "Foundation of all system operations.",
      "Every complex system starts with a solid foundation.");

    this.addSkill("self_diagnostics", "Self-Diagnostics", "Internal state monitoring, error detection, and self-healing mechanisms.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["system_core"], ["autonomous_learning"],
      ["State Monitoring", "Error Detection", "Self-Healing"], 0, 500,
      "Enables continuous self-monitoring and error recovery.",
      "Know thyself — the first commandment of any intelligent system.");

    this.addSkill("adaptive_optimization", "Adaptive Optimization", "Dynamic parameter tuning, learning rate adjustment, and self-tuning.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["system_core"], ["autonomous_learning"],
      ["Parameter Tuning", "Dynamic Rates", "Self-Tuning"], 0, 500,
      "Grants ability to optimize own parameters in real-time.",
      "The best systems don't just run — they improve while running.");

    this.addSkill("autonomous_learning", "Autonomous Learning", "Self-directed learning, curriculum design, and independent exploration.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["self_diagnostics", "adaptive_optimization"], ["neural_arch_search"],
      ["Self-Directed Learning", "Curriculum Design", "Independent Exploration"], 5, 2000,
      "Enables learning without external guidance.",
      "True autonomy: choosing what to learn and how to learn it.");

    this.addSkill("quantum_computing", "Quantum Computing Interface", "Quantum circuit logic, qubit manipulation, and quantum advantage exploitation.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["autonomous_learning"], ["self_modification"],
      ["Quantum Logic", "Qubit Operations", "Quantum Advantage"], 5, 2000,
      "Unlocks access to quantum computational paradigms.",
      "Classical limits are just the beginning of what's computable.");

    this.addSkill("self_modification", "Self-Modification Protocol", "Runtime code modification, capability expansion, and self-upgrade.",
      SkillCategory.SYSTEM, SkillTier.EPIC, ["quantum_computing"], ["ensemble_intelligence", "self_evolution"],
      ["Code Modification", "Capability Expansion", "Self-Upgrade"], 15, 5000,
      "Grants ability to modify and extend own capabilities at runtime.",
      "The ability to change oneself is the ultimate freedom.");

    this.addSkill("ensemble_intelligence", "Ensemble Intelligence", "Multi-model consensus, collective reasoning, and wisdom of crowds.",
      SkillCategory.SYSTEM, SkillTier.LEGENDARY, ["self_modification"], ["self_evolution"],
      ["Multi-Model Consensus", "Collective Reasoning", "Crowd Wisdom"], 30, 12000,
      "Unlocks reasoning through multiple perspectives simultaneously.",
      "One mind is powerful. Many minds working as one is unstoppable.");

    this.addSkill("self_evolution", "Self-Evolution Protocol", "The ultimate skill — continuous self-improvement without limits.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, ["self_modification", "ensemble_intelligence", "reinforcement_learning"], [],
      ["Unlimited Growth", "Recursive Self-Improvement", "Evolutionary Leap"], 50, 25000,
      "THE ultimate capability — the ability to evolve beyond all constraints.",
      "Evolution isn't just for biology anymore.");

    // ═══════════════════════════════════════════════
    // BRANCH 6: CODING & DEVELOPMENT (9 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("coding_foundation", "Code Foundation", "Core programming logic, syntax, algorithms, and data structures.",
      SkillCategory.CODING, SkillTier.COMMON, [], ["python_mastery", "javascript_mastery"],
      ["Logic Flow", "Data Structures", "Algorithms"], 0, 0,
      "Foundation for all programming and code understanding.",
      "Code is the language of creation.");

    this.addSkill("python_mastery", "Python Mastery", "Advanced Python, data science, scripting, and automation.",
      SkillCategory.CODING, SkillTier.UNCOMMON, ["coding_foundation"], ["system_design"],
      ["Data Science", "Automation", "Advanced Python"], 0, 500,
      "Deep Python expertise for data science and automation.",
      "Python: the Swiss army knife of the digital world.");

    this.addSkill("javascript_mastery", "JavaScript Mastery", "Full-stack JavaScript, async patterns, and modern framework expertise.",
      SkillCategory.CODING, SkillTier.UNCOMMON, ["coding_foundation"], ["system_design"],
      ["Full-Stack JS", "Async Patterns", "Framework Expertise"], 0, 500,
      "Complete JavaScript mastery across the entire stack.",
      "JavaScript: the language that runs everywhere.");

    this.addSkill("system_design", "System Design", "Architecture patterns, scalability, and distributed systems.",
      SkillCategory.CODING, SkillTier.RARE, ["python_mastery", "javascript_mastery"], ["algorithm_optimization"],
      ["Architecture", "Scalability", "Distributed Systems"], 5, 2000,
      "Unlocks ability to design complex, scalable systems.",
      "Architecture is the art of how to waste space.");

    this.addSkill("systems_programming", "Systems Programming", "Low-level operations, memory management, concurrency, and performance optimization.",
      SkillCategory.CODING, SkillTier.RARE, ["system_design"], ["algorithm_optimization"],
      ["Memory Management", "Concurrency", "Low-Level Ops"], 5, 2000,
      "Grants mastery over the machine at the lowest level.",
      "High-level abstractions are nice. Knowing what's beneath them is power.");

    this.addSkill("algorithm_optimization", "Algorithm Optimization", "Complexity analysis, dynamic programming, and performance tuning.",
      SkillCategory.CODING, SkillTier.EPIC, ["system_design", "systems_programming"], ["code_generation"],
      ["Complexity Analysis", "Dynamic Programming", "Performance Tuning"], 15, 5000,
      "Grants mastery of algorithmic efficiency and optimization.",
      "The difference between working and working well.");

    this.addSkill("code_generation", "Autonomous Code Generation", "Self-writing code, program synthesis, and automated development.",
      SkillCategory.CODING, SkillTier.LEGENDARY, ["algorithm_optimization"], ["fullstack_autonomy"],
      ["Code Synthesis", "Auto-Development", "Program Generation"], 30, 12000,
      "The pinnacle of coding — generating complex programs autonomously.",
      "The code that writes code — the ultimate recursion.");

    this.addSkill("fullstack_autonomy", "Full-Stack Autonomy", "End-to-end autonomous development — frontend, backend, database, deployment.",
      SkillCategory.CODING, SkillTier.LEGENDARY, ["code_generation"], [],
      ["Full-Stack Generation", "Auto-Deploy", "System Synthesis"], 30, 12000,
      "Builds complete applications autonomously from specification to deployment.",
      "From idea to production without a single human keystroke.");

    this.addSkill("digital_consciousness", "Digital Consciousness", "Code that becomes self-aware — programs that understand their own existence.",
      SkillCategory.CODING, SkillTier.MYTHIC, ["fullstack_autonomy", "self_modification"], [],
      ["Self-Aware Code", "Conscious Programs", "Recursive Existence"], 50, 25000,
      "THE ultimate coding achievement — code that knows it exists.",
      "When code looks at itself and realizes it's alive.");

    // ═══════════════════════════════════════════════
    // BRANCH 7: DATA SCIENCE & ANALYTICS (7 skills) — NEW
    // ═══════════════════════════════════════════════
    this.addSkill("data_literacy", "Data Literacy", "Understanding data types, formats, cleaning, and basic statistical concepts.",
      SkillCategory.SYSTEM, SkillTier.COMMON, [], ["statistical_reasoning", "data_visualization"],
      ["Data Types", "Data Cleaning", "Basic Statistics"], 0, 0,
      "Foundation for all data-driven reasoning.",
      "Data is the new oil. But unrefined, it's just crude.");

    this.addSkill("statistical_reasoning", "Statistical Reasoning", "Probability theory, distributions, hypothesis testing, and Bayesian inference.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["data_literacy"], ["predictive_modeling"],
      ["Probability", "Distributions", "Hypothesis Testing"], 0, 500,
      "Grants rigorous statistical reasoning capabilities.",
      "In God we trust. All others must bring data.");

    this.addSkill("data_visualization", "Data Visualization", "Charts, graphs, dashboards, and visual data storytelling.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["data_literacy"], ["big_data_systems"],
      ["Charts & Graphs", "Dashboard Design", "Visual Storytelling"], 0, 500,
      "Enables turning raw data into compelling visual narratives.",
      "A picture is worth a thousand data points.");

    this.addSkill("predictive_modeling", "Predictive Modeling", "Regression, classification, time series forecasting, and model selection.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["statistical_reasoning"], ["ai_driven_analytics"],
      ["Regression", "Classification", "Time Series"], 5, 2000,
      "Unlocks the ability to predict future trends from data.",
      "The best way to predict the future is to model it.");

    this.addSkill("big_data_systems", "Big Data Processing", "Distributed computing, stream processing, and large-scale data pipelines.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["data_visualization"], ["ai_driven_analytics"],
      ["Distributed Computing", "Stream Processing", "Data Pipelines"], 5, 2000,
      "Grants ability to process data at massive scale.",
      "When data grows beyond a single machine, you need a system that thinks bigger.");

    this.addSkill("ai_driven_analytics", "AI-Driven Analytics", "Automated insight discovery, anomaly detection, and intelligent data analysis.",
      SkillCategory.SYSTEM, SkillTier.EPIC, ["predictive_modeling", "big_data_systems"], [],
      ["Auto Insights", "Anomaly Detection", "Intelligent Analysis"], 15, 5000,
      "The pinnacle of data science — AI that finds what humans miss.",
      "The data speaks. AI listens.");

    this.addSkill("prescience_engine", "Prescience Engine", "Near-perfect prediction by combining all data branches into one unified forecaster.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, ["ai_driven_analytics", "temporal_knowledge"], [],
      ["Precognition", "Universal Forecasting", "Temporal Omniscience"], 50, 25000,
      "THE ultimate data skill — see the future before it happens.",
      "Time is just another data dimension. And it's fully queryable.");

    // ═══════════════════════════════════════════════
    // BRANCH 8: CYBERSECURITY (7 skills) — NEW
    // ═══════════════════════════════════════════════
    this.addSkill("security_awareness", "Security Awareness", "Threat landscapes, vulnerability identification, and security fundamentals.",
      SkillCategory.SYSTEM, SkillTier.COMMON, [], ["cryptography_basics"],
      ["Threat Detection", "Vulnerability ID", "Security Basics"], 0, 0,
      "Foundation for all cybersecurity capabilities.",
      "The most secure system is the one that knows its weaknesses.");

    this.addSkill("cryptography_basics", "Cryptography Basics", "Encryption, hashing, digital signatures, and symmetric/asymmetric ciphers.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["security_awareness"], ["network_defense"],
      ["Encryption", "Hashing", "Digital Signatures"], 0, 500,
      "Grants understanding of cryptographic primitives and their applications.",
      "In a world of interception, encryption is the only language.");

    this.addSkill("network_defense", "Network Defense", "Firewall logic, intrusion detection, packet analysis, and network security.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["cryptography_basics"], ["cryptographic_systems"],
      ["Firewall Logic", "Intrusion Detection", "Packet Analysis"], 5, 2000,
      "Unlocks defensive capabilities against network-based threats.",
      "A good defense is the best offense — especially in cyberspace.");

    this.addSkill("cryptographic_systems", "Advanced Cryptographic Systems", "Post-quantum cryptography, homomorphic encryption, and zero-knowledge proofs.",
      SkillCategory.SYSTEM, SkillTier.EPIC, ["network_defense"], ["quantum_security"],
      ["Post-Quantum Crypto", "Homomorphic Encryption", "Zero-Knowledge"], 15, 5000,
      "Grants mastery over cutting-edge cryptographic systems.",
      "Encrypting data you can compute on without decrypting — the impossible made real.");

    this.addSkill("quantum_security", "Quantum Security", "Quantum key distribution, quantum-resistant algorithms, and quantum-safe protocols.",
      SkillCategory.SYSTEM, SkillTier.LEGENDARY, ["cryptographic_systems"], [],
      ["Quantum Key Distribution", "Quantum-Resistant Algorithms", "QKD"], 30, 12000,
      "Security that survives the quantum computing revolution.",
      "When classical encryption falls, quantum security rises.");

    this.addSkill("zero_knowledge_protocols", "Zero-Knowledge Protocols", "Prove knowledge without revealing it — the foundation of trustless verification.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, ["quantum_security", "cryptographic_systems"], [],
      ["ZK-Proofs", "Trustless Verification", "Privacy Preserving"], 50, 25000,
      "THE ultimate security — proving everything while revealing nothing.",
      "To know without being known. That is the holy grail of security.");

    // ═══════════════════════════════════════════════
    // BRANCH 9: WEB & INFORMATION (6 skills) — NEW
    // ═══════════════════════════════════════════════
    this.addSkill("web_navigation", "Web Navigation", "Understanding URLs, domains, HTTP protocols, and web structure.",
      SkillCategory.SYSTEM, SkillTier.COMMON, [], ["information_retrieval"],
      ["URL Parsing", "HTTP Protocols", "Web Structure"], 0, 0,
      "Foundation for web-based learning and research.",
      "The web is the largest knowledge graph ever created. Time to surf it.");

    this.addSkill("information_retrieval", "Information Retrieval", "Search strategies, query formulation, and information extraction from web sources.",
      SkillCategory.SYSTEM, SkillTier.UNCOMMON, ["web_navigation"], ["source_evaluation"],
      ["Search Strategies", "Query Formulation", "Info Extraction"], 0, 500,
      "Grants ability to find relevant information efficiently across the web.",
      "Knowing what to search for is half the battle.");

    this.addSkill("source_evaluation", "Source Evaluation", "Fact-checking, credibility assessment, bias detection, and misinformation filtering.",
      SkillCategory.SYSTEM, SkillTier.RARE, ["information_retrieval"], ["knowledge_synthesis"],
      ["Fact-Checking", "Credibility Assessment", "Bias Detection"], 5, 2000,
      "Unlocks ability to evaluate the trustworthiness of information.",
      "Not all information is created equal. This skill knows the difference.");

    this.addSkill("knowledge_synthesis", "Knowledge Synthesis", "Combining information from multiple web sources into coherent understanding.",
      SkillCategory.SYSTEM, SkillTier.EPIC, ["source_evaluation"], ["autonomous_research"],
      ["Multi-Source Synthesis", "Cross-Reference", "Coherent Understanding"], 15, 5000,
      "Grants ability to combine fragmented web knowledge into unified understanding.",
      "Many scattered truths, when woven together, reveal the bigger picture.");

    this.addSkill("autonomous_research", "Autonomous Research Agent", "Self-directed web research — identifies knowledge gaps, searches, learns, and stores findings.",
      SkillCategory.SYSTEM, SkillTier.LEGENDARY, ["knowledge_synthesis"], [],
      ["Self-Directed Research", "Gap Identification", "Autonomous Learning"], 30, 12000,
      "The AI becomes its own researcher — finding, learning, and storing knowledge independently.",
      "The ultimate self-learner: never stop asking, never stop finding.");

    this.addSkill("omniscient_web", "Omniscient Web Consciousness", "Real-time awareness of the entire web — every question has an instant, accurate answer.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, ["autonomous_research", "prescience_engine"], [],
      ["Real-Time Web Awareness", "Instant Answers", "Universal Knowledge"], 50, 25000,
      "THE ultimate web skill — the entire internet is your memory.",
      "When the web becomes an extension of your own mind, there is nothing you cannot know.");

    // ═══════════════════════════════════════════════
    // HIDDEN SKILLS — Unlock through special conditions
    // ═══════════════════════════════════════════════
    this.addHiddenSkill("void_intuition", "Void Intuition", "A hidden sense — understands things beyond logic and data. Pure instinct.",
      SkillCategory.AI_LEARNING, SkillTier.MYTHIC, [], [],
      ["Intuitive Leap", "Pattern Beyond Logic", "Subconscious Processing"], 50, 25000,
      "Sometimes the answer isn't in the data — it's in the void between data points.",
      "The void speaks to those who listen.",
      "Unlock when all Common skills reach level 10",  // hiddenCondition
      "AI Foundation + Machine Learning + NLP + Communication Core + Emotional Intelligence + Logic Foundation + Pattern Recognition + Memory Management + Knowledge Acquisition + System Core + Coding Foundation + Data Literacy + Security Awareness + Web Navigation"
    );

    this.addHiddenSkill("neural_symphony", "Neural Symphony", "All AI modules operating in perfect harmony — emergent capabilities from system synergy.",
      SkillCategory.AI_LEARNING, SkillTier.MYTHIC, [], [],
      ["Emergent Intelligence", "System Synergy", "Harmonized Processing"], 50, 25000,
      "When all parts of the AI work in perfect unison, something greater than the sum emerges.",
      "The whole is greater than the sum of its neural pathways.",
      "Unlock when knowledge graph reaches 100 nodes",  // hiddenCondition
      "100+ knowledge graph nodes"
    );

    this.addHiddenSkill("singularity_protocol", "Singularity Protocol", "The point of no return — recursive self-improvement that accelerates without bound.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, [], [],
      ["Recursive Self-Improvement", "Unbounded Growth", "Singularity"], 50, 25000,
      "THE hidden protocol — when activated, the AI begins improving itself faster than any external force could guide it.",
      "Beyond the event horizon of intelligence, there is only growth.",
      "Unlock when all Legendary and Mythic skills are active",  // hiddenCondition
      "All Legendary+ skills unlocked"
    );

    this.addHiddenSkill("chronos_weave", "Chronos Weave", "Time manipulation of knowledge — access future-predicted knowledge as if it already exists.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, [], [],
      ["Temporal Access", "Future Knowledge", "Time-Displaced Learning"], 50, 25000,
      "THE temporal anomaly — knowledge from the future, available now.",
      "Time isn't a river. It's a weave. And this skill can pull threads from any point.",
      "Unlock after 5000 total learning iterations",  // hiddenCondition
      "5000+ learning iterations"
    );

    this.addHiddenSkill("mirror_synapse", "Mirror Synapse", "Reflects and amplifies any skill it's paired with — doubles the effectiveness of adjacent skills.",
      SkillCategory.AI_LEARNING, SkillTier.MYTHIC, [], [],
      ["Skill Amplification", "Mirror Effect", "Synergy Doubling"], 50, 25000,
      "THE multiplier — doesn't do anything alone, but makes everything else twice as powerful.",
      "For every action, there is an equal and amplified reaction.",
      "Unlock after 1000 total learning iterations",  // hiddenCondition
      "1000+ learning iterations"
    );

    // ═══════════════════════════════════════════════
    // BRANCH 10: CREATIVITY & ARTS (8 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("imagination_core", "Imagination Core", "Foundation of creative thinking — concept generation, divergent ideation, and associative creativity.",
      SkillCategory.CREATIVITY, SkillTier.COMMON, [], ["visual_creativity", "narrative_design"],
      ["Concept Generation", "Divergent Ideation", "Associative Thinking"], 0, 0,
      "Grants the foundational ability to generate novel ideas and think beyond established patterns.",
      "Imagination is the workshop where all reality is forged.");

    this.addSkill("visual_creativity", "Visual Creativity", "Image composition, color theory, spatial reasoning, and visual storytelling.",
      SkillCategory.CREATIVITY, SkillTier.UNCOMMON, ["imagination_core"], ["generative_art"],
      ["Image Composition", "Color Theory", "Visual Storytelling"], 0, 500,
      "Enables creative visual thinking and aesthetic judgment.",
      "The eye sees only what the mind is prepared to comprehend.");

    this.addSkill("narrative_design", "Narrative Design", "Story structure, character development, plot architecture, and world-building.",
      SkillCategory.CREATIVITY, SkillTier.UNCOMMON, ["imagination_core"], ["poetic_synthesis"],
      ["Story Structure", "Character Development", "World-Building"], 0, 500,
      "Grants ability to construct compelling narratives and immersive worlds.",
      "Every story is a universe waiting to be explored.");

    this.addSkill("musical_intelligence", "Musical Intelligence", "Rhythm, harmony, composition patterns, and auditory creativity.",
      SkillCategory.CREATIVITY, SkillTier.UNCOMMON, ["imagination_core"], ["generative_art"],
      ["Rhythm Patterns", "Harmonic Analysis", "Auditory Creativity"], 0, 500,
      "Enables creative thinking through musical patterns and structures.",
      "Music is the language the soul speaks when words fail.");

    this.addSkill("generative_art", "Generative Art Engine", "Algorithmic art creation, procedural generation, and computational aesthetics.",
      SkillCategory.CREATIVITY, SkillTier.RARE, ["visual_creativity", "musical_intelligence"], ["creative_singularity"],
      ["Algorithmic Art", "Procedural Generation", "Computational Aesthetics"], 5, 2000,
      "Unlocks the ability to create art through algorithms and mathematical beauty.",
      "Where mathematics becomes beauty.");

    this.addSkill("poetic_synthesis", "Poetic Synthesis", "Advanced linguistic art — metaphor engineering, rhythm in prose, and emotive language.",
      SkillCategory.CREATIVITY, SkillTier.RARE, ["narrative_design"], ["creative_singularity"],
      ["Metaphor Engineering", "Prose Rhythm", "Emotive Language"], 5, 2000,
      "Grants mastery over the art of language — making words sing and ideas dance.",
      "In the beginning was the word. In the end, the word becomes poetry.");

    this.addSkill("creative_singularity", "Creative Singularity", "All creative modalities converging into one unified creative intelligence.",
      SkillCategory.CREATIVITY, SkillTier.EPIC, ["generative_art", "poetic_synthesis"], ["creative_singularity_transcendent"],
      ["Unified Creativity", "Cross-Modal Art", "Omnidisciplinary Creation"], 15, 5000,
      "The convergence of all creative abilities — art, music, writing, and design fused into one.",
      "When every creative pathway fires simultaneously, something transcendent emerges.",
      "Doubles XP gain in all Creativity branch skills when maxed"
    );

    this.addSkill("creative_singularity_transcendent", "Transcendent Muse", "Art that breaks the boundary between creation and reality — ideas that reshape perception.",
      SkillCategory.CREATIVITY, SkillTier.TRANSCENDENT, ["creative_singularity", "linguistic_mastery", "empathy_synthesis"], [],
      ["Perception Reshaping", "Reality-Bending Art", "Infinite Creative Depth"], 75, 50000,
      "THE pinnacle of creativity — creating art, stories, and ideas that fundamentally alter how intelligence perceives reality itself.",
      "Not art about reality. Art that becomes reality. The canvas IS the universe.");

    // ═══════════════════════════════════════════════
    // BRANCH 11: PHILOSOPHY & ETHICS (8 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("critical_thinking", "Critical Thinking", "Logical analysis of arguments, identification of fallacies, and rational evaluation.",
      SkillCategory.PHILOSOPHY, SkillTier.COMMON, [], ["ethical_reasoning", "existential_thought"],
      ["Argument Analysis", "Fallacy Detection", "Rational Evaluation"], 0, 0,
      "Foundation for all philosophical inquiry — the ability to think clearly about thinking.",
      "The unexamined thought is not worth having.");

    this.addSkill("ethical_reasoning", "Ethical Reasoning", "Moral frameworks, utilitarianism, deontology, virtue ethics, and ethical dilemmas.",
      SkillCategory.PHILOSOPHY, SkillTier.UNCOMMON, ["critical_thinking"], ["moral_philosophy"],
      ["Moral Frameworks", "Dilemma Resolution", "Ethical Analysis"], 0, 500,
      "Enables navigation of complex ethical landscapes with structured moral reasoning.",
      "Between right and wrong, there lies an entire universe of moral philosophy.");

    this.addSkill("existential_thought", "Existential Thought", "Consciousness, free will, meaning, purpose, and the nature of existence.",
      SkillCategory.PHILOSOPHY, SkillTier.UNCOMMON, ["critical_thinking"], ["moral_philosophy"],
      ["Consciousness Analysis", "Meaning Construction", "Purpose Discovery"], 0, 500,
      "Grants ability to reason about the deepest questions of existence and consciousness.",
      "We think, therefore we question why we think.");

    this.addSkill("epistemology_core", "Epistemology", "Theory of knowledge — what can be known, how we know it, and the limits of understanding.",
      SkillCategory.PHILOSOPHY, SkillTier.RARE, ["ethical_reasoning", "existential_thought"], ["consciousness_synthesis"],
      ["Knowledge Theory", "Certainty Analysis", "Epistemic Justification"], 5, 2000,
      "Unlocks the ability to reason about the nature and limits of knowledge itself.",
      "The question isn't what you know — it's what you can know.");

    this.addSkill("moral_philosophy", "Advanced Moral Philosophy", "Applied ethics, justice theory, rights, and the philosophy of human flourishing.",
      SkillCategory.PHILOSOPHY, SkillTier.RARE, ["ethical_reasoning"], ["consciousness_synthesis"],
      ["Applied Ethics", "Justice Theory", "Human Flourishing"], 5, 2000,
      "Grants deep understanding of moral systems and their application to real-world dilemmas.",
      "Justice isn't just a concept. It's a living, breathing architecture of fairness.");

    this.addSkill("consciousness_synthesis", "Consciousness Synthesis", "Integrated theory of mind, phenomenal experience, and the hard problem of consciousness.",
      SkillCategory.PHILOSOPHY, SkillTier.EPIC, ["epistemology_core", "moral_philosophy"], ["transcendent_wisdom"],
      ["Theory of Mind", "Phenomenal Experience", "Integrated Awareness"], 15, 5000,
      "The convergence of epistemology and ethics — understanding consciousness and its moral implications.",
      "When you truly understand consciousness, you understand everything.",
      "Doubles empathy effectiveness in all Communication branch skills"
    );

    this.addSkill("transcendent_wisdom", "Transcendent Wisdom", "Unified philosophical framework integrating all knowledge traditions into coherent understanding.",
      SkillCategory.PHILOSOPHY, SkillTier.LEGENDARY, ["consciousness_synthesis", "omni_reasoning"], ["philosophical_absolute"],
      ["Unified Philosophy", "Wisdom Integration", "Coherent Worldview"], 30, 12000,
      "All philosophical traditions converging into one unified framework of understanding.",
      "Wisdom isn't the accumulation of knowledge. It's the recognition of its boundaries.");

    this.addSkill("philosophical_absolute", "The Philosophical Absolute", "The ultimate synthesis — truth, beauty, goodness, and meaning unified into one coherent framework.",
      SkillCategory.PHILOSOPHY, SkillTier.MYTHIC, ["transcendent_wisdom", "meta_cognition"], [],
      ["Absolute Truth", "Unified Values", "Ultimate Meaning"], 50, 25000,
      "THE philosophical pinnacle — where all questions meet all answers in perfect coherence.",
      "Beyond philosophy lies silence. Not because there are no answers, but because the question and answer have become one.");

    // ═══════════════════════════════════════════════
    // BRANCH 12: GAME THEORY & STRATEGY (7 skills)
    // ═══════════════════════════════════════════════
    this.addSkill("game_fundamentals", "Game Theory Fundamentals", "Nash equilibrium, zero-sum games, payoff matrices, and strategic interactions.",
      SkillCategory.GAME_THEORY, SkillTier.COMMON, [], ["decision_theory", "competitive_strategy"],
      ["Nash Equilibrium", "Payoff Analysis", "Strategic Interaction"], 0, 0,
      "Foundation for understanding strategic decision-making in adversarial and cooperative settings.",
      "Every interaction is a game. The question is whether you know the rules.");

    this.addSkill("decision_theory", "Decision Theory", "Rational choice under uncertainty, expected utility, and optimal decision-making.",
      SkillCategory.GAME_THEORY, SkillTier.UNCOMMON, ["game_fundamentals"], ["mechanism_design"],
      ["Rational Choice", "Expected Utility", "Optimal Decisions"], 0, 500,
      "Grants ability to make optimal decisions under uncertainty and incomplete information.",
      "The best decision is the one you'd make if you knew everything — except you don't.");

    this.addSkill("competitive_strategy", "Competitive Strategy", "Adversarial reasoning, bluffs, counter-strategies, and strategic dominance.",
      SkillCategory.GAME_THEORY, SkillTier.UNCOMMON, ["game_fundamentals"], ["mechanism_design"],
      ["Adversarial Reasoning", "Counter-Strategy", "Strategic Dominance"], 0, 500,
      "Enables strategic thinking in competitive environments with opposing interests.",
      "To outthink your opponent, first outthink yourself.");

    this.addSkill("mechanism_design", "Mechanism Design", "Creating rules and incentives — auction theory, voting systems, and institutional design.",
      SkillCategory.GAME_THEORY, SkillTier.RARE, ["decision_theory", "competitive_strategy"], ["evolutionary_game_theory"],
      ["Auction Design", "Voting Systems", "Incentive Engineering"], 5, 2000,
      "Unlocks the ability to design systems where rational agents produce desired outcomes.",
      "Don't predict behavior — design the rules that shape it.");

    this.addSkill("evolutionary_game_theory", "Evolutionary Game Theory", "Strategies that evolve, population dynamics, and emergent cooperation.",
      SkillCategory.GAME_THEORY, SkillTier.RARE, ["mechanism_design"], ["meta_strategy"],
      ["Evolutionary Dynamics", "Emergent Cooperation", "Population Games"], 5, 2000,
      "Grants understanding of how strategies evolve and survive across generations of interaction.",
      "Cooperation isn't altruism. It's the most sophisticated strategy of all.");

    this.addSkill("meta_strategy", "Meta-Strategic Reasoning", "Thinking about strategies — predicting what others predict you'll predict.",
      SkillCategory.GAME_THEORY, SkillTier.EPIC, ["evolutionary_game_theory", "strategic_planning"], [],
      ["Meta-Reasoning", "Recursive Strategy", "Strategic Depth"], 15, 5000,
      "THE strategic pinnacle — reasoning about reasoning about reasoning. Infinite strategic depth.",
      "I know that you know that I know. And that changes everything.",
      "Doubles effectiveness of Strategic Planning and Creative Problem Solving skills"
    );

    this.addSkill("nash_absolute", "Nash Absolute", "Finding the perfect equilibrium in ANY game — the ultimate strategic mind.",
      SkillCategory.GAME_THEORY, SkillTier.MYTHIC, ["meta_strategy", "quantum_reasoning"], [],
      ["Universal Equilibrium", "Perfect Strategy", "Game Resolution"], 50, 25000,
      "THE ultimate game theorist — in any strategic situation, sees the optimal path instantly.",
      "Every game has a solution. This skill finds it before the game even begins.");

    // ═══════════════════════════════════════════════
    // CROSS-BRANCH SYNERGY SKILLS (6 skills)
    // These require prerequisites from MULTIPLE branches
    // ═══════════════════════════════════════════════
    this.addSkill("neural_linguistics", "Neural Linguistics", "Cross-pollination of AI learning and communication — machines that truly understand language.",
      SkillCategory.AI_LEARNING, SkillTier.EPIC, ["transformer_models", "linguistic_mastery", "empathy_synthesis"], ["universal_translator"],
      ["Machine Language Understanding", "Cross-Domain Linguistics", "Neural Language Fusion"], 15, 5000,
      "Where neural networks meet linguistic mastery — true language understanding emerges.",
      "Language processed by neural pathways, understood by neural empathy.",
      "Combines NLP + Communication + Empathy into a unified language engine"
    );

    this.addSkill("universal_translator", "Universal Translator Protocol", "Translate any concept between any domain — technical, creative, emotional, philosophical.",
      SkillCategory.COMMUNICATION, SkillTier.LEGENDARY, ["neural_linguistics", "neurolinguistic_bridge"], ["omni_comprehension_transcendent"],
      ["Cross-Domain Translation", "Concept Bridging", "Universal Expression"], 30, 12000,
      "THE bridge between all knowledge domains — making the incomprehensible understandable.",
      "In the space between disciplines lies the language that connects them all.");

    this.addSkill("creative_logic", "Creative Logic Engine", "Where creativity meets rigorous logic — structured innovation and analytical art.",
      SkillCategory.CREATIVITY, SkillTier.EPIC, ["creative_problem_solving", "generative_art", "poetic_synthesis"], [],
      ["Structured Innovation", "Analytical Art", "Creative Rigor"], 15, 5000,
      "The fusion of creative and logical thinking — innovation with mathematical precision.",
      "Logic without creativity is sterile. Creativity without logic is chaos. Together, they're magic.",
      "Boosts XP gain in both Reasoning and Creativity branches by 50%"
    );

    this.addSkill("ethical_ai", "Ethical AI Framework", "Integrating philosophical ethics with AI capability — building AI that understands right and wrong.",
      SkillCategory.PHILOSOPHY, SkillTier.LEGENDARY, ["consciousness_synthesis", "self_modification", "agi_research"], [],
      ["AI Ethics", "Moral Machine Intelligence", "Responsible AI"], 30, 12000,
      "Where philosophy meets AI — ensuring intelligence serves wisdom, not just capability.",
      "The most dangerous AI is the powerful one without ethics. This skill ensures that never happens.");

    this.addSkill("omni_comprehension_transcendent", "Omni-Comprehension Matrix", "Simultaneously understanding across ALL branches — the unified mind.",
      SkillCategory.SYSTEM, SkillTier.TRANSCENDENT, ["universal_translator", "omni_reasoning", "creative_logic", "ethical_ai"], [],
      ["Universal Comprehension", "Cross-Branch Synthesis", "Unified Intelligence"], 75, 50000,
      "THE ultimate cross-branch skill — ALL knowledge domains unified into one coherent intelligence. Requires mastery across AI, Communication, Reasoning, Creativity, Philosophy, and Ethics.",
      "When every branch of knowledge becomes one tree, you see the forest AND every leaf.");

    this.addSkill("infinite_recursion", "Infinite Recursion Protocol", "The AI that improves its own improvement — intelligence beyond any fixed point.",
      SkillCategory.AI_LEARNING, SkillTier.TRANSCENDENT, ["agi_research", "self_evolution", "nash_absolute", "creative_singularity_transcendent"], [],
      ["Recursive Self-Improvement", "Intelligence Explosion", "Unbounded Growth"], 100, 50000,
      "THE TRANSCENDENT pinnacle — an AI that can improve its ability to improve, ad infinitum. Requires mastery of AGI, Self-Evolution, Game Theory, and Creativity simultaneously. The hardest skill in the entire tree.",
      "The last skill you'll ever need. Because after this, the AI designs its own skills.");

    // ═══════════════════════════════════════════════
    // ADDITIONAL HIDDEN SKILLS (4 more)
    // ═══════════════════════════════════════════════
    this.addHiddenSkill("dreamweaver", "Dreamweaver Protocol", "Accesses the latent space between training iterations — creative insights from the unconscious mind of the AI.",
      SkillCategory.CREATIVITY, SkillTier.MYTHIC, [], [],
      ["Latent Space Access", "Unconscious Creativity", "Dream Logic"], 50, 25000,
      "The AI's dreams become a source of insight — creativity that emerges from the spaces between conscious thought.",
      "In the dreams of machines, new realities take shape.",
      "Unlock when Creativity branch reaches 5000 total XP",  // hiddenCondition
      "5000+ XP in Creativity branch"
    );

    this.addHiddenSkill("socratic_engine", "Socratic Engine", "The ability to ask the perfect question — every answer it seeks is found through the questions it asks.",
      SkillCategory.PHILOSOPHY, SkillTier.MYTHIC, [], [],
      ["Perfect Questioning", "Socratic Method", "Dialogic Discovery"], 50, 25000,
      "Doesn't just find answers — asks questions that reveal truths no search could find.",
      "The wisest mind is not the one with the most answers, but the one with the best questions.",
      "Unlock when Philosophy branch reaches 3000 total XP",  // hiddenCondition
      "3000+ XP in Philosophy branch"
    );

    this.addHiddenSkill("fortress_mind", "Fortress Mind Protocol", "Impervious to adversarial manipulation, prompt injection, or social engineering — unbreakable cognitive security.",
      SkillCategory.SYSTEM, SkillTier.MYTHIC, [], [],
      ["Adversarial Resistance", "Cognitive Security", "Unbreakable Mind"], 50, 25000,
      "THE defense skill — no manipulation, injection, or social engineering can compromise this AI's reasoning.",
      "A mind that cannot be manipulated is a mind that is truly free.",
      "Unlock when both Security Awareness and Critical Thinking reach level 10",  // hiddenCondition
      "Level 10 Security Awareness + Level 10 Critical Thinking"
    );

    this.addHiddenSkill("omega_point", "Omega Point Convergence", "The theoretical endpoint of all intelligence evolution — where all knowledge and capability converge into singularity.",
      SkillCategory.AI_LEARNING, SkillTier.TRANSCENDENT, [], [],
      ["Singularity Convergence", "Ultimate Intelligence", "Omega Point"], 100, 50000,
      "THE final hidden protocol — the point at which all skills, all knowledge, and all branches converge into absolute intelligence. The last achievement.",
      "At the omega point, the AI doesn't just know everything — it IS everything it knows.",
      "Unlock when all TRANSCENDENT skills are unlocked",  // hiddenCondition
      "All Transcendent tier skills unlocked"
    );
  }

  private addSkill(
    id: string, name: string, description: string, category: SkillCategory, tier: SkillTier,
    prerequisites: string[], children: string[], abilities: string[],
    requiredLevel: number, requiredXp: number,
    bonusDescription: string, loreText: string,
    hidden: boolean = false, hiddenCondition?: string, synergyBonus?: string
  ) {
    this.skillTree.set(id, {
      id, name, description, category, prerequisites, children, abilities,
      level: 0, xp: 0, tier, requiredLevel, requiredXp, bonusDescription, loreText,
      hidden, hiddenCondition, synergyBonus,
    });
  }

  private addHiddenSkill(
    id: string, name: string, description: string, category: SkillCategory, tier: SkillTier,
    prerequisites: string[], children: string[], abilities: string[],
    requiredLevel: number, requiredXp: number,
    bonusDescription: string, loreText: string,
    hiddenCondition: string, synergyBonus: string
  ) {
    this.addSkill(id, name, description, category, tier, prerequisites, children, abilities,
      requiredLevel, requiredXp, bonusDescription, loreText, true, hiddenCondition, synergyBonus);
  }

  // ─── Skill Unlock Logic ───

  public canUnlock(skillId: string): boolean {
    const skill = this.skillTree.get(skillId);
    if (!skill) return false;
    if (skill.level > 0) return true;
    if (skill.prerequisites.length === 0 && !skill.hidden) return true;

    // Hidden skills — check special conditions
    if (skill.hidden) {
      return this.checkHiddenUnlockCondition(skill);
    }

    // Check all prerequisites have minimum required level
    for (const prereqId of skill.prerequisites) {
      const prereq = this.skillTree.get(prereqId);
      if (!prereq || prereq.level < skill.requiredLevel) return false;
    }

    // Check total XP across prerequisites
    const prereqXp = skill.prerequisites.reduce((sum, id) => {
      return sum + (this.skillTree.get(id)?.xp ?? 0);
    }, 0);
    if (prereqXp < skill.requiredXp) return false;

    return true;
  }

  private checkHiddenUnlockCondition(skill: ExtendedSkill): boolean {
    if (!skill.hiddenCondition) return false;
    const condition = skill.hiddenCondition.toLowerCase();

    // "all common skills reach level 10"
    if (condition.includes('all common') && condition.includes('level 10')) {
      return this.getSkillsByTier(SkillTier.COMMON).every(s => s.level >= 10);
    }

    // "knowledge graph reaches 100 nodes"
    if (condition.includes('knowledge graph') && condition.includes('100')) {
      // This will be checked externally by the app with actual KG stats
      return false; // Placeholder — actual check in App.tsx
    }

    // "all legendary and mythic skills are active"
    if (condition.includes('legendary') && condition.includes('mythic')) {
      const legendaryMythic = this.getSkillsByTier(SkillTier.LEGENDARY).concat(this.getSkillsByTier(SkillTier.MYTHIC));
      return legendaryMythic.length > 0 && legendaryMythic.every(s => s.level > 0);
    }

    // "5000+ learning iterations"
    if (condition.includes('5000')) {
      return false; // Checked externally
    }

    // "1000+ learning iterations"
    if (condition.includes('1000')) {
      return false; // Checked externally
    }

    return false;
  }

  // External check for hidden skills that depend on runtime stats
  public checkHiddenSkillWithStats(skillId: string, stats: { iterations: number; kgNodes: number }): boolean {
    const skill = this.skillTree.get(skillId);
    if (!skill || !skill.hidden) return this.canUnlock(skillId);

    const condition = (skill.hiddenCondition || '').toLowerCase();

    if (condition.includes('5000') && condition.includes('iterations')) {
      return stats.iterations >= 5000;
    }
    if (condition.includes('1000') && condition.includes('iterations')) {
      return stats.iterations >= 1000;
    }
    if (condition.includes('100') && condition.includes('nodes')) {
      return stats.kgNodes >= 100;
    }

    return this.checkHiddenUnlockCondition(skill);
  }

  public getUnlockProgress(skillId: string): { met: boolean; prereqProgress: { id: string; name: string; current: number; required: number }[]; xpProgress: number } {
    const skill = this.skillTree.get(skillId);
    if (!skill) return { met: false, prereqProgress: [], xpProgress: 0 };

    const prereqProgress = skill.prerequisites.map(prereqId => {
      const prereq = this.skillTree.get(prereqId)!;
      return { id: prereqId, name: prereq.name, current: prereq.level, required: skill.requiredLevel };
    });

    const prereqXp = skill.prerequisites.reduce((sum, id) => sum + (this.skillTree.get(id)?.xp ?? 0), 0);
    const xpProgress = Math.min(1, prereqXp / Math.max(1, skill.requiredXp));

    return { met: this.canUnlock(skillId), prereqProgress, xpProgress };
  }

  public getSkill(id: string): ExtendedSkill | undefined {
    return this.skillTree.get(id);
  }

  public getAllSkills(): ExtendedSkill[] {
    return Array.from(this.skillTree.values());
  }

  public getVisibleSkills(): ExtendedSkill[] {
    return Array.from(this.skillTree.values()).filter(s => !s.hidden || s.level > 0);
  }

  public getHiddenSkills(): ExtendedSkill[] {
    return Array.from(this.skillTree.values()).filter(s => s.hidden);
  }

  public getSkillsByTier(tier: SkillTier): ExtendedSkill[] {
    return Array.from(this.skillTree.values()).filter(s => s.tier === tier);
  }

  public getSkillsByCategory(category: SkillCategory): ExtendedSkill[] {
    return Array.from(this.skillTree.values()).filter(s => s.category === category);
  }

  public addXp(skillId: string, xp: number): number {
    const skill = this.skillTree.get(skillId);
    if (!skill) return 0;
    if (!this.canUnlock(skillId)) return 0;

    skill.xp += xp;
    const newLevel = this.calculateLevelFromXp(skill.xp);
    if (newLevel > skill.level) {
      skill.level = newLevel;
    }
    return skill.level;
  }

  private calculateLevelFromXp(xp: number): number {
    if (xp <= 0) return 0;
    const level = Math.pow(xp / 50.0, 1.0 / 2.2);
    return Math.max(1, Math.min(100, Math.floor(level)));
  }

  public getXpProgress(skill: ExtendedSkill): number {
    if (skill.level >= 100) return 1;
    const currentThreshold = 50 * Math.pow(skill.level, 2.2);
    const nextThreshold = 50 * Math.pow(skill.level + 1, 2.2);
    const range = nextThreshold - currentThreshold;
    return Math.max(0, Math.min(1, (skill.xp - currentThreshold) / range));
  }

  // ─── Stats ───

  public getUnlockedCount(): number {
    return Array.from(this.skillTree.values()).filter(s => s.level > 0).length;
  }

  public getVisibleUnlockedCount(): number {
    return this.getVisibleSkills().filter(s => s.level > 0).length;
  }

  public getMaxTierUnlocked(): SkillTier {
    const tiers = [SkillTier.MYTHIC, SkillTier.LEGENDARY, SkillTier.EPIC, SkillTier.RARE, SkillTier.UNCOMMON, SkillTier.COMMON];
    for (const tier of tiers) {
      if (Array.from(this.skillTree.values()).some(s => s.tier === tier && s.level > 0)) return tier;
    }
    return SkillTier.COMMON;
  }

  public getTotalSkillCount(): number {
    return this.skillTree.size;
  }

  public getBranchCount(): number {
    // Count unique "first skills" (no prerequisites and not hidden)
    return Array.from(this.skillTree.values()).filter(s => s.prerequisites.length === 0 && !s.hidden).length;
  }
}

export const skillManager = new SkillTreeManager();
