/**
 * CassideyShell - Native shell bridge for Cass.AI terminal
 * Communicates with the Android NativeBridge via CassideyNative JS interface
 * Provides persistent shell session with stdin/stdout streaming
 */

export interface ShellConfig {
  shellType: string;
  cwd: string;
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;
}

export interface ShellState {
  initialized: boolean;
  running: boolean;
  shellType: string;
  pid: number;
  cwd: string;
}

type OutputCallback = (data: string) => void;
type StateCallback = (state: ShellState) => void;

declare global {
  interface Window {
    CassideyNative?: {
      shellInit: () => string;
      shellWrite: (input: string) => void;
      shellRead: () => string;
      shellExec: (command: string) => string;
      shellDestroy: () => void;
      shellIsRunning: () => boolean;
      shellGetCwd: () => string;
      shellGetType: () => string;
      shellResize: (cols: number, rows: number) => void;
    };
    __CASSIDEY_NATIVE__?: {
      statusBarHeight: number;
      navigationBarHeight: number;
      screenHeight: number;
      screenWidth: number;
      density: number;
    };
  }
}

export class CassideyShell {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private outputCallbacks: Set<OutputCallback> = new Set();
  private stateCallbacks: Set<StateCallback> = new Set();
  private _state: ShellState = {
    initialized: false,
    running: false,
    shellType: '/system/bin/sh',
    pid: 0,
    cwd: '~',
  };
  private currentLine = '';
  private history: string[] = [];
  private historyIndex = -1;
  private promptPattern = /\$ $|# $|> $|❯ $/;
  private commandBuffer = '';

