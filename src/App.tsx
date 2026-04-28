import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Cpu,
  ChevronRight,
  ChevronDown,
  Info,
  Orbit,
  Anchor,
  Lock,
  Unlock,
  Shield,
  Activity,
  Database,
  Network,
  Layers,
  GitBranch,
  Crown,
  Flame,
  Star
} from 'lucide-react';
import { skillManager, ExtendedSkill, SkillTier, TIER_CONFIG } from './lib/skill-tree';
import { aiEngine } from './lib/ai';
import { WebLearner } from './lib/ai/web-learner';
import { Globe, Search } from 'lucide-react';
import { cn } from './lib/utils';
import { Skill, SkillCategory, AIEngineState, LearningType } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { readJson, writeJson, purgeAll, migrateFromLocalStorage, STORAGE_KEYS } from './lib/storage';

// Lazy-load the heavy 3D graph component
const KnowledgeGraphVisualizer = lazy(() => import('./components/KnowledgeGraphVisualizer').then(m => ({ default: m.KnowledgeGraphVisualizer })));

function GraphLoadingFallback() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300">
      <Orbit className="w-12 h-12 mb-4 opacity-30 text-indigo-300 animate-[spin_8s_linear_infinite]" />
      <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-zinc-300">Initializing Neural Lattice...</span>
    </div>
  );
}

