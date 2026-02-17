import { WORD_NUMBERS, CONFIG, type Sound } from '@/types';
import { isPlaying, play, stop, stopAll } from './audioEngine';

// Speech Recognition types
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
    length: number;
  };
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionType;

interface VoiceCallbacks {
  onPlay: (sound: Sound) => void;
  onStopAll: () => void;
  onLoopToggle: (enabled: boolean) => void;
  onBankSwitch: (bank: string) => void;
  getSounds: () => Sound[];
  getBanks: () => string[];
  getActiveBank: () => string;
  getLoopMode: () => boolean;
  getFilteredSounds: () => Sound[];
}

let recognition: SpeechRecognitionType | null = null;
let isSupported = false;
let isActive = false;
let lastTranscript = '';
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let callbacks: VoiceCallbacks | null = null;

export function initVoiceEngine(voiceCallbacks: VoiceCallbacks): boolean {
  callbacks = voiceCallbacks;
  const SpeechRecognition = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition || 
                            (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    return false;
  }
  
  isSupported = true;
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  rec.maxAlternatives = 3;
  recognition = rec;
  
  recognition.onresult = handleResult;
  recognition.onend = () => {
    if (isActive) {
      try {
        recognition?.start();
      } catch (e) {
        // Already started
      }
    }
  };
  
  recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
    if (e.error === 'not-allowed') {
      toggle(false);
    } else if (isActive && e.error !== 'aborted') {
      setTimeout(() => {
        if (isActive) {
          try {
            recognition?.start();
          } catch (e) {
            // Already started
          }
        }
      }, 500);
    }
  };
  
  return true;
}

export function toggle(force?: boolean): boolean {
  if (!isSupported || !recognition) {
    return false;
  }
  
  isActive = force !== undefined ? force : !isActive;
  
  if (isActive) {
    try {
      recognition.start();
    } catch (e) {
      // Already started
    }
    resetSilenceTimer();
  } else {
    try {
      recognition.stop();
    } catch (e) {
      // Already stopped
    }
    clearSilenceTimer();
  }
  
  return isActive;
}

export function isVoiceActive(): boolean {
  return isActive;
}

function resetSilenceTimer() {
  clearSilenceTimer();
  const endTime = Date.now() + CONFIG.VOICE_TIMEOUT_MS;
  silenceTimer = setTimeout(() => {
    if (isActive) {
      toggle(false);
    }
  }, CONFIG.VOICE_TIMEOUT_MS);
  
  countdownInterval = setInterval(() => {
    // Could emit remaining time for UI display
    Math.max(0, Math.ceil((endTime - Date.now()) / 60000));
  }, 30000);
}

function clearSilenceTimer() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function handleResult(event: SpeechRecognitionEvent) {
  let finalTranscript = '';
  let interimTranscript = '';
  
  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i].isFinal) {
      finalTranscript += event.results[i][0].transcript;
    } else {
      interimTranscript += event.results[i][0].transcript;
    }
  }
  
  if (interimTranscript) {
    // Could emit for UI display
  }
  
  if (finalTranscript) {
    const transcript = finalTranscript.trim().toLowerCase();
    if (transcript !== lastTranscript) {
      lastTranscript = transcript;
      resetSilenceTimer();
      processCommand(transcript);
      // Could emit match result for UI display
    }
  }
}

function processCommand(transcript: string): string | null {
  const raw = transcript.replace(/[^\w\s]/g, '').trim();
  const filtered = callbacks?.getFilteredSounds() || [];
  
  // Stop commands
  if (/\b(stop all|stop everything|silence|quiet|shut up|kill)\b/.test(raw)) {
    stopAll();
    callbacks?.onStopAll();
    return 'Stopped all';
  }
  
  if (/^stop$/.test(raw)) {
    stopAll();
    callbacks?.onStopAll();
    return 'Stopped';
  }
  
  // Loop commands
  if (/\bloop\s*(on|mode)\b/.test(raw)) {
    callbacks?.onLoopToggle(true);
    return 'Loop ON';
  }
  
  if (/\bloop\s*(off)\b/.test(raw)) {
    callbacks?.onLoopToggle(false);
    return 'Loop OFF';
  }
  
  // Bank switch
  const bankMatch = raw.match(/\b(?:switch to|bank|go to)\s+(.+)/);
  if (bankMatch && callbacks) {
    const banks = callbacks.getBanks();
    const target = banks.find(b => b.toLowerCase().includes(bankMatch[1].trim()));
    if (target) {
      callbacks.onBankSwitch(target);
      return `Bank: ${target}`;
    }
  }
  
  // Play commands
  const playTrigger = /\b(play|hit|trigger|fire|press|tap)\b/;
  const hasPlay = playTrigger.test(raw);
  const number = extractNumber(raw);
  
  if (number && number >= 1 && number <= filtered.length) {
    const sound = filtered[number - 1];
    triggerPlay(sound);
    return `#${number}: ${sound.name}`;
  }
  
  if (hasPlay) {
    let after = raw;
    const playMatch = raw.match(playTrigger);
    if (playMatch) {
      after = raw.substring(raw.indexOf(playMatch[0]) + playMatch[0].length)
        .replace(/\b(the|a|option|number|sound)\b/g, '').trim();
    }
    
    if (after.length > 1) {
      const numWord = extractNumber(after);
      if (numWord && numWord >= 1 && numWord <= filtered.length) {
        const sound = filtered[numWord - 1];
        triggerPlay(sound);
        return `#${numWord}: ${sound.name}`;
      }
      
      const byName = findByName(after, filtered) || findByName(after, callbacks?.getSounds() || []);
      if (byName) {
        triggerPlay(byName);
        return byName.name;
      }
    }
  }
  
  return null;
}

function extractNumber(text: string): number | null {
  const digitMatch = text.match(/\b(\d{1,2})\b/);
  if (digitMatch) return parseInt(digitMatch[1]);
  
  for (const word of text.split(/\s+/)) {
    if (WORD_NUMBERS[word]) return WORD_NUMBERS[word];
  }
  
  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  
  return dp[m][n];
}

function findByName(query: string, sounds: Sound[]): Sound | null {
  query = query.toLowerCase().trim();
  if (query.length < 2) return null;
  
  let match = sounds.find(s => s.name.toLowerCase() === query);
  if (match) return match;
  
  match = sounds.find(s => s.name.toLowerCase().includes(query));
  if (match) return match;
  
  let best: Sound | null = null;
  let bestScore = 0;
  
  for (const sound of sounds) {
    let score = 0;
    for (const qw of query.split(/\s+/)) {
      for (const sw of sound.name.toLowerCase().split(/\s+/)) {
        if (sw.includes(qw) || qw.includes(sw)) {
          score += 2;
        } else {
          const d = levenshtein(qw, sw);
          if (Math.max(qw.length, sw.length) > 0 && d / Math.max(qw.length, sw.length) <= 0.35) {
            score += 1;
          }
        }
      }
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      best = sound;
    }
  }
  
  return best;
}

function triggerPlay(sound: Sound) {
  if (isPlaying(sound.id)) {
    stop(sound.id);
  } else {
    const loopMode = callbacks?.getLoopMode() || false;
    play(sound.id, (sound.volume || 80) / 100, sound.loopDefault || loopMode);
  }
  callbacks?.onPlay(sound);
}

export function pause() {
  if (isSupported && isActive) {
    try {
      recognition?.stop();
    } catch (e) {
      // Already stopped
    }
  }
}

export function resume() {
  if (isSupported && isActive) {
    setTimeout(() => {
      try {
        recognition?.start();
      } catch (e) {
        // Already started
      }
    }, 500);
  }
}
