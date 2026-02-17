import { getAudioContext } from './audioEngine';

export async function decodeFile(file: File): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = await getAudioContext().decodeAudioData(reader.result as ArrayBuffer);
        resolve(buffer);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function trimSilence(buffer: AudioBuffer, threshold: number = 0.02): AudioBuffer {
  const data = buffer.getChannelData(0);
  let start = 0;
  let end = data.length - 1;
  
  while (start < end && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;
  
  const pad = Math.min(Math.floor(buffer.sampleRate * 0.01), start, data.length - 1 - end);
  start = Math.max(0, start - pad);
  end = Math.min(data.length - 1, end + pad);
  
  const length = end - start + 1;
  const ctx = getAudioContext();
  const output = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    output.getChannelData(c).set(buffer.getChannelData(c).subarray(start, end + 1));
  }
  
  return output;
}

export function normalize(buffer: AudioBuffer): AudioBuffer {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  
  if (peak < 0.001 || peak > 0.95) return buffer;
  
  const gain = 0.95 / peak;
  const ctx = getAudioContext();
  const output = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = output.getChannelData(c);
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[i] * gain;
    }
  }
  
  return output;
}

export function fadeInOut(buffer: AudioBuffer, ms: number = 15): AudioBuffer {
  const samples = Math.floor(buffer.sampleRate * ms / 1000);
  const ctx = getAudioContext();
  const output = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = output.getChannelData(c);
    dst.set(src);
    
    for (let i = 0; i < samples && i < dst.length; i++) {
      dst[i] *= i / samples;
    }
    
    for (let i = 0; i < samples && i < dst.length; i++) {
      dst[dst.length - 1 - i] *= i / samples;
    }
  }
  
  return output;
}

export function extractRegion(buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer | null {
  const sr = buffer.sampleRate;
  const start = Math.floor(startSec * sr);
  const end = Math.min(Math.floor(endSec * sr), buffer.length);
  const length = end - start;
  
  if (length <= 0) return null;
  
  const ctx = getAudioContext();
  const output = ctx.createBuffer(buffer.numberOfChannels, length, sr);
  
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    output.getChannelData(c).set(buffer.getChannelData(c).subarray(start, end));
  }
  
  return output;
}

export function detectSilences(
  buffer: AudioBuffer, 
  threshold: number = 0.03, 
  minSilence: number = 0.15
): Array<{ start: number; end: number }> {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const minSamples = Math.floor(minSilence * sr);
  const regions: Array<{ start: number; end: number }> = [];
  let inSound = false;
  let soundStart = 0;
  let silenceStart = 0;
  
  for (let i = 0; i < data.length; i++) {
    const loud = Math.abs(data[i]) > threshold;
    
    if (loud && !inSound) {
      inSound = true;
      soundStart = i;
    } else if (!loud && inSound) {
      if (!silenceStart) silenceStart = i;
      if (i - silenceStart >= minSamples) {
        regions.push({ start: soundStart / sr, end: silenceStart / sr });
        inSound = false;
        silenceStart = 0;
      }
    } else if (loud && silenceStart) {
      silenceStart = 0;
    }
  }
  
  if (inSound) {
    regions.push({ start: soundStart / sr, end: buffer.duration });
  }
  
  return regions.filter(r => (r.end - r.start) >= 0.05);
}

export function encodeWAV(buffer: AudioBuffer): Blob {
  const sr = buffer.sampleRate;
  const ch = buffer.numberOfChannels;
  const bps = 16;
  const length = buffer.length * ch * bps / 8;
  
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * ch * bps / 8, true);
  view.setUint16(32, ch * bps / 8, true);
  view.setUint16(34, bps, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);
  
  let offset = 44;
  
  if (ch === 1) {
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      view.setInt16(offset, Math.max(-1, Math.min(1, data[i])) * 0x7FFF, true);
      offset += 2;
    }
  } else {
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    for (let i = 0; i < left.length; i++) {
      view.setInt16(offset, Math.max(-1, Math.min(1, left[i])) * 0x7FFF, true);
      offset += 2;
      view.setInt16(offset, Math.max(-1, Math.min(1, right[i])) * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export interface ProcessingOptions {
  trim?: boolean;
  normalize?: boolean;
  fade?: boolean;
}

export async function processFile(
  file: File, 
  options: ProcessingOptions = {}
): Promise<Blob> {
  let buffer = await decodeFile(file);
  
  if (options.trim) buffer = trimSilence(buffer);
  if (options.normalize) buffer = normalize(buffer);
  if (options.fade) buffer = fadeInOut(buffer);
  
  return encodeWAV(buffer);
}
