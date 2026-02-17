import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { 
  Search, Mic, Edit2, Repeat, Settings, 
  Circle, Square, Scissors, FolderPlus, 
  Upload, Download, Trash2, Volume2, Volume1,
  Play, X, Check, HelpCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

import { 
  type Sound, type PadColor, CONFIG, PAD_COLORS, 
  DEFAULT_ICONS, CATEGORIES, type ExportData 
} from '@/types';
import { 
  loadAllMeta, saveMeta, deleteMeta, saveAudio, 
  loadAudio, deleteAudio, clearAll, loadBanks, saveBank, 
  deleteBank
} from '@/lib/storage';
import { 
  decodeAudio, play, stop, stopAll, 
  isPlaying, getPlayingSounds, evictBuffer, 
  generateTone, previewBuffer, getAudioContext 
} from '@/lib/audioEngine';
import { 
  processFile, extractRegion, fadeInOut, 
  normalize, detectSilences, encodeWAV, decodeFile 
} from '@/lib/audioProcessing';
import { initVoiceEngine, toggle as toggleVoice, pause as pauseVoice, resume as resumeVoice } from '@/lib/voiceEngine';

import './App.css';

// Demo sounds for initial load
const DEMO_SOUNDS = [
  { n: 'Air Horn', i: '📯', c: 'Effects', cl: 'red' as PadColor, f: 440, t: 'square' as const, d: 0.8 },
  { n: 'Ding', i: '🔔', c: 'Alerts', cl: 'yellow' as PadColor, f: 880, t: 'sine' as const, d: 0.5 },
  { n: 'Bass Drop', i: '💥', c: 'Music', cl: 'purple' as PadColor, f: 80, t: 'sawtooth' as const, d: 1 },
  { n: 'Laser', i: '⚡', c: 'Effects', cl: 'blue' as PadColor, f: 1200, t: 'sawtooth' as const, d: 0.3 },
  { n: 'Sad Trombone', i: '🎺', c: 'Funny', cl: 'orange' as PadColor, f: 300, t: 'square' as const, d: 1.2 },
  { n: 'Cymbal', i: '🥁', c: 'Music', cl: 'teal' as PadColor, f: 5000, t: 'triangle' as const, d: 0.6 },
  { n: 'Boing', i: '🏀', c: 'Funny', cl: 'green' as PadColor, f: 600, t: 'sine' as const, d: 0.4 },
  { n: 'Alert', i: '🚨', c: 'Alerts', cl: 'red' as PadColor, f: 660, t: 'square' as const, d: 0.7 },
  { n: 'Click', i: '👆', c: 'Effects', cl: 'pink' as PadColor, f: 2000, t: 'sine' as const, d: 0.05 },
];

function App() {
  // State
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [banks, setBanks] = useState<string[]>(['Main']);
  const [activeBank, setActiveBank] = useState('Main');
  const [activeCategory, setActiveCategory] = useState('All');
  const [editMode, setEditMode] = useState(false);
  const [loopMode, setLoopMode] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());
  
  // Modal states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [chopperOpen, setChopperOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bankManagerOpen, setBankManagerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  
  // Edit state
  const [editingSound, setEditingSound] = useState<Sound | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState<PadColor>('red');
  const [editBank, setEditBank] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVolume, setEditVolume] = useState(80);
  const [editLoopDefault, setEditLoopDefault] = useState(false);
  
  // Upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadBank, setUploadBank] = useState('Main');
  const [uploadCategory, setUploadCategory] = useState('All');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [optTrim, setOptTrim] = useState(true);
  const [optNorm, setOptNorm] = useState(true);
  const [optFade, setOptFade] = useState(true);
  
  // Chopper state
  const [chopBuffer, setChopBuffer] = useState<AudioBuffer | null>(null);
  const [chopRegions, setChopRegions] = useState<Array<{
    start: number;
    end: number;
    name: string;
    color: string;
  }>>([]);
  const [chopSelection, setChopSelection] = useState({ start: 0, end: 0 });
  const [chopBank, setChopBank] = useState('Main');
  const [chopCategory, setChopCategory] = useState('All');
  const [chopCanvasReady, setChopCanvasReady] = useState(false);
  
  // Export/Import state
  const [exportProgress, setExportProgress] = useState(0);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [importReplace, setImportReplace] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chopFileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const chopCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);

  // Initialize
  useEffect(() => {
    init();
    
    // Setup visibility change handler
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Resume the shared AudioContext instead of creating a new one
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
      }
    });
    
    // Update playing state periodically
    const interval = setInterval(() => {
      const playing = getPlayingSounds();
      setPlayingIds(new Set(playing.keys()));
    }, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Initialize voice engine
  useEffect(() => {
    const supported = initVoiceEngine({
      onPlay: () => refreshUI(),
      onStopAll: () => refreshUI(),
      onLoopToggle: setLoopMode,
      onBankSwitch: (bank) => {
        setActiveBank(bank);
        setActiveCategory('All');
      },
      getSounds: () => sounds,
      getBanks: () => banks,
      getActiveBank: () => activeBank,
      getLoopMode: () => loopMode,
      getFilteredSounds: () => getFilteredSounds(),
    });
    
    if (!supported) {
      toast.error('Voice control not supported in this browser');
    }
  }, [sounds, banks, activeBank, loopMode]);

  async function init() {
    try {
      const loadedSounds = await loadAllMeta();
      loadedSounds.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setSounds(loadedSounds);
      
      const loadedBanks = await loadBanks();
      if (loadedBanks.length === 0) {
        await saveBank('Main');
        setBanks(['Main']);
      } else {
        setBanks(loadedBanks);
      }
      
      // Decode all audio
      for (const sound of loadedSounds) {
        const blob = await loadAudio(sound.id);
        if (blob) await decodeAudio(sound.id, blob);
      }
      
      // Generate demo sounds if empty
      if (loadedSounds.length === 0) {
        await generateDemoSounds();
      }
    } catch (e) {
      console.error('Init failed:', e);
      toast.error('Failed to initialize');
    }
  }

  async function generateDemoSounds() {
    for (const demo of DEMO_SOUNDS) {
      const blob = generateTone(demo.f, demo.t, demo.d);
      const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2)}`;
      const meta: Sound = {
        id,
        name: demo.n,
        icon: demo.i,
        category: demo.c,
        color: demo.cl,
        volume: 80,
        bank: 'Main',
        order: sounds.length,
        loopDefault: false,
      };
      
      await saveMeta(meta);
      await saveAudio(id, blob);
      await decodeAudio(id, blob);
      sounds.push(meta);
    }
    
    setSounds([...sounds]);
    toast.success('Demo sounds created');
  }

  function refreshUI() {
    setSounds([...sounds]);
  }

  function getSoundsForBank(): Sound[] {
    return sounds
      .filter(s => (s.bank || 'Main') === activeBank)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function getFilteredSounds(): Sound[] {
    let list = getSoundsForBank();
    if (activeCategory !== 'All') {
      list = list.filter(s => s.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    return list;
  }

  function getCategories(): string[] {
    const cats = new Set(['All']);
    getSoundsForBank().forEach(s => cats.add(s.category));
    return [...cats];
  }

  async function handlePlay(sound: Sound) {
    if (isPlaying(sound.id)) {
      stop(sound.id);
    } else {
      await play(sound.id, (sound.volume || 80) / 100, sound.loopDefault || loopMode);
    }
    refreshUI();
  }

  async function handleRecord() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      resumeVoice();
      return;
    }
    
    pauseVoice();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          const processed = await processFile(
            new File([blob], 'rec.webm', { type: 'audio/webm' }),
            { trim: true, normalize: true, fade: true }
          );
          await saveSoundQuick('Recording', processed);
        } catch (e) {
          await saveSoundQuick('Recording', blob);
        }
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.info('Recording...');
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        toast.error('Microphone access denied');
      } else if (e.name === 'NotFoundError') {
        toast.error('No microphone found');
      } else {
        toast.error('Recording failed: ' + e.message);
      }
      resumeVoice();
    }
  }

  async function saveSoundQuick(name: string, blob: Blob) {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2)}`;
    const order = sounds.filter(s => (s.bank || 'Main') === activeBank).length;
    const color = PAD_COLORS[Math.floor(Math.random() * PAD_COLORS.length)].name;
    const icon = DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
    
    const meta: Sound = {
      id,
      name: `${name} ${sounds.length + 1}`,
      icon,
      category: 'Voice',
      color,
      volume: 80,
      bank: activeBank,
      order,
      loopDefault: false,
    };
    
    await saveMeta(meta);
    await saveAudio(id, blob);
    await decodeAudio(id, blob);
    
    sounds.push(meta);
    setSounds([...sounds]);
    toast.success('Sound saved');
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    
    setUploadProcessing(true);
    setUploadProgress(0);
    
    let success = 0;
    
    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      setUploadProgress(Math.round(((i + 1) / pendingFiles.length) * 100));
      
      try {
        const blob = await processFile(file, { trim: optTrim, normalize: optNorm, fade: optFade });
        const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2)}`;
        const meta: Sound = {
          id,
          name: file.name.replace(/\.[^/.]+$/, ''),
          icon: DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)],
          category: uploadCategory,
          color: PAD_COLORS[Math.floor(Math.random() * PAD_COLORS.length)].name,
          volume: 80,
          bank: uploadBank,
          order: sounds.length,
          loopDefault: false,
        };
        
        await saveMeta(meta);
        await saveAudio(id, blob);
        await decodeAudio(id, blob);
        sounds.push(meta);
        success++;
      } catch (e) {
        console.error('Upload failed:', e);
      }
    }
    
    setSounds([...sounds]);
    setUploadProcessing(false);
    setPendingFiles([]);
    setUploadOpen(false);
    toast.success(`${success} sounds imported`);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => {
        if (f.size > CONFIG.MAX_FILE_SIZE) {
          toast.error(`"${f.name}" too large`);
          return false;
        }
        if (!f.type.startsWith('audio/')) {
          toast.error(`"${f.name}" not audio`);
          return false;
        }
        return true;
      });
      setPendingFiles(files);
    }
  }

  async function handleEditSave() {
    if (!editingSound) return;
    
    const idx = sounds.findIndex(s => s.id === editingSound.id);
    if (idx === -1) return;
    
    sounds[idx] = {
      ...sounds[idx],
      name: editName || 'Untitled',
      icon: editIcon || '🔊',
      color: editColor,
      volume: editVolume,
      bank: editBank,
      category: editCategory,
      loopDefault: editLoopDefault,
    };
    
    await saveMeta(sounds[idx]);
    setSounds([...sounds]);
    setEditOpen(false);
    toast.success('Sound updated');
  }

  async function handleDelete(id: string) {
    const sound = sounds.find(s => s.id === id);
    if (!sound) return;
    
    if (!confirm(`Delete "${sound.name}"?`)) return;
    
    stop(id);
    evictBuffer(id);
    await deleteMeta(id);
    await deleteAudio(id);
    
    const newSounds = sounds.filter(s => s.id !== id);
    setSounds(newSounds);
    toast.success('Sound deleted');
  }

  async function handleDownload(id: string) {
    const blob = await loadAudio(id);
    if (!blob) return;
    
    const sound = sounds.find(s => s.id === id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sound?.name || 'sound'}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleAddBank() {
    const name = prompt('New bank name:');
    if (!name) return;
    
    const trimmed = name.trim();
    if (!trimmed || banks.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Bank already exists');
      return;
    }
    
    banks.push(trimmed);
    await saveBank(trimmed);
    setBanks([...banks]);
    toast.success(`"${trimmed}" created`);
  }

  async function handleDeleteBank(name: string) {
    if (name === 'Main') {
      toast.error('Cannot delete Main bank');
      return;
    }
    
    if (!confirm(`Delete "${name}"? Sounds will move to Main.`)) return;
    
    const toMove = sounds.filter(s => s.bank === name);
    for (const s of toMove) {
      s.bank = 'Main';
      await saveMeta(s);
    }
    
    const newBanks = banks.filter(b => b !== name);
    setBanks(newBanks);
    await deleteBank(name);
    
    if (activeBank === name) {
      setActiveBank('Main');
    }
    
    setSounds([...sounds]);
    toast.success('Bank deleted');
  }

  async function handleExport() {
    setExportOpen(true);
    setExportProgress(0);
    
    const data: ExportData = {
      version: CONFIG.EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      banks,
      sounds: [],
    };
    
    for (let i = 0; i < sounds.length; i++) {
      const s = sounds[i];
      setExportProgress(Math.round(((i + 1) / sounds.length) * 100));
      
      try {
        const blob = await loadAudio(s.id);
        let base64: string | null = null;
        
        if (blob) {
          const reader = new FileReader();
          base64 = await new Promise((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
        }
        
        data.sounds.push({
          ...s,
          audioBase64: base64,
          mimeType: blob?.type || 'audio/wav',
        });
      } catch (e) {
        data.sounds.push({ ...s, audioBase64: null, mimeType: 'audio/wav' });
      }
      
      if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
    }
    
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sounddeck-${new Date().toISOString().split('T')[0]}.sounddeck`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setExportProgress(100);
    setTimeout(() => setExportOpen(false), 1000);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);
      
      if (!data.sounds?.length) {
        toast.error('No sounds in file');
        return;
      }
      
      setImportData(data);
      setImportOpen(true);
    } catch (e) {
      toast.error('Invalid file');
    }
  }

  async function handleConfirmImport() {
    if (!importData) return;
    
    setImportProgress(0);
    
    // Add banks
    for (const b of importData.banks) {
      if (!banks.includes(b)) {
        banks.push(b);
        await saveBank(b);
      }
    }
    
    const existing = new Set(sounds.map(s => s.name.toLowerCase()));
    const withAudio = importData.sounds.filter(s => s.audioBase64);
    const toImport = importReplace 
      ? withAudio 
      : withAudio.filter(s => !existing.has(s.name.toLowerCase()));
    
    let count = 0;
    for (let i = 0; i < toImport.length; i++) {
      const s = toImport[i];
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
      
      try {
        const byteString = atob(s.audioBase64!);
        const array = new Uint8Array(byteString.length);
        for (let j = 0; j < byteString.length; j++) {
          array[j] = byteString.charCodeAt(j);
        }
        const blob = new Blob([array], { type: s.mimeType || 'audio/wav' });
        
        if (importReplace) {
          const existingIdx = sounds.findIndex(x => x.name.toLowerCase() === s.name.toLowerCase());
          if (existingIdx !== -1) {
            const ex = sounds[existingIdx];
            await saveAudio(ex.id, blob);
            evictBuffer(ex.id);
            await decodeAudio(ex.id, blob);
            Object.assign(sounds[existingIdx], {
              icon: s.icon,
              category: s.category,
              color: s.color,
              volume: s.volume,
              bank: s.bank || 'Main',
            });
            await saveMeta(sounds[existingIdx]);
            count++;
            continue;
          }
        }
        
        const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2)}`;
        const meta: Sound = {
          id,
          name: s.name,
          icon: s.icon || '🔊',
          category: s.category || 'All',
          color: s.color || 'purple',
          volume: s.volume || 80,
          bank: s.bank || 'Main',
          order: sounds.length,
          loopDefault: s.loopDefault || false,
        };
        
        await saveMeta(meta);
        await saveAudio(id, blob);
        await decodeAudio(id, blob);
        sounds.push(meta);
        count++;
      } catch (e) {
        console.error('Import failed:', e);
      }
      
      if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
    }
    
    setSounds([...sounds]);
    setImportOpen(false);
    setImportData(null);
    toast.success(`Imported ${count} sounds`);
  }

  async function handleClearAll() {
    if (!confirm('Delete ALL sounds?') || !confirm('Cannot undo.')) return;
    
    stopAll();
    await clearAll();
    setSounds([]);
    setSettingsOpen(false);
    toast.success('All sounds deleted');
  }

  // Chopper functions
  async function handleChopFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('Not an audio file');
      return;
    }
    
    try {
      toast.info('Decoding audio...');
      const buffer = await decodeFile(file);
      setChopBuffer(buffer);
      setChopRegions([]);
      setChopSelection({ start: 0, end: 0 });
      setChopCanvasReady(true);
      drawChopWaveform(buffer, []);
    } catch (e) {
      toast.error('Failed to decode audio');
    }
  }

  function drawChopWaveform(buffer: AudioBuffer, regions: typeof chopRegions, selection?: { start: number; end: number }) {
    const canvas = chopCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const W = rect.width;
    const H = rect.height;
    
    // Background
    ctx.fillStyle = '#14141f';
    ctx.fillRect(0, 0, W, H);
    
    // Draw regions
    for (const r of regions) {
      const x1 = (r.start / buffer.duration) * W;
      const x2 = (r.end / buffer.duration) * W;
      ctx.fillStyle = r.color + '30';
      ctx.fillRect(x1, 0, x2 - x1, H);
      ctx.fillStyle = r.color;
      ctx.fillRect(x1, 0, 2, H);
      ctx.fillRect(x2 - 2, 0, 2, H);
    }
    
    // Draw selection
    const sel = selection || chopSelection;
    if (sel.end > sel.start) {
      const x1 = (sel.start / buffer.duration) * W;
      const x2 = (sel.end / buffer.duration) * W;
      ctx.fillStyle = 'rgba(123,97,255,0.25)';
      ctx.fillRect(x1, 0, x2 - x1, H);
      ctx.strokeStyle = '#7b61ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, 0, x2 - x1, H);
    }
    
    // Draw waveform
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / W);
    ctx.beginPath();
    ctx.strokeStyle = '#00e5a0';
    ctx.lineWidth = 1;
    const mid = H / 2;
    
    for (let x = 0; x < W; x++) {
      const idx = Math.floor(x * data.length / W);
      let min = 0, max = 0;
      for (let j = 0; j < step && idx + j < data.length; j++) {
        const v = data[idx + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ctx.moveTo(x, mid + min * mid * 0.95);
      ctx.lineTo(x, mid + max * mid * 0.95);
    }
    ctx.stroke();
    
    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();
  }

  function handleChopCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!chopBuffer) return;
    const canvas = chopCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * chopBuffer.duration;
    
    isDraggingRef.current = true;
    setChopSelection({ start: time, end: time });
  }

  function handleChopCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDraggingRef.current || !chopBuffer) return;
    const canvas = chopCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * chopBuffer.duration;
    
    setChopSelection(prev => {
      const newSel = { ...prev, end: time };
      if (newSel.end < newSel.start) {
        const t = newSel.start;
        newSel.start = newSel.end;
        newSel.end = t;
      }
      drawChopWaveform(chopBuffer, chopRegions, newSel);
      return newSel;
    });
  }

  function handleChopCanvasMouseUp() {
    isDraggingRef.current = false;
    if (chopSelection.end - chopSelection.start < 0.02) {
      setChopSelection({ start: 0, end: 0 });
      if (chopBuffer) drawChopWaveform(chopBuffer, chopRegions, { start: 0, end: 0 });
    }
  }

  function handleChopPreview() {
    if (!chopBuffer) return;
    if (chopSelection.end > chopSelection.start) {
      previewBuffer(chopBuffer, chopSelection.start, chopSelection.end - chopSelection.start);
    } else {
      previewBuffer(chopBuffer);
    }
  }

  async function handleChopSaveRegion() {
    if (!chopBuffer || chopSelection.end - chopSelection.start < 0.02) {
      toast.error('Select a region first');
      return;
    }
    
    const region = extractRegion(chopBuffer, chopSelection.start, chopSelection.end);
    if (!region) {
      toast.error('Failed to extract region');
      return;
    }
    
    const processed = fadeInOut(normalize(region));
    const blob = encodeWAV(processed);
    const colors = ['#ff3d71', '#00e5a0', '#7b61ff', '#ffaa00', '#3d9eff', '#ff61a6', '#00d4c8', '#ffe144'];
    const color = colors[chopRegions.length % colors.length];
    
    const newRegion = {
      start: chopSelection.start,
      end: chopSelection.end,
      name: `Region ${chopRegions.length + 1}`,
      color,
    };
    
    setChopRegions([...chopRegions, newRegion]);
    
    // Save to library
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2)}`;
    const order = sounds.filter(s => (s.bank || 'Main') === chopBank).length;
    const rc = PAD_COLORS.find(c => '#' + c.swatch === color)?.name || PAD_COLORS[0].name;
    const ri = DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
    
    const meta: Sound = {
      id,
      name: `Chopped ${chopRegions.length + 1}`,
      icon: ri,
      category: chopCategory,
      color: rc,
      volume: 80,
      bank: chopBank,
      order,
      loopDefault: false,
    };
    
    await saveMeta(meta);
    await saveAudio(id, blob);
    await decodeAudio(id, blob);
    sounds.push(meta);
    setSounds([...sounds]);
    
    toast.success(`Saved "${meta.name}"`);
  }

  async function handleChopAutoSplit() {
    if (!chopBuffer) {
      toast.error('Load audio first');
      return;
    }
    
    toast.info('Detecting segments...');
    const detected = detectSilences(chopBuffer);
    
    if (!detected.length) {
      toast.error('No distinct segments found');
      return;
    }
    
    const colors = ['#ff3d71', '#00e5a0', '#7b61ff', '#ffaa00', '#3d9eff', '#ff61a6', '#00d4c8', '#ffe144'];
    let count = 0;
    
    for (let i = 0; i < detected.length; i++) {
      const r = detected[i];
      const region = extractRegion(chopBuffer, r.start, r.end);
      if (!region) continue;
      
      const processed = fadeInOut(normalize(region));
      const blob = encodeWAV(processed);
      const color = colors[(chopRegions.length + i) % colors.length];
      
      const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2)}`;
      const order = sounds.filter(s => (s.bank || 'Main') === chopBank).length;
      const rc = PAD_COLORS.find(c => '#' + c.swatch === color)?.name || PAD_COLORS[0].name;
      const ri = DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
      
      const meta: Sound = {
        id,
        name: `Auto ${chopRegions.length + i + 1}`,
        icon: ri,
        category: chopCategory,
        color: rc,
        volume: 80,
        bank: chopBank,
        order,
        loopDefault: false,
      };
      
      await saveMeta(meta);
      await saveAudio(id, blob);
      await decodeAudio(id, blob);
      sounds.push(meta);
      count++;
    }
    
    setSounds([...sounds]);
    toast.success(`Auto-split: ${count} segments saved`);
  }

  const filteredSounds = getFilteredSounds();
  const categories = getCategories();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#eeeef5] font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 shrink-0 z-10">
        <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-[#ff3d71] to-[#7b61ff] bg-clip-text text-transparent">
          SoundDeck
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setSearchVisible(!searchVisible)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              searchVisible ? 'bg-[#ff3d71] text-white' : 'bg-[#1c1c2e] text-[#eeeef5]'
            }`}
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => {
              const active = toggleVoice();
              setVoiceActive(active);
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              voiceActive ? 'bg-[#ff3d71] text-white' : 'bg-[#1c1c2e] text-[#eeeef5]'
            }`}
          >
            <Mic size={18} />
          </button>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              editMode ? 'bg-[#ff3d71] text-white' : 'bg-[#1c1c2e] text-[#eeeef5]'
            }`}
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={() => {
              setLoopMode(!loopMode);
              toast.info(loopMode ? 'Loop OFF' : 'Loop ON');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              loopMode ? 'bg-[#ff3d71] text-white' : 'bg-[#1c1c2e] text-[#eeeef5]'
            }`}
          >
            <Repeat size={18} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 rounded-xl bg-[#1c1c2e] text-[#eeeef5] flex items-center justify-center"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Voice Bar */}
      {voiceActive && (
        <div className="px-5 pb-2">
          <div className="bg-[#1c1c2e] rounded-xl px-4 py-3 flex items-center gap-3 border border-[#24243a]">
            <div className="w-3 h-3 rounded-full bg-[#00e5a0] animate-pulse" />
            <span className="flex-1 text-sm text-[#8888aa]">Listening...</span>
            <button onClick={() => setHelpOpen(true)} className="text-[#8888aa]">
              <HelpCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {searchVisible && (
        <div className="px-5 pb-3">
          <Input
            placeholder="Search sounds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#1c1c2e] border-[#24243a] text-[#eeeef5] placeholder:text-[#8888aa]"
          />
        </div>
      )}

      {/* Bank Bar */}
      <div className="px-5 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {banks.map(bank => (
          <button
            key={bank}
            onClick={() => {
              setActiveBank(bank);
              setActiveCategory('All');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeBank === bank
                ? 'bg-[#7b61ff] text-white'
                : 'bg-[#1c1c2e] text-[#8888aa] border border-[#24243a]'
            }`}
          >
            {bank}
            <span className="ml-1 text-xs opacity-60">
              {sounds.filter(s => (s.bank || 'Main') === bank).length}
            </span>
          </button>
        ))}
        <button
          onClick={handleAddBank}
          className="w-9 h-9 rounded-xl border border-dashed border-[#24243a] text-[#8888aa] flex items-center justify-center text-xl"
        >
          +
        </button>
      </div>

      {/* Categories */}
      <div className="px-5 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-[#ff3d71] text-white'
                : 'border border-[#24243a] text-[#8888aa]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sound Grid */}
      <ScrollArea className="flex-1 px-3 pb-24">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
          {filteredSounds.map((sound, idx) => (
            <button
              key={sound.id}
              onClick={() => {
                if (editMode) {
                  setEditingSound(sound);
                  setEditName(sound.name);
                  setEditIcon(sound.icon);
                  setEditColor(sound.color);
                  setEditBank(sound.bank || 'Main');
                  setEditCategory(sound.category);
                  setEditVolume(sound.volume || 80);
                  setEditLoopDefault(sound.loopDefault || false);
                  setEditOpen(true);
                } else {
                  handlePlay(sound);
                }
              }}
              className={`
                relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1
                transition-all active:scale-95
                ${editMode ? 'animate-pulse' : ''}
                ${playingIds.has(sound.id) ? 'ring-2 ring-white/30' : ''}
                ${{
                  red: 'bg-gradient-to-br from-[#ff3d71] to-[#c0193f]',
                  green: 'bg-gradient-to-br from-[#00e5a0] to-[#009965]',
                  purple: 'bg-gradient-to-br from-[#7b61ff] to-[#4a30cc]',
                  orange: 'bg-gradient-to-br from-[#ffaa00] to-[#cc7700]',
                  blue: 'bg-gradient-to-br from-[#3d9eff] to-[#1a5fcc]',
                  pink: 'bg-gradient-to-br from-[#ff61a6] to-[#cc2070]',
                  teal: 'bg-gradient-to-br from-[#00d4c8] to-[#009088]',
                  yellow: 'bg-gradient-to-br from-[#ffe144] to-[#ccaa00]',
                }[sound.color]}
              `}
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-bold text-white/50 bg-black/30 px-1 rounded">
                #{idx + 1}
              </span>
              {editMode && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(sound.id);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-[#ff3d71] flex items-center justify-center text-xs border border-[#ff3d71]"
                >
                  ×
                </span>
              )}
              <span className="text-2xl relative z-10 drop-shadow-md">{sound.icon}</span>
              <span className="text-[10px] font-semibold text-center text-white leading-tight px-1 line-clamp-2 text-shadow">
                {sound.name}
              </span>
              {(sound.loopDefault || loopMode) && (
                <span className="absolute bottom-1 text-[8px] bg-black/50 px-1.5 rounded text-white/80 tracking-wider font-bold">
                  LOOP
                </span>
              )}
            </button>
          ))}
        </div>
        
        {filteredSounds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-6xl opacity-40 mb-4">🎧</span>
            <p className="text-[#8888aa]">
              No sounds here.<br />
              Record, upload, or use the chopper.
            </p>
          </div>
        )}
      </ScrollArea>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 px-5 py-3 bg-gradient-to-t from-[#0a0a0f] to-transparent flex gap-2.5 z-20">
        <Button
          onClick={handleRecord}
          className={`flex-1 h-13 rounded-xl font-bold ${
            isRecording 
              ? 'bg-[#ff1744] animate-pulse' 
              : 'bg-[#ff3d71] hover:bg-[#ff3d71]/90'
          }`}
        >
          {isRecording ? <Square size={18} className="mr-2" /> : <Circle size={18} className="mr-2" />}
          {isRecording ? 'Stop' : 'Record'}
        </Button>
        <Button
          onClick={() => setUploadOpen(true)}
          variant="secondary"
          className="flex-1 h-13 rounded-xl bg-[#1c1c2e] text-[#eeeef5] font-bold"
        >
          <Upload size={18} className="mr-2" />
          Upload
        </Button>
        <Button
          onClick={() => setChopperOpen(true)}
          className="h-13 w-13 rounded-xl bg-gradient-to-br from-[#ffaa00] to-[#cc7700] font-bold"
        >
          <Scissors size={20} />
        </Button>
        <Button
          onClick={() => { stopAll(); refreshUI(); }}
          variant="secondary"
          className="h-13 w-13 rounded-xl bg-[#1c1c2e] text-[#ff3d71] font-bold"
        >
          <Square size={20} />
        </Button>
      </div>

      {/* Upload Modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="bg-[#14141f] border-[#24243a] text-[#eeeef5] max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Sounds</DialogTitle>
          </DialogHeader>
          
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#24243a] rounded-2xl p-8 text-center cursor-pointer hover:border-[#00e5a0] hover:bg-[#00e5a0]/5 transition-all"
          >
            <p className="font-semibold mb-1">Drag & drop audio files</p>
            <p className="text-sm text-[#8888aa]">or click to browse. Max 5 MB per file.</p>
            <Button variant="secondary" className="mt-3 bg-[#24243a]">
              <FolderPlus size={18} className="mr-2" />
              Choose Files
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Bank</Label>
              <Select value={uploadBank} onValueChange={setUploadBank}>
                <SelectTrigger className="bg-[#1c1c2e] border-[#24243a]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1c1c2e] border-[#24243a]">
                  {banks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="bg-[#1c1c2e] border-[#24243a]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1c1c2e] border-[#24243a]">
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Processing</Label>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1c1c2e] border border-[#24243a] cursor-pointer">
                <input type="checkbox" checked={optTrim} onChange={(e) => setOptTrim(e.target.checked)} className="accent-[#00e5a0]" />
                <span className="text-sm">Trim silence</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1c1c2e] border border-[#24243a] cursor-pointer">
                <input type="checkbox" checked={optNorm} onChange={(e) => setOptNorm(e.target.checked)} className="accent-[#00e5a0]" />
                <span className="text-sm">Normalize</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1c1c2e] border border-[#24243a] cursor-pointer">
                <input type="checkbox" checked={optFade} onChange={(e) => setOptFade(e.target.checked)} className="accent-[#00e5a0]" />
                <span className="text-sm">Fade in/out</span>
              </label>
            </div>
          </div>
          
          {uploadProcessing && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-[#8888aa] text-center">Processing...</p>
            </div>
          )}
          
          {pendingFiles.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-[#24243a]">
                  <span className="truncate">{f.name}</span>
                  <span className="text-[#8888aa]">{Math.round(f.size / 1024)}KB</span>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>Close</Button>
            {pendingFiles.length > 0 && !uploadProcessing && (
              <Button onClick={handleUpload} className="bg-[#7b61ff]">Import All</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chopper Modal */}
      <Dialog open={chopperOpen} onOpenChange={setChopperOpen}>
        <DialogContent className="bg-[#14141f] border-[#24243a] text-[#eeeef5] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors size={20} />
              Audio Chopper
            </DialogTitle>
          </DialogHeader>
          
          {!chopCanvasReady ? (
            <div
              onClick={() => chopFileInputRef.current?.click()}
              className="border-2 border-dashed border-[#24243a] rounded-2xl p-6 text-center cursor-pointer hover:border-[#00e5a0] hover:bg-[#00e5a0]/5 transition-all"
            >
              <p className="font-semibold mb-1">Drop or choose an audio file</p>
              <p className="text-sm text-[#8888aa]">Any length — we&apos;ll slice it up.</p>
              <Button variant="secondary" className="mt-3 bg-[#24243a] text-sm">
                <FolderPlus size={16} className="mr-2" />
                Choose File
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <canvas
                  ref={chopCanvasRef}
                  className="w-full h-36 bg-[#14141f] rounded-lg cursor-crosshair"
                  onMouseDown={handleChopCanvasMouseDown}
                  onMouseMove={handleChopCanvasMouseMove}
                  onMouseUp={handleChopCanvasMouseUp}
                  onMouseLeave={handleChopCanvasMouseUp}
                />
                {chopBuffer && (
                  <div className="flex justify-between text-xs text-[#8888aa] mt-1">
                    <span>{chopBuffer.duration.toFixed(2)}s</span>
                    <span>
                      {chopSelection.end > chopSelection.start 
                        ? `Selected: ${chopSelection.start.toFixed(2)}s - ${chopSelection.end.toFixed(2)}s (${(chopSelection.end - chopSelection.start).toFixed(2)}s)`
                        : 'Drag on waveform to select'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="secondary" size="sm" onClick={handleChopPreview}>
                  <Play size={14} className="mr-1" />
                  Preview
                </Button>
                <Button size="sm" onClick={handleChopSaveRegion} className="bg-[#00e5a0] text-black">
                  <Check size={14} className="mr-1" />
                  Save Selection
                </Button>
                <Button size="sm" onClick={handleChopAutoSplit} className="bg-[#ffaa00] text-black">
                  <Scissors size={14} className="mr-1" />
                  Auto-Split
                </Button>
                <Button variant="secondary" size="sm" onClick={() => {
                  setChopBuffer(null);
                  setChopCanvasReady(false);
                  setChopRegions([]);
                }}>
                  New File
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Bank</Label>
                  <Select value={chopBank} onValueChange={setChopBank}>
                    <SelectTrigger className="bg-[#1c1c2e] border-[#24243a]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1c1c2e] border-[#24243a]">
                      {banks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Category</Label>
                  <Select value={chopCategory} onValueChange={setChopCategory}>
                    <SelectTrigger className="bg-[#1c1c2e] border-[#24243a]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1c1c2e] border-[#24243a]">
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
          
          <DialogFooter>
            <Button variant="secondary" onClick={() => setChopperOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#14141f] border-[#24243a] text-[#eeeef5]">
          <DialogHeader>
            <DialogTitle>Edit Sound</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-[#1c1c2e] border-[#24243a]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Emoji</Label>
                <Input
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  maxLength={4}
                  className="bg-[#1c1c2e] border-[#24243a]"
                />
              </div>
              <div>
                <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Color</Label>
                <Select value={editColor} onValueChange={(v) => setEditColor(v as PadColor)}>
                  <SelectTrigger className="bg-[#1c1c2e] border-[#24243a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c2e] border-[#24243a]">
                    {PAD_COLORS.map(c => (
                      <SelectItem key={c.name} value={c.name}>
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: c.swatch }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Bank</Label>
                <Select value={editBank} onValueChange={setEditBank}>
                  <SelectTrigger className="bg-[#1c1c2e] border-[#24243a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c2e] border-[#24243a]">
                    {banks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="bg-[#1c1c2e] border-[#24243a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c2e] border-[#24243a]">
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Volume</Label>
              <div className="flex items-center gap-3">
                <Volume1 size={18} className="text-[#8888aa]" />
                <Slider
                  value={[editVolume]}
                  onValueChange={([v]) => setEditVolume(v)}
                  min={0}
                  max={100}
                  className="flex-1"
                />
                <Volume2 size={18} className="text-[#8888aa]" />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-xs text-[#8888aa] uppercase tracking-wider">Loop by default</Label>
              <Switch checked={editLoopDefault} onCheckedChange={setEditLoopDefault} />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => editingSound && handleDelete(editingSound.id)}
            >
              <Trash2 size={16} className="mr-1" />
              Delete
            </Button>
            <Button
              variant="secondary"
              onClick={() => editingSound && handleDownload(editingSound.id)}
            >
              <Download size={16} className="mr-1" />
              WAV
            </Button>
            <Button onClick={handleEditSave} className="bg-[#7b61ff]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-[#14141f] border-[#24243a] text-[#eeeef5]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2">
            <button
              onClick={() => { setSettingsOpen(false); setBankManagerOpen(true); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#1c1c2e] border border-[#24243a] hover:bg-[#24243a] transition-all text-left"
            >
              <span className="text-2xl">📂</span>
              <div className="flex-1">
                <div className="font-semibold">Manage Banks</div>
                <div className="text-xs text-[#8888aa]">Create, rename, delete</div>
              </div>
              <span className="text-[#8888aa]">›</span>
            </button>
            
            <button
              onClick={() => { setSettingsOpen(false); handleExport(); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#1c1c2e] border border-[#24243a] hover:bg-[#24243a] transition-all text-left"
            >
              <span className="text-2xl">📤</span>
              <div className="flex-1">
                <div className="font-semibold">Export</div>
                <div className="text-xs text-[#8888aa]">Download .sounddeck backup</div>
              </div>
              <span className="text-[#8888aa]">›</span>
            </button>
            
            <button
              onClick={() => { setSettingsOpen(false); importFileInputRef.current?.click(); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#1c1c2e] border border-[#24243a] hover:bg-[#24243a] transition-all text-left"
            >
              <span className="text-2xl">📥</span>
              <div className="flex-1">
                <div className="font-semibold">Import</div>
                <div className="text-xs text-[#8888aa]">Restore from backup</div>
              </div>
              <span className="text-[#8888aa]">›</span>
            </button>
            
            <button
              onClick={handleClearAll}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#1c1c2e] border border-[#24243a] hover:bg-[#24243a] transition-all text-left"
            >
              <span className="text-2xl">🗑️</span>
              <div className="flex-1">
                <div className="font-semibold text-[#ff3d71]">Clear All</div>
                <div className="text-xs text-[#8888aa]">Delete everything</div>
              </div>
              <span className="text-[#8888aa]">›</span>
            </button>
          </div>
          
          <div className="text-center text-xs text-[#8888aa] mt-4">
            {sounds.length} sounds
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Manager Modal */}
      <Dialog open={bankManagerOpen} onOpenChange={setBankManagerOpen}>
        <DialogContent className="bg-[#14141f] border-[#24243a] text-[#eeeef5]">
          <DialogHeader>
            <DialogTitle>Manage Banks</DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2">
            <Input
              placeholder="New bank name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddBank();
                  (e.target as HTMLInputElement).value = '';
                }
              }}
              className="bg-[#1c1c2e] border-[#24243a]"
            />
            <Button onClick={handleAddBank} className="bg-[#7b61ff]">Add</Button>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {banks.map(bank => (
              <div
                key={bank}
                className={`flex items-center justify-between p-3 rounded-xl bg-[#1c1c2e] border ${
                  activeBank === bank ? 'border-[#7b61ff]' : 'border-[#24243a]'
                }`}
              >
                <span className="font-semibold">{bank}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#8888aa]">
                    {sounds.filter(s => (s.bank || 'Main') === bank).length}
                  </span>
                  {bank !== 'Main' && (
                    <button
                      onClick={() => handleDeleteBank(bank)}
                      className="w-7 h-7 rounded-lg bg-[#ff3d71]/15 text-[#ff3d71] flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Modal */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="bg-[#14141f] border-[#24243a] text-[#eeeef5]">
          <DialogHeader>
            <DialogTitle>Voice Commands</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-xs text-[#8888aa] uppercase tracking-wider mb-2">Play</div>
              <div className="flex flex-wrap gap-2">
                <code className="px-2 py-1 bg-[#24243a] rounded text-[#00e5a0]">play 1</code>
                <code className="px-2 py-1 bg-[#24243a] rounded text-[#00e5a0]">play air horn</code>
              </div>
            </div>
            <div>
              <div className="text-xs text-[#8888aa] uppercase tracking-wider mb-2">Stop</div>
              <div className="flex flex-wrap gap-2">
                <code className="px-2 py-1 bg-[#24243a] rounded text-[#00e5a0]">stop</code>
                <code className="px-2 py-1 bg-[#24243a] rounded text-[#00e5a0]">stop all</code>
              </div>
            </div>
            <div>
              <div className="text-xs text-[#8888aa] uppercase tracking-wider mb-2">Loop</div>
              <div className="flex flex-wrap gap-2">
                <code className="px-2 py-1 bg-[#24243a] rounded text-[#00e5a0]">loop on</code>
                <code className="px-2 py-1 bg-[#24243a] rounded text-[#00e5a0]">loop off</code>
              </div>
            </div>
            <div>
              <div className="text-xs text-[#8888aa] uppercase tracking-wider mb-2">Banks</div>
              <div className="flex flex-wrap gap-2">
                <code className="px-2 py-1 bg-[#24243a] rounded text-[#00e5a0]">switch to memes</code>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Progress Modal */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="bg-[#14141f] border-[#24243a] text-[#eeeef5]">
          <DialogHeader>
            <DialogTitle>Exporting...</DialogTitle>
          </DialogHeader>
          <Progress value={exportProgress} className="h-2" />
          <p className="text-sm text-[#8888aa] text-center">{exportProgress}%</p>
        </DialogContent>
      </Dialog>

      {/* Import Preview Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="bg-[#14141f] border-[#24243a] text-[#eeeef5]">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
          
          {importData && (
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-[#24243a]">
                <span className="text-[#8888aa]">Sounds</span>
                <span className="font-semibold">{importData.sounds.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24243a]">
                <span className="text-[#8888aa]">New</span>
                <span className="font-semibold text-[#00e5a0]">
                  {importData.sounds.filter(s => !sounds.some(x => x.name.toLowerCase() === s.name.toLowerCase())).length}
                </span>
              </div>
              
              <label className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  checked={importReplace}
                  onChange={(e) => setImportReplace(e.target.checked)}
                  className="accent-[#7b61ff]"
                />
                <span>Replace existing</span>
              </label>
              
              {importProgress > 0 && (
                <Progress value={importProgress} className="h-2" />
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmImport} className="bg-[#7b61ff]">Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={chopFileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleChopFileSelect}
      />
      <input
        ref={importFileInputRef}
        type="file"
        accept=".sounddeck,.json"
        className="hidden"
        onChange={handleImportFile}
      />
    </div>
  );
}

export default App;
