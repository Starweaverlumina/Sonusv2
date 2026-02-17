// SoundDeck Pro - TypeScript Types

export interface Sound {
  id: string;
  name: string;
  icon: string;
  category: string;
  color: PadColor;
  volume: number;
  bank: string;
  order: number;
  loopDefault: boolean;
}

export type PadColor = 
  | 'red' | 'green' | 'purple' | 'orange' 
  | 'blue' | 'pink' | 'teal' | 'yellow';

export interface SoundWithAudio extends Sound {
  audioBlob?: Blob;
}

export interface PlayingSound {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

export interface AudioRegion {
  start: number;
  end: number;
  name: string;
  color: string;
  blob?: Blob;
  bank?: string;
  category?: string;
}

export interface TrimState {
  start: number;
  end: number;
}

export interface FadeState {
  in: number;
  out: number;
}

export interface EnvelopeState {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface ExportData {
  version: number;
  exportDate: string;
  banks: string[];
  sounds: ExportedSound[];
}

export interface ExportedSound extends Sound {
  audioBase64: string | null;
  mimeType: string;
}

export interface VoiceCommand {
  type: 'play' | 'stop' | 'loop' | 'bank' | 'stopAll';
  value?: string | number | boolean;
}

export interface Category {
  id: string;
  name: string;
}

export const PAD_COLORS: { name: PadColor; swatch: string }[] = [
  { name: 'red', swatch: '#ff3d71' },
  { name: 'green', swatch: '#00e5a0' },
  { name: 'purple', swatch: '#7b61ff' },
  { name: 'orange', swatch: '#ffaa00' },
  { name: 'blue', swatch: '#3d9eff' },
  { name: 'pink', swatch: '#ff61a6' },
  { name: 'teal', swatch: '#00d4c8' },
  { name: 'yellow', swatch: '#ffe144' },
];

export const DEFAULT_ICONS = [
  '🔊', '📯', '🎵', '🥁', '👏', '💥', '😂', '🔔', 
  '🎤', '🎸', '🎹', '🐱', '🐶', '💀', '🚨', '🎉'
];

export const CATEGORIES = [
  'All', 'Effects', 'Music', 'Voice', 'Funny', 'Alerts'
];

export const WORD_NUMBERS: Record<string, number> = {
  one: 1, won: 1, two: 2, too: 2, to: 2, three: 3, free: 3, tree: 3,
  four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, ate: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12
};

export const CONFIG = {
  DB_NAME: 'SoundDeckDB',
  DB_VERSION: 2,
  STORE_META: 'metadata',
  STORE_AUDIO: 'audioblobs',
  STORE_BANKS: 'banks',
  MAX_FILE_SIZE: 25 * 1024 * 1024,
  MAX_CONCURRENT: 8,
  VOICE_TIMEOUT_MS: 5 * 60 * 1000,
  EXPORT_VERSION: 2,
} as const;
