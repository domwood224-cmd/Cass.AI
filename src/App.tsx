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
  Anchor
} from 'lucide-react';
import { skillManager } from './lib/skill-tree';
import { learningEngine } from './lib/learning-engine';
import { chatWithCassidey } from './lib/gemini';
import { cn } from './lib/utils';
import { Skill, SkillCategory, LearningState, LearningType } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { readJson, writeJson, purgeAll, migrateFromLocalStorage, STORAGE_KEYS } from './lib/storage';

// Lazy-load the heavy 3D graph component (three.js + force-graph-3d = ~2MB)
const KnowledgeGraphVisualizer = lazy(() => import('./components/KnowledgeGraphVisualizer').then(m => ({ default: m.KnowledgeGraphVisualizer })));

function GraphLoadingFallback() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300">
      <Orbit className="w-12 h-12 mb-4 opacity-30 text-indigo-300 animate-[spin_8s_linear_infinite]" />
      <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-zinc-300">Initializing Neural Lattice...</span>
    </div>
  );
}

export default function App() {
  // Catch-all error boundary for the entire app
  const [activeTab, setActiveTab] = useState<'chat' | 'skills' | 'brain' | 'graph' | 'settings'>('chat');
  // Start empty — SD card data loads async after mount
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stats, setStats] = useState<LearningState>(learningEngine.getStats());
  const [skills, setSkills] = useState<Skill[]>(skillManager.getAllSkills());
  const [ready, setReady] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── One-time init: migrate localStorage → SD card, then load from SD card ──
  useEffect(() => {
    (async () => {
      await migrateFromLocalStorage();

      // Load messages from SD card (or localStorage fallback on web)
      const savedMsgs = await readJson<{ role: string; content: string }[]>(STORAGE_KEYS.MESSAGES, []);
      if (savedMsgs.length > 0) setMessages(savedMsgs);

      // Reload engine data from SD card
      await learningEngine.loadLocalProgress();
      setStats(learningEngine.getStats());

      // Reload skills from SD card
      await skillManager.loadLocalProgress();
      setSkills(skillManager.getAllSkills());

      setReady(true);
    })();
  }, []);

  // ── Persist messages to SD card on every change ──
  useEffect(() => {
    if (messages.length > 0 || ready) {
      writeJson(STORAGE_KEYS.MESSAGES, messages).catch(console.error);
    }
  }, [messages, ready]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInputValue('');
    setIsTyping(true);

    // Build conversation context from recent messages for Gemini
    const recentContext = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

    let aiResponse: string;

    try {
      // Try Gemini AI first (primary brain)
      const geminiResponse = await chatWithCassidey(userMsg, recentContext);
      if (geminiResponse) {
        aiResponse = geminiResponse;
      } else {
        // Fallback to local learning engine
        aiResponse = learningEngine.generateResponse(userMsg);
      }
    } catch {
      // Gemini unavailable — local engine takes over
      aiResponse = learningEngine.generateResponse(userMsg);
    }

    // Learning Engine Step (always runs to grow the knowledge graph)
    const { type, improvement } = await learningEngine.processInteraction(userMsg, aiResponse);
    
    // Reward Skills based on interaction type
    const relevantSkills = skills.filter(s => s.category.toString().includes(type.split('_')[0]) || Math.random() > 0.8);
    relevantSkills.forEach(s => skillManager.addXp(s.id, Math.floor(improvement * 500)));
    
    await skillManager.saveLocalProgress();
    await learningEngine.saveLocalProgress();
    
    setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    setStats(learningEngine.getStats());
    setSkills(skillManager.getAllSkills());
    setIsTyping(false);
  };

  return (
    <ErrorBoundary>
    <div className="flex flex-col fixed inset-0 bg-[var(--color-system-bg)] overflow-hidden font-sans relative">
      <div className="nerve-line"></div>
      
      {/* Corner Micro-text Warnings - hidden on small screens */}
      <div className="absolute top-4 left-4 z-50 text-[var(--color-glitch-red)] text-[8px] font-mono tracking-widest font-bold opacity-80 pointer-events-none hidden md:block">
        VOLTAGE_PEAK
      </div>
      <div className="absolute top-4 right-4 z-50 text-[var(--color-glitch-red)] text-[8px] font-mono tracking-widest font-bold opacity-80 pointer-events-none hidden md:block">
        NEURAL_OVERRIDE
      </div>

      {/* Immersive high-end ambient background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-60 mix-blend-screen">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-zinc-800/40 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-white/20 rounded-full blur-[100px]"></div>
      </div>
      
      {/* Compact Mobile Header */}
      <header className="h-12 flex items-center justify-between px-4 bg-transparent z-30 shrink-0 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10">
            <Cpu className="text-emerald-200/80 w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-light tracking-[0.15em] text-zinc-100 flex items-baseline gap-1.5">
            CASSIDEY
            <span className="text-zinc-400 font-light text-[8px] tracking-[0.3em]">V2.0.4</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl px-2.5 py-1 rounded-full border border-white/10">
           <div className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
           <span className="text-[8px] font-medium text-zinc-300 uppercase tracking-widest">Active</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden bg-transparent flex flex-col">
        <div className={cn("w-full overflow-y-auto no-scrollbar scroll-smooth flex-1", activeTab === 'graph' ? "h-full": "")}>
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="max-w-4xl mx-auto w-full min-h-full flex flex-col px-3 py-2 md:p-6"
              >
                <div className="hidden md:block absolute top-6 left-6 z-10 pointer-events-none">
                  <h2 className="text-2xl font-light text-zinc-100 tracking-[0.2em] uppercase drop-shadow-md">Interface</h2>
                  <p className="text-zinc-300 text-[11px] uppercase tracking-[0.1em] font-light mt-1 drop-shadow-md">Direct Input Link</p>
                </div>
                <div className="flex-1 space-y-4 pb-6 pt-2 md:pt-16">
                  {messages.length === 0 && (
                    <div className="min-h-[40vh] md:min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 px-4 opacity-50 relative z-10">
                      <div className="space-y-2">
                        <h2 className="text-xl md:text-3xl font-display text-[var(--color-electric-cyan)] tracking-[0.3em] font-medium uppercase drop-shadow-md">NODE ACTIVE</h2>
                        <p className="text-[var(--color-electric-cyan)] text-[9px] tracking-[0.2em] font-mono mx-auto leading-relaxed uppercase opacity-70">Awaiting direct injection...</p>
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => {
                    const isMemoryWeighted = m.content.toLowerCase().includes('hobbies');
                    const hasGlitch = m.content.toLowerCase().includes('subjective experience');

                    return (
                      <div key={i} className={cn(
                        "flex flex-col relative z-10 py-1",
                        m.role === 'user' ? "items-end" : "items-start",
                        hasGlitch && "active-glitch glitch-container"
                      )}>
                        {m.role === 'user' ? (
                          <div className={cn(
                            "text-right text-[var(--color-brushed-gold)] !text-trail font-mono text-[13px] md:text-sm tracking-tight leading-relaxed max-w-[85%] px-3 py-1.5 rounded-2xl bg-white/[0.03]",
                            isMemoryWeighted && "memory-weighted"
                          )}>
                            {m.content}
                          </div>
                        ) : (
                          <div className="flex flex-col max-w-[90%] md:max-w-[85%]">
                            {/* Header Shard Effect */}
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <div className="h-3 w-0.5 bg-[var(--color-violet)] shadow-[0_0_6px_var(--color-violet)]"></div>
                              <span className="font-display font-bold text-[var(--color-violet)] text-[8px] uppercase tracking-[0.15em]">RESPONSE</span>
                            </div>
                            {/* Main Body */}
                            <div className="text-[13px] md:text-sm text-[var(--color-electric-cyan)] font-sans font-light tracking-wide leading-relaxed relative flex items-start">
                              <span className="mr-2 mt-0.5 opacity-40">›</span>
                              <span className="break-words">{m.content}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {isTyping && (
                    <div className="flex flex-col items-start gap-2 relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-4 w-1 bg-[var(--color-violet)] opacity-50 animate-pulse"></div>
                        <span className="font-display font-medium text-[var(--color-violet)] text-[10px] uppercase tracking-[0.2em] opacity-50 animate-pulse">SYNTHESIZING...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </motion.div>
            )}

            {activeTab === 'skills' && (
              <motion.div 
                key="skills"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full p-4 md:p-8 max-w-4xl mx-auto pt-20"
              >
                <div className="max-w-6xl mx-auto">
                  <header className="mb-10 text-center relative z-10">
                    <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-b from-zinc-800 to-black items-center justify-center mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_rgba(255,255,255,0.1)] border border-white/10">
                      <Terminal className="text-emerald-200/80 w-7 h-7" />
                    </div>
                    <h2 className="text-3xl font-light text-zinc-100 tracking-[0.2em] uppercase mb-3">Protocol Library</h2>
                    <p className="text-zinc-300 text-[11px] tracking-[0.1em] max-w-md mx-auto uppercase leading-relaxed font-light mb-4">
                      Installed capabilities and active algorithms adapting to current needs.
                    </p>
                    <div className="inline-flex items-center gap-3 bg-white/10 border border-white/10 rounded-full px-4 py-2 mt-4 shadow-inner">
                      <span className="text-[9px] font-medium text-zinc-300 uppercase tracking-[0.2em]">Unlocked</span>
                      <span className="text-sm font-mono text-emerald-200">{skills.filter(s => s.level > 0).length}/{skills.length}</span>
                    </div>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                    {Object.values(SkillCategory).map(category => (
                      <div key={category} className="space-y-4">
                        <div className="flex items-center gap-3 px-2 border-b border-white/20 pb-2">
                          <SkillCategoryIcon category={category as SkillCategory} className="w-4 h-4 text-emerald-200/60" />
                          <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-200">{category}</h3>
                        </div>
                        <div className="space-y-4">
                          {skills.filter(s => s.category === category).map(skill => (
                            <SkillCard 
                              key={skill.id} 
                              skill={skill} 
                              progress={skillManager.getXpProgress(skill)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'brain' && (
              <motion.div 
                key="brain"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full p-4 md:p-8 max-w-4xl mx-auto pt-20"
              >
                <header className="mb-10 text-center relative z-10">
                  <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-b from-zinc-800 to-black items-center justify-center mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_rgba(255,255,255,0.1)] border border-white/10">
                    <Cpu className="text-emerald-200/80 w-7 h-7" />
                  </div>
                  <h2 className="text-3xl font-light text-zinc-100 tracking-[0.2em] uppercase mb-3">Model Metrics</h2>
                  <p className="text-zinc-300 text-[11px] tracking-[0.1em] max-w-md mx-auto uppercase leading-relaxed font-light">
                    Real-time network telemetry and synapse performance statistics.
                  </p>
                </header>

                <div className="bg-zinc-900/60 backdrop-blur-3xl rounded-[3rem] p-6 md:p-8 border border-white/20 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  
                  <div className="flex flex-col gap-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 glass-panel rounded-[2.5rem] p-6 md:p-8 border border-white/20 relative overflow-hidden shadow-[inset_0_1px_rgba(255,255,255,0.05)] bg-gradient-to-br from-white/[0.02] to-transparent">
                        <div className="absolute top-0 right-0 p-8 blur-3xl opacity-10 bg-emerald-500/20 rounded-full w-full h-full -z-10"></div>
                        <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300 mb-8 flex items-center gap-3">
                          <TrendingUp className="w-4 h-4 text-emerald-200/60" />
                          Concept Saturation
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
                          {Object.entries(stats.conceptMastery).map(([type, mastery]) => (
                            <div key={type} className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.15em] font-medium">
                                <span className="text-zinc-300 capitalize">{type.toLowerCase().replace('_', ' ')}</span>
                                <span className="font-mono text-zinc-300">{((mastery as number) * 100).toFixed(1)}%</span>
                              </div>
                              <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(mastery as number) * 100}%` }}
                                  className="h-full bg-gradient-to-r from-zinc-500 to-emerald-200/80"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-6">
                        <StatBox label="Iterations" value={stats.totalIterations} icon={<Settings className="w-3.5 h-3.5 text-zinc-300" />} />
                        <StatBox label="Gradient" value={stats.learningRate.toFixed(4)} icon={<Zap className="w-3.5 h-3.5 text-emerald-200/60" />} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'graph' && (
              <motion.div 
                key="graph"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full relative"
              >
                <div className="absolute top-6 left-6 z-10 pointer-events-none">
                  <h2 className="text-2xl font-light text-zinc-100 tracking-[0.2em] uppercase drop-shadow-md">Neuro-Graph</h2>
                  <p className="text-zinc-300 text-[11px] uppercase tracking-[0.1em] font-light mt-1 drop-shadow-md">Interactive Spatial Topography</p>
                </div>
                <div className="w-full h-full pt-20">
                  <ErrorBoundary fallback={<GraphLoadingFallback />}>
                    <Suspense fallback={<GraphLoadingFallback />}>
                      <KnowledgeGraphVisualizer data={learningEngine.getGraphData()} className="h-full rounded-none border-0" isLearning={isTyping} />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full p-4 md:p-8 max-w-4xl mx-auto pt-20"
              >
                <header className="mb-10 text-center relative z-10">
                  <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-b from-zinc-800 to-black items-center justify-center mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_rgba(255,255,255,0.1)] border border-white/10">
                    <Settings className="text-emerald-200/80 w-7 h-7" />
                  </div>
                  <h2 className="text-3xl font-light text-zinc-100 tracking-[0.2em] uppercase mb-3">System Configuration</h2>
                  <p className="text-zinc-300 text-[11px] tracking-[0.1em] max-w-md mx-auto uppercase leading-relaxed font-light">
                    Manage core runtime variables and localized storage vectors.
                  </p>
                </header>

                <div className="bg-zinc-900/60 backdrop-blur-3xl rounded-[3rem] p-6 md:p-8 border border-white/20 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  
                  <div className="flex flex-col gap-6">
                    <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] border border-white/20 relative overflow-hidden shadow-[inset_0_1px_rgba(255,255,255,0.05)] bg-gradient-to-br from-white/[0.02] to-transparent">
                      <div className="absolute top-0 right-0 p-8 blur-3xl opacity-10 bg-red-900/30 rounded-full w-full h-full -z-10"></div>
                      <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300 mb-3 flex items-center gap-3">
                        <Zap className="w-4 h-4 text-red-500/80" />
                        Memory Purge
                      </h3>
                      <p className="text-zinc-300 text-[12px] mb-8 leading-relaxed font-light">
                        Clear all conversational history and reset local model weights to their factory initialization state. 
                        This operation is irrecoverable.
                      </p>
                      
                      <button
                        onClick={async () => {
                          await learningEngine.reset();
                          await skillManager.reset();
                          await purgeAll();
                          setStats(learningEngine.getStats());
                          setSkills(skillManager.getAllSkills());
                          setMessages([]);
                        }}
                        className="px-8 py-4 text-[11px] font-medium uppercase tracking-[0.15em] rounded-full bg-red-500/5 text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all active:scale-95 flex items-center gap-3 w-full sm:w-auto justify-center shadow-sm"
                      >
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

        {/* Floating Input Area */}
        <AnimatePresence>
          {activeTab === 'chat' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="w-full px-3 pb-2 pt-2 shrink-0 z-20 pointer-events-none"
            >
              <div className="max-w-4xl mx-auto w-full pointer-events-auto">
                <div className="relative w-full h-[44px] bg-zinc-900/60 backdrop-blur-xl border border-[var(--color-electric-cyan)]/30 rounded-2xl shadow-[0_0_15px_rgba(0,243,255,0.1)] flex items-center overflow-hidden">
                  <span className="absolute left-3 top-0.5 text-[6px] font-mono font-bold text-[var(--color-electric-cyan)] opacity-50 tracking-widest uppercase">DIRECT INJECTION</span>
                  
                  {(inputValue.length > 0 || isTyping) && (
                    <div className="absolute left-[50%] -translate-x-[50%] bottom-[50%] w-0 h-0 pointer-events-none z-0">
                       {/* Upwards particle flow to neural line */}
                       <div className="absolute left-0 bottom-0 w-[2px] h-[10px] bg-[var(--color-violet)] rounded-full animate-[ping_0.5s_infinite] opacity-80 shadow-[0_0_10px_var(--color-violet)]"></div>
                       <div className="absolute left-[-10px] bottom-[-5px] w-[1px] h-[5px] bg-[var(--color-electric-cyan)] rounded-full animate-[ping_0.7s_infinite_0.2s] opacity-80 shadow-[0_0_5px_var(--color-electric-cyan)]"></div>
                       <div className="absolute left-[10px] bottom-[-2px] w-[2px] h-[8px] bg-[var(--color-violet)] rounded-full animate-[ping_0.6s_infinite_0.4s] opacity-60 shadow-[0_0_8px_var(--color-violet)]"></div>
                    </div>
                  )}

                  <div className="flex-1 flex items-center px-3 pt-2.5 relative z-10 w-full">
                    <span className="text-[var(--color-electric-cyan)] mr-2 opacity-50 font-mono font-bold text-sm">{">"}</span>
                    <input 
                      className="command-line-input text-[var(--color-brushed-gold)] !text-trail font-mono text-[13px] tracking-tight"
                      placeholder="Type a message..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                  </div>
                  
                  <button 
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="px-3 h-full flex items-center justify-center transition-all bg-[var(--color-electric-cyan)]/10 hover:bg-[var(--color-electric-cyan)]/20 rounded-r-2xl text-[var(--color-brushed-gold)] disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed group z-10"
                  >
                    <Anchor className="w-4 h-4 group-hover:scale-110 drop-shadow-[0_0_6px_var(--color-brushed-gold)] transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Compact Bottom Tab Bar - mobile optimized */}
      <nav className="h-14 glass-nav flex items-center justify-around px-1 z-40 shrink-0 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)]">
        <TabButton 
          icon={<MessageSquare className="w-[18px] h-[18px]" />} 
          active={activeTab === 'chat'} 
          onClick={() => setActiveTab('chat')}
          label="Chat"
        />
        <TabButton 
          icon={<Terminal className="w-[18px] h-[18px]" />} 
          active={activeTab === 'skills'} 
          onClick={() => setActiveTab('skills')}
          label="Skills"
        />
        <TabButton 
          icon={<Cpu className="w-[18px] h-[18px]" />} 
          active={activeTab === 'brain'} 
          onClick={() => setActiveTab('brain')}
          label="Brain"
        />
        <TabButton 
          icon={<Orbit className="w-[18px] h-[18px]" />} 
          active={activeTab === 'graph'} 
          onClick={() => setActiveTab('graph')}
          label="Graph"
        />
        <TabButton 
          icon={<Settings className="w-[18px] h-[18px]" />} 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')}
          label="Settings"
        />
      </nav>
    </div>
    </ErrorBoundary>
  );
}

function TabButton({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-300 relative min-w-[56px]",
        active 
          ? "bg-white/10 shadow-[0_2px_10px_rgba(0,243,255,0.1),_inset_0_1px_rgba(255,255,255,0.2)] border border-white/15" 
          : "text-zinc-400 active:text-zinc-200"
      )}
    >
      <div className={cn(
        "transition-transform duration-300",
        active ? "scale-110 drop-shadow-[0_0_6px_var(--color-electric-cyan)] text-[var(--color-electric-cyan)]" : "scale-100"
      )}>
        {icon}
      </div>
      <span className="text-[7px] font-mono font-bold uppercase tracking-[0.08em] text-center max-w-[56px] leading-tight mt-0.5">{label}</span>
      {active && (
        <motion.div 
          layoutId="activeIndicator"
          className="absolute -bottom-0.5 w-[40%] h-[2px] bg-[var(--color-electric-cyan)] shadow-[0_0_6px_var(--color-electric-cyan)] rounded-full"
        />
      )}
    </button>
  );
}

function SuggestionCard({ text, onClick }: { text: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-left text-[11px] font-medium text-zinc-200 hover:text-white hover:bg-zinc-800/60 transition-all active:scale-95 flex items-center justify-between group"
    >
      <span>{text}</span>
      <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-indigo-400 transition-colors" />
    </button>
  );
}

const SkillCard: React.FC<{ skill: Skill, progress: number, key?: any }> = ({ skill, progress }) => {
  const isLocked = skill.level === 0;

  return (
    <div className={cn(
      "glass-panel rounded-3xl p-5 transition-all relative overflow-hidden group",
      isLocked ? "border-white/20 opacity-50 grayscale" : "border-white/10 hover:border-indigo-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_32px_rgba(79,70,229,0.15)]"
    )}>
      {!isLocked && (
        <div className="absolute top-0 right-0 p-3 opacity-30 text-indigo-300 z-10 transition-opacity group-hover:opacity-60">
           <Zap className="w-3.5 h-3.5" />
        </div>
      )}
      {/* Subtle iridescent glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={cn(
          "p-2.5 rounded-2xl transition-colors",
          isLocked ? "bg-white/10 text-zinc-300" : "bg-white/10 text-indigo-300 backdrop-blur-md shadow-inner border border-white/20"
        )}>
          <SkillCategoryIcon category={skill.category} className="w-4 h-4" />
        </div>
        <div className="text-right">
          <div className={cn(
            "text-[9px] font-medium px-2.5 py-1 rounded-full uppercase tracking-[0.1em]",
            isLocked ? "bg-white/10 text-zinc-300 border border-white/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          )}>
            {isLocked ? "Locked" : `LVL ${skill.level}`}
          </div>
        </div>
      </div>
      
      <h4 className="text-[15px] font-light text-zinc-100 mb-1.5 group-hover:text-indigo-200 transition-colors relative z-10">{skill.name}</h4>
      <p className="text-[12px] font-light text-zinc-200 mb-5 line-clamp-2 leading-relaxed relative z-10">{skill.description}</p>
      
      <div className="space-y-4 relative z-10">
        <div className="h-1 bg-zinc-900/60 rounded-full overflow-hidden shadow-inner border border-white/20">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 opacity-80"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {skill.abilities.map((ability, idx) => (
            <span key={idx} className={cn(
              "text-[9px] px-2.5 py-1 rounded-full border transition-all shadow-inner",
              skill.level >= (idx + 1) * 20 
                ? "bg-white/10 text-indigo-300 border-white/10 font-medium" 
                : "bg-white/10 text-zinc-300 border-white/20"
            )}>
              {ability}
            </span>
          ))}
        </div>
      </div>
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

function StatBox({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="glass-panel p-6 rounded-[2.5rem] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 blur-3xl opacity-10 bg-indigo-500/20 rounded-full w-full h-full -z-10"></div>
      <div className="flex items-center gap-2 mb-3 text-zinc-200">
        <div className="bg-white/10 p-2 rounded-2xl border border-white/20 backdrop-blur-md">
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className="text-3xl font-light text-zinc-100 font-mono tracking-tight drop-shadow-md">{value}</div>
    </div>
  );
}