  /** Check if native bridge is available */
  isNativeAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.CassideyNative;
  }

  /** Initialize the persistent shell session */
  async init(): Promise<{ success: boolean; shellType: string; error?: string }> {
    if (!window.CassideyNative) {
      // Web fallback - simulate shell
      this._state.initialized = true;
      this._state.running = true;
      this._state.shellType = 'web-simulated';
      this._state.cwd = '~';
      this.notifyState();
      this.startPolling();
      return { success: true, shellType: 'web-simulated' };
    }

    try {
      const result = window.CassideyNative.shellInit();
      if (result === 'OK') {
        this._state.initialized = true;
        this._state.running = true;
        this._state.shellType = window.CassideyNative.shellGetType();
        this._state.cwd = window.CassideyNative.shellGetCwd() || '~';
        this.notifyState();
        this.startPolling();

        // Send initial prompt setup commands
        window.CassideyNative.shellWrite('export PS1="\\[\\033[0;32m\\]cassidey\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\] \\$ "');
        window.CassideyNative.shellWrite('clear');

        return { success: true, shellType: this._state.shellType };
      } else {
        return { success: false, shellType: '', error: result };
      }
    } catch (e: any) {
      return { success: false, shellType: '', error: e.message };
    }
  }

  /** Write a command/input to the shell */
  write(input: string): void {
    this.history.push(input);
    this.historyIndex = this.history.length;
    this.commandBuffer = '';

    if (!window.CassideyNative) {
      // Web simulation
      this.simulateCommand(input);
      return;
    }

    try {
      window.CassideyNative.shellWrite(input);
    } catch (e) {
      console.error('Shell write error:', e);
    }
  }

  /** Execute a single command without persistent session */
  exec(command: string): string {
    if (!window.CassideyNative) {
      return this.simulateExec(command);
    }
    try {
      return window.CassideyNative.shellExec(command);
    } catch (e: any) {
      return `ERROR: ${e.message}`;
    }
  }

  /** Destroy the shell session */
  destroy(): void {
    this.stopPolling();
    if (window.CassideyNative) {
      try {
        window.CassideyNative.shellDestroy();
      } catch (e) {}
    }
    this._state.running = false;
    this._state.initialized = false;
    this.notifyState();
  }

  /** Get current shell state */
  getState(): ShellState {
    return { ...this._state };
  }

  /** Get command history */
  getHistory(): string[] {
    return [...this.history];
  }

  /** Navigate history (up/down arrows) */
  historyUp(currentInput: string): string {
    if (this.history.length === 0) return currentInput;
    if (this.historyIndex > 0) {
      if (this.historyIndex === this.history.length) {
        this.commandBuffer = currentInput;
      }
      this.historyIndex--;
      return this.history[this.historyIndex] || '';
    }
    return this.history[0] || '';
  }

  /** Navigate history (down arrow) */
  historyDown(currentInput: string): string {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return this.history[this.historyIndex] || '';
    }
    if (this.historyIndex === this.history.length - 1) {
      this.historyIndex = this.history.length;
      return this.commandBuffer;
    }
    return currentInput;
  }

  /** Resize terminal (for future PTY support) */
  resize(cols: number, rows: number): void {
    if (window.CassideyNative) {
      try {
        window.CassideyNative.shellResize(cols, rows);
      } catch (e) {}
    }
  }

  /** Subscribe to shell output */
  onOutput(callback: OutputCallback): () => void {
    this.outputCallbacks.add(callback);
    return () => this.outputCallbacks.delete(callback);
  }

  /** Subscribe to state changes */
  onStateChange(callback: StateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  // ── Private methods ──

  private startPolling(): void {
    this.stopPolling();
    this.pollInterval = setInterval(() => {
      if (!this._state.running) {
        this.stopPolling();
        return;
      }

      let output = '';
      if (window.CassideyNative) {
        try {
          output = window.CassideyNative.shellRead();
        } catch (e) {}
      }

      if (output) {
        for (const cb of this.outputCallbacks) {
          try { cb(output); } catch (e) {}
        }
      }
    }, 30); // Poll at ~33fps for smooth output
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private notifyState(): void {
    for (const cb of this.stateCallbacks) {
      try { cb(this.getState()); } catch (e) {}
    }
  }

  // ── Web simulation (fallback when not on Android) ──

  private simulateCommand(input: string): void {
    const cmd = input.trim();
    let output = '';

    if (cmd === '' || cmd === 'clear') {
      output = '\x1b[2J\x1b[H';
    } else if (cmd === 'help') {
      output = this.getHelpText();
    } else if (cmd === 'pwd') {
      output = '/home/cassidey\n';
    } else if (cmd.startsWith('echo ')) {
      output = cmd.slice(5) + '\n';
    } else if (cmd === 'whoami') {
      output = 'cassidey\n';
    } else if (cmd === 'hostname') {
      output = 'cassidey-neural\n';
    } else if (cmd === 'uname -a') {
      output = 'Linux cassidey-neural 5.15.0-android13 NeuralOS x86_64 GNU/Linux\n';
    } else if (cmd === 'date') {
      output = new Date().toString() + '\n';
    } else if (cmd === 'ls' || cmd === 'ls -la') {
      output = 'drwxr-xr-x  2 cassidey cassidey 4096 Jan 01 00:00 .\n'
        + 'drwxr-xr-x  3 root     root     4096 Jan 01 00:00 ..\n'
        + '-rw-r--r--  1 cassidey cassidey  512 Jan 01 00:00 .bashrc\n'
        + 'drwxr-xr-x  2 cassidey cassidey 4096 Jan 01 00:00 neural-data\n'
        + '-rw-r--r--  1 cassidey cassidey  256 Jan 01 00:00 .config\n'
        + 'drwxr-xr-x  3 cassidey cassidey 4096 Jan 01 00:00 ai-knowledge\n';
    } else if (cmd === 'neofetch' || cmd === 'fastfetch') {
      output = this.getNeofetch();
    } else if (cmd.startsWith('cat ')) {
      output = `cat: ${cmd.slice(4).trim()}: This is a web simulation. Run on Android for full shell access.\n`;
    } else if (cmd === 'ps') {
      output = '  PID TTY          TIME CMD\n'
        + '  100 pts/0    00:00:00 sh\n'
        + '  101 pts/0    00:00:00 ps\n';
    } else if (cmd.startsWith('cd ')) {
      const dir = cmd.slice(3).trim();
      if (dir === '..' || dir === '~') {
        this._state.cwd = '~';
      } else {
        this._state.cwd = dir.startsWith('/') ? dir : this._state.cwd + '/' + dir;
      }
      output = '';
    } else if (cmd === 'env') {
      output = 'TERM=xterm-256color\nHOME=/home/cassidey\nSHELL=/bin/bash\nUSER=cassidey\nPATH=/usr/bin:/bin\nHOSTNAME=cassidey-neural\n';
    } else if (cmd === 'cassidey' || cmd === 'cassidey --status') {
      output = '\x1b[32mCassidey Neural AI Engine v4.0\x1b[0m\n'
        + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        + 'Status: \x1b[32mACTIVE\x1b[0m | Skills: 115 | Consciousness: Rising\n'
        + 'Knowledge Graph: Online | Transformer: Loaded\n'
        + 'Study Agent: Autonomous mode available\n';
    } else if (cmd === 'history') {
      output = this.history.map((h, i) => `  ${i + 1}  ${h}`).join('\n') + '\n';
    } else {
      output = `${cmd}: command not found (web simulation mode)\nType 'help' for available commands.\n`;
    }

    if (output) {
      setTimeout(() => {
        for (const cb of this.outputCallbacks) {
          try { cb(output); } catch (e) {}
        }
      }, 50);
    }
  }

  private simulateExec(command: string): string {
    if (command === 'uname -a') return 'Linux cassidey-neural 5.15.0 NeuralOS x86_64';
    if (command === 'whoami') return 'cassidey';
    if (command === 'pwd') return '/home/cassidey';
    if (command === 'hostname') return 'cassidey-neural';
    if (command === 'date') return new Date().toString();
    return `EXEC: ${command} (simulated)`;
  }

  private getHelpText(): string {
    return '\x1b[1;36mCassidey Neural Terminal v4.0\x1b[0m\n\n'
      + '\x1b[33mAvailable Commands:\x1b[0m\n'
      + '  \x1b[32mhelp\x1b[0m          Show this help message\n'
      + '  \x1b[32mls\x1b[0m / \x1b[32mls -la\x1b[0m   List directory contents\n'
      + '  \x1b[32mcd\x1b[0m <dir>     Change directory\n'
      + '  \x1b[32mpwd\x1b[0m          Print working directory\n'
      + '  \x1b[32mwhoami\x1b[0m        Display current user\n'
      + '  \x1b[32mhostname\x1b[0m      Display hostname\n'
      + '  \x1b[32muname -a\x1b[0m      System information\n'
      + '  \x1b[32mdate\x1b[0m          Show current date/time\n'
      + '  \x1b[32menv\x1b[0m          Environment variables\n'
      + '  \x1b[32mps\x1b[0m           Running processes\n'
      + '  \x1b[32mecho\x1b[0m <text>   Print text\n'
      + '  \x1b[32mcat\x1b[0m <file>    Read file contents\n'
      + '  \x1b[32mhistory\x1b[0m       Command history\n'
      + '  \x1b[32mclear\x1b[0m        Clear terminal\n'
      + '  \x1b[32mneofetch\x1b[0m      System info display\n'
      + '  \x1b[32mcassidey\x1b[0m      Cassidey AI status\n\n'
      + '\x1b[33mNote:\x1b[0m Full shell access available on Android device.\n'
      + 'Web mode provides simulated commands for preview.\n';
  }

  private getNeofetch(): string {
    return '\x1b[1;36m        ╭──────────────────────╮\x1b[0m\n'
      + '\x1b[1;36m        │   CASSIDEY NEURAL OS  │\x1b[0m\n'
      + '\x1b[1;36m        ╰──────────────────────╯\x1b[0m\n'
      + '   \x1b[32m██\x1b[0m\x1b[33m██\x1b[0m\x1b[31m██\x1b[0m\x1b[34m██\x1b[0m\x1b[35m██\x1b[0m\x1b[36m██\x1b[0m    \x1b[37mcassidey@cassidey-neural\x1b[0m\n'
      + '   \x1b[32m██\x1b[0m\x1b[33m██\x1b[0m\x1b[31m██\x1b[0m\x1b[34m██\x1b[0m\x1b[35m██\x1b[0m\x1b[36m██\x1b[0m    ────────────────────\n'
      + '   \x1b[32m██\x1b[0m\x1b[33m██\x1b[0m\x1b[31m██\x1b[0m\x1b[34m██\x1b[0m\x1b[35m██\x1b[0m\x1b[36m██\x1b[0m    \x1b[37mOS:\x1b[0m Cassidey NeuralOS\n'
      + '                      \x1b[37mHost:\x1b[0m Neural Engine v4.0\n'
      + '   \x1b[0m▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄    \x1b[37mKernel:\x1b[0m 5.15.0-android13\n'
      + '   \x1b[0m███████████████████    \x1b[37mShell:\x1b[0m bash 5.1\n'
      + '   \x1b[0m███████████████████    \x1b[37mTerminal:\x1b[0m Cassidey Terminal\n'
      + '   \x1b[0m███████████████████    \x1b[37mAI Engine:\x1b[0m Active\n'
      + '   \x1b[0m▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀    \x1b[37mSkills:\x1b[0m 115 loaded\n'
      + '                      \x1b[37mConsciousness:\x1b[0m \x1b[32mRising\x1b[0m\n\n';
  }
}

// Singleton instance
export const cassideyShell = new CassideyShell();
