import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { cassideyShell, ShellState } from '../lib/shell-bridge';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal as TerminalIcon, Cpu, Wifi, WifiOff, Trash2, Maximize2, Minimize2, ChevronRight, X, RotateCcw } from 'lucide-react';

interface LinuxTerminalProps {
  className?: string;
}

export function LinuxTerminal({ className = '' }: LinuxTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputBufferRef = useRef<string>('');
  const [shellState, setShellState] = useState<ShellState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm.js instance with cyberpunk theme
    const term = new Terminal({
      theme: {
        background: '#050505',
        foreground: '#00ff66',
        cursor: '#00ff66',
        cursorAccent: '#050505',
        selectionBackground: 'rgba(0, 255, 102, 0.15)',
        selectionForeground: '#00ff66',
        black: '#0a0a0a',
        red: '#ff003c',
        green: '#00ff66',
        yellow: '#39ff14',
        blue: '#00f3ff',
        magenta: '#8a2be2',
        cyan: '#00f3ff',
        white: '#e0e0e0',
        brightBlack: '#404040',
        brightRed: '#ff3366',
        brightGreen: '#33ff88',
        brightYellow: '#66ff33',
        brightBlue: '#33ccff',
        brightMagenta: '#bb55ff',
        brightCyan: '#55ffff',
        brightWhite: '#ffffff',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      letterSpacing: 0.5,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true,
      allowTransparency: true,
      macOptionIsMeta: true,
      drawBoldTextInBrightColors: true,
      overviewRuler: { width: 0 },
      minimumContrastRatio: 4,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(terminalRef.current);

    // Fit after opening
    setTimeout(() => {
      try { fitAddon.fit(); } catch (e) {}
    }, 100);

    // Welcome banner
    const banner = [
      '',
      '\x1b[1;36m  ╔═══════════════════════════════════════════════╗\x1b[0m',
      '\x1b[1;36m  ║\x1b[0m                                               \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m  ║\x1b[0m   \x1b[1;32mC A S S I D E Y\x1b[0m  \x1b[1;36mN E U R A L\x1b[0m  \x1b[1;35mT E R M I N A L\x1b[0m  \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m  ║\x1b[0m                                               \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m  ║\x1b[0m   \x1b[37mv4.0\x1b[0m  |  \x1b[32mAI Engine Active\x1b[0m  |  \x1b[36m115 Skills\x1b[0m    \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m  ║\x1b[0m   \x1b[37m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m  \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m  ║\x1b[0m   \x1b[90mType "help" for commands\x1b[0m                   \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m  ║\x1b[0m                                               \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m  ╚═══════════════════════════════════════════════╝\x1b[0m',
      '',
    ];
    term.writeln(banner.join('\r\n'));

    // Handle user input
    term.onData((data) => {
      if (data === '\r') {
        // Enter key - send command
        const cmd = inputBufferRef.current;
        term.write('\r\n');
        if (cmd.trim()) {
          cassideyShell.write(cmd);
        }
        inputBufferRef.current = '';
      } else if (data === '\x7f') {
        // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data === '\x1b[A') {
        // Arrow up - history
        const newInput = cassideyShell.historyUp(inputBufferRef.current);
        const diff = inputBufferRef.current.length - newInput.length;
        if (diff > 0) {
          term.write(`\b \b`.repeat(diff));
        } else if (diff < 0) {
          term.write(newInput.slice(inputBufferRef.current.length));
        }
        inputBufferRef.current = newInput;
      } else if (data === '\x1b[B') {
        // Arrow down - history
        const newInput = cassideyShell.historyDown(inputBufferRef.current);
        const diff = inputBufferRef.current.length - newInput.length;
        if (diff > 0) {
          term.write(`\b \b`.repeat(diff));
        } else if (diff < 0) {
          term.write(newInput.slice(inputBufferRef.current.length));
        }
        inputBufferRef.current = newInput;
      } else if (data === '\x03') {
        // Ctrl+C
        term.write('^C\r\n');
        inputBufferRef.current = '';
      } else if (data === '\x0c') {
        // Ctrl+L = clear
        term.clear();
        term.write(banner.join('\r\n'));
      } else if (data >= ' ') {
        // Printable characters
        inputBufferRef.current += data;
        term.write(data);
      }
    });

    // Subscribe to shell output
    const unsubOutput = cassideyShell.onOutput((data: string) => {
      if (term) {
        term.write(data);
        inputBufferRef.current = '';
      }
    });

    // Subscribe to state changes
    const unsubState = cassideyShell.onStateChange((state) => {
      setShellState(state);
    });

    cleanupRef.current.push(unsubOutput, unsubState);

    // Initialize shell
    cassideyShell.init().then(result => {
      if (!result.success) {
        setInitError(result.error || 'Failed to initialize shell');
      }
      setShellState(cassideyShell.getState());
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon?.fit(); } catch (e) {}
    });
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    cleanupRef.current.push(() => resizeObserver.disconnect());

    // Cleanup
    return () => {
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
      cassideyShell.destroy();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  const handleClear = useCallback(() => {
    xtermRef.current?.clear();
  }, []);

  const handleRestart = useCallback(() => {
    cassideyShell.destroy();
    setTimeout(() => {
      cassideyShell.init().then(result => {
        if (result.success) {
          setShellState(cassideyShell.getState());
          setInitError(null);
        } else {
          setInitError(result.error || 'Failed to restart shell');
        }
      });
    }, 200);
  }, []);

  return (
    <motion.div
      key="terminal"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-[200]' : ''}`} style={isFullscreen ? { paddingTop: 0 } : {}}>
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-[var(--color-amber)]/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--color-glitch-red)]/80 animate-[pulse_4s_ease-in-out_infinite] shadow-[0_0_8px_rgba(255,0,60,0.3)]"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400/80 animate-[pulse_5s_ease-in-out_infinite] shadow-[0_0_8px_rgba(255,191,0,0.3)]" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-3 h-3 rounded-full bg-emerald-400/80 animate-[pulse_6s_ease-in-out_infinite] shadow-[0_0_8px_rgba(52,211,153,0.3)]" style={{ animationDelay: '1s' }}></div>
            <span className="text-[10px] font-mono text-zinc-400 ml-2 uppercase tracking-widest">cassidey:~/neural-terminal</span>
          </div>
          <div className="flex items-center gap-1">
            {shellState?.running ? (
              <Wifi className="w-3 h-3 text-emerald-400/60" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400/60" />
            )}
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">
              {shellState?.running ? 'Connected' : 'Disconnected'}
            </span>
            <span className="text-[8px] font-mono text-zinc-600 ml-1">
              {cassideyShell.isNativeAvailable() ? 'Native' : 'Web'}
            </span>
          </div>
        </div>

        {/* Terminal Toolbar */}
        <AnimatePresence>
          {showToolbar && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/40 border-b border-white/5 shrink-0 overflow-x-auto no-scrollbar"
            >
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono text-zinc-400 hover:text-[var(--color-amber)] hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono text-zinc-400 hover:text-cyan-400 hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" /> Restart
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono text-zinc-400 hover:text-purple-400 hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </button>
              <div className="h-3 w-px bg-white/10 mx-1"></div>
              <div className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-purple-400/50" />
                <span className="text-[8px] font-mono text-zinc-500 uppercase">{shellState?.shellType || '...'}</span>
              </div>
              {initError && (
                <div className="flex items-center gap-1 ml-auto">
                  <X className="w-3 h-3 text-red-400" />
                  <span className="text-[8px] font-mono text-red-400/70 truncate max-w-[150px]">{initError}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Terminal Body */}
        <div
          ref={terminalRef}
          className="flex-1 bg-[#050505] relative overflow-hidden"
          style={{
            height: isFullscreen
              ? 'calc(100vh - 40px - 32px)'
              : 'calc(100vh - 48px - 64px - 40px - 32px - 48px)',
            minHeight: isFullscreen ? undefined : 300,
          }}
        />

        {/* Terminal Scanline Effect */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,102,0.03) 2px, rgba(0,255,102,0.03) 4px)',
          }}
        />

        {/* Terminal Glow */}
        <div className="pointer-events-none absolute inset-0 z-[5] opacity-[0.02]">
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[var(--color-amber)]/20 to-transparent" />
        </div>
      </div>
    </motion.div>
  );
}

export default LinuxTerminal;
