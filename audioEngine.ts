import { type PlayingSound, CONFIG } from '@/types';

let audioContext: AudioContext | null = null;
const playingSounds = new Map<string, PlayingSound>();
const decodedBuffers = new Map<string, AudioBuffer>();
let previewSource: AudioBufferSourceNode | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export async function decodeAudio(id: string, blob: Blob): Promise<AudioBuffer | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = await getAudioContext().decodeAudioData(arrayBuffer);
    decodedBuffers.set(id, buffer);
    return buffer;
  } catch (e) {
    console.error('Failed to decode audio:', e);
    return null;
  }
}

export async function getBuffer(id: string): Promise<AudioBuffer | null> {
  if (decodedBuffers.has(id)) {
    return decodedBuffers.get(id)!;
  }
  return null;
}

export function isPlaying(id: string): boolean {
  return playingSounds.has(id);
}

export async function play(
  id: string, 
  volume: number = 0.8, 
  loop: boolean = false
): Promise<boolean> {
  if (playingSounds.size >= CONFIG.MAX_CONCURRENT || playingSounds.has(id)) {
    return false;
  }
  
  const buffer = await getBuffer(id);
  if (!buffer) return false;
  
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  
  source.buffer = buffer;
  source.loop = loop;
  gainNode.gain.value = volume;
  
  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  source.onended = () => {
    if (!loop || !playingSounds.has(id)) {
      playingSounds.delete(id);
    }
  };
  
  source.start(0);
  playingSounds.set(id, { source, gainNode });
  return true;
}

export function stop(id: string): void {
  const playing = playingSounds.get(id);
  if (playing) {
    try {
      playing.source.stop();
    } catch (e) {
      // Already stopped
    }
    playingSounds.delete(id);
  }
}

export function stopAll(): void {
  for (const [, playing] of playingSounds) {
    try {
      playing.source.stop();
    } catch (e) {
      // Already stopped
    }
  }
  playingSounds.clear();
}

export function evictBuffer(id: string): void {
  decodedBuffers.delete(id);
}

export function getPlayingSounds(): Map<string, PlayingSound> {
  return playingSounds;
}

export function stopPreview(): void {
  if (previewSource) {
    try {
      previewSource.stop();
    } catch (e) {
      // Already stopped
    }
    previewSource = null;
  }
}

export function previewBuffer(
  buffer: AudioBuffer, 
  startTime: number = 0, 
  duration?: number
): void {
  stopPreview();
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0, startTime, duration);
  previewSource = source;
  previewSource.onended = () => {
    previewSource = null;
  };
}

export function generateTone(
  frequency: number, 
  type: 'sine' | 'square' | 'sawtooth' | 'triangle', 
  duration: number
): Blob {
  const sampleRate = 44100;
  const length = Math.floor(sampleRate * duration);
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - t / duration);
    const phase = 2 * Math.PI * frequency * t;
    let sample = 0;
    
    switch (type) {
      case 'sine':
        sample = Math.sin(phase);
        break;
      case 'square':
        sample = Math.sin(phase) > 0 ? 0.8 : -0.8;
        break;
      case 'sawtooth':
        sample = 2 * ((frequency * t) % 1) - 1;
        break;
      case 'triangle':
        sample = 4 * Math.abs(((frequency * t) % 1) - 0.5) - 1;
        break;
    }
    
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample * envelope * 0.5)) * 0x7FFF, true);
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function cloneBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const clone = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    clone.getChannelData(ch).set(buffer.getChannelData(ch));
  }
  return clone;
}
