import { Pause, Play, SkipForward, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAudioCoverFallback } from '../data/musicCatalog';

export function MiniAudioPlayer() {
  const {
    activeTab,
    setActiveTab,
    currentTrack,
    isPlaying,
    audioLoading,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    stopPlayer,
  } = useApp();

  if (!currentTrack || activeTab === 'music') return null;

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const fallbackCover = getAudioCoverFallback(currentTrack);

  return (
    <div className="fixed bottom-16 left-0 right-0 z-35 px-2 sm:px-4 pb-1.5 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-3xl overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between gap-2.5 px-3 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('music')}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <img
              src={currentTrack.coverUrl || fallbackCover}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                if (e.currentTarget.src !== fallbackCover) {
                  e.currentTarget.src = fallbackCover;
                }
              }}
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                {currentTrack.title}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {currentTrack.artist}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pausar música' : 'Reproducir música'}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
            >
              {audioLoading ? (
                <span className="h-4 w-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-slate-950" />
              ) : (
                <Play className="h-4 w-4 fill-slate-950 ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={playNext}
              aria-label="Siguiente canción"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={stopPlayer}
              aria-label="Cerrar reproductor"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-0.5 w-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-amber-500 transition-[width] duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
