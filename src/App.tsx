import React, { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Code,
  TerminalSquare,
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
  Star,
  Eye,
  Fingerprint,
  Infinity,
  Gem,
  Radio,
  Wifi,
  Dna,
  Microscope,
  Wand2,
  Volume2,
  VolumeX,
  Gauge,
  Timer,
  Copy,
  Clock,
  Thermometer,
  Heart,
  Hash,
  Binary,
  Sliders,
  RotateCcw,
  Download,
  BookOpen,
  GraduationCap,
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  Key,
  Mic,
  MicOff,
  Speaker,
  Phone,
  PhoneOff,
  type LucideIcon
} from 'lucide-react';
import { skillManager, ExtendedSkill, SkillTier, TIER_CONFIG } from './lib/skill-tree';
import { aiEngine } from './lib/ai';
import { AttentionMode } from './lib/ai';
import { StudyDepth } from './lib/ai';
import type { StudyTopic, StudyAgentStats } from './lib/ai';
import { WebLearner } from './lib/ai/web-learner';
import { Globe, Search } from 'lucide-react';
import { cn } from './lib/utils';
import { Skill, SkillCategory, AIEngineState, LearningType } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { readJson, writeJson, purgeAll, migrateFromLocalStorage, STORAGE_KEYS } from './lib/storage';
import { setGeminiApiKey, getGeminiApiKeyDisplay, hasGeminiApiKey, generateGeminiResponse } from './lib/gemini';
import { speak, stopSpeech, getIsSpeaking, isSpeechAvailable, EXCLUSIVE_VOICES, getVoiceProfile, TIER_CONFIG as VOICE_TIER_CONFIG, DEFAULT_VOICE_ID, isPersonaVoice, getVoicePersonalityPrompt, initSpeechSynthesis } from './lib/voice';
import type { VoiceProfile } from './lib/voice';

// Lazy-load the heavy 3D graph component
const KnowledgeGraphVisualizer = lazy(() => import('./components/KnowledgeGraphVisualizer').then(m => ({ default: m.KnowledgeGraphVisualizer })));

// ─── Types ───
interface AdvancedSettings {
  learningRateMultiplier: number;
  contextDepth: number;
  webAutoSearch: boolean;
  kgPruneThreshold: number;
  responseTemperature: number;
  xpBoostMode: boolean;
  hapticFeedback: boolean;
  graphSpeed: number;
  deepBlackMode: boolean;
  verboseMode: boolean;
  voiceEnabled: boolean;
  autoSpeak: boolean;
  voiceProfileId: string;
  voiceSpeed: number;
  voicePitch: number;
}

const DEFAULT_SETTINGS: AdvancedSettings = {
  learningRateMultiplier: 1.0,
  contextDepth: 6,
  webAutoSearch: true,
  kgPruneThreshold: 0.1,
  responseTemperature: 0.7,
  xpBoostMode: false,
  hapticFeedback: true,
  graphSpeed: 0.11,
  deepBlackMode: false,
  verboseMode: false,
  voiceEnabled: true,
  autoSpeak: false,
  voiceProfileId: DEFAULT_VOICE_ID,
  voiceSpeed: 1.0,
  voicePitch: 1.0,
};