// ─── Map LearningType to SkillCategory for XP rewards ───
function learningTypeToSkillCategories(type: LearningType): SkillCategory[] {
  switch (type) {
    case LearningType.GREETING:
    case LearningType.EMPATHY:
    case LearningType.GENERAL_CONVERSATION:
      return [SkillCategory.COMMUNICATION, SkillCategory.PHILOSOPHY];
    case LearningType.QUESTION_ANSWERING:
    case LearningType.REASONING:
      return [SkillCategory.SYSTEM, SkillCategory.AI_LEARNING, SkillCategory.PHILOSOPHY];
    case LearningType.COMMAND_EXECUTION:
    case LearningType.CREATIVITY:
      return [SkillCategory.CODING, SkillCategory.AI_LEARNING, SkillCategory.CREATIVITY];
    case LearningType.MEMORY_MANAGEMENT:
      return [SkillCategory.SYSTEM, SkillCategory.GAME_THEORY];
    default:
      return [SkillCategory.COMMUNICATION, SkillCategory.CREATIVITY];
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'skills' | 'brain' | 'graph' | 'settings'>('chat');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiStats, setAiStats] = useState<AIEngineState | null>(null);
  const [skills, setSkills] = useState<ExtendedSkill[]>(skillManager.getAllSkills());
  const [ready, setReady] = useState(false);
  const [lastLearningInfo, setLastLearningInfo] = useState<string>('');
  const [webStatus, setWebStatus] = useState<string>(''); // Web search status
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [insets, setInsets] = useState({ statusBar: 0, navBar: 0 });

  useEffect(() => {
    if ((window as any).__CASSIDEY_NATIVE__) {
      const n = (window as any).__CASSIDEY_NATIVE__;
      setInsets({ statusBar: n.statusBarHeight || 0, navBar: n.navigationBarHeight || 0 });
      return;
    }
    const handler = () => {
      const n = (window as any).__CASSIDEY_NATIVE__;
      if (n) setInsets({ statusBar: n.statusBarHeight || 0, navBar: n.navigationBarHeight || 0 });
    };
    window.addEventListener('nativeInsetsReady', handler);
    return () => window.removeEventListener('nativeInsetsReady', handler);
  }, []);

  useEffect(() => {
    (async () => {
      await migrateFromLocalStorage();
      const savedMsgs = await readJson<{ role: string; content: string }[]>(STORAGE_KEYS.MESSAGES, []);
      if (savedMsgs.length > 0) setMessages(savedMsgs);
      await skillManager.loadLocalProgress();
      await aiEngine.loadLocalProgress();
      setSkills(skillManager.getAllSkills());
      setAiStats(aiEngine.getStats());
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (messages.length > 0 || ready) {
      writeJson(STORAGE_KEYS.MESSAGES, messages).catch(console.error);
    }
  }, [messages, ready]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Refresh stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAiStats(aiEngine.getStats());
      setSkills(skillManager.getAllSkills());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInputValue('');
    setIsTyping(true);
    setWebStatus('');

    const recentContext = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

    // ═══════════════════════════════════════════════════════════════
    // THE AI ENGINE IS THE BRAIN. Gemini is ONLY a training helper.
    // ═══════════════════════════════════════════════════════════════

    let aiResponse: string;
    let webSearchPerformed = false;

    // Step 1: Check if we need to search the web (knowledge gap detection)
    try {
      const webContext = await aiEngine.processWithWebLearning(userMsg, recentContext);

      // If we have prior web knowledge, enhance the response
      if (webContext.priorKnowledge) {
        setWebStatus('Recalled prior knowledge');
      }

      // If web search is needed, search and learn
      if (webContext.shouldSearch && webContext.searchResult) {
        webSearchPerformed = true;
        setWebStatus(`Searched web: learned ${webContext.searchResult.learnedFacts.length} facts`);
      }
    } catch (e) {
      // Web learning is optional — don't break the flow
      console.log('Web learning check skipped:', e);
    }

    // Step 2: AI ENGINE generates the response (PRIMARY BRAIN)
    aiResponse = aiEngine.generateResponse(userMsg);

    // Step 3: If web search found new info, enhance the response
    if (webSearchPerformed) {
      const webLearner = aiEngine.getWebLearner();
      const enhanced = webLearner.enhanceResponse(aiResponse, userMsg);
      if (enhanced !== aiResponse) {
        aiResponse = enhanced;
      }
    }

    // Step 4: Process through the AI engine learning pipeline (THE CORE)
    const result = await aiEngine.processAndLearn(userMsg, aiResponse, recentContext);

    // Step 5: Skill tree rewards based on AI engine output
    const categories = learningTypeToSkillCategories(result.type);
    const relevantSkills = skills.filter(s => {
      const isUnlocked = skillManager.canUnlock(s.id);
      const categoryMatch = categories.includes(s.category);
      return isUnlocked && (categoryMatch || Math.random() > 0.7);
    });

    // Bonus XP for web learning
    const webBonus = webSearchPerformed ? 200 : 0;

    for (const skill of relevantSkills) {
      skillManager.addXp(skill.id, result.skillXpReward + webBonus);
    }

    await skillManager.saveLocalProgress();
    await aiEngine.saveLocalProgress();
    setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    setAiStats(aiEngine.getStats());
    setSkills(skillManager.getAllSkills());
    setLastLearningInfo(result.learnedKnowledge);
    setIsTyping(false);
  };

  const handlePurge = async () => {
    await aiEngine.reset();
    await skillManager.reset();
    await purgeAll();
    setAiStats(aiEngine.getStats());
    setSkills(skillManager.getAllSkills());
    setMessages([]);
  };

  return (
    <ErrorBoundary>
    <div className="flex flex-col bg-[var(--color-system-bg)] overflow-hidden font-sans relative" style={{ height: window.innerHeight + 'px' }}>
      <div className="nerve-line"></div>
      
      <div className="absolute top-4 left-4 z-50 text-[var(--color-glitch-red)] text-[8px] font-mono tracking-widest font-bold opacity-80 pointer-events-none hidden md:block">
        {aiStats ? `ITER:${aiStats.totalLearningIterations}` : 'VOLTAGE_PEAK'}
      </div>
      <div className="absolute top-4 right-4 z-50 text-[var(--color-glitch-red)] text-[8px] font-mono tracking-widest font-bold opacity-80 pointer-events-none hidden md:block">
        {aiStats ? `KG:${aiStats.knowledgeGraphNodes}N/${aiStats.knowledgeGraphEdges}E` : 'NEURAL_OVERRIDE'}
      </div>

      <div className="absolute inset-0 z-0 pointer-events-none opacity-60 mix-blend-screen">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-zinc-800/40 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-white/20 rounded-full blur-[100px]"></div>
      </div>
      
      <header className="h-12 flex items-center justify-between px-4 bg-transparent z-30 shrink-0" style={{ paddingTop: insets.statusBar + 'px' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10">
            <Cpu className="text-emerald-200/80 w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-light tracking-[0.15em] text-zinc-100 flex items-baseline gap-1.5">
            CASSIDEY
            <span className="text-zinc-400 font-light text-[8px] tracking-[0.3em]">V4.0</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl px-2.5 py-1 rounded-full border border-white/10">
           <div className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
           <span className="text-[8px] font-medium text-zinc-300 uppercase tracking-widest">AI Active</span>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-transparent flex flex-col" style={{ paddingBottom: '56px' }}>
        <div className={cn("w-full overflow-y-auto no-scrollbar scroll-smooth flex-1", activeTab === 'graph' ? "h-full": "")}>
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="max-w-4xl mx-auto w-full min-h-full flex flex-col px-3 py-2 md:p-6">
                <div className="hidden md:block absolute top-6 left-6 z-10 pointer-events-none">
                  <h2 className="text-2xl font-light text-zinc-100 tracking-[0.2em] uppercase drop-shadow-md">Interface</h2>
                  <p className="text-zinc-300 text-[11px] uppercase tracking-[0.1em] font-light mt-1 drop-shadow-md">AI Engine Direct Input</p>
                </div>
                <div className="flex-1 space-y-4 pb-6 pt-2 md:pt-16">
                  {messages.length === 0 && (
                    <div className="min-h-[40vh] md:min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 px-4 opacity-50 relative z-10">
                      <div className="space-y-2">
                        <h2 className="text-xl md:text-3xl font-display text-[var(--color-electric-cyan)] tracking-[0.3em] font-medium uppercase drop-shadow-md">NEURAL ENGINE ACTIVE</h2>
                        <p className="text-[var(--color-electric-cyan)] text-[9px] tracking-[0.2em] font-mono mx-auto leading-relaxed uppercase opacity-70">
                          AI Engine + Web Learning + Knowledge Graph + Transformer Attention
                        </p>
                        {aiStats && (
                          <p className="text-zinc-400 text-[10px] font-mono mt-2">
                            {aiStats.knowledgeGraphNodes} knowledge nodes | {aiStats.transformerVocabSize} vocab entries | Strategy: {aiStats.activeLearningStrategy}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => {
                    const isMemoryWeighted = m.content.toLowerCase().includes('hobbies');
                    const hasGlitch = m.content.toLowerCase().includes('subjective experience');
                    return (
                      <div key={i} className={cn("flex flex-col relative z-10 py-1", m.role === 'user' ? "items-end" : "items-start", hasGlitch && "active-glitch glitch-container")}>
                        {m.role === 'user' ? (
                          <div className={cn("text-right text-[var(--color-brushed-gold)] !text-trail font-mono text-[13px] md:text-sm tracking-tight leading-relaxed max-w-[85%] px-3 py-1.5 rounded-2xl bg-white/[0.03]", isMemoryWeighted && "memory-weighted")}>
                            {m.content}
                          </div>
                        ) : (
                          <div className="flex flex-col max-w-[90%] md:max-w-[85%]">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <div className="h-3 w-0.5 bg-[var(--color-violet)] shadow-[0_0_6px_var(--color-violet)]"></div>
                              <span className="font-display font-bold text-[var(--color-violet)] text-[8px] uppercase tracking-[0.15em]">AI RESPONSE</span>
                            </div>
                            <div className="text-[13px] md:text-sm text-[var(--color-electric-cyan)] font-sans font-light tracking-wide leading-relaxed relative flex items-start">
                              <span className="mr-2 mt-0.5 opacity-40">›</span>
                              <span className="break-words">{m.content}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isTyping && (
                    <div className="flex flex-col items-start gap-2 relative z-10">
                      <div className="flex flex-col items-start gap-1 relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-4 w-1 bg-[var(--color-violet)] opacity-50 animate-pulse"></div>
                          <span className="font-display font-medium text-[var(--color-violet)] text-[10px] uppercase tracking-[0.2em] opacity-50 animate-pulse">PROCESSING THROUGH AI ENGINE...</span>
                        </div>
                        {webStatus && (
                          <div className="flex items-center gap-1.5 ml-6">
                            <Globe className="w-3 h-3 text-cyan-400/60 animate-pulse" />
                            <span className="text-[8px] font-mono text-cyan-400/60 uppercase tracking-widest animate-pulse">{webStatus}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </motion.div>
            )}

            {/* ═══════════ SKILLS TAB ═══════════ */}
            {activeTab === 'skills' && (
              <motion.div key="skills" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }} className="w-full p-4 md:p-8 max-w-6xl mx-auto pt-20">
                <header className="mb-8 text-center relative z-10">
                  <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-b from-zinc-800 to-black items-center justify-center mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_rgba(255,255,255,0.1)] border border-white/10">
                    <GitBranch className="text-emerald-200/80 w-7 h-7" />
                  </div>
                  <h2 className="text-3xl font-light text-zinc-100 tracking-[0.2em] uppercase mb-3">Neural Skill Tree</h2>
                  <p className="text-zinc-300 text-[11px] tracking-[0.1em] max-w-lg mx-auto uppercase leading-relaxed font-light mb-4">
                    AI-driven capabilities. Each interaction feeds through the neural engine, unlocking new skills and tiers.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                    <div className="inline-flex items-center gap-3 bg-white/10 border border-white/10 rounded-full px-4 py-2">
                      <span className="text-[9px] font-medium text-zinc-300 uppercase tracking-[0.2em]">Unlocked</span>
                      <span className="text-sm font-mono text-emerald-200">{skillManager.getVisibleUnlockedCount()}/{skillManager.getVisibleSkills().length}</span>
                    </div>
                    <div className="inline-flex items-center gap-3 bg-white/10 border border-white/10 rounded-full px-4 py-2">
                      <Globe className="w-3 h-3 text-cyan-400" />
                      <span className="text-[9px] font-medium text-zinc-300 uppercase tracking-[0.2em]">Total Skills</span>
                      <span className="text-sm font-mono text-cyan-400">{skillManager.getTotalSkillCount()}</span>
                    </div>
                    <div className="inline-flex items-center gap-3 bg-white/10 border border-white/10 rounded-full px-4 py-2">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span className="text-[9px] font-medium text-zinc-300 uppercase tracking-[0.2em]">Max Tier</span>
                      <span className="text-sm font-mono text-amber-400">{TIER_CONFIG[skillManager.getMaxTierUnlocked()]?.label}</span>
                    </div>
                    <div className="inline-flex items-center gap-3 bg-white/10 border border-white/10 rounded-full px-4 py-2">
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span className="text-[9px] font-medium text-zinc-300 uppercase tracking-[0.2em]">Total XP</span>
                      <span className="text-sm font-mono text-purple-400">{skillManager.getTotalXp().toLocaleString()}</span>
                    </div>
                  </div>
                </header>

                {/* Tier sections */}
                {Object.values(SkillTier).map(tier => {
                  const tierSkills = skillManager.getVisibleSkills().filter(s => s.tier === tier);
                  if (tierSkills.length === 0) return null;
                  const config = TIER_CONFIG[tier];
                  return (
                    <div key={tier} className="mb-10 relative z-10">
                      <div className="flex items-center gap-3 mb-5 px-1">
                        <div className={cn("w-2 h-2 rounded-full", tier === SkillTier.COMMON ? 'bg-zinc-400' : tier === SkillTier.UNCOMMON ? 'bg-emerald-400' : tier === SkillTier.RARE ? 'bg-blue-400' : tier === SkillTier.EPIC ? 'bg-purple-400' : tier === SkillTier.LEGENDARY ? 'bg-amber-400' : tier === SkillTier.TRANSCENDENT ? 'bg-fuchsia-400' : 'bg-red-400')}></div>
                        <h3 className={cn("text-[12px] font-medium uppercase tracking-[0.25em]", config.color)}>{config.label}</h3>
                        <div className="flex-1 h-px bg-white/10"></div>
                        <span className="text-[9px] font-mono text-zinc-500">{tierSkills.filter(s => s.level > 0).length}/{tierSkills.length}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tierSkills.map(skill => (
                          <ExtendedSkillCard key={skill.id} skill={skill} progress={skillManager.getXpProgress(skill)} canUnlock={skillManager.canUnlock(skill.id)} unlockInfo={skillManager.getUnlockProgress(skill.id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* ═══════════ BRAIN TAB ═══════════ */}
            {activeTab === 'brain' && (
              <motion.div key="brain" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }} className="w-full p-4 md:p-8 max-w-4xl mx-auto pt-20">
                <header className="mb-10 text-center relative z-10">
                  <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-b from-zinc-800 to-black items-center justify-center mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_rgba(255,255,255,0.1)] border border-white/10">
                    <Brain className="text-emerald-200/80 w-7 h-7" />
                  </div>
                  <h2 className="text-3xl font-light text-zinc-100 tracking-[0.2em] uppercase mb-3">AI Engine Metrics</h2>
                  <p className="text-zinc-300 text-[11px] tracking-[0.1em] max-w-md mx-auto uppercase leading-relaxed font-light">
                    Real-time neural engine telemetry — your AI script in action.
                  </p>
                </header>

                {aiStats && (
                  <div className="space-y-6 relative z-10">
                    {/* Top-level stats grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <BrainStatBox label="Iterations" value={aiStats.totalLearningIterations} icon={<Activity className="w-3.5 h-3.5 text-zinc-300" />} accent="text-zinc-100" />
                      <BrainStatBox label="Accuracy" value={(aiStats.currentAccuracy * 100).toFixed(1) + '%'} icon={<Target className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-200" />
                      <BrainStatBox label="Learning Rate" value={aiStats.currentLearningRate.toFixed(6)} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-200" />
                      <BrainStatBox label="Avg Mastery" value={(aiStats.averageMastery * 100).toFixed(1) + '%'} icon={<TrendingUp className="w-3.5 h-3.5 text-blue-400" />} accent="text-blue-200" />
                    </div>

                    {/* Knowledge Graph Stats */}
                    <div className="bg-zinc-900/60 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-white/20 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                      <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300 mb-6 flex items-center gap-3">
                        <Network className="w-4 h-4 text-purple-300/60" />
                        Neural Knowledge Graph
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MiniStat label="Nodes" value={aiStats.knowledgeGraphNodes} icon={<Database className="w-3 h-3" />} />
                        <MiniStat label="Edges" value={aiStats.knowledgeGraphEdges} icon={<GitBranch className="w-3 h-3" />} />
                        <MiniStat label="Transfer Rate" value={(aiStats.transferSuccessRate * 100).toFixed(1) + '%'} icon={<Sparkles className="w-3 h-3" />} />
                        <MiniStat label="Transfer Benefit" value={aiStats.averageTransferBenefit.toFixed(4)} icon={<TrendingUp className="w-3 h-3" />} />
                      </div>
                    </div>

                    {/* Transformer Stats */}
                    <div className="bg-zinc-900/60 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-white/20 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                      <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300 mb-6 flex items-center gap-3">
                        <Layers className="w-4 h-4 text-cyan-300/60" />
                        Transformer Attention Module
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MiniStat label="Vocabulary" value={aiStats.transformerVocabSize} icon={<Terminal className="w-3 h-3" />} />
                        <MiniStat label="Cache Size" value={aiStats.attentionCacheSize} icon={<Database className="w-3 h-3" />} />
                        <MiniStat label="Strategy" value={aiStats.activeLearningStrategy.replace('_', ' ')} icon={<Shield className="w-3 h-3" />} />
                        <MiniStat label="Efficiency" value={aiStats.learningEfficiency.toFixed(6)} icon={<Activity className="w-3 h-3" />} />
                      </div>
                    </div>

                    {/* Concept Mastery */}
                    <div className="bg-zinc-900/60 backdrop-blur-3xl rounded-[3rem] p-6 md:p-8 border border-white/20 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                      <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300 mb-8 flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-emerald-200/60" />
                        Concept Saturation
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
                        {Object.entries(aiStats.conceptMastery).map(([type, mastery]) => (
                          <div key={type} className="space-y-3">
                            <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.15em] font-medium">
                              <span className="text-zinc-300 capitalize">{(type as string).toLowerCase().replace(/_/g, ' ')}</span>
                              <span className="font-mono text-zinc-300">{((mastery as number) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${(mastery as number) * 100}%` }}
                                className="h-full bg-gradient-to-r from-zinc-500 to-emerald-200/80" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {lastLearningInfo && (
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Last Learning Event</p>
                        <p className="text-[12px] text-zinc-300 font-light">{lastLearningInfo}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════════ GRAPH TAB ═══════════ */}
            {activeTab === 'graph' && (
              <motion.div key="graph" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }} className="w-full h-full relative">
                <div className="absolute top-6 left-6 z-10 pointer-events-none">
                  <h2 className="text-2xl font-light text-zinc-100 tracking-[0.2em] uppercase drop-shadow-md">Neuro-Graph</h2>
                  <p className="text-zinc-300 text-[11px] uppercase tracking-[0.1em] font-light mt-1 drop-shadow-md">Knowledge Network Topology</p>
                </div>
                <div className="w-full h-full pt-20">
                  <ErrorBoundary fallback={<GraphLoadingFallback />}>
                    <Suspense fallback={<GraphLoadingFallback />}>
                      <KnowledgeGraphVisualizer data={aiEngine.getGraphData()} className="h-full rounded-none border-0" isLearning={isTyping} />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </motion.div>
            )}

            {/* ═══════════ SETTINGS TAB ═══════════ */}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }} className="w-full p-4 md:p-8 max-w-4xl mx-auto pt-20">
                <header className="mb-10 text-center relative z-10">
                  <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-b from-zinc-800 to-black items-center justify-center mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_rgba(255,255,255,0.1)] border border-white/10">
                    <Settings className="text-emerald-200/80 w-7 h-7" />
                  </div>
                  <h2 className="text-3xl font-light text-zinc-100 tracking-[0.2em] uppercase mb-3">System Configuration</h2>
                  <p className="text-zinc-300 text-[11px] tracking-[0.1em] max-w-md mx-auto uppercase leading-relaxed font-light">
                    Manage the AI engine and neural cortex.
                  </p>
                </header>
                <div className="bg-zinc-900/60 backdrop-blur-3xl rounded-[3rem] p-6 md:p-8 border border-white/20 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <div className="flex flex-col gap-6">
                    <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] border border-white/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 blur-3xl opacity-10 bg-red-900/30 rounded-full w-full h-full -z-10"></div>
                      <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300 mb-3 flex items-center gap-3">
                        <Zap className="w-4 h-4 text-red-500/80" />
                        Memory Purge
                      </h3>
                      <p className="text-zinc-300 text-[12px] mb-8 leading-relaxed font-light">
                        Clear all conversational history, reset the AI engine (transformer weights, knowledge graph, active learning state, transfer learning cache), and reset all skill progress to zero. This operation is irrecoverable.
                      </p>
                      <button onClick={handlePurge}
                        className="px-8 py-4 text-[11px] font-medium uppercase tracking-[0.15em] rounded-full bg-red-500/5 text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all active:scale-95 flex items-center gap-3 w-full sm:w-auto justify-center shadow-sm">
                        <Zap className="w-3.5 h-3.5" />
                        Format Neural Cortex
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {activeTab === 'chat' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="w-full px-3 pb-2 pt-2 shrink-0 z-20 pointer-events-none">
              <div className="max-w-4xl mx-auto w-full pointer-events-auto">
                <div className="relative w-full h-[44px] bg-zinc-900/60 backdrop-blur-xl border border-[var(--color-electric-cyan)]/30 rounded-2xl shadow-[0_0_15px_rgba(0,243,255,0.1)] flex items-center overflow-hidden">
                  <span className="absolute left-3 top-0.5 text-[6px] font-mono font-bold text-[var(--color-electric-cyan)] opacity-50 tracking-widest uppercase">AI ENGINE INPUT</span>
                  {(inputValue.length > 0 || isTyping) && (
                    <div className="absolute left-[50%] -translate-x-[50%] bottom-[50%] w-0 h-0 pointer-events-none z-0">
                      <div className="absolute left-0 bottom-0 w-[2px] h-[10px] bg-[var(--color-violet)] rounded-full animate-[ping_0.5s_infinite] opacity-80 shadow-[0_0_10px_var(--color-violet)]"></div>
                      <div className="absolute left-[-10px] bottom-[-5px] w-[1px] h-[5px] bg-[var(--color-electric-cyan)] rounded-full animate-[ping_0.7s_infinite_0.2s] opacity-80 shadow-[0_0_5px_var(--color-electric-cyan)]"></div>
                      <div className="absolute left-[10px] bottom-[-2px] w-[2px] h-[8px] bg-[var(--color-violet)] rounded-full animate-[ping_0.6s_infinite_0.4s] opacity-60 shadow-[0_0_8px_var(--color-violet)]"></div>
                    </div>
                  )}
                  <div className="flex-1 flex items-center px-3 pt-2.5 relative z-10 w-full">
                    <span className="text-[var(--color-electric-cyan)] mr-2 opacity-50 font-mono font-bold text-sm">{">"}</span>
                    <input className="command-line-input text-[var(--color-brushed-gold)] !text-trail font-mono text-[13px] tracking-tight"
                      placeholder="Type a message..." value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
                  </div>
                  <button onClick={handleSend} disabled={!inputValue.trim()}
                    className="px-3 h-full flex items-center justify-center transition-all bg-[var(--color-electric-cyan)]/10 hover:bg-[var(--color-electric-cyan)]/20 rounded-r-2xl text-[var(--color-brushed-gold)] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed group z-10">
                    <Anchor className="w-4 h-4 group-hover:scale-110 drop-shadow-[0_0_6px_var(--color-brushed-gold)] transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="absolute bottom-0 left-0 right-0 h-14 glass-nav flex items-center justify-around px-1 z-40 backdrop-blur-2xl">
        <TabButton icon={<MessageSquare className="w-[18px] h-[18px]" />} active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} label="Chat" />
        <TabButton icon={<GitBranch className="w-[18px] h-[18px]" />} active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} label="Skills" />
        <TabButton icon={<Brain className="w-[18px] h-[18px]" />} active={activeTab === 'brain'} onClick={() => setActiveTab('brain')} label="Brain" />
        <TabButton icon={<Orbit className="w-[18px] h-[18px]" />} active={activeTab === 'graph'} onClick={() => setActiveTab('graph')} label="Graph" />
        <TabButton icon={<Settings className="w-[18px] h-[18px]" />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />
      </nav>
    </div>
    </ErrorBoundary>
  );
}

// ═══════════ COMPONENTS ═══════════

function TabButton({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-300 relative min-w-[56px]",
      active ? "bg-white/10 shadow-[0_2px_10px_rgba(0,243,255,0.1),_inset_0_1px_rgba(255,255,255,0.2)] border border-white/15" : "text-zinc-400 active:text-zinc-200"
    )}>
      <div className={cn("transition-transform duration-300", active ? "scale-110 drop-shadow-[0_0_6px_var(--color-electric-cyan)] text-[var(--color-electric-cyan)]" : "scale-100")}>{icon}</div>
      <span className="text-[7px] font-mono font-bold uppercase tracking-[0.08em] text-center max-w-[56px] leading-tight mt-0.5">{label}</span>
      {active && <motion.div layoutId="activeIndicator" className="absolute -bottom-0.5 w-[40%] h-[2px] bg-[var(--color-electric-cyan)] shadow-[0_0_6px_var(--color-electric-cyan)] rounded-full" />}
    </button>
  );
}

function Target({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  );
}

function BrainStatBox({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="glass-panel p-5 rounded-[2rem] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 blur-3xl opacity-10 bg-indigo-500/20 rounded-full w-full h-full -z-10"></div>
      <div className="flex items-center gap-2 mb-3 text-zinc-200">
        <div className="bg-white/10 p-2 rounded-xl border border-white/20 backdrop-blur-md">{icon}</div>
        <span className="text-[9px] font-medium uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className={cn("text-2xl font-light font-mono tracking-tight drop-shadow-md", accent)}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-1 text-zinc-400">
        {icon}
        <span className="text-[8px] uppercase tracking-[0.15em] font-medium">{label}</span>
      </div>
      <div className="text-lg font-mono text-zinc-100 font-light">{value}</div>
    </div>
  );
}

function ExtendedSkillCard({ skill, progress, canUnlock, unlockInfo }: { skill: ExtendedSkill; progress: number; canUnlock: boolean; unlockInfo: { met: boolean; prereqProgress: { id: string; name: string; current: number; required: number }[]; xpProgress: number }; key?: string }) {
  const isLocked = !canUnlock;
  const tierConfig = TIER_CONFIG[skill.tier];
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={cn(
      "glass-panel rounded-3xl p-5 transition-all relative overflow-hidden group",
      isLocked ? "border-white/10 opacity-60" : "border-white/10 hover:border-indigo-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
    )}>
      {/* Tier gradient overlay */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0", tierConfig.bgColor)}></div>
      {!isLocked && <div className="absolute top-0 right-0 p-3 opacity-30 z-10 transition-opacity group-hover:opacity-60"><Star className="w-3.5 h-3.5 text-amber-300" /></div>}

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={cn("p-2.5 rounded-2xl border backdrop-blur-md shadow-inner", isLocked ? "bg-white/10 border-white/20" : "bg-white/10 border-white/20")}>
          <SkillCategoryIcon category={skill.category} className="w-4 h-4" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className={cn("text-[8px] font-medium px-2.5 py-0.5 rounded-full uppercase tracking-[0.1em] border", tierConfig.color,
            isLocked ? "bg-white/5 border-white/10" : "bg-white/10 border-white/20"
          )}>{tierConfig.label}</div>
          {isLocked ? (
            <div className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-500 border border-white/10 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Locked
            </div>
          ) : (
            <div className="text-[9px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Unlock className="w-2.5 h-2.5" /> LVL {skill.level}
            </div>
          )}
        </div>
      </div>

      <h4 className={cn("text-[15px] font-light mb-1 group-hover:text-indigo-200 transition-colors relative z-10", tierConfig.color)}>{skill.name}</h4>
      <p className="text-[11px] font-light text-zinc-200 mb-3 line-clamp-2 leading-relaxed relative z-10">{skill.description}</p>

      {!isLocked && (
        <div className="space-y-3 relative z-10">
          <div className="h-1 bg-zinc-900/60 rounded-full overflow-hidden shadow-inner border border-white/20">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }}
              className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 opacity-80" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {skill.abilities.slice(0, 3).map((ability, idx) => (
              <span key={idx} className={cn("text-[8px] px-2 py-0.5 rounded-full border shadow-inner",
                skill.level >= (idx + 1) * 20 ? "bg-white/10 text-indigo-300 border-white/10 font-medium" : "bg-white/5 text-zinc-400 border-white/10"
              )}>{ability}</span>
            ))}
          </div>
        </div>
      )}

      {/* Lock info */}
      {isLocked && unlockInfo.prereqProgress.length > 0 && (
        <div className="mt-3 space-y-2 relative z-10">
          <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Requires:</div>
          {unlockInfo.prereqProgress.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", p.current >= p.required ? "bg-emerald-400" : "bg-zinc-600")} style={{ width: `${Math.min(100, (p.current / Math.max(1, p.required)) * 100)}%` }}></div>
              </div>
              <span className="text-[8px] font-mono text-zinc-500 w-16 text-right truncate">{p.name}</span>
              <span className="text-[8px] font-mono text-zinc-600">{p.current}/{p.required}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expandable lore */}
      <button onClick={() => setShowDetails(!showDetails)} className="mt-3 text-[8px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors relative z-10 flex items-center gap-1">
        {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {showDetails ? 'Less' : 'Details'}
      </button>
      {showDetails && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 relative z-10">
          <p className="text-[10px] text-zinc-400 italic leading-relaxed mb-1">"{skill.loreText}"</p>
          <p className="text-[10px] text-zinc-300 leading-relaxed">{skill.bonusDescription}</p>
        </motion.div>
      )}
    </div>
  );
}

function SkillCategoryIcon({ category, className }: { category: SkillCategory, className?: string }) {
  switch (category) {
    case SkillCategory.AI_LEARNING: return <Brain className={className} />;
    case SkillCategory.CODING: return <Code className={className} />;
    case SkillCategory.TERMUX: return <Terminal className={className} />;
    case SkillCategory.GITHUB: return <Github className={className} />;
    case SkillCategory.PDF_ANALYSIS: return <FileText className={className} />;
    case SkillCategory.YOUTUBE_LEARNING: return <Youtube className={className} />;
    case SkillCategory.SYSTEM: return <Settings className={className} />;
    default: return <MessageSquare className={className} />;
  }
}
