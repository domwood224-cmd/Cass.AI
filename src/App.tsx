import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as d3 from 'd3';
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
  Trash2,
  Download,
  Upload,
  Key,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { skillManager } from './lib/skill-tree';
import { learningEngine } from './lib/learning-engine';
import { cn } from './lib/utils';
import { Skill, SkillCategory, LearningState, LearningType } from './types';
import { KnowledgeGraphVisualizer } from './components/KnowledgeGraphVisualizer';
import { chatWithCassidey, isGeminiConfigured, setGeminiApiKey, getStoredGeminiKey } from './lib/gemini';
import { checkForUpdate, downloadUpdate, triggerInstall, formatBytes, UpdateInfo, UpdateStatus } from './lib/updater';

// Proper mapping from LearningType to SkillCategory for XP rewards
const LEARNING_TYPE_TO_CATEGORY: Record<string, SkillCategory> = {
  QUESTION_ANSWERING: SkillCategory.AI_LEARNING,
  REASONING: SkillCategory.AI_LEARNING,
  CREATIVITY: SkillCategory.COMMUNICATION,
  EMPATHY: SkillCategory.COMMUNICATION,
  GENERAL_CONVERSATION: SkillCategory.COMMUNICATION,
  COMMAND_EXECUTION: SkillCategory.CODING,
  MEMORY_MANAGEMENT: SkillCategory.SYSTEM,
  GREETING: SkillCategory.COMMUNICATION,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'skills' | 'brain' | 'setup'>('chat');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>(() => {
    try {
      const saved = localStorage.getItem('cassidey_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [useGemini, setUseGemini] = useState(() => isGeminiConfigured());
  const [stats, setStats] = useState<LearningState>(learningEngine.getStats());
  const [skills, setSkills] = useState<Skill[]>(skillManager.getAllSkills());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Setup tab state
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredGeminiKey() || '');
  const [apiSaved, setApiSaved] = useState(false);
  const [showApiSaved, setShowApiSaved] = useState(false);

  // Auto-updater state
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState('');
  const [showUpdateBanner, setShowUpdateBanner] = useState(true);

  // Persist messages safely
  useEffect(() => {
    try {
      localStorage.setItem('cassidey_messages', JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save messages:", e);
    }
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInputValue('');
    setIsTyping(true);

    let aiResponse: string;
    try {
      if (useGemini && isGeminiConfigured()) {
        // Use Gemini API with conversation context
        const context = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
        aiResponse = await chatWithCassidey(userMsg, context);
      } else {
        // Give a slight delay to simulate processing
        await new Promise(r => setTimeout(r, 600));
        aiResponse = learningEngine.generateResponse(userMsg);
      }
    } catch {
      aiResponse = learningEngine.generateResponse(userMsg);
    }

    // Learning Engine Step (always runs locally for skill progression)
    const { type, improvement } = await learningEngine.processInteraction(userMsg, aiResponse);
    
    // Reward Skills based on interaction type with proper mapping
    const targetCategory = LEARNING_TYPE_TO_CATEGORY[type] || SkillCategory.COMMUNICATION;
    const relevantSkills = skills.filter(s => s.category === targetCategory);
    if (relevantSkills.length === 0) {
      // Fallback: reward a random skill
      const fallback = skills[Math.floor(Math.random() * skills.length)];
      skillManager.addXp(fallback.id, Math.floor(improvement * 500));
    } else {
      relevantSkills.forEach(s => skillManager.addXp(s.id, Math.floor(improvement * 500)));
    }
    
    skillManager.saveLocalProgress();
    learningEngine.saveLocalProgress();
    
    setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    setStats(learningEngine.getStats());
    setSkills(skillManager.getAllSkills());
    setIsTyping(false);
  }, [inputValue, messages, skills, useGemini]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('cassidey_messages');
  }, []);

  const handleExportData = useCallback(() => {
    const data = {
      messages: messages,
      skillProgress: skillManager.exportProgress(),
      learningState: stats,
      exportedAt: new Date().toISOString(),
      version: '2.0.4'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cassidey-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, stats]);

  const handleSaveApiKey = useCallback(() => {
    setGeminiApiKey(apiKeyInput);
    setUseGemini(!!apiKeyInput.trim());
    setApiSaved(true);
    setShowApiSaved(true);
    setTimeout(() => setShowApiSaved(false), 2000);
  }, [apiKeyInput]);

  // Check for updates on startup (native Android only)
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        // @ts-expect-error Capacitor global
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
          setUpdateStatus('checking');
          const info = await checkForUpdate();
          setUpdateInfo(info);
          if (info.available) {
            setUpdateStatus('available');
          } else {
            setUpdateStatus('not_available');
          }
        }
      } catch (err) {
        console.error('Update check failed:', err);
        setUpdateStatus('idle');
      }
    };
    checkUpdate();
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    if (!updateInfo?.downloadUrl) return;
    try {
      setUpdateStatus('downloading');
      setDownloadProgress(0);
      setUpdateError('');
      await downloadUpdate(updateInfo.downloadUrl, (pct) => setDownloadProgress(pct), updateInfo.assetId);
      setUpdateStatus('downloaded');
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Download failed');
      setUpdateStatus('error');
    }
  }, [updateInfo]);

  const handleInstallUpdate = useCallback(async () => {
    try {
      setUpdateStatus('installing');
      await triggerInstall();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Install failed');
      setUpdateStatus('error');
    }
  }, []);

  const handleResetAll = useCallback(() => {
    learningEngine.reset();
    skillManager.reset();
    setStats(learningEngine.getStats());
    setSkills(skillManager.getAllSkills());
    setMessages([]);
    localStorage.removeItem('cassidey_messages');
  }, []);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden font-sans">
      {/* Update Available Banner */}
      {updateStatus === 'available' && showUpdateBanner && updateInfo && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-600 border-b border-indigo-500 px-4 py-2.5 flex items-center justify-between z-50 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Download className="w-4 h-4 text-white shrink-0" />
            <span className="text-xs text-white font-medium truncate">
              v{updateInfo.latestVersion} available
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadUpdate}
              className="px-3 py-1 text-[11px] font-bold bg-white text-indigo-600 rounded-lg active:scale-95 transition-transform"
            >
              Update
            </button>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="p-1 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}

      {/* Download Progress Banner */}
      {(updateStatus === 'downloading' || updateStatus === 'downloaded') && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 z-50 shrink-0"
        >
          <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-zinc-300">
            {updateStatus === 'downloaded' ? 'Download complete!' : `Downloading... ${downloadProgress}%`}
          </span>
          {updateStatus === 'downloaded' && (
            <button
              onClick={handleInstallUpdate}
              className="px-3 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg active:scale-95 transition-all"
            >
              Install Now
            </button>
          )}
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${updateStatus === 'downloaded' ? 100 : downloadProgress}%` }}
              transition={{ duration: 0.3 }}
              className={`h-full rounded-full ${updateStatus === 'downloaded' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            />
          </div>
        </motion.div>
      )}

      {/* Update Error Banner */}
      {updateStatus === 'error' && updateError && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-2.5 flex items-center justify-between z-50 shrink-0">
          <span className="text-xs text-red-300 truncate">{updateError}</span>
          <button onClick={() => setUpdateStatus('idle')} className="text-red-400 text-xs font-bold ml-2 shrink-0">Dismiss</button>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="h-20 pt-4 border-b border-zinc-900 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur-xl z-30 shrink-0 safe-area-top">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <Cpu className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white flex items-baseline gap-1.5">
            Cassidey 
            <span className="text-zinc-600 font-normal text-[10px] tracking-widest uppercase">v2.0.4</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
           <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Active</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden bg-elegant-dark">
        <div className="h-full w-full overflow-y-auto custom-scrollbar pb-20">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="max-w-4xl mx-auto w-full h-full flex flex-col p-4 md:p-6"
              >
                <div className="flex-1 space-y-6 pb-24">
                  {messages.length === 0 && (
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 px-4">
                      <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-[0_0_40px_rgba(79,70,229,0.15)] rotate-3">
                        <Cpu className="text-indigo-500 w-10 h-10 -rotate-3" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-white tracking-tight">Cassidey Node</h2>
                        <p className="text-zinc-500 text-sm max-w-[280px] mx-auto leading-relaxed">Local intelligence active. Every conversation trains my neural weights.</p>
                        {useGemini && isGeminiConfigured() && (
                          <p className="text-indigo-400 text-xs flex items-center justify-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            Gemini-powered mode enabled
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm mt-4">
                        <SuggestionCard text="What are your current skills?" onClick={() => setInputValue("What are your current skills?")} />
                        <SuggestionCard text="How do you learn?" onClick={() => setInputValue("How does your learning engine work?")} />
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={cn(
                      "flex gap-3 max-w-[90%] md:max-w-[80%]",
                      m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border",
                        m.role === 'user' ? "bg-indigo-600 border-indigo-500" : "bg-zinc-900 border-zinc-800"
                      )}>
                        {m.role === 'user' ? <div className="w-4 h-4 bg-white/20 rounded-full" /> : <Cpu className="w-4 h-4 text-indigo-400" />}
                      </div>
                      <div className={cn(
                        "p-4 rounded-2xl text-[13px] md:text-sm leading-relaxed shadow-lg",
                        m.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-zinc-900/80 border border-zinc-800/50 text-zinc-200 backdrop-blur-sm rounded-tl-none"
                      )}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-3 mr-auto">
                      <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                        <Cpu className="w-4 h-4 text-blue-400 animate-pulse" />
                      </div>
                      <div className="flex gap-1.5 items-center p-4">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="fixed bottom-20 left-0 right-0 p-4 md:p-6 pointer-events-none">
                  <div className="max-w-2xl mx-auto w-full pointer-events-auto">
                    <div className="glass-panel p-2 rounded-2xl flex items-center gap-2 shadow-2xl border border-zinc-800/80">
                      <input 
                        className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-sm text-white placeholder-zinc-600"
                        placeholder="Speak to Cassidey..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      />
                      <button 
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isTyping}
                        className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-90"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'skills' && (
              <motion.div 
                key="skills"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-4 md:p-8"
              >
                <div className="max-w-6xl mx-auto">
                  <header className="mb-8 flex justify-between items-end">
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Skill Matrix</h2>
                      <p className="text-zinc-500 text-xs">Unlocking my potential through dialogue.</p>
                    </div>
                    <div className="text-right hidden sm:block">
                       <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Unlocked</span>
                       <span className="text-lg font-mono text-indigo-400">{skills.filter(s => s.level > 0).length}/{skills.length}</span>
                    </div>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.values(SkillCategory).map(category => (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <SkillCategoryIcon category={category as SkillCategory} className="w-3.5 h-3.5 text-indigo-400" />
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">{category}</h3>
                        </div>
                        <div className="space-y-3">
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="p-4 md:p-8"
              >
                <div className="max-w-6xl mx-auto">
                  <header className="mb-10">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Synaptic Hub</h2>
                    <p className="text-zinc-500 text-xs text-balance">Real-time visualization of knowledge growth and concept mastery indices.</p>
                  </header>

                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 glass-panel rounded-[2rem] p-6 md:p-8 border-zinc-800/50">
                        <h3 className="text-base font-bold text-white mb-8 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          Concept Saturation
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
                          {Object.entries(stats.conceptMastery).map(([type, mastery]) => (
                            <div key={type} className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold">
                                <span className="text-zinc-500 capitalize">{type.toLowerCase().replace('_', ' ')}</span>
                                <span className="font-mono text-emerald-400">{((mastery as number) * 100).toFixed(1)}%</span>
                              </div>
                              <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(mastery as number) * 100}%` }}
                                  className="h-full bg-gradient-to-r from-indigo-600 to-emerald-400"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-6">
                        <StatBox label="Iterations" value={stats.totalIterations} icon={<Settings className="w-3.5 h-3.5" />} />
                        <StatBox label="Gradient" value={stats.learningRate.toFixed(4)} icon={<Zap className="w-3.5 h-3.5" />} />
                      </div>
                    </div>

                    <div className="glass-panel rounded-[2rem] p-6 lg:p-8 border-zinc-800/50 relative">
                      <div className="flex justify-between items-start mb-6">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Brain className="w-4 h-4 text-indigo-400" />
                          Knowledge Graph Topology
                        </h3>
                        <button
                          onClick={handleResetAll}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Reset Neural Weights
                        </button>
                      </div>
                      <KnowledgeGraphVisualizer data={learningEngine.getGraphData()} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'setup' && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="p-4 md:p-8"
              >
                <div className="max-w-2xl mx-auto space-y-6">
                  <header>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Setup & Configuration</h2>
                    <p className="text-zinc-500 text-xs mt-1">Manage your Cassidey instance settings and data.</p>
                  </header>

                  {/* Gemini API Key */}
                  <div className="glass-panel rounded-[2rem] p-6 border-zinc-800/50 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-900/20 text-indigo-400">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Gemini API Key</h3>
                        <p className="text-[11px] text-zinc-500">Enable cloud-powered AI responses alongside local learning.</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="password"
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
                        placeholder="Enter your Gemini API key..."
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                      />
                      <button
                        onClick={handleSaveApiKey}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all active:scale-95"
                      >
                        Save
                      </button>
                    </div>

                    <AnimatePresence>
                      {showApiSaved && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 text-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">API key saved successfully</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {isGeminiConfigured() ? (
                      <div className="flex items-center gap-3 pt-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useGemini}
                            onChange={(e) => setUseGemini(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                        </label>
                        <span className="text-xs text-zinc-400">Use Gemini for chat responses</span>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                        <Info className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                          Get a free Gemini API key from{' '}
                          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                            Google AI Studio
                          </a>
                          {' '}to enable cloud-powered responses. Without it, Cassidey uses her local learning engine.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Data Management */}
                  <div className="glass-panel rounded-[2rem] p-6 border-zinc-800/50 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-900/20 text-emerald-400">
                        <Settings className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Data Management</h3>
                        <p className="text-[11px] text-zinc-500">Export, clear, or reset your learning data.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={handleExportData}
                        className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-[0.98] text-left group"
                      >
                        <Download className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                        <div>
                          <span className="text-sm font-medium text-zinc-300 block">Export Data</span>
                          <span className="text-[10px] text-zinc-600">Download backup JSON</span>
                        </div>
                      </button>

                      <button
                        onClick={handleClearChat}
                        className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-red-500/30 transition-all active:scale-[0.98] text-left group"
                      >
                        <Trash2 className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
                        <div>
                          <span className="text-sm font-medium text-zinc-300 block">Clear Chat</span>
                          <span className="text-[10px] text-zinc-600">{messages.length} messages</span>
                        </div>
                      </button>

                      <button
                        onClick={handleResetAll}
                        className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-red-500/30 transition-all active:scale-[0.98] text-left group"
                      >
                        <RefreshCw className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
                        <div>
                          <span className="text-sm font-medium text-zinc-300 block">Full Reset</span>
                          <span className="text-[10px] text-zinc-600">Erase all progress</span>
                        </div>
                      </button>

                      <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                        <div className="text-center flex-1">
                          <span className="text-[10px] text-zinc-600 block uppercase tracking-widest mb-1">Vocabulary</span>
                          <span className="text-lg font-mono text-indigo-400">{stats.totalIterations}</span>
                          <span className="text-[10px] text-zinc-600 ml-1">words learned</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* App Updates */}
                  <div className="glass-panel rounded-[2rem] p-6 border-zinc-800/50 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-900/20 text-indigo-400">
                        <Download className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-white">App Updates</h3>
                        <p className="text-[11px] text-zinc-500">Check for new versions and install in-app.</p>
                      </div>
                      {updateStatus === 'not_available' && (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                      <div>
                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest block">Current Version</span>
                        <span className="text-sm font-mono text-zinc-300">v{updateInfo?.currentVersion || '2.0.4'}</span>
                      </div>
                      {updateInfo?.latestVersion && (
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-600 uppercase tracking-widest block">Latest</span>
                          <span className={`text-sm font-mono ${updateInfo.available ? 'text-indigo-400' : 'text-zinc-400'}`}>
                            v{updateInfo.latestVersion}
                          </span>
                        </div>
                      )}
                    </div>

                    {updateStatus === 'available' && updateInfo && (
                      <div className="p-3 rounded-xl bg-indigo-900/10 border border-indigo-500/20 space-y-2">
                        <p className="text-[11px] text-indigo-300">
                          Update to <span className="font-bold">v{updateInfo.latestVersion}</span>
                          {updateInfo.apkSize > 0 && (
                            <span className="text-zinc-500"> ({formatBytes(updateInfo.apkSize)})</span>
                          )}
                        </p>
                        {updateInfo.releaseNotes && (
                          <p className="text-[10px] text-zinc-500 line-clamp-3 whitespace-pre-wrap">{updateInfo.releaseNotes}</p>
                        )}
                        <button
                          onClick={handleDownloadUpdate}
                          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Update
                        </button>
                      </div>
                    )}

                    {updateStatus === 'downloading' && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-zinc-400">Downloading update...</span>
                          <span className="text-indigo-400 font-mono">{downloadProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            animate={{ width: `${downloadProgress}%` }}
                            className="h-full bg-indigo-500 rounded-full"
                          />
                        </div>
                      </div>
                    )}

                    {updateStatus === 'downloaded' && (
                      <button
                        onClick={handleInstallUpdate}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Install Update Now
                      </button>
                    )}

                    {updateStatus === 'error' && updateError && (
                      <div className="p-3 rounded-xl bg-red-900/10 border border-red-500/20 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-[11px] text-red-300">{updateError}</p>
                          <button
                            onClick={() => { setUpdateStatus('idle'); setUpdateError(''); }}
                            className="text-[10px] text-red-400 underline mt-1"
                          >Dismiss</button>
                        </div>
                      </div>
                    )}

                    {(updateStatus === 'idle' || updateStatus === 'not_available' || updateStatus === 'checking') && (
                      <button
                        onClick={async () => {
                          try {
                            setUpdateStatus('checking');
                            setUpdateError('');
                            const info = await checkForUpdate();
                            setUpdateInfo(info);
                            setUpdateStatus(info.available ? 'available' : 'not_available');
                          } catch (err) {
                            setUpdateError(err instanceof Error ? err.message : 'Check failed');
                            setUpdateStatus('error');
                          }
                        }}
                        disabled={updateStatus === 'checking'}
                        className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                        {updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}
                      </button>
                    )}
                  </div>

                  {/* About */}
                  <div className="glass-panel rounded-[2rem] p-6 border-zinc-800/50 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">About Cassidey</h3>
                        <p className="text-[11px] text-zinc-500">Open-source offline AI assistant with self-learning capabilities.</p>
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-600 space-y-1 pl-11">
                      <p>Version 2.0.4 (patched)</p>
                      <p>Built with React + Tailwind CSS + D3.js</p>
                      <p>Learning engine runs 100% locally in your browser.</p>
                      <p>Source:{' '}
                        <a href="https://github.com/mrsaggynutz/https-github.com-mrsaggynutz-Cassidey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                          GitHub
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Persistent Bottom Tab Bar */}
      <nav className="h-24 bg-zinc-950/95 border-t border-zinc-900 flex items-center justify-around px-4 z-40 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] safe-area-bottom pb-4 backdrop-blur-md">
        <TabButton 
          icon={<MessageSquare className="w-5 h-5" />} 
          active={activeTab === 'chat'} 
          onClick={() => setActiveTab('chat')}
          label="Chat"
        />
        <TabButton 
          icon={<Zap className="w-5 h-5" />} 
          active={activeTab === 'skills'} 
          onClick={() => setActiveTab('skills')}
          label="Skills"
        />
        <TabButton 
          icon={<Brain className="w-5 h-5" />} 
          active={activeTab === 'brain'} 
          onClick={() => setActiveTab('brain')}
          label="Neural"
        />
        <TabButton 
          icon={<Settings className="w-5 h-5" />} 
          active={activeTab === 'setup'} 
          onClick={() => setActiveTab('setup')}
          label="Setup"
        />
      </nav>
    </div>
  );
}

function TabButton({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative px-4 pt-2",
        active ? "text-indigo-400" : "text-zinc-600"
      )}
    >
      <div className={cn(
        "transition-transform duration-300",
        active ? "scale-110 -translate-y-1" : "scale-100"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{label}</span>
      {active && (
        <motion.div 
          layoutId="activeIndicator"
          className="absolute -top-1 w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.8)]"
        />
      )}
    </button>
  );
}

function SuggestionCard({ text, onClick }: { text: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-left text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all active:scale-95 flex items-center justify-between group"
    >
      <span>{text}</span>
      <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-indigo-400 transition-colors" />
    </button>
  );
}

const SkillCard: React.FC<{ skill: Skill, progress: number }> = ({ skill, progress }) => {
  const isLocked = skill.level === 0;

  return (
    <div className={cn(
      "glass-panel rounded-2xl p-4 transition-all border relative overflow-hidden group",
      isLocked ? "border-zinc-800/30 opacity-50 grayscale" : "border-zinc-700 hover:border-indigo-500/50 shadow-lg hover:shadow-indigo-500/10"
    )}>
      {!isLocked && (
        <div className="absolute top-0 right-0 p-2 opacity-50 text-indigo-400">
           <Zap className="w-3 h-3" />
        </div>
      )}
      
      <div className="flex justify-between items-start mb-3">
        <div className={cn(
          "p-2 rounded-lg transition-colors",
          isLocked ? "bg-zinc-900" : "bg-indigo-900/10 text-indigo-400"
        )}>
          <SkillCategoryIcon category={skill.category} className="w-4 h-4" />
        </div>
        <div className="text-right">
          <div className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter",
            isLocked ? "bg-zinc-800 text-zinc-500" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
          )}>
            {isLocked ? "Locked" : `LVL ${skill.level}`}
          </div>
        </div>
      </div>
      
      <h4 className="text-sm font-bold text-zinc-100 mb-1 group-hover:text-indigo-300 transition-colors">{skill.name}</h4>
      <p className="text-[11px] text-zinc-500 mb-4 line-clamp-2 leading-relaxed">{skill.description}</p>
      
      <div className="space-y-3">
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {skill.abilities.map((ability, idx) => (
            <span key={idx} className={cn(
              "text-[9px] px-2 py-0.5 rounded border transition-all",
              skill.level >= (idx + 1) * 20 
                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20 font-medium" 
                : "bg-zinc-800/30 text-zinc-600 border-zinc-800/50"
            )}>
              {ability}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

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
    <div className="glass-panel p-6 rounded-3xl">
      <div className="flex items-center gap-2 mb-2 text-neutral-500">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white font-mono">{value}</div>
    </div>
  );
}