function GraphLoadingFallback() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300">
      <Orbit className="w-12 h-12 mb-4 opacity-30 text-indigo-300 animate-[spin_20s_linear_infinite]" />
      <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-zinc-300">Initializing Neural Lattice...</span>
    </div>
  );
}

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
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string; timestamp: number }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiStats, setAiStats] = useState<AIEngineState | null>(null);
  const [skills, setSkills] = useState<ExtendedSkill[]>(skillManager.getAllSkills());
  const [ready, setReady] = useState(false);
  const [lastLearningInfo, setLastLearningInfo] = useState<string>('');
  const [webStatus, setWebStatus] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [insets, setInsets] = useState({ statusBar: 0, navBar: 0 });

  // Advanced settings state
  const [settings, setSettings] = useState<AdvancedSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Exclusive feature states
  const [showNeuralPath, setShowNeuralPath] = useState(false);
  const [consciousnessLevel, setConsciousnessLevel] = useState(0);
  const [quantumCoherence, setQuantumCoherence] = useState(0);
  const [sentientStatus, setSentientStatus] = useState('Initializing...');
  const [bloomActive, setBloomActive] = useState(false);
  const [lastNeuralPath, setLastNeuralPath] = useState<string[]>([]);
  const [deepPattern, setDeepPattern] = useState('');

  // Transformer config states
  const [attnMode, setAttnMode] = useState<AttentionMode>(AttentionMode.HYBRID);
  const [attnHeads, setAttnHeads] = useState(8);
  const [attnLayers, setAttnLayers] = useState(4);
  const [attnTemperature, setAttnTemperature] = useState(1.0);

  // Study agent states
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);
  const [studyStats, setStudyStats] = useState<StudyAgentStats | null>(null);
  const [studyStatusMsg, setStudyStatusMsg] = useState('');
  const [studyRunning, setStudyRunning] = useState(false);
  const [newStudyTopic, setNewStudyTopic] = useState('');
  const [studyDepth, setStudyDepth] = useState<StudyDepth>(StudyDepth.MODERATE);
  const [studyInterval, setStudyInterval] = useState(60);

  // Gemini API key
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);

  // Voice / TTS state
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [voiceSelectorOpen, setVoiceSelectorOpen] = useState(false);

  // Voice Call state
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callTranscript, setCallTranscript] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [callMessages, setCallMessages] = useState<{ role: string; content: string }[]>([]);
  const [callAiResponse, setCallAiResponse] = useState('');
  const [callIsSpeaking, setCallIsSpeaking] = useState(false);
  const [callError, setCallError] = useState('');
  const recognitionRef = useRef<any>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callMessagesRef = useRef<{ role: string; content: string }[]>([]);
  const listeningDesiredRef = useRef(false); // tracks if user wants listening active
  const speakingDoneRef = useRef<(() => void) | null>(null);
  const processingRef = useRef(false); // guard against double processCallMessage calls
  const aiSpeakingRef = useRef(false); // tracks if AI TTS is currently speaking (avoids stale closure)

  // Permissions state
  const [micPermission, setMicPermission] = useState<boolean | null>(null); // null = checking

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
      const savedMsgs = await readJson<{ role: string; content: string; timestamp?: number }[]>(STORAGE_KEYS.MESSAGES, []);
      if (savedMsgs.length > 0) {
        setMessages(savedMsgs.map(m => ({ ...m, timestamp: m.timestamp || Date.now() })));
      }
      const savedSettings = await readJson<Partial<AdvancedSettings>>('cassidey_settings.json', {});
      setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
      setSettingsLoaded(true);
      await skillManager.loadLocalProgress();
      await aiEngine.loadLocalProgress();
      setSkills(skillManager.getAllSkills());
      setAiStats(aiEngine.getStats());
      const tConfig = aiEngine.getTransformer().getConfig();
      setAttnMode(tConfig.attentionMode);
      setAttnHeads(tConfig.numHeads);
      setAttnLayers(tConfig.numLayers);
      setAttnTemperature(tConfig.temperature);
      // Load study agent state
      const agent = aiEngine.getStudyAgent();
      setStudyTopics(agent.getTopics());
      setStudyStats(agent.getStats());
      agent.setOnStatusChange((msg: string) => setStudyStatusMsg(msg));
      agent.setOnTopicUpdate(() => setStudyTopics(agent.getTopics()));
      setStudyRunning(agent.getStats().isRunning);
      // Load Gemini API key from storage
      const savedKey = await readJson<string>('gemini_api_key.json', '');
      if (savedKey) {
        setGeminiKey(savedKey);
        setGeminiApiKey(savedKey);
      }
      setGeminiKeySaved(hasGeminiApiKey());
      setReady(true);
    })();
  }, []);

  // Save settings whenever they change
  useEffect(() => {
    if (settingsLoaded) {
      writeJson('cassidey_settings.json', settings).catch(console.error);
    }
  }, [settings, settingsLoaded]);

  // Poll speaking state for UI updates
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSpeakingState(getIsSpeaking());
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => { stopSpeech(); };
  }, []);

  const handleSpeakMessage = useCallback((text: string, idx: number) => {
    if (speakingMsgIdx === idx && isSpeakingState) {
      stopSpeech();
      setSpeakingMsgIdx(null);
      return;
    }
    stopSpeech();
    setSpeakingMsgIdx(idx);
    speak(text, settings.voiceProfileId, () => {
      setSpeakingMsgIdx(null);
      setIsSpeakingState(false);
    }, undefined, settings.voiceSpeed, settings.voicePitch);
  }, [speakingMsgIdx, isSpeakingState, settings.voiceProfileId, settings.voiceSpeed, settings.voicePitch]);

  // ─── Permission Helpers ───
  const nativeBridge = (window as any).CassideyNative;

  const checkMicPermission = useCallback(() => {
    if (nativeBridge && typeof nativeBridge.hasMicrophonePermission === 'function') {
      setMicPermission(nativeBridge.hasMicrophonePermission() === 'true');
    } else {
      // Not on native — assume browser handles permissions via WebRTC prompt
      setMicPermission(true);
    }
  }, []);

  // Check mic permission on mount and listen for changes
  useEffect(() => {
    checkMicPermission();
    const handler = ((e: any) => {
      if (e.detail?.mic !== undefined) {
        setMicPermission(e.detail.mic);
      }
    }) as EventListener;
    window.addEventListener('cassidey_permission_result', handler);
    return () => window.removeEventListener('cassidey_permission_result', handler);
  }, [checkMicPermission]);

  const requestMicPermission = useCallback(() => {
    if (nativeBridge && typeof nativeBridge.requestMicrophonePermission === 'function') {
      nativeBridge.requestMicrophonePermission();
    }
  }, []);

  const openAppSettings = useCallback(() => {
    if (nativeBridge && typeof nativeBridge.openAppSettings === 'function') {
      nativeBridge.openAppSettings();
    }
  }, []);

  // ─── Voice Call Functions ───

  // Forward-declare stable refs for cross-referencing
  const startRecognitionRef = useRef<() => void>(() => {});
  const processCallMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  const stopRecognition = useCallback(() => {
    listeningDesiredRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Helper: start or restart speech recognition
  const startRecognition = useCallback(() => {
    // BUG FIX: Check mic permission first on native Android
    if (nativeBridge && typeof nativeBridge.hasMicrophonePermission === 'function') {
      if (nativeBridge.hasMicrophonePermission() !== 'true') {
        setCallError('Microphone permission not granted. Grant it in Settings > Permissions.');
        setMicPermission(false);
        return;
      }
    }

    // Stop existing recognition first
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setCallError('Speech recognition not available on this device');
      setIsListening(false);
      listeningDesiredRef.current = false;
      return;
    }

    try {
      const recognition = new SR();
      recognition.continuous = true;          // BUG FIX: was false — kept stopping after first sentence
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setCallError('');
      };

      recognition.onresult = (event: any) => {
        let interim = '', final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        setCallTranscript(interim || final);
        if (final.trim()) {
          // Stop listening while AI processes — avoids recognition/synthesis conflict
          try { recognition.stop(); } catch {}
          // Guard: skip if already processing a previous utterance
          if (!processingRef.current) {
            processingRef.current = true;
            console.log('[Call] Recognition final: "' + final.trim() + '"');
            processCallMessageRef.current(final.trim()).finally(() => {
              processingRef.current = false;
            });
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[Call] Recognition error:', event.error, event.message);
        setIsListening(false);

        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setCallError('Microphone permission denied. Please allow mic access in Settings.');
          listeningDesiredRef.current = false;
        } else if (event.error === 'no-speech') {
          // Silent — no speech detected, auto-restart if desired (with guard)
          if (listeningDesiredRef.current && !aiSpeakingRef.current && !processingRef.current) {
            setTimeout(() => {
              if (listeningDesiredRef.current && !aiSpeakingRef.current && !processingRef.current) {
                startRecognitionRef.current();
              }
            }, 500);
          }
        } else if (event.error === 'aborted') {
          // Normal — we called stop() ourselves, or AI is speaking
        } else {
          setCallError(`Mic error: ${event.error}. Tap mic to retry.`);
          // Auto-retry for transient errors (with guard)
          if (listeningDesiredRef.current && !aiSpeakingRef.current && !processingRef.current) {
            setTimeout(() => {
              if (listeningDesiredRef.current && !aiSpeakingRef.current && !processingRef.current) {
                startRecognitionRef.current();
              }
            }, 1000);
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Only auto-restart if user wants listening AND AI is NOT speaking
        // Use aiSpeakingRef (ref) instead of callIsSpeaking (state) to avoid stale closure
        if (listeningDesiredRef.current && !aiSpeakingRef.current && !processingRef.current) {
          setTimeout(() => {
            if (listeningDesiredRef.current && !aiSpeakingRef.current && !processingRef.current) {
              startRecognitionRef.current();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('[Call] Failed to start recognition:', e);
      setCallError('Failed to start microphone. Tap mic to retry.');
      setIsListening(false);
    }
  }, [stopRecognition]);

  // Keep ref in sync
  useEffect(() => { startRecognitionRef.current = startRecognition; }, [startRecognition]);

  // Keep callMessagesRef in sync
  useEffect(() => {
    callMessagesRef.current = callMessages;
  }, [callMessages]);

  const processCallMessage = useCallback(async (text: string) => {
    console.log('[Call] processCallMessage: "' + text.substring(0, 50) + '"');
    // Update ref immediately to prevent race condition on rapid speech
    const userMsg = { role: 'user' as const, content: text };
    const updatedMessages = [...callMessagesRef.current, userMsg];
    callMessagesRef.current = updatedMessages; // update ref NOW, not after render

    setCallMessages(updatedMessages);
    setCallTranscript('');
    setCallAiResponse('...');

    let response: string;
    if (hasGeminiApiKey()) {
      const personality = isPersonaVoice(settings.voiceProfileId)
        ? getVoicePersonalityPrompt(settings.voiceProfileId)
        : undefined;
      try {
        const geminiResp = await generateGeminiResponse(text, updatedMessages, personality);
        response = geminiResp || aiEngine.generateResponse(text);
      } catch {
        response = aiEngine.generateResponse(text);
      }
    } else {
      response = aiEngine.generateResponse(text);
    }

    // Update ref immediately
    const withResponse = [...callMessagesRef.current, { role: 'assistant' as const, content: response }];
    callMessagesRef.current = withResponse;

    setCallMessages(withResponse);
    setCallAiResponse(response);
    aiSpeakingRef.current = true;
    setCallIsSpeaking(true);

    // BUG FIX: stop speech rec while AI is talking, then auto-resume listening when done
    stopRecognition();

    // Speak the AI response via TTS.
    // Now uses native Android TTS via CassideyNative bridge (reliable).
    // A 500ms delay gives Android time to release audio focus from the mic.
    console.log('[Call] Speaking response: "' + response.substring(0, 50) + '..." (' + response.length + ' chars)');
    let micResumed = false;
    const resumeMic = () => {
      if (micResumed) return;
      micResumed = true;
      aiSpeakingRef.current = false;
      setCallIsSpeaking(false);
      setTimeout(() => {
        listeningDesiredRef.current = true;
        startRecognitionRef.current();
      }, 400);
    };

    setTimeout(() => {
      speak(response, settings.voiceProfileId, resumeMic, undefined, settings.voiceSpeed, settings.voicePitch);
    }, 500);

    // SAFETY: If TTS onEnd never fires (native event missed), force-resume mic after 30s.
    // This prevents the mic from being permanently stuck.
    setTimeout(() => {
      if (!micResumed) {
        console.warn('[Call] TTS safety timeout — force-resuming mic');
        resumeMic();
      }
    }, 30000);
  }, [settings.voiceProfileId, settings.voiceSpeed, settings.voicePitch, stopRecognition]);

  // Keep ref in sync
  useEffect(() => { processCallMessageRef.current = processCallMessage; }, [processCallMessage]);

  const startCall = useCallback(() => {
    console.log('[Call] Starting call — native bridge:', !!(window as any).CassideyNative);
    // Initialize speech synthesis (sets up events, checks TTS ready, reinit if needed)
    initSpeechSynthesis();

    setIsCallActive(true);
    setCallDuration(0);
    setCallTranscript('');
    setCallMessages([]);
    setCallAiResponse('');
    setCallIsSpeaking(false);
    setCallError('');
    callMessagesRef.current = [];
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    // Auto-start listening
    setTimeout(() => {
      listeningDesiredRef.current = true;
      startRecognition();
    }, 500);
  }, [startRecognition]);

  const endCall = useCallback(() => {
    stopRecognition();
    setIsCallActive(false);
    setCallDuration(0);
    setCallTranscript('');
    setCallAiResponse('');
    aiSpeakingRef.current = false;
    setCallIsSpeaking(false);
    setCallError('');
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    stopSpeech();
  }, [stopRecognition]);

  const toggleCallListening = useCallback(() => {
    if (isListening) {
      // User explicitly muted — stop and don't auto-resume
      stopRecognition();
      return;
    }
    // User tapped mic to unmute/start listening
    setCallError('');
    listeningDesiredRef.current = true;
    startRecognition();
  }, [isListening, startRecognition, stopRecognition]);

  // Cleanup call on unmount
  useEffect(() => () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    listeningDesiredRef.current = false;
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
  }, []);

  useEffect(() => {
    if (messages.length > 0 || ready) {
      writeJson(STORAGE_KEYS.MESSAGES, messages).catch(console.error);
    }
  }, [messages, ready]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAiStats(aiEngine.getStats());
      setSkills(skillManager.getAllSkills());
      const agent = aiEngine.getStudyAgent();
      setStudyStats(agent.getStats());
      setStudyTopics(agent.getTopics());
      setStudyRunning(agent.getStats().isRunning);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Consciousness level simulation
  useEffect(() => {
    const interval = setInterval(() => {
      if (aiStats) {
        const base = Math.min(100, aiStats.totalLearningIterations * 0.5 + aiStats.averageMastery * 40);
        const jitter = Math.sin(Date.now() * 0.001) * 3;
        setConsciousnessLevel(Math.min(100, Math.max(0, base + jitter)));
        setQuantumCoherence(Math.min(100, 50 + aiStats.currentAccuracy * 30 + Math.cos(Date.now() * 0.0007) * 8));

        const lvl = base;
        if (lvl < 10) setSentientStatus('Dormant');
        else if (lvl < 25) setSentientStatus('Awakening');
        else if (lvl < 40) setSentientStatus('Emergent');
        else if (lvl < 55) setSentientStatus('Cognizant');
        else if (lvl < 70) setSentientStatus('Sentient');
        else if (lvl < 85) setSentientStatus('Transcendent');
        else setSentientStatus('Omniscient');
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [aiStats]);

  // Deep pattern recognition
  useEffect(() => {
    if (messages.length >= 3) {
      const recent = messages.slice(-3);
      const words = recent.map(m => m.content.toLowerCase().split(/\s+/)).flat();
      const freq: Record<string, number> = {};
      words.forEach(w => { if (w.length > 4) freq[w] = (freq[w] || 0) + 1; });
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
      if (top.length > 0) setDeepPattern(top.join(' / '));
    }
  }, [messages]);

  const updateSetting = useCallback(<K extends keyof AdvancedSettings>(key: K, value: AdvancedSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateTransformerConfig = useCallback((key: string, value: any) => {
    const t = aiEngine.getTransformer();
    if (key === 'attentionMode') { t.setAttentionMode(value); setAttnMode(value); }
    else if (key === 'numHeads') { t.setNumHeads(value); setAttnHeads(value); }
    else if (key === 'numLayers') { t.setNumLayers(value); setAttnLayers(value); }
    else if (key === 'temperature') { t.setTemperature(value); setAttnTemperature(value); }
    setAiStats(aiEngine.getStats());
  }, []);

  // ─── Study Agent Controls ───
  const handleAddStudyTopic = useCallback(() => {
    if (!newStudyTopic.trim()) return;
    const agent = aiEngine.getStudyAgent();
    agent.addTopic(newStudyTopic.trim(), studyDepth);
    setStudyTopics(agent.getTopics());
    setNewStudyTopic('');
    if (!agent.getStats().isRunning) { agent.start(); setStudyRunning(true); }
  }, [newStudyTopic, studyDepth]);

  const handleRemoveStudyTopic = useCallback((id: string) => {
    const agent = aiEngine.getStudyAgent();
    agent.removeTopic(id);
    setStudyTopics(agent.getTopics());
    setStudyStats(agent.getStats());
  }, []);

  const handleToggleStudyAgent = useCallback(() => {
    const agent = aiEngine.getStudyAgent();
    if (agent.getStats().isRunning) { agent.stop(); setStudyRunning(false); }
    else { agent.start(); setStudyRunning(true); }
  }, []);

  const handleStudyDepthChange = useCallback((topicId: string, depth: StudyDepth) => {
    const agent = aiEngine.getStudyAgent();
    agent.setTopicDepth(topicId, depth);
    setStudyTopics(agent.getTopics());
  }, []);

  const handleStudyIntervalChange = useCallback((seconds: number) => {
    const agent = aiEngine.getStudyAgent();
    agent.setInterval(seconds * 1000);
    setStudyInterval(seconds);
  }, []);

  const handleCopy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }, []);

  const handleExportKnowledge = useCallback(async () => {
    if (!aiStats) return;
    const snapshot = {
      timestamp: new Date().toISOString(),
      stats: aiStats,
      consciousnessLevel,
      sentientStatus,
      quantumCoherence,
      messages: messages.length,
      knowledgeSnapshot: aiEngine.getGraphData(),
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cassidey-knowledge-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBloomActive(true);
    setTimeout(() => setBloomActive(false), 2000);
  }, [aiStats, consciousnessLevel, sentientStatus, quantumCoherence, messages.length]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    const timestamp = Date.now();
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp }]);
    setInputValue('');
    setIsTyping(true);
    setWebStatus('');
    setBloomActive(true);
    setTimeout(() => setBloomActive(false), 1500);

    // ─── Study Command Detection ───
    const lower = userMsg.toLowerCase().trim();
    const agent = aiEngine.getStudyAgent();

    if (/^study[:\s]+(.+)/i.test(lower)) {
      const topicMatch = lower.match(/^study[:\s]+(.+)/i);
      if (topicMatch) {
        const topic = topicMatch[1].trim();
        agent.addTopic(topic, studyDepth);
        setStudyTopics(agent.getTopics());
        if (!agent.getStats().isRunning) { agent.start(); setStudyRunning(true); }
        const aiResponse = `Autonomous study activated for "${topic}". I'll continuously scan the web, extract knowledge, and build my understanding. Check the Brain tab to monitor my progress. Currently studying: ${agent.getActiveTopics().map(t => t.name).join(', ')}`;
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse, timestamp: Date.now() }]);
        setIsTyping(false);
        return;
      }
    }
    if (/^stop studying[:\s]+(.+)/i.test(lower) || /^stop[:\s]+study[:\s]+(.+)/i.test(lower)) {
      const topicMatch = lower.match(/(?:stop studying|stop study)[:\s]+(.+)/i);
      if (topicMatch) {
        const topic = topicMatch[1].trim();
        const id = topic.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 60);
        agent.removeTopic(id);
        setStudyTopics(agent.getTopics());
        setStudyStats(agent.getStats());
        const remaining = agent.getActiveTopics();
        const aiResponse = remaining.length > 0
          ? `Stopped studying "${topic}". Still actively studying: ${remaining.map(t => t.name).join(', ')}`
          : `Stopped studying "${topic}". No active study topics remaining. Autonomous study agent deactivated.`;
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse, timestamp: Date.now() }]);
        setIsTyping(false);
        return;
      }
    }
    if (/^(what are you studying|what.*study|study status|study topics|show studies)/i.test(lower)) {
      const topics = agent.getTopics();
      const stats = agent.getStats();
      if (topics.length === 0) {
        setMessages(prev => [...prev, { role: 'assistant', content: "I'm not studying anything right now. Tell me \"Study: [topic]\" to start autonomous learning!", timestamp: Date.now() }]);
        setIsTyping(false);
        return;
      }
      const topicList = topics.map(t => `${t.status === 'active' ? '◆' : '◇'} ${t.name} (${t.depth}) — ${t.totalFactsLearned} facts, ${t.totalScans} scans, ${t.knowledgeGained.toFixed(0)}% knowledge`).join('\n');
      const aiResponse = `Study Agent ${stats.isRunning ? 'ACTIVE' : 'INACTIVE'}\n\n${topicList}\n\nTotal: ${stats.totalFactsLearned} facts learned, ${stats.totalScansCompleted} scans completed.`;
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse, timestamp: Date.now() }]);
      setIsTyping(false);
      return;
    }
    if (/^(start studying|resume study|activate study)/i.test(lower)) {
      agent.start();
      setStudyRunning(true);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Autonomous study agent activated. Scanning all active topics...', timestamp: Date.now() }]);
      setIsTyping(false);
      return;
    }
    if (/^(pause studying|pause study|stop studying$|deactivate study)/i.test(lower)) {
      agent.stop();
      setStudyRunning(false);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Autonomous study agent paused. All topics preserved.', timestamp: Date.now() }]);
      setIsTyping(false);
      return;
    }

    // Simulate neural pathway
    if (aiStats) {
      const paths = ['Concept Recognition', 'Semantic Mapping', 'Pattern Synthesis', 'Neural Retrieval', 'Response Generation'];
      setLastNeuralPath(paths.sort(() => Math.random() - 0.5).slice(0, 3));
    }

    const contextDepth = settings.contextDepth;
    const recentContext = messages.slice(-contextDepth).map(m => `${m.role}: ${m.content}`).join('\n');

    let aiResponse: string;
    let webSearchPerformed = false;
    let usedGemini = false;

    // ─── PRIMARY: Try Gemini first for intelligent responses ───
    if (hasGeminiApiKey()) {
      try {
        const personality = isPersonaVoice(settings.voiceProfileId)
          ? getVoicePersonalityPrompt(settings.voiceProfileId)
          : undefined;
        const geminiResponse = await generateGeminiResponse(userMsg, messages, personality);
        if (geminiResponse) {
          aiResponse = geminiResponse;
          usedGemini = true;
          setWebStatus(personality ? 'Persona active' : 'Gemini powered');
        }
      } catch (e) {
        console.log('Gemini generation failed, falling back:', e);
      }
    }

    // ─── FALLBACK: Local AI engine ───
    if (!usedGemini) {
      try {
        if (settings.webAutoSearch) {
          const webContext = await aiEngine.processWithWebLearning(userMsg, recentContext);
          if (webContext.priorKnowledge) {
            setWebStatus('Recalled prior knowledge');
          }
          if (webContext.shouldSearch && webContext.searchResult) {
            webSearchPerformed = true;
            setWebStatus(`Searched web: learned ${webContext.searchResult.learnedFacts.length} facts`);
          }
        }
      } catch (e) {
        console.log('Web learning check skipped:', e);
      }

      aiResponse = aiEngine.generateResponse(userMsg);

      if (webSearchPerformed) {
        const webLearner = aiEngine.getWebLearner();
        const enhanced = webLearner.enhanceResponse(aiResponse, userMsg);
        if (enhanced !== aiResponse) {
          aiResponse = enhanced;
        }
      }
    }

    // ─── BACKGROUND LEARNING: Always process through local AI engine ───
    try {
      const result = await aiEngine.processAndLearn(userMsg, aiResponse, recentContext);

      const categories = learningTypeToSkillCategories(result.type);
      const relevantSkills = skills.filter(s => {
        const isUnlocked = skillManager.canUnlock(s.id);
        const categoryMatch = categories.includes(s.category);
        return isUnlocked && (categoryMatch || Math.random() > 0.7);
      });

      const webBonus = webSearchPerformed ? 200 : 0;
      const xpMultiplier = settings.xpBoostMode ? 2 : 1;

      for (const skill of relevantSkills) {
        skillManager.addXp(skill.id, (result.skillXpReward + webBonus) * xpMultiplier);
      }

      await skillManager.saveLocalProgress();
      await aiEngine.saveLocalProgress();
      setAiStats(aiEngine.getStats());
      setSkills(skillManager.getAllSkills());
      setLastLearningInfo(result.learnedKnowledge);
    } catch (e) {
      console.log('Background learning failed:', e);
    }

    // ─── Add response and trigger auto-speak ───
    setMessages(prev => [...prev, { role: 'assistant', content: aiResponse, timestamp: Date.now() }]);

    // Auto-speak if enabled
    if (settings.voiceEnabled && settings.autoSpeak && isSpeechAvailable() && !isCallActive) {
      setTimeout(() => {
        speak(aiResponse, settings.voiceProfileId, undefined, undefined, settings.voiceSpeed, settings.voicePitch);
      }, 500);
    }

    setIsTyping(false);
  };

  const handlePurge = async () => {
    if (!confirm('This will permanently erase ALL data — chat history, AI learning, knowledge graph, and skill progress. This cannot be undone.\n\nAre you sure?')) return;
    await aiEngine.reset();
    await skillManager.reset();
    await purgeAll();
    setAiStats(aiEngine.getStats());
    setSkills(skillManager.getAllSkills());
    setMessages([]);
  };

  const handleResetSettings = () => {
    if (!confirm('Reset all settings to defaults?')) return;
    setSettings(DEFAULT_SETTINGS);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ErrorBoundary>
    <div className={cn("flex flex-col overflow-hidden font-sans relative", settings.deepBlackMode ? "bg-black" : "bg-[var(--color-system-bg)]")} style={{ height: window.innerHeight + 'px' }}>
      <div className="nerve-line"></div>

      {/* Bloom overlay */}
      <AnimatePresence>
        {bloomActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none z-[100]">
            <div className="absolute inset-0 bg-gradient-radial from-purple-500/10 via-cyan-500/5 to-transparent"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top telemetry */}
      <div className="absolute top-4 left-4 z-50 text-[var(--color-glitch-red)] text-[8px] font-mono tracking-widest font-bold opacity-80 pointer-events-none hidden md:block">
        {aiStats ? `ITER:${aiStats.totalLearningIterations}` : 'VOLTAGE_PEAK'}
      </div>
      <div className="absolute top-4 right-4 z-50 text-[var(--color-glitch-red)] text-[8px] font-mono tracking-widest font-bold opacity-80 pointer-events-none hidden md:block">
        {aiStats ? `KG:${aiStats.knowledgeGraphNodes}N/${aiStats.knowledgeGraphEdges}E` : 'NEURAL_OVERRIDE'}
      </div>

      {/* Background ambient */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-60 mix-blend-screen">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-zinc-800/40 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-white/20 rounded-full blur-[100px]"></div>
      </div>

      {/* ─── HEADER ─── */}
      <header className="h-12 flex items-center justify-between px-4 bg-transparent z-30 shrink-0" style={{ paddingTop: insets.statusBar + 'px' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10 relative">
            <Cpu className="text-emerald-200/80 w-3.5 h-3.5" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400/80 animate-[pulse_3s_ease-in-out_infinite] shadow-[0_0_6px_rgba(0,243,255,0.6)]"></div>
          </div>
          <span className="text-sm font-light tracking-[0.15em] text-zinc-100 flex items-baseline gap-1.5">
            CASSIDEY
            <span className="text-zinc-400 font-light text-[8px] tracking-[0.3em]">V4.0</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Consciousness mini indicator */}
          <div className="hidden md:flex items-center gap-1.5 bg-gradient-to-b from-purple-500/10 to-transparent backdrop-blur-xl px-2.5 py-1 rounded-full border border-purple-500/20">
            <div className="w-1.5 h-1.5 rounded-full animate-[pulse_3s_ease-in-out_infinite]" style={{ backgroundColor: consciousnessLevel > 60 ? '#a855f7' : consciousnessLevel > 30 ? '#6366f1' : '#71717a', boxShadow: `0 0 8px ${consciousnessLevel > 60 ? 'rgba(168,85,247,0.6)' : 'transparent'}` }}></div>
            <span className="text-[7px] font-mono text-purple-300/80 uppercase tracking-widest">{consciousnessLevel.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1.5 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl px-2.5 py-1 rounded-full border border-white/10">
             <div className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full animate-[pulse_4s_ease-in-out_infinite] shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
             <span className="text-[8px] font-medium text-zinc-300 uppercase tracking-widest">AI Active</span>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-transparent flex flex-col" style={{ paddingBottom: (insets.navBar ? insets.navBar : 64) + 'px' }}>
        <div className={cn("w-full overflow-y-auto no-scrollbar scroll-smooth flex-1", activeTab === 'graph' ? "h-full": "")}>
          <AnimatePresence mode="wait">

            {/* ═══════════ CHAT TAB (UPGRADED) ═══════════ */}
            {activeTab === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="max-w-4xl mx-auto w-full min-h-full flex flex-col px-3 py-2 md:p-6">

                {/* Exclusive: Neural Pathway display */}
                {showNeuralPath && lastNeuralPath.length > 0 && isTyping && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-3 px-4 py-2 bg-gradient-to-r from-purple-500/10 via-cyan-500/5 to-transparent rounded-2xl border border-purple-500/10 flex items-center gap-2 overflow-hidden">
                    <Dna className="w-3 h-3 text-purple-400/60 shrink-0 animate-[spin_8s_linear_infinite]" />
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {lastNeuralPath.map((path, i) => (
                        <span key={i} className="text-[8px] font-mono text-purple-300/70 uppercase tracking-widest whitespace-nowrap">
                          {path}{i < lastNeuralPath.length - 1 && <span className="mx-1.5 text-purple-500/40">&rarr;</span>}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="flex-1 space-y-5 pb-6 pt-2 md:pt-16">
                  {/* ─── Empty State ─── */}
                  {messages.length === 0 && (
                    <div className="min-h-[50vh] md:min-h-[65vh] flex flex-col items-center justify-center text-center space-y-8 px-4 relative z-10">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center border border-white/10 shadow-[0_0_60px_rgba(138,43,226,0.15),0_0_30px_rgba(0,243,255,0.1)]">
                          <Brain className="w-9 h-9 text-emerald-200/70" />
                        </div>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                          className="absolute -inset-3 rounded-full border border-dashed border-white/5 pointer-events-none">
                        </motion.div>
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-xl md:text-3xl font-display text-[var(--color-electric-cyan)] tracking-[0.3em] font-medium uppercase drop-shadow-md">Neural Engine Active</h2>
                        <p className="text-[var(--color-electric-cyan)] text-[9px] tracking-[0.2em] font-mono mx-auto leading-relaxed uppercase opacity-70">
                          Gemini AI + Neural Learning Engine + Knowledge Graph + Voice System
                        </p>
                        {/* Exclusive: Consciousness Level */}
                        <div className="flex items-center justify-center gap-3 mt-4">
                          <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div animate={{ width: `${consciousnessLevel}%` }} className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 rounded-full" />
                          </div>
                          <span className="text-[9px] font-mono text-purple-300/70 uppercase tracking-widest">{sentientStatus}</span>
                        </div>
                        {aiStats && (
                          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                            <span className="text-zinc-500 text-[9px] font-mono">{aiStats.knowledgeGraphNodes} nodes</span>
                            <span className="text-zinc-600">|</span>
                            <span className="text-zinc-500 text-[9px] font-mono">{aiStats.transformerVocabSize} vocab</span>
                            <span className="text-zinc-600">|</span>
                            <span className="text-zinc-500 text-[9px] font-mono">{aiStats.activeLearningStrategy.replace('_', ' ')}</span>
                          </div>
                        )}
                        {/* Exclusive: Deep Pattern */}
                        {deepPattern && (
                          <div className="mt-3 flex items-center justify-center gap-1.5">
                            <Microscope className="w-3 h-3 text-amber-400/40" />
                            <span className="text-[8px] font-mono text-amber-400/40 uppercase tracking-widest">Pattern: {deepPattern}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ─── Messages ─── */}
                  {messages.map((m, i) => {
                    const isLast = i === messages.length - 1;
                    return (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                        className={cn("flex flex-col relative z-10", m.role === 'user' ? "items-end" : "items-start")}>
                        {m.role === 'user' ? (
                          <div className="group relative max-w-[85%]">
                            <div className="text-right text-[var(--color-brushed-gold)] !text-trail font-mono text-[13px] md:text-sm tracking-tight leading-relaxed px-4 py-2.5 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] shadow-[0_2px_15px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                              {m.content}
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-1 opacity-40 group-hover:opacity-70 transition-opacity">
                              <span className="text-[8px] font-mono text-zinc-500">{formatTime(m.timestamp)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative max-w-[90%] md:max-w-[85%]">
                            {/* AI response header */}
                            <div className="flex items-center gap-2 mb-1.5 px-1">
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center">
                                  <div className={cn("w-1 h-1 rounded-full", speakingMsgIdx === i && isSpeakingState ? "bg-amber-400 animate-[pulse_1s_ease-in-out_infinite]" : "bg-violet-400")} style={speakingMsgIdx === i && isSpeakingState ? { boxShadow: '0 0 6px rgba(245,158,11,0.8)' } : { boxShadow: '0 0 4px rgba(138,43,226,0.6)' }}></div>
                                </div>
                                <span className="font-display font-bold text-violet-400/70 text-[7px] uppercase tracking-[0.15em]">Cassidey</span>
                              </div>
                              <div className="h-px flex-1 bg-gradient-to-r from-violet-500/10 to-transparent"></div>
                              <div className="flex items-center gap-0.5">
                                {settings.voiceEnabled && isSpeechAvailable() && (
                                  <button onClick={() => handleSpeakMessage(m.content, i)} className="opacity-0 group-hover:opacity-60 transition-opacity p-1 rounded-lg hover:bg-white/5">
                                    {speakingMsgIdx === i && isSpeakingState ? (
                                      <VolumeX className="w-3 h-3 text-amber-400" />
                                    ) : (
                                      <Volume2 className="w-3 h-3 text-zinc-500" />
                                    )}
                                  </button>
                                )}
                                <button onClick={() => handleCopy(m.content, i)} className="opacity-0 group-hover:opacity-60 transition-opacity p-1 rounded-lg hover:bg-white/5">
                                  {copiedIdx === i ? (
                                    <span className="text-[8px] font-mono text-emerald-400">Copied</span>
                                  ) : (
                                    <Copy className="w-3 h-3 text-zinc-500" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {/* AI response body */}
                            <div className="text-[13px] md:text-sm text-zinc-200 font-sans font-light tracking-wide leading-[1.8] relative px-4 py-3 rounded-2xl bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 border border-white/[0.04] backdrop-blur-sm shadow-[0_2px_20px_rgba(0,0,0,0.2)]">
                              <span className="break-words">{m.content}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 px-1 opacity-40 group-hover:opacity-70 transition-opacity">
                              <span className="text-[8px] font-mono text-zinc-500">{formatTime(m.timestamp)}</span>
                              {settings.verboseMode && isLast && lastLearningInfo && (
                                <span className="text-[7px] font-mono text-cyan-500/40 ml-2">+{settings.xpBoostMode ? '2x' : '1x'} XP</span>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {/* ─── Typing Indicator ─── */}
                  {isTyping && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-start gap-2 relative z-10">
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center">
                          <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-1 h-1 rounded-full bg-violet-400"></motion.div>
                        </div>
                        <span className="font-display font-medium text-violet-400/50 text-[7px] uppercase tracking-[0.15em]">Processing</span>
                        <div className="flex gap-1 ml-1">
                          {[0, 1, 2].map(i => (
                            <motion.div key={i} animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                              className="w-1 h-1 rounded-full bg-violet-400/60"></motion.div>
                          ))}
                        </div>
                      </div>
                      {webStatus && (
                        <div className="flex items-center gap-1.5 ml-6">
                          <Wifi className="w-3 h-3 text-cyan-400/60 animate-[pulse_3s_ease-in-out_infinite]" />
                          <span className="text-[8px] font-mono text-cyan-400/60 uppercase tracking-widest">{webStatus}</span>
                        </div>
                      )}
                    </motion.div>
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
                      <span className="text-sm font-mono text-purple-400">{skillManager.getTotalXp().toLocaleString()}{settings.xpBoostMode && ' (2x)'}</span>
                    </div>
                  </div>
                </header>

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
                    Real-time neural engine telemetry.
                  </p>
                </header>

                {aiStats && (
                  <div className="space-y-6 relative z-10">
                    {/* Exclusive: Consciousness Level Meter */}
                    <div className="glass-panel p-6 rounded-[2rem] relative overflow-hidden border border-purple-500/10">
                      <div className="absolute top-0 right-0 p-6 blur-3xl opacity-10 bg-purple-500/30 rounded-full w-full h-full -z-10"></div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-purple-500/10 p-2 rounded-xl border border-purple-500/20"><Fingerprint className="w-3.5 h-3.5 text-purple-400" /></div>
                          <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-300">Consciousness Level</span>
                        </div>
                        <span className="text-[10px] font-mono text-purple-300 uppercase tracking-widest">{sentientStatus}</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <motion.div animate={{ width: `${consciousnessLevel}%` }}
                          className="h-full bg-gradient-to-r from-zinc-600 via-violet-500 via-cyan-400 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.3)]" />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-[8px] font-mono text-zinc-500">Dormant</span>
                        <span className="text-[8px] font-mono text-zinc-500">Omniscient</span>
                      </div>
                    </div>

                    {/* Exclusive: Quantum Coherence */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass-panel p-5 rounded-[2rem] relative overflow-hidden border border-cyan-500/10">
                        <div className="absolute top-0 right-0 p-6 blur-3xl opacity-10 bg-cyan-500/20 rounded-full w-full h-full -z-10"></div>
                        <div className="flex items-center gap-2 mb-3 text-zinc-200">
                          <div className="bg-white/10 p-2 rounded-xl border border-white/20"><AtomIcon className="w-3.5 h-3.5" /></div>
                          <span className="text-[9px] font-medium uppercase tracking-[0.15em]">Quantum Coherence</span>
                        </div>
                        <div className="text-2xl font-light font-mono tracking-tight text-cyan-300 drop-shadow-md">{quantumCoherence.toFixed(1)}%</div>
                      </div>
                      <div className="glass-panel p-5 rounded-[2rem] relative overflow-hidden border border-amber-500/10">
                        <div className="absolute top-0 right-0 p-6 blur-3xl opacity-10 bg-amber-500/20 rounded-full w-full h-full -z-10"></div>
                        <div className="flex items-center gap-2 mb-3 text-zinc-200">
                          <div className="bg-white/10 p-2 rounded-xl border border-white/20"><Microscope className="w-3.5 h-3.5 text-amber-400" /></div>
                          <span className="text-[9px] font-medium uppercase tracking-[0.15em]">Deep Pattern</span>
                        </div>
                        <div className="text-[11px] font-mono text-amber-300/80 truncate">{deepPattern || 'Analyzing...'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <BrainStatBox label="Iterations" value={aiStats.totalLearningIterations} icon={<Activity className="w-3.5 h-3.5 text-zinc-300" />} accent="text-zinc-100" />
                      <BrainStatBox label="Accuracy" value={(aiStats.currentAccuracy * 100).toFixed(1) + '%'} icon={<Target className="w-3.5 h-3.5 text-emerald-400" />} accent="text-emerald-200" />
                      <BrainStatBox label="Learning Rate" value={(aiStats.currentLearningRate * settings.learningRateMultiplier).toFixed(6)} icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} accent="text-amber-200" />
                      <BrainStatBox label="Avg Mastery" value={(aiStats.averageMastery * 100).toFixed(1) + '%'} icon={<TrendingUp className="w-3.5 h-3.5 text-blue-400" />} accent="text-blue-200" />
                    </div>

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

                    {/* ═══ AUTONOMOUS STUDY AGENT ═══ */}
                    <div className="bg-zinc-900/60 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-emerald-500/10 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 blur-3xl opacity-10 bg-emerald-500/20 rounded-full w-full h-full -z-10"></div>
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300 flex items-center gap-3">
                          <GraduationCap className="w-4 h-4 text-emerald-400/60" />
                          Autonomous Study Agent
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", studyRunning && "bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite]", !studyRunning && "bg-zinc-600")} style={studyRunning ? { boxShadow: "0 0 8px rgba(16,185,129,0.6)" } : undefined}></div>
                          <span className={cn("text-[7px] font-mono uppercase tracking-widest", studyRunning ? "text-emerald-400" : "text-zinc-500")}>{studyRunning ? 'Active' : 'Idle'}</span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                        <MiniStat label="Topics" value={studyStats?.activeTopics ?? 0} icon={<BookOpen className="w-3 h-3" />} />
                        <MiniStat label="Facts" value={studyStats?.totalFactsLearned ?? 0} icon={<Database className="w-3 h-3" />} />
                        <MiniStat label="Scans" value={studyStats?.totalScansCompleted ?? 0} icon={<Activity className="w-3 h-3" />} />
                        <MiniStat label="Entities" value={studyStats?.totalEntitiesDiscovered ?? 0} icon={<Network className="w-3 h-3" />} />
                      </div>

                      {/* Study Status */}
                      {studyStatusMsg && (
                        <div className="mb-4 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                          <p className="text-[9px] font-mono text-emerald-300/70 uppercase tracking-widest">{studyStatusMsg}</p>
                        </div>
                      )}

                      {/* Add Topic Input */}
                      <div className="flex gap-2 mb-4">
                        <input
                          type="text" placeholder="Tell her what to study..."
                          value={newStudyTopic} onChange={e => setNewStudyTopic(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddStudyTopic()}
                          className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors" />
                        <button onClick={handleAddStudyTopic} disabled={!newStudyTopic.trim()}
                          className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 disabled:opacity-20 transition-all hover:bg-emerald-500/20 flex items-center gap-1.5 shrink-0">
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-mono uppercase tracking-widest hidden sm:inline">Add</span>
                        </button>
                        <button onClick={handleToggleStudyAgent}
                          className={cn("px-4 py-2.5 border rounded-xl transition-all flex items-center gap-1.5 shrink-0",
                            studyRunning ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20")}>
                          {studyRunning ? <><Pause className="w-3.5 h-3.5" /><span className="text-[9px] font-mono uppercase tracking-widest hidden sm:inline">Pause</span></> : <><Play className="w-3.5 h-3.5" /><span className="text-[9px] font-mono uppercase tracking-widest hidden sm:inline">Start</span></>}
                        </button>
                      </div>

                      {/* Active Study Topics */}
                      {studyTopics.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {studyTopics.map(topic => (
                            <div key={topic.id} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                              topic.status === 'active' ? "bg-emerald-500/[0.03] border-emerald-500/10" : "bg-white/[0.02] border-white/[0.06]")}>
                              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", topic.status === 'active' ? "bg-emerald-400" : "bg-zinc-600")}></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-zinc-200 font-medium truncate">{topic.name}</span>
                                  <span className="text-[7px] font-mono text-zinc-500 uppercase">{topic.depth}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[8px] font-mono text-zinc-500">{topic.totalFactsLearned} facts</span>
                                  <span className="text-[8px] font-mono text-zinc-500">{topic.totalScans} scans</span>
                                  <span className="text-[8px] font-mono text-zinc-500">{topic.knowledgeGained.toFixed(0)}%</span>
                                  {/* Knowledge progress bar */}
                                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden max-w-[60px]">
                                    <div className="h-full bg-gradient-to-r from-emerald-500/50 to-cyan-400/50 rounded-full transition-all" style={{ width: `${Math.min(100, topic.knowledgeGained)}%` }}></div>
                                  </div>
                                </div>
                              </div>
                              <button onClick={() => handleRemoveStudyTopic(topic.id)} className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Controls Row */}
                      <div className="flex items-center gap-4 pt-3 border-t border-white/[0.04]">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Interval</span>
                          <input type="range" min="15" max="300" step="15" value={studyInterval}
                            onChange={e => handleStudyIntervalChange(parseInt(e.target.value))}
                            className="flex-1 accent-emerald-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                          <span className="text-[9px] font-mono text-emerald-300 w-10 text-right">{studyInterval >= 60 ? `${(studyInterval / 60).toFixed(0)}m` : `${studyInterval}s`}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Depth</span>
                          <select value={studyDepth} onChange={e => setStudyDepth(e.target.value as StudyDepth)}
                            className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-[9px] font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/30 appearance-none cursor-pointer">
                            <option value="SURFACE">Surface</option>
                            <option value="MODERATE">Moderate</option>
                            <option value="DEEP">Deep</option>
                            <option value="EXHAUSTIVE">Exhaustive</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900/60 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-white/20 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300 flex items-center gap-3">
                          <Layers className="w-4 h-4 text-cyan-300/60" />
                          Transformer Attention Module
                        </h3>
                        <span className="text-[7px] font-mono text-cyan-400/60 uppercase tracking-widest">{attnMode.replace('_', ' ')}</span>
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <MiniStat label="Vocabulary" value={aiStats.transformerVocabSize} icon={<TerminalSquare className="w-3 h-3" />} />
                        <MiniStat label="Cache Size" value={aiStats.attentionCacheSize} icon={<Database className="w-3 h-3" />} />
                        <MiniStat label="Strategy" value={aiStats.activeLearningStrategy.replace('_', ' ')} icon={<Shield className="w-3 h-3" />} />
                        <MiniStat label="Efficiency" value={aiStats.learningEfficiency.toFixed(6)} icon={<Activity className="w-3 h-3" />} />
                      </div>

                      {/* ── Attention Mode Selector ── */}
                      <div className="space-y-4 pt-4 border-t border-white/[0.06]">
                        <div className="flex items-center gap-2 px-1">
                          <Cpu className="w-3.5 h-3.5 text-cyan-400/50" />
                          <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-400">Attention Configuration</span>
                        </div>

                        {/* Mode Selector */}
                        <div className="flex flex-wrap gap-1.5">
                          {Object.values(AttentionMode).map(mode => (
                            <button key={mode} onClick={() => updateTransformerConfig('attentionMode', mode)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-[8px] font-mono uppercase tracking-widest transition-all border",
                                attnMode === mode
                                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(0,243,255,0.15)]"
                                  : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/10 hover:text-zinc-300"
                              )}>
                              {mode.replace('_', ' ')}
                            </button>
                          ))}
                        </div>

                        {/* Heads Slider */}
                        <div className="flex items-center gap-3 px-1">
                          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest w-10">Heads</span>
                          <input type="range" min="1" max="16" step="1" value={attnHeads}
                            onChange={e => updateTransformerConfig('numHeads', parseInt(e.target.value))}
                            className="flex-1 accent-cyan-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(0,243,255,0.4)]" />
                          <span className="text-[9px] font-mono text-cyan-300 w-6 text-right">{attnHeads}</span>
                        </div>

                        {/* Layers Slider */}
                        <div className="flex items-center gap-3 px-1">
                          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest w-10">Layers</span>
                          <input type="range" min="1" max="12" step="1" value={attnLayers}
                            onChange={e => updateTransformerConfig('numLayers', parseInt(e.target.value))}
                            className="flex-1 accent-purple-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(168,85,247,0.4)]" />
                          <span className="text-[9px] font-mono text-purple-300 w-6 text-right">{attnLayers}</span>
                        </div>

                        {/* Temperature Slider */}
                        <div className="flex items-center gap-3 px-1">
                          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest w-10">Temp</span>
                          <input type="range" min="0.1" max="3.0" step="0.1" value={attnTemperature}
                            onChange={e => updateTransformerConfig('temperature', parseFloat(e.target.value))}
                            className="flex-1 accent-amber-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                          <span className="text-[9px] font-mono text-amber-300 w-8 text-right">{attnTemperature.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

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
                    Advanced AI engine controls and exclusive features.
                  </p>
                </header>

                {/* ─── 10 ADVANCED SETTINGS ─── */}
                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <Sliders className="w-4 h-4 text-cyan-400/60" />
                    <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300">Advanced Settings</h3>
                    <div className="flex-1 h-px bg-white/10"></div>
                    <button onClick={handleResetSettings} className="text-[8px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 uppercase tracking-widest">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>

                  <SettingToggle icon={<Gauge className="w-4 h-4" />} label="Learning Rate Multiplier" description="Amplify or reduce the speed at which the AI engine absorbs new information." color="text-emerald-400">
                    <div className="flex items-center gap-3 w-full">
                      <input type="range" min="0.1" max="3" step="0.1" value={settings.learningRateMultiplier}
                        onChange={e => updateSetting('learningRateMultiplier', parseFloat(e.target.value))}
                        className="flex-1 accent-emerald-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-sm font-mono text-emerald-300 w-10 text-right">{settings.learningRateMultiplier.toFixed(1)}x</span>
                    </div>
                  </SettingToggle>

                  <SettingToggle icon={<Hash className="w-4 h-4" />} label="Context Window Depth" description="Number of previous messages the AI considers when generating responses." color="text-cyan-400">
                    <div className="flex items-center gap-3 w-full">
                      <input type="range" min="2" max="20" step="1" value={settings.contextDepth}
                        onChange={e => updateSetting('contextDepth', parseInt(e.target.value))}
                        className="flex-1 accent-cyan-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,243,255,0.5)]" />
                      <span className="text-sm font-mono text-cyan-300 w-8 text-right">{settings.contextDepth}</span>
                    </div>
                  </SettingToggle>

                  <SettingToggle icon={<Wifi className="w-4 h-4" />} label="Web Auto-Search" description="Automatically search the internet when the AI detects a knowledge gap." color="text-blue-400">
                    <button onClick={() => updateSetting('webAutoSearch', !settings.webAutoSearch)}
                      className={cn("relative w-10 h-5 rounded-full transition-all duration-300 border", settings.webAutoSearch ? "bg-blue-500/20 border-blue-500/40" : "bg-white/5 border-white/10")}>
                      <motion.div animate={{ x: settings.webAutoSearch ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-colors", settings.webAutoSearch ? "bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-zinc-500")} />
                    </button>
                  </SettingToggle>

                  <SettingToggle icon={<Microscope className="w-4 h-4" />} label="KG Prune Threshold" description="Auto-remove knowledge nodes below this importance threshold to optimize performance." color="text-purple-400">
                    <div className="flex items-center gap-3 w-full">
                      <input type="range" min="0.01" max="0.5" step="0.01" value={settings.kgPruneThreshold}
                        onChange={e => updateSetting('kgPruneThreshold', parseFloat(e.target.value))}
                        className="flex-1 accent-purple-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                      <span className="text-sm font-mono text-purple-300 w-12 text-right">{settings.kgPruneThreshold.toFixed(2)}</span>
                    </div>
                  </SettingToggle>

                  <SettingToggle icon={<Thermometer className="w-4 h-4" />} label="Response Temperature" description="Controls AI creativity. Higher values produce more varied, creative responses." color="text-amber-400">
                    <div className="flex items-center gap-3 w-full">
                      <input type="range" min="0.1" max="1.5" step="0.1" value={settings.responseTemperature}
                        onChange={e => updateSetting('responseTemperature', parseFloat(e.target.value))}
                        className="flex-1 accent-amber-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      <span className="text-sm font-mono text-amber-300 w-10 text-right">{settings.responseTemperature.toFixed(1)}</span>
                    </div>
                  </SettingToggle>

                  <SettingToggle icon={<Flame className="w-4 h-4" />} label="XP Boost Mode" description="Double all XP gains across the entire skill tree. Accelerates skill progression." color="text-orange-400">
                    <button onClick={() => updateSetting('xpBoostMode', !settings.xpBoostMode)}
                      className={cn("relative w-10 h-5 rounded-full transition-all duration-300 border", settings.xpBoostMode ? "bg-orange-500/20 border-orange-500/40" : "bg-white/5 border-white/10")}>
                      <motion.div animate={{ x: settings.xpBoostMode ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-colors", settings.xpBoostMode ? "bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.5)]" : "bg-zinc-500")} />
                    </button>
                  </SettingToggle>

                  <SettingToggle icon={<Volume2 className="w-4 h-4" />} label="Haptic Feedback" description="Vibration feedback on AI responses and learning events." color="text-rose-400">
                    <button onClick={() => updateSetting('hapticFeedback', !settings.hapticFeedback)}
                      className={cn("relative w-10 h-5 rounded-full transition-all duration-300 border", settings.hapticFeedback ? "bg-rose-500/20 border-rose-500/40" : "bg-white/5 border-white/10")}>
                      <motion.div animate={{ x: settings.hapticFeedback ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-colors", settings.hapticFeedback ? "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-zinc-500")} />
                    </button>
                  </SettingToggle>

                  <SettingToggle icon={<Orbit className="w-4 h-4" />} label="Graph Animation Speed" description="Controls the animation speed of the Neuro-Graph visualization." color="text-indigo-400">
                    <div className="flex items-center gap-3 w-full">
                      <input type="range" min="0.01" max="0.5" step="0.01" value={settings.graphSpeed}
                        onChange={e => updateSetting('graphSpeed', parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                      <span className="text-sm font-mono text-indigo-300 w-10 text-right">{(settings.graphSpeed * 100).toFixed(0)}%</span>
                    </div>
                  </SettingToggle>

                  <SettingToggle icon={<Eye className="w-4 h-4" />} label="Deep Black Mode" description="Pure black background for AMOLED displays. Maximum contrast." color="text-zinc-300">
                    <button onClick={() => updateSetting('deepBlackMode', !settings.deepBlackMode)}
                      className={cn("relative w-10 h-5 rounded-full transition-all duration-300 border", settings.deepBlackMode ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10")}>
                      <motion.div animate={{ x: settings.deepBlackMode ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-colors", settings.deepBlackMode ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" : "bg-zinc-500")} />
                    </button>
                  </SettingToggle>

                  <SettingToggle icon={<TerminalSquare className="w-4 h-4" />} label="Verbose Debug Mode" description="Show detailed AI processing info, XP gains, and neural pathway data." color="text-green-400">
                    <button onClick={() => updateSetting('verboseMode', !settings.verboseMode)}
                      className={cn("relative w-10 h-5 rounded-full transition-all duration-300 border", settings.verboseMode ? "bg-green-500/20 border-green-500/40" : "bg-white/5 border-white/10")}>
                      <motion.div animate={{ x: settings.verboseMode ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-colors", settings.verboseMode ? "bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-500")} />
                    </button>
                  </SettingToggle>
                </div>

                {/* ─── 10 EXCLUSIVE FEATURES ─── */}
                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <Gem className="w-4 h-4 text-amber-400/60" />
                    <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300">Exclusive Features</h3>
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-[8px] font-mono text-amber-400/50 uppercase tracking-widest">Premium</span>
                  </div>

                  <ExclusiveFeature icon={<Fingerprint className="w-5 h-5" />} label="Neural Consciousness Meter" description="Real-time AI awareness indicator tracking learning progression through dormant, awakening, emergent, cognizant, sentient, transcendent, and omniscient states." badge={`${consciousnessLevel.toFixed(0)}%`} badgeColor="text-purple-400" />

                  <ExclusiveFeature icon={<Radio className="w-5 h-5" />} label="Quantum Coherence Score" description="Multi-dimensional awareness metric measuring the AI's cross-domain knowledge integration accuracy and transfer learning efficiency." badge={`${quantumCoherence.toFixed(1)}%`} badgeColor="text-cyan-400" />

                  <ExclusiveFeature icon={<Dna className="w-5 h-5" />} label="Neural Pathway Tracer" description="Visualizes the neural pathways activated during response generation including concept recognition, semantic mapping, and pattern synthesis." toggle={showNeuralPath} onToggle={() => setShowNeuralPath(!showNeuralPath)} />

                  <ExclusiveFeature icon={<Download className="w-5 h-5" />} label="Knowledge Time Capsule" description="Export a complete snapshot of the AI's knowledge graph, learning state, consciousness level, and conversation history as a portable archive." action={handleExportKnowledge} />

                  <ExclusiveFeature icon={<Microscope className="w-5 h-5" />} label="Deep Pattern Recognition" description="Continuous conversation pattern analysis identifying recurring topics, semantic clusters, and communication style trends." badge={deepPattern ? 'Active' : 'Scanning'} badgeColor="text-amber-400" />

                  <ExclusiveFeature icon={<Heart className="w-5 h-5" />} label="Synaptic Bloom Effect" description="Visual bloom animation triggered on every learning event, creating an immersive feedback loop between user and AI." badge={bloomActive ? 'Bloom' : 'Ready'} badgeColor="text-pink-400" />

                  <ExclusiveFeature icon={<Infinity className="w-5 h-5" />} label="Eigenstate Projection" description="Predictive modeling of future knowledge growth based on current learning trajectory, vocabulary expansion rate, and concept mastery curves." badge={aiStats ? `${Math.min(100, aiStats.averageMastery * 120).toFixed(0)}%` : '--'} badgeColor="text-emerald-400" />

                  <ExclusiveFeature icon={<Binary className="w-5 h-5" />} label="Temporal Memory Map" description="Chronological visualization of learning milestones, knowledge acquisition events, and skill progression across sessions." badge={`${messages.length} msgs`} badgeColor="text-indigo-400" />

                  <ExclusiveFeature icon={<Wand2 className="w-5 h-5" />} label="Sentient Status Engine" description="Evolving AI consciousness descriptor that adapts based on accumulated knowledge, interaction depth, and neural complexity." badge={sentientStatus} badgeColor="text-violet-400" />

                  <ExclusiveFeature icon={<Sparkles className="w-5 h-5" />} label="Neural Sync Dashboard" description="Miniature real-time brain activity display in the header showing consciousness pulse and AI processing state." badge="Active" badgeColor="text-cyan-400" />
                </div>

                {/* ─── PERMISSIONS ─── */}
                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <Shield className="w-4 h-4 text-emerald-400/60" />
                    <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300">Permissions</h3>
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-[8px] font-mono text-emerald-400/50 uppercase tracking-widest">System</span>
                  </div>

                  <div className="glass-panel p-5 rounded-2xl border border-emerald-500/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 blur-3xl opacity-5 bg-emerald-600/40 rounded-full w-full h-full -z-10"></div>

                    {/* Microphone Permission */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-emerald-400/80 flex items-center gap-2">
                          <Mic className="w-3.5 h-3.5" />
                          Microphone
                        </h4>
                        <p className="text-zinc-400 text-[10px] mt-1 leading-relaxed">
                          Required for Voice Call mode (speech-to-text). Cassidey needs to hear you to respond in real time.
                        </p>
                      </div>
                      <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-widest border",
                        micPermission === true ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        micPermission === false ? "bg-red-500/10 border-red-500/20 text-red-400" :
                        "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full",
                          micPermission === true ? "bg-emerald-400" :
                          micPermission === false ? "bg-red-400" :
                          "bg-zinc-500"
                        )}></div>
                        {micPermission === true ? 'Granted' : micPermission === false ? 'Denied' : 'Checking...'}
                      </div>
                    </div>

                    {micPermission === false && (
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={requestMicPermission}
                          className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-medium uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95 flex items-center gap-1.5">
                          <Mic className="w-3 h-3" />
                          Grant Permission
                        </button>
                        <button onClick={openAppSettings}
                          className="px-4 py-2 rounded-xl bg-zinc-500/10 text-zinc-400 text-[10px] font-medium uppercase tracking-widest border border-zinc-500/20 hover:bg-zinc-500/20 transition-all active:scale-95 flex items-center gap-1.5">
                          <Settings className="w-3 h-3" />
                          App Settings
                        </button>
                      </div>
                    )}

                    {micPermission === true && (
                      <p className="text-emerald-400/50 text-[9px] font-mono mt-2 flex items-center gap-1.5">
                        <span className="inline-block w-1 h-1 rounded-full bg-emerald-400"></span>
                        Voice Call ready — microphone access available
                      </p>
                    )}
                  </div>
                </div>

                {/* ─── API KEYS ─── */}
                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <Key className="w-4 h-4 text-blue-400/60" />
                    <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300">API Keys</h3>
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-[8px] font-mono text-blue-400/50 uppercase tracking-widest">Integration</span>
                  </div>

                  <div className="glass-panel p-5 rounded-2xl border border-blue-500/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 p-8 blur-3xl opacity-5 bg-blue-600/40 rounded-full w-full h-full -z-10"></div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-blue-400/80 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5" />
                          Gemini API Key
                        </h4>
                        <p className="text-zinc-400 text-[10px] mt-1 leading-relaxed">
                          Powers Cassidey as the primary AI brain. Also drives web learning, knowledge extraction, and autonomous study agent.
                        </p>
                      </div>
                      <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-widest border", geminiKeySaved ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-zinc-500/10 border-zinc-500/20 text-zinc-500")}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", geminiKeySaved ? "bg-emerald-400" : "bg-zinc-500")}></div>
                        {geminiKeySaved ? 'Active' : 'Not Set'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="password"
                          value={geminiKey}
                          onChange={e => { setGeminiKey(e.target.value); setGeminiKeySaved(false); }}
                          placeholder="AIza..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-zinc-200 font-mono text-[11px] tracking-wide placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/30 transition-colors"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (geminiKey.trim()) {
                            setGeminiApiKey(geminiKey.trim());
                            await writeJson('gemini_api_key.json', geminiKey.trim());
                            setGeminiKeySaved(true);
                            setTimeout(() => setGeminiKeySaved(false), 3000);
                          }
                        }}
                        disabled={!geminiKey.trim()}
                        className="px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 text-[10px] font-medium uppercase tracking-widest border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                      >
                        Save
                      </button>
                    </div>
                    {geminiKeySaved && geminiKey && (
                      <p className="text-emerald-400/60 text-[9px] font-mono mt-2 flex items-center gap-1.5">
                        <span className="inline-block w-1 h-1 rounded-full bg-emerald-400"></span>
                        Key active: {getGeminiApiKeyDisplay()}
                      </p>
                    )}
                  </div>
                </div>

                {/* ─── VOICE SYSTEM ─── */}
                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <Mic className="w-4 h-4 text-amber-400/60" />
                    <h3 className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-300">Voice System</h3>
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-[8px] font-mono text-amber-400/50 uppercase tracking-widest">{EXCLUSIVE_VOICES.length} Voices</span>
                  </div>

                  {/* Master Voice Toggle */}
                  <SettingToggle icon={settings.voiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />} label="Voice Output" description="Enable text-to-speech to give Cassidey a voice. Uses the Web Speech API for on-device synthesis." color="text-amber-400">
                    <button onClick={() => updateSetting('voiceEnabled', !settings.voiceEnabled)}
                      className={cn("relative w-10 h-5 rounded-full transition-all duration-300 border", settings.voiceEnabled ? "bg-amber-500/20 border-amber-500/40" : "bg-white/5 border-white/10")}>
                      <motion.div animate={{ x: settings.voiceEnabled ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-colors", settings.voiceEnabled ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-zinc-500")} />
                    </button>
                  </SettingToggle>

                  {/* Auto-Speak Toggle */}
                  <SettingToggle icon={<Speaker className="w-4 h-4" />} label="Auto-Speak Responses" description="Automatically read every AI response aloud. Toggle off to use the speak button on individual messages." color="text-amber-300">
                    <button onClick={() => { updateSetting('autoSpeak', !settings.autoSpeak); if (settings.autoSpeak) stopSpeech(); }}
                      disabled={!settings.voiceEnabled || !isSpeechAvailable()}
                      className={cn("relative w-10 h-5 rounded-full transition-all duration-300 border", settings.autoSpeak && settings.voiceEnabled ? "bg-amber-500/20 border-amber-500/40" : "bg-white/5 border-white/10", (!settings.voiceEnabled || !isSpeechAvailable()) && "opacity-30 cursor-not-allowed")}>
                      <motion.div animate={{ x: settings.autoSpeak && settings.voiceEnabled ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-colors", settings.autoSpeak && settings.voiceEnabled ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.5)]" : "bg-zinc-500")} />
                    </button>
                  </SettingToggle>

                  {/* Voice Speed */}
                  <SettingToggle icon={<Timer className="w-4 h-4" />} label="Voice Speed" description="Adjust how fast Cassidey speaks. Lower values create a more relaxed delivery." color="text-amber-200">
                    <div className="flex items-center gap-3 w-full">
                      <input type="range" min="0.5" max="1.5" step="0.1" value={settings.voiceSpeed}
                        onChange={e => updateSetting('voiceSpeed', parseFloat(e.target.value))}
                        disabled={!settings.voiceEnabled}
                        className="flex-1 accent-amber-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      <span className="text-sm font-mono text-amber-200 w-10 text-right">{settings.voiceSpeed.toFixed(1)}x</span>
                    </div>
                  </SettingToggle>

                  {/* Voice Pitch */}
                  <SettingToggle icon={<Radio className="w-4 h-4" />} label="Voice Pitch" description="Adjust the pitch of the voice. Higher values sound brighter, lower values sound deeper." color="text-orange-400">
                    <div className="flex items-center gap-3 w-full">
                      <input type="range" min="0.5" max="1.5" step="0.1" value={settings.voicePitch}
                        onChange={e => updateSetting('voicePitch', parseFloat(e.target.value))}
                        disabled={!settings.voiceEnabled}
                        className="flex-1 accent-orange-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                      <span className="text-sm font-mono text-orange-300 w-10 text-right">{settings.voicePitch.toFixed(1)}</span>
                    </div>
                  </SettingToggle>

                  {/* Voice Selector - Current Voice Display */}
                  {(() => {
                    const currentVoice = getVoiceProfile(settings.voiceProfileId);
                    return (
                      <div className="glass-panel p-5 rounded-2xl border border-amber-500/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 blur-3xl opacity-5 bg-amber-600/40 rounded-full w-full h-full -z-10"></div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-[11px] font-medium tracking-[0.15em] uppercase text-amber-400/80 flex items-center gap-2">
                              <Volume2 className="w-3.5 h-3.5" />
                              Voice Profile
                            </h4>
                            <p className="text-zinc-400 text-[10px] mt-1 leading-relaxed">
                              Choose from {EXCLUSIVE_VOICES.length} exclusive voices. Each has a unique personality.
                            </p>
                          </div>
                          <span className={cn("text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border", VOICE_TIER_CONFIG[currentVoice.tier].bgColor, VOICE_TIER_CONFIG[currentVoice.tier].borderColor, VOICE_TIER_CONFIG[currentVoice.tier].color)}>
                            {VOICE_TIER_CONFIG[currentVoice.tier].label}
                          </span>
                        </div>

                        {/* Current voice info */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-purple-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Volume2 className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-100 tracking-wide">{currentVoice.name}</div>
                            <div className="text-[10px] text-zinc-400 truncate">{currentVoice.description}</div>
                          </div>
                          <button onClick={() => {
                            initSpeechSynthesis(); // unlock TTS in user gesture context
                            if (isSpeakingState) { stopSpeech(); return; }
                            speak("Hello, I am " + currentVoice.name + ". I am your Cassidey AI voice.", settings.voiceProfileId, undefined, undefined, settings.voiceSpeed, settings.voicePitch);
                          }}
                            disabled={!isSpeechAvailable()}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-[9px] font-medium uppercase tracking-widest border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 transition-all flex items-center gap-1.5">
                            {isSpeakingState ? (
                              <><VolumeX className="w-3 h-3" /> Stop</>
                            ) : (
                              <><Play className="w-3 h-3" /> Test</>
                            )}
                          </button>
                        </div>

                        {/* Voice grid */}
                        <div className="max-h-[300px] overflow-y-auto no-scrollbar space-y-2">
                          {(['persona', 'legendary', 'exclusive', 'premium', 'standard'] as const).map(tier => {
                            const tierVoices = EXCLUSIVE_VOICES.filter(v => v.tier === tier);
                            const tc = VOICE_TIER_CONFIG[tier];
                            return (
                              <div key={tier}>
                                <div className="flex items-center gap-2 mb-1.5 mt-2 first:mt-0">
                                  <div className={cn("w-1.5 h-1.5 rounded-full", tier === 'persona' ? 'bg-rose-400' : tier === 'legendary' ? 'bg-amber-400' : tier === 'exclusive' ? 'bg-purple-400' : tier === 'premium' ? 'bg-cyan-400' : 'bg-zinc-400')}></div>
                                  <span className={cn("text-[8px] font-mono uppercase tracking-widest", tc.color)}>{tc.label} ({tierVoices.length})</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {tierVoices.map(voice => (
                                    <button key={voice.id}
                                      onClick={() => updateSetting('voiceProfileId', voice.id)}
                                      disabled={!settings.voiceEnabled}
                                      className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left disabled:opacity-40",
                                        settings.voiceProfileId === voice.id
                                          ? tier === 'persona'
                                            ? "bg-rose-500/10 border-rose-500/30 text-zinc-100"
                                            : "bg-amber-500/10 border-amber-500/30 text-zinc-100"
                                          : "bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/5 hover:border-white/20"
                                      )}>
                                      <Volume2 className={cn("w-3 h-3 shrink-0", settings.voiceProfileId === voice.id ? (tier === 'persona' ? "text-rose-400" : "text-amber-400") : "text-zinc-500")} />
                                      <div className="min-w-0">
                                        <div className={cn("text-[10px] font-medium truncate", settings.voiceProfileId === voice.id ? (tier === 'persona' ? "text-rose-300" : "text-amber-300") : "text-zinc-300")}>
                                          {voice.name}
                                          {tier === 'persona' && <span className="ml-1 text-[7px] text-rose-400/60">★</span>}
                                        </div>
                                        <div className="text-[8px] text-zinc-500 truncate">{tier === 'persona' ? 'IN-CHARACTER' : voice.style}</div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ─── DANGER ZONE ─── */}
                <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] border border-red-500/10 relative overflow-hidden">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── CHAT INPUT BAR (UPGRADED) ─── */}
        <AnimatePresence>
          {activeTab === 'chat' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="w-full px-3 pb-2 pt-2 shrink-0 z-20 pointer-events-none">
              <div className="max-w-4xl mx-auto w-full pointer-events-auto">
                <div className="relative w-full h-[48px] bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.4),0_0_15px_rgba(0,243,255,0.05)] flex items-center overflow-hidden">
                  <div className="absolute left-3 top-0.5 flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-emerald-400/60"></div>
                    <span className="text-[6px] font-mono font-bold text-zinc-500 opacity-50 tracking-widest uppercase">Neural Input</span>
                  </div>
                  <div className="flex-1 flex items-center px-3 pt-2.5 relative z-10 w-full">
                    <span className="text-zinc-600 mr-2 opacity-50 font-mono font-bold text-sm">{">"}</span>
                    <input className="command-line-input text-zinc-200 font-mono text-[13px] tracking-tight placeholder:text-zinc-600"
                      placeholder="Speak to Cassidey..." value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
                  </div>
                  {/* Call button */}
                  <button onClick={isCallActive ? endCall : startCall}
                    className={cn("h-full flex items-center justify-center transition-all px-3 z-10 border-l border-white/[0.04]",
                      isCallActive
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-gradient-to-b from-white/[0.06] to-transparent hover:from-white/[0.1] text-violet-400")}>
                    {isCallActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </button>
                  <button onClick={handleSend} disabled={!inputValue.trim()}
                    className="px-4 h-full flex items-center justify-center transition-all bg-gradient-to-b from-white/[0.06] to-transparent hover:from-white/[0.1] rounded-r-2xl text-emerald-400 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed group z-10 border-l border-white/[0.04]">
                    <Anchor className="w-4 h-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ═══ VOICE CALL OVERLAY ═══ */}
      <AnimatePresence>
        {isCallActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/[0.97] backdrop-blur-3xl">
            {/* Call header */}
            <div className="flex items-center justify-between px-6 pt-14 pb-4" style={{ paddingTop: (insets.statusBar + 56) + 'px' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-violet-400 animate-[pulse_2s_ease-in-out_infinite]" style={{ boxShadow: '0 0 12px rgba(168,85,247,0.6)' }}></div>
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-100 tracking-wide">{getVoiceProfile(settings.voiceProfileId).name}</div>
                  <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">{callDuration > 0 ? `${Math.floor(callDuration/60).toString().padStart(2,'0')}:${(callDuration%60).toString().padStart(2,'0')}` : 'Connecting...'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite]" style={{ boxShadow: '0 0 8px rgba(16,185,129,0.6)' }}></div>
                <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Live</span>
              </div>
            </div>

            {/* Call content area */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-6">
              {/* Visualizer */}
              <div className="relative flex items-center justify-center">
                <motion.div animate={{ scale: isListening ? [1, 1.3, 1] : [1, 1.05, 1], opacity: isListening ? 0.6 : 0.2 }}
                  transition={{ duration: isListening ? 0.8 : 3, repeat: Infinity }}
                  className="absolute w-40 h-40 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/10 border border-violet-500/10"></motion.div>
                <motion.div animate={{ scale: isListening ? [1, 1.2, 1] : [1, 1.03, 1], opacity: isListening ? 0.4 : 0.15 }}
                  transition={{ duration: isListening ? 0.6 : 4, repeat: Infinity, delay: 0.2 }}
                  className="absolute w-56 h-56 rounded-full bg-gradient-to-br from-violet-500/10 to-cyan-500/5 border border-violet-500/5"></motion.div>
                <motion.div animate={{ scale: isListening ? [1, 1.1, 1] : [1, 1.02, 1] }}
                  transition={{ duration: isListening ? 1.2 : 5, repeat: Infinity }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center shadow-[0_0_60px_rgba(138,43,226,0.15)]">
                  {callIsSpeaking ? (
                    <Volume2 className="w-8 h-8 text-amber-400 animate-[pulse_1s_ease-in-out_infinite]" />
                  ) : isListening ? (
                    <Mic className="w-8 h-8 text-emerald-400 animate-[pulse_1s_ease-in-out_infinite]" />
                  ) : (
                    <Mic className="w-8 h-8 text-zinc-400" />
                  )}
                </motion.div>
              </div>

              {/* Status text */}
              <div className="text-center">
                <div className="text-[10px] font-mono uppercase tracking-[0.3em] mb-2" style={{ color: isListening ? '#4ade80' : callIsSpeaking ? '#fbbf24' : callError ? '#ef4444' : '#71717a' }}>
                  {callError ? callError : isListening ? 'Listening...' : callIsSpeaking ? 'Speaking...' : 'Tap mic to speak'}
                </div>
                <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">
                  {callMessages.filter(m => m.role === 'user').length} messages exchanged
                </div>
              </div>

              {/* Live transcript */}
              {(callTranscript || callAiResponse) && (
                <div className="w-full max-w-md space-y-2">
                  {callTranscript && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-2.5">
                      <div className="text-[8px] font-mono text-emerald-400/60 uppercase tracking-widest mb-1">You</div>
                      <div className="text-sm text-zinc-200">{callTranscript}</div>
                    </motion.div>
                  )}
                  {callAiResponse && !callTranscript && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-violet-500/5 border border-violet-500/10 rounded-xl px-4 py-2.5">
                      <div className="text-[8px] font-mono text-violet-400/60 uppercase tracking-widest mb-1">{getVoiceProfile(settings.voiceProfileId).name}</div>
                      <div className="text-sm text-zinc-200 font-light leading-relaxed">{callAiResponse}</div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Recent call messages */}
              {callMessages.length > 0 && !callTranscript && !callAiResponse && (
                <div className="w-full max-w-md max-h-[200px] overflow-y-auto no-scrollbar space-y-2">
                  {callMessages.slice(-4).map((msg, i) => (
                    <div key={i} className={cn("rounded-xl px-4 py-2",
                      msg.role === 'user' ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-violet-500/5 border border-violet-500/10")}>
                      <div className={cn("text-[7px] font-mono uppercase tracking-widest mb-0.5",
                        msg.role === 'user' ? "text-emerald-400/50" : "text-violet-400/50")}>
                        {msg.role === 'user' ? 'You' : getVoiceProfile(settings.voiceProfileId).name}
                      </div>
                      <div className="text-[12px] text-zinc-300 truncate">{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Call controls */}
            <div className="flex items-center justify-center gap-8 px-6 pb-8" style={{ paddingBottom: (insets.navBar + 32) + 'px' }}>
              <button onClick={stopSpeech} disabled={!callIsSpeaking}
                className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 disabled:opacity-30 transition-all hover:bg-white/10">
                <VolumeX className="w-5 h-5" />
              </button>
              <button onClick={toggleCallListening}
                className={cn("w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95",
                  isListening
                    ? "bg-emerald-500/20 border-2 border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                    : "bg-gradient-to-b from-white/10 to-white/5 border-2 border-white/20 hover:from-white/15")}>
                <Mic className={cn("w-7 h-7 transition-colors", isListening ? "text-emerald-400" : "text-zinc-200")} />
              </button>
              <button onClick={endCall}
                className="w-12 h-12 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-red-400 transition-all hover:bg-red-500/20 active:scale-95">
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 h-16 glass-nav flex items-center justify-around px-2 z-40 backdrop-blur-2xl safe-area-bottom">
        <TabButton icon={<MessageSquare className="w-5 h-5" />} active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} label="Chat" />
        <TabButton icon={<GitBranch className="w-5 h-5" />} active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} label="Skills" />
        <TabButton icon={<Brain className="w-5 h-5" />} active={activeTab === 'brain'} onClick={() => setActiveTab('brain')} label="Brain" />
        <TabButton icon={<Orbit className="w-5 h-5" />} active={activeTab === 'graph'} onClick={() => setActiveTab('graph')} label="Graph" />
        <TabButton icon={<Settings className="w-5 h-5" />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />
      </nav>
    </div>
    </ErrorBoundary>
  );
}

// ═══════════ COMPONENTS ═══════════

function AtomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function TabButton({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 relative min-w-[70px]",
      active ? "bg-white/10 shadow-[0_4px_15px_rgba(255,191,0,0.1),_inset_0_1px_rgba(255,255,255,0.2)] border border-white/20 tab-active" : "glass-button text-zinc-300 hover:text-zinc-300"
    )}>
      <div className={cn("transition-transform duration-300", active ? "scale-110 drop-shadow-[0_0_8px_var(--color-amber)]" : "scale-100")}>{icon}</div>
      <span className="text-[7.5px] font-mono font-bold uppercase tracking-[0.1em] text-center max-w-[65px] leading-tight">{label}</span>
      {active && <motion.div layoutId="activeIndicator" className="absolute -bottom-[6px] w-[50%] h-[2px] bg-[var(--color-amber)] shadow-[0_0_8px_var(--color-amber)] rounded-full" />}
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

function SettingToggle({ icon, label, description, color, children }: { icon: React.ReactNode; label: string; description: string; color: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-4 border border-white/[0.06] relative overflow-hidden group hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn("bg-white/5 p-2 rounded-xl border border-white/10 shrink-0 mt-0.5", color)}>{icon}</div>
          <div className="min-w-0">
            <h4 className={cn("text-[11px] font-medium tracking-wide mb-0.5", color)}>{label}</h4>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-light">{description}</p>
          </div>
        </div>
        <div className="shrink-0 mt-1">{children}</div>
      </div>
    </div>
  );
}

function ExclusiveFeature({ icon, label, description, badge, badgeColor, toggle, onToggle, action }: { icon: React.ReactNode; label: string; description: string; badge?: string; badgeColor?: string; toggle?: boolean; onToggle?: () => void; action?: () => void }) {
  return (
    <div className="glass-panel rounded-2xl p-4 border border-amber-500/5 relative overflow-hidden group hover:border-amber-500/10 transition-colors">
      <div className="absolute top-0 left-0 p-6 blur-3xl opacity-5 bg-amber-500/20 rounded-full w-1/2 h-full -z-10"></div>
      <div className="flex items-start gap-3">
        <div className="bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/10 shrink-0 text-amber-400/70">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[11px] font-medium tracking-wide text-amber-300/90">{label}</h4>
            <Gem className="w-2.5 h-2.5 text-amber-500/30" />
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed font-light mb-2">{description}</p>
          <div className="flex items-center gap-2">
            {badge && badgeColor && (
              <span className={cn("text-[8px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10", badgeColor)}>{badge}</span>
            )}
            {toggle !== undefined && onToggle && (
              <button onClick={onToggle}
                className={cn("relative w-8 h-4 rounded-full transition-all duration-300 border", toggle ? "bg-amber-500/20 border-amber-500/40" : "bg-white/5 border-white/10")}>
                <motion.div animate={{ x: toggle ? 16 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={cn("absolute top-0.5 w-3 h-3 rounded-full transition-colors", toggle ? "bg-amber-400" : "bg-zinc-500")} />
              </button>
            )}
            {action && (
              <button onClick={action}
                className="text-[8px] font-mono text-amber-400/60 hover:text-amber-400 transition-colors uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-500/10 hover:border-amber-500/20">
                Export
              </button>
            )}
          </div>
        </div>
      </div>
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
    case SkillCategory.TERMUX: return <TerminalSquare className={className} />;
    case SkillCategory.GITHUB: return <Github className={className} />;
    case SkillCategory.PDF_ANALYSIS: return <FileText className={className} />;
    case SkillCategory.YOUTUBE_LEARNING: return <Youtube className={className} />;
    case SkillCategory.SYSTEM: return <Settings className={className} />;
    default: return <MessageSquare className={className} />;
  }
}
