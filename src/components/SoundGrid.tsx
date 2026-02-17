import { ScrollArea } from '@/components/ui/scroll-area';
import { type Sound, type PadColor } from '@/types';

interface SoundGridProps {
  sounds: Sound[];
  playingIds: Set<string>;
  editMode: boolean;
  loopMode: boolean;
  onPlay: (sound: Sound) => void;
  onEdit: (sound: Sound) => void;
  onDelete: (id: string) => void;
}

const colorMap: Record<string, string> = {
  red: 'bg-gradient-to-br from-[#ff3d71] to-[#c0193f]',
  green: 'bg-gradient-to-br from-[#00e5a0] to-[#009965]',
  purple: 'bg-gradient-to-br from-[#7b61ff] to-[#4a30cc]',
  orange: 'bg-gradient-to-br from-[#ffaa00] to-[#cc7700]',
  blue: 'bg-gradient-to-br from-[#3d9eff] to-[#1a5fcc]',
  pink: 'bg-gradient-to-br from-[#ff61a6] to-[#cc2070]',
  teal: 'bg-gradient-to-br from-[#00d4c8] to-[#009088]',
  yellow: 'bg-gradient-to-br from-[#ffe144] to-[#ccaa00]',
};

export function SoundGrid({
  sounds,
  playingIds,
  editMode,
  loopMode,
  onPlay,
  onEdit,
  onDelete,
}: SoundGridProps) {
  if (sounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center flex-1">
        <span className="text-6xl opacity-40 mb-4">🎧</span>
        <p className="text-[#8888aa]">
          No sounds here.<br />
          Record, upload, or use the chopper.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-3 pb-24">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
        {sounds.map((sound, idx) => (
          <button
            key={sound.id}
            onClick={() => (editMode ? onEdit(sound) : onPlay(sound))}
            className={`
              relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1
              transition-all active:scale-95 cursor-pointer
              ${editMode ? 'animate-pulse' : ''}
              ${playingIds.has(sound.id) ? 'ring-2 ring-white/30' : ''}
              ${colorMap[sound.color as keyof typeof colorMap] || colorMap.purple}
            `}
            title={sound.name}
          >
            <span className="absolute top-1 left-1.5 text-[9px] font-bold text-white/50 bg-black/30 px-1 rounded">
              #{idx + 1}
            </span>
            {editMode && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(sound.id);
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-[#ff3d71] flex items-center justify-center text-xs border border-[#ff3d71] hover:bg-black cursor-pointer transition-all"
              >
                ×
              </span>
            )}
            <span className="text-2xl relative z-10 drop-shadow-md">{sound.icon}</span>
            <span className="text-[10px] font-semibold text-center text-white leading-tight px-1 line-clamp-2">
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
    </ScrollArea>
  );
}