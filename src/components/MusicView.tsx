import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Captions,
  Disc3,
  FileText,
  Heart,
  Headphones,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ADVENTIST_MUSIC_VIDEOS,
  HIMNARIO_ANTIGUO_CURATED,
  HIMNARIO_NUEVO_STARTER,
  getAudioCoverFallback,
} from '../data/musicCatalog';
import { useApp } from '../context/AppContext';
import { formatVideoTime, sendYtCommand, useYouTubeProgress } from '../lib/youtubePlayer';
import { MusicTrack, MusicVideo } from '../types';

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

interface LyricsModalState {
  track: MusicTrack;
  loading: boolean;
  found: boolean;
  lyrics: string;
  correlatedNumber?: number;
}

export function MusicView() {
  const {
    currentTrack,
    isPlaying,
    audioLoading,
    currentTime,
    duration,
    shuffle,
    repeat,
    favoriteTrackIds,
    toggleShuffle,
    toggleRepeat,
    toggleFavoriteTrack,
    playTrack,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    showToast,
  } = useApp();

  const [mode, setMode] = useState<'audio' | 'videos'>('audio');

  // Top Header Search Bar State (Magnifying Glass at the top)
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const topSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Audio = Solo Himnario (Nuevo 2009 y Antiguo 1962)
  const [hymnFilter, setHymnFilter] = useState<'nuevo' | 'antiguo' | 'favoritos'>('nuevo');
  const [hymnSearchQuery, setHymnSearchQuery] = useState('');
  const [nuevoHymns, setNuevoHymns] = useState<MusicTrack[]>(HIMNARIO_NUEVO_STARTER);
  const [antiguoHymns, setAntiguoHymns] = useState<MusicTrack[]>(HIMNARIO_ANTIGUO_CURATED);
  const [loadingEdition, setLoadingEdition] = useState<'nuevo' | 'antiguo' | null>(null);
  const [resolvingTrackId, setResolvingTrackId] = useState<string | null>(null);
  const [lyricsModal, setLyricsModal] = useState<LyricsModalState | null>(null);
  const lyricsCacheRef = useRef<Record<string, { found: boolean; lyrics: string; correlatedNumber?: number }>>({});

  // Videos Musicales state & clean player controls
  const [activeVideo, setActiveVideo] = useState<MusicVideo>(ADVENTIST_MUSIC_VIDEOS[0]);
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [videoCategoryFilter, setVideoCategoryFilter] = useState<string>('Todas');
  const [remoteVideoResults, setRemoteVideoResults] = useState<MusicVideo[]>([]);
  const [searchingVideos, setSearchingVideos] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoSubtitles, setVideoSubtitles] = useState(false);
  const [videoResumeSec, setVideoResumeSec] = useState(0);

  const videoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoStageRef = useRef<HTMLDivElement | null>(null);

  const {
    currentTime: ytCurrentTime,
    duration: ytDuration,
    seekBy: seekVideoBy,
    seekTo: seekVideoTo,
    onIframeLoad: onVideoIframeLoad,
  } = useYouTubeProgress(videoIframeRef, activeVideo.youtubeId);

  // Load complete Himnario Nuevo (613) and Himnario Antiguo (1962) catalogs
  useEffect(() => {
    let cancelled = false;
    setLoadingEdition('nuevo');
    fetch('/api/hymns/catalog?edition=nuevo')
      .then((r) => r.json())
      .then((data: { items?: MusicTrack[] }) => {
        if (!cancelled && Array.isArray(data.items) && data.items.length > 0) {
          setNuevoHymns(data.items);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingEdition((cur) => (cur === 'nuevo' ? null : cur));
      });

    fetch('/api/hymns/catalog?edition=antiguo')
      .then((r) => r.json())
      .then((data: { items?: MusicTrack[] }) => {
        if (!cancelled && Array.isArray(data.items) && data.items.length > 0) {
          const curatedById = new Map(HIMNARIO_ANTIGUO_CURATED.map((t) => [t.id, t]));
          const merged = data.items.map((item) => curatedById.get(item.id) || item);
          const seen = new Set(merged.map((m) => m.id));
          for (const c of HIMNARIO_ANTIGUO_CURATED) {
            if (!seen.has(c.id)) merged.push(c);
          }
          merged.sort((a, b) => (a.hymnNumber || 9999) - (b.hymnNumber || 9999));
          setAntiguoHymns(merged);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (topSearchOpen) {
      window.setTimeout(() => topSearchInputRef.current?.focus(), 60);
    }
  }, [topSearchOpen]);

  const toggleVideoPlayPause = () => {
    if (videoPaused) {
      sendYtCommand(videoIframeRef.current, 'playVideo');
      setVideoPaused(false);
    } else {
      sendYtCommand(videoIframeRef.current, 'pauseVideo');
      setVideoPaused(true);
    }
  };

  const toggleVideoMute = () => {
    if (videoMuted) {
      sendYtCommand(videoIframeRef.current, 'unMute');
      sendYtCommand(videoIframeRef.current, 'setVolume', [100]);
      setVideoMuted(false);
    } else {
      sendYtCommand(videoIframeRef.current, 'mute');
      setVideoMuted(true);
    }
  };

  const toggleVideoFullscreen = () => {
    const el = videoStageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  };

  const selectMusicVideo = (mv: MusicVideo) => {
    if (isPlaying) togglePlayPause();
    setVideoResumeSec(0);
    setActiveVideo(mv);
    setVideoPaused(false);
  };

  const fetchMusicVideos = async (query: string, autoPlayFirst: boolean) => {
    const q = query.trim();
    if (q.length < 2) {
      setRemoteVideoResults([]);
      return;
    }
    setSearchingVideos(true);
    try {
      const res = await fetch(`/api/videos/search?q=${encodeURIComponent(q)}&type=music`);
      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          youtubeId: string;
          title: string;
          authorName: string;
        }>;
      };
      if (Array.isArray(data.items)) {
        const mapped: MusicVideo[] = data.items.map((item) => ({
          id: `search_${item.youtubeId}`,
          title: item.title,
          artist: item.authorName,
          youtubeId: item.youtubeId,
          category: 'Búsqueda',
        }));
        setRemoteVideoResults(mapped);
        if (autoPlayFirst && mapped.length > 0) {
          selectMusicVideo(mapped[0]);
        }
      }
    } catch {
      // keep local results
    } finally {
      setSearchingVideos(false);
    }
  };

  useEffect(() => {
    const q = videoSearchQuery.trim();
    if (q.length < 2) {
      if (!q) setRemoteVideoResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchMusicVideos(q, false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [videoSearchQuery]);

  const handleTopSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'videos') {
      void fetchMusicVideos(videoSearchQuery, true);
    }
  };

  const filteredVideos = useMemo(() => {
    const q = videoSearchQuery.trim().toLowerCase();
    const localMatches = ADVENTIST_MUSIC_VIDEOS.filter((mv) => {
      if (videoCategoryFilter !== 'Todas' && mv.category !== videoCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        mv.title.toLowerCase().includes(q) ||
        mv.artist.toLowerCase().includes(q) ||
        mv.category.toLowerCase().includes(q)
      );
    });
    if (remoteVideoResults.length === 0) return localMatches;
    const seen = new Set(remoteVideoResults.map((r) => r.youtubeId));
    return [...remoteVideoResults, ...localMatches.filter((m) => !seen.has(m.youtubeId))];
  }, [videoSearchQuery, videoCategoryFilter, remoteVideoResults]);

  const allHymnsPool = useMemo(() => [...nuevoHymns, ...antiguoHymns], [nuevoHymns, antiguoHymns]);

  const filteredHymns = useMemo(() => {
    const q = hymnSearchQuery.trim().toLowerCase();
    const numericQuery = q.replace(/^0+/, '');
    const sourceList =
      hymnFilter === 'nuevo'
        ? nuevoHymns
        : hymnFilter === 'antiguo'
          ? antiguoHymns
          : allHymnsPool.filter((t) => favoriteTrackIds.has(t.id));

    if (!q) return sourceList;
    return sourceList.filter((t) => {
      const numStr = t.hymnNumber ? String(t.hymnNumber) : '';
      return (
        t.title.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        (numericQuery.length > 0 && numStr === numericQuery)
      );
    });
  }, [hymnFilter, hymnSearchQuery, nuevoHymns, antiguoHymns, allHymnsPool, favoriteTrackIds]);

  const resolveAndPlayHymn = async (track: MusicTrack, queue: MusicTrack[]) => {
    if (track.audioUrl) {
      playTrack(track, queue);
      return;
    }
    if (!track.archiveIdentifier) {
      showToast('Este himno no tiene audio disponible');
      return;
    }

    setResolvingTrackId(track.id);
    try {
      const res = await fetch(
        `/api/hymns/resolve?identifier=${encodeURIComponent(track.archiveIdentifier)}`
      );
      if (!res.ok) throw new Error('Audio no disponible');
      const data = (await res.json()) as { audioUrl: string; durationSec: number };
      const resolvedTrack: MusicTrack = {
        ...track,
        audioUrl: data.audioUrl,
        durationSec: data.durationSec || track.durationSec,
      };
      // Cache resolved URL in state
      setAntiguoHymns((prev) => prev.map((t) => (t.id === track.id ? resolvedTrack : t)));
      const updatedQueue = queue.map((t) => (t.id === track.id ? resolvedTrack : t));
      playTrack(resolvedTrack, updatedQueue);
    } catch {
      showToast('No se pudo cargar el audio de este himno');
    } finally {
      setResolvingTrackId(null);
    }
  };

  const handleOpenLyrics = async (track: MusicTrack) => {
    const edition = track.hymnEdition || 'nuevo';
    const num = track.hymnNumber || 0;
    const cacheKey = `${edition}_${num}_${track.title}`;
    const cached = lyricsCacheRef.current[cacheKey];
    if (cached) {
      setLyricsModal({
        track,
        loading: false,
        found: cached.found,
        lyrics: cached.lyrics,
        correlatedNumber: cached.correlatedNumber,
      });
      return;
    }

    setLyricsModal({
      track,
      loading: true,
      found: false,
      lyrics: '',
    });

    try {
      const params = new URLSearchParams({
        edition,
        number: String(num),
        title: track.title,
      });
      const res = await fetch(`/api/hymns/lyrics?${params.toString()}`);
      const data = (await res.json()) as {
        found?: boolean;
        lyrics?: string;
        correlatedNumber?: number;
      };
      const entry = {
        found: Boolean(data.found && data.lyrics),
        lyrics: data.lyrics || '',
        correlatedNumber: data.correlatedNumber,
      };
      lyricsCacheRef.current[cacheKey] = entry;
      setLyricsModal({
        track,
        loading: false,
        ...entry,
      });
    } catch {
      setLyricsModal({
        track,
        loading: false,
        found: false,
        lyrics: '',
      });
    }
  };

  const displayedTrack: MusicTrack =
    (currentTrack && currentTrack.playlist === 'Himnario' ? currentTrack : null) ||
    filteredHymns[0] ||
    HIMNARIO_NUEVO_STARTER[0];
  const activeDuration =
    currentTrack && currentTrack.id === displayedTrack.id
      ? duration || currentTrack.durationSec
      : displayedTrack.durationSec;

  const handlePlayAll = () => {
    const list = filteredHymns.length > 0 ? filteredHymns : nuevoHymns;
    const firstPlayable = list.find((t) => Boolean(t.audioUrl)) || list[0];
    if (firstPlayable) {
      void resolveAndPlayHymn(firstPlayable, list);
    }
  };

  const activeSearchValue = mode === 'audio' ? hymnSearchQuery : videoSearchQuery;

  return (
    <div className="min-h-screen pb-24 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Mode Bar + Top Search Magnifying Glass */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <Headphones className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-display text-base sm:text-lg font-bold truncate">
              {mode === 'audio' ? 'Himnario Adventista' : 'Videos Musicales'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Top Magnifying Glass Search Button */}
            <button
              type="button"
              onClick={() => setTopSearchOpen((open) => !open)}
              aria-label="Buscar"
              title={mode === 'audio' ? 'Buscar himno por número o título' : 'Buscar música en video'}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                topSearchOpen || activeSearchValue.trim().length > 0
                  ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Search className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setMode('audio')}
                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                  mode === 'audio'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Himnario
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPlaying) togglePlayPause();
                  setMode('videos');
                }}
                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                  mode === 'videos'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                Videos
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Top Search Bar */}
        {topSearchOpen && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 sm:px-6 py-2.5">
            <form
              onSubmit={handleTopSearchSubmit}
              className="mx-auto flex max-w-6xl items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={topSearchInputRef}
                  type="text"
                  value={activeSearchValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (mode === 'audio') {
                      setHymnSearchQuery(val);
                    } else {
                      setVideoSearchQuery(val);
                      if (!val.trim()) setRemoteVideoResults([]);
                    }
                  }}
                  placeholder={
                    mode === 'audio'
                      ? 'Buscar himno por número (ej. 115, 255) o título...'
                      : 'Buscar cualquier canción o cantante cristiano...'
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-10 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {activeSearchValue && (
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === 'audio') {
                        setHymnSearchQuery('');
                      } else {
                        setVideoSearchQuery('');
                        setRemoteVideoResults([]);
                      }
                    }}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {mode === 'videos' && (
                <button
                  type="submit"
                  disabled={searchingVideos || videoSearchQuery.trim().length < 2}
                  className="min-h-[38px] rounded-xl bg-amber-500 px-3.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-45 transition-colors shrink-0"
                >
                  {searchingVideos ? 'Buscando...' : 'Buscar'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setTopSearchOpen(false)}
                aria-label="Cerrar buscador"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-5">
        {mode === 'audio' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left / Sticky Now Playing Hymnal Deck */}
            <section className="lg:col-span-5 lg:sticky lg:top-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {displayedTrack.hymnEdition === 'antiguo'
                    ? 'Himnario Antiguo · 1962'
                    : 'Himnario Nuevo · 2009'}
                </span>
                <span>Reproducción en segundo plano</span>
              </div>

              <div className="mx-auto max-w-[272px] aspect-square overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/15 bg-slate-900">
                <img
                  src={displayedTrack.coverUrl || getAudioCoverFallback(displayedTrack)}
                  alt={displayedTrack.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const fallback = getAudioCoverFallback(displayedTrack);
                    if (e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                  className="h-full w-full object-cover transition-transform duration-500"
                />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {displayedTrack.hymnNumber && (
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Himno N.° {displayedTrack.hymnNumber}
                    </p>
                  )}
                  <h2 className="font-display text-xl sm:text-2xl font-bold leading-snug line-clamp-2 mt-0.5">
                    {displayedTrack.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
                    {displayedTrack.artist} · {displayedTrack.album}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleOpenLyrics(displayedTrack)}
                    aria-label="Ver letra del himno"
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Letra
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavoriteTrack(displayedTrack.id)}
                    aria-label="Guardar en favoritas"
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        favoriteTrackIds.has(displayedTrack.id)
                          ? 'fill-emerald-500 text-emerald-500'
                          : 'text-slate-400'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Scrubber */}
              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, Math.floor(activeDuration))}
                  value={currentTrack && currentTrack.id === displayedTrack.id ? Math.floor(currentTime) : 0}
                  onChange={(e) => {
                    if (!currentTrack || currentTrack.id !== displayedTrack.id) {
                      void resolveAndPlayHymn(displayedTrack, filteredHymns);
                    }
                    seekTo(Number(e.target.value));
                  }}
                  aria-label="Progreso de reproducción"
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex items-center justify-between font-mono-code text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  <span>
                    {formatDuration(
                      currentTrack && currentTrack.id === displayedTrack.id ? currentTime : 0
                    )}
                  </span>
                  <span>{formatDuration(activeDuration)}</span>
                </div>
              </div>

              {/* Playback Controls with -10s / +10s Seek */}
              <div className="flex items-center justify-between gap-1 pt-1">
                <button
                  type="button"
                  onClick={toggleShuffle}
                  aria-label="Aleatorio"
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    shuffle
                      ? 'text-emerald-500 bg-emerald-500/10'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Shuffle className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={playPrev}
                  aria-label="Himno anterior"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <SkipBack className="h-4 w-4 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!currentTrack || currentTrack.id !== displayedTrack.id) {
                      void resolveAndPlayHymn(displayedTrack, filteredHymns);
                    } else {
                      seekTo(Math.max(0, currentTime - 10));
                    }
                  }}
                  aria-label="Retroceder 10 segundos"
                  title="Retroceder 10s"
                  className="flex h-10 w-10 flex-col items-center justify-center rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-[9px] font-bold leading-none mt-0.5">-10</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!currentTrack || currentTrack.id !== displayedTrack.id) {
                      void resolveAndPlayHymn(displayedTrack, filteredHymns);
                    } else {
                      togglePlayPause();
                    }
                  }}
                  aria-label={
                    isPlaying && currentTrack?.id === displayedTrack.id ? 'Pausar' : 'Reproducir'
                  }
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg hover:bg-emerald-400 active:scale-95 transition-all"
                >
                  {(audioLoading && currentTrack?.id === displayedTrack.id) ||
                  resolvingTrackId === displayedTrack.id ? (
                    <span className="h-5 w-5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  ) : isPlaying && currentTrack?.id === displayedTrack.id ? (
                    <Pause className="h-6 w-6 fill-slate-950" />
                  ) : (
                    <Play className="h-6 w-6 fill-slate-950 ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!currentTrack || currentTrack.id !== displayedTrack.id) {
                      void resolveAndPlayHymn(displayedTrack, filteredHymns);
                    } else {
                      seekTo(Math.min(activeDuration, currentTime + 10));
                    }
                  }}
                  aria-label="Avanzar 10 segundos"
                  title="Avanzar 10s"
                  className="flex h-10 w-10 flex-col items-center justify-center rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RotateCw className="h-4 w-4" />
                  <span className="text-[9px] font-bold leading-none mt-0.5">+10</span>
                </button>

                <button
                  type="button"
                  onClick={playNext}
                  aria-label="Siguiente himno"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={toggleRepeat}
                  aria-label="Repetir"
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    repeat
                      ? 'text-emerald-500 bg-emerald-500/10'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Repeat className="h-4 w-4" />
                </button>
              </div>
            </section>

            {/* Right / Himnario Nuevo y Antiguo List */}
            <section className="lg:col-span-7 space-y-4">
              {/* Edition Switcher + Play All */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(
                      [
                        { id: 'nuevo', label: `Himnario Nuevo (${nuevoHymns.length})` },
                        { id: 'antiguo', label: `Himnario Antiguo (${antiguoHymns.length})` },
                        { id: 'favoritos', label: 'Favoritos' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHymnFilter(tab.id)}
                        className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                          hymnFilter === tab.id
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handlePlayAll}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5 fill-slate-950" />
                    Reproducir
                  </button>
                </div>

                {hymnSearchQuery.trim() && (
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                    <span>
                      Filtrando por &ldquo;{hymnSearchQuery}&rdquo; ({filteredHymns.length}{' '}
                      {filteredHymns.length === 1 ? 'resultado' : 'resultados'})
                    </span>
                    <button
                      type="button"
                      onClick={() => setHymnSearchQuery('')}
                      className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Mostrar todos
                    </button>
                  </div>
                )}
              </div>

              {/* Hymn Rows with Play & Ver Letra */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
                {loadingEdition === hymnFilter && filteredHymns.length <= 10 ? (
                  <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Cargando himnos del Himnario Adventista...
                  </p>
                ) : filteredHymns.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {hymnFilter === 'favoritos'
                      ? 'Todavía no guardaste himnos en favoritos.'
                      : 'No se encontraron himnos con ese número o título.'}
                  </p>
                ) : (
                  filteredHymns.map((track, idx) => {
                    const isCurrent = currentTrack?.id === track.id;
                    const fav = favoriteTrackIds.has(track.id);
                    const isResolving = resolvingTrackId === track.id;
                    const displayNum = track.hymnNumber
                      ? String(track.hymnNumber).padStart(3, '0')
                      : String(idx + 1).padStart(3, '0');
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center justify-between gap-2.5 px-3.5 sm:px-4 py-3 transition-colors ${
                          isCurrent
                            ? 'bg-emerald-50/85 dark:bg-emerald-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isCurrent) {
                              togglePlayPause();
                            } else {
                              void resolveAndPlayHymn(track, filteredHymns);
                            }
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`h-10 min-w-[42px] px-1.5 rounded-xl flex items-center justify-center font-mono-code text-xs font-bold tabular-nums shrink-0 transition-colors ${
                              isCurrent
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {isResolving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isCurrent && isPlaying ? (
                              <Disc3 className="h-4 w-4 animate-spin" />
                            ) : (
                              displayNum
                            )}
                          </span>

                          <img
                            src={track.coverUrl || getAudioCoverFallback(track)}
                            alt={track.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const fallback = getAudioCoverFallback(track);
                              if (e.currentTarget.src !== fallback) {
                                e.currentTarget.src = fallback;
                              }
                            }}
                            className="h-11 w-11 rounded-xl object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/10 shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-sm font-bold leading-snug ${
                                isCurrent
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {track.title}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {track.album}
                              {track.durationSec > 0 ? ` · ${formatDuration(track.durationSec)}` : ''}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleOpenLyrics(track)}
                            aria-label={`Ver letra de ${track.title}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Letra</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFavoriteTrack(track.id)}
                            aria-label="Favorito"
                            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Heart
                              className={`h-4 w-4 ${
                                fav ? 'fill-emerald-500 text-emerald-500' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        ) : (
          /* Music Videos Theater + Subtitles Toggle + Searchable List */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-8 space-y-4">
              <div
                ref={videoStageRef}
                className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-black shadow-lg"
              >
                <div className="relative aspect-video w-full">
                  <iframe
                    ref={videoIframeRef}
                    key={`${activeVideo.youtubeId}-${videoSubtitles ? 'cc1' : 'cc0'}`}
                    onLoad={onVideoIframeLoad}
                    src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&controls=0&iv_load_policy=3&disablekb=1&fs=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&cc_load_policy=${
                      videoSubtitles ? 1 : 0
                    }&cc_lang_pref=es${videoResumeSec > 0 ? `&start=${videoResumeSec}` : ''}`}
                    title={activeVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />

                  {/* Clean Tap Overlay (prevents YouTube hover header/logo bar) */}
                  <button
                    type="button"
                    onClick={toggleVideoPlayPause}
                    aria-label={videoPaused ? 'Reproducir video' : 'Pausar video'}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-transparent focus:outline-none"
                  >
                    {videoPaused && (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm shadow-md">
                        <Play className="h-4 w-4 fill-white ml-0.5" />
                      </span>
                    )}
                  </button>

                  {/* Compact Bottom Controls Bar with Seek, Subtitles & Timeline */}
                  <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-6 space-y-1.5">
                    {ytDuration > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono-code text-[10px] tabular-nums text-white/90 shrink-0">
                          {formatVideoTime(ytCurrentTime)}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(1, Math.floor(ytDuration))}
                          value={Math.floor(ytCurrentTime)}
                          onChange={(e) => seekVideoTo(Number(e.target.value))}
                          aria-label="Posición del video musical"
                          className="h-1 flex-1 accent-amber-500 cursor-pointer"
                        />
                        <span className="font-mono-code text-[10px] tabular-nums text-white/75 shrink-0">
                          {formatVideoTime(ytDuration)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={toggleVideoPlayPause}
                          aria-label={videoPaused ? 'Reproducir' : 'Pausar'}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                        >
                          {videoPaused ? (
                            <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
                          ) : (
                            <Pause className="h-3.5 w-3.5 fill-white" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => seekVideoBy(-10)}
                          aria-label="Retroceder 10 segundos"
                          title="Retroceder 10s"
                          className="inline-flex h-8 items-center gap-0.5 rounded-lg bg-black/55 px-2 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                          10s
                        </button>
                        <button
                          type="button"
                          onClick={() => seekVideoBy(10)}
                          aria-label="Avanzar 10 segundos"
                          title="Avanzar 10s"
                          className="inline-flex h-8 items-center gap-0.5 rounded-lg bg-black/55 px-2 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                        >
                          10s
                          <RotateCw className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setVideoResumeSec(Math.floor(ytCurrentTime));
                            setVideoSubtitles((s) => !s);
                          }}
                          aria-label={videoSubtitles ? 'Quitar subtítulos' : 'Poner subtítulos'}
                          title={videoSubtitles ? 'Quitar subtítulos' : 'Poner subtítulos'}
                          className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold backdrop-blur-sm transition-colors ${
                            videoSubtitles
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                              : 'bg-black/55 text-white hover:bg-black/80'
                          }`}
                        >
                          <Captions className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Subtítulos</span>
                        </button>
                        <button
                          type="button"
                          onClick={toggleVideoMute}
                          aria-label={videoMuted ? 'Activar sonido' : 'Silenciar'}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                        >
                          {videoMuted ? (
                            <VolumeX className="h-3.5 w-3.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={toggleVideoFullscreen}
                          aria-label="Pantalla completa"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-1.5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {activeVideo.category} · {activeVideo.artist}
                </p>
                <h1 className="font-display text-xl sm:text-2xl font-bold leading-snug text-slate-900 dark:text-slate-100">
                  {activeVideo.title}
                </h1>
              </div>
            </section>

            <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-lg font-bold">Videos Musicales</h2>
                {searchingVideos && (
                  <span className="text-xs text-amber-500 font-medium">Buscando...</span>
                )}
              </div>

              {/* Category / Artist Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  'Todas',
                  'Alabanza Cristiana',
                  'Adoradores',
                  'Heraldos del Rey',
                  'Dúo Zimrah',
                  'Adoración',
                  'Cuartetos',
                  'Jóvenes',
                  'Himnos y Coros',
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setVideoCategoryFilter(cat)}
                    className={`min-h-[32px] rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      videoCategoryFilter === cat
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-0.5">
                {filteredVideos.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Solo se muestran alabanzas y himnos cristianos. Usa la lupa arriba para buscar otro canto o intérprete cristiano.
                  </p>
                ) : (
                  filteredVideos.map((mv) => {
                    const active = mv.youtubeId === activeVideo.youtubeId;
                    return (
                      <button
                        key={mv.id}
                        type="button"
                        onClick={() => selectMusicVideo(mv)}
                        className={`w-full flex items-start gap-3 rounded-xl p-2 text-left transition-colors ${
                          active
                            ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500/50'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-800 ring-1 ring-black/10 dark:ring-white/10">
                          <img
                            src={`https://i.ytimg.com/vi/${mv.youtubeId}/hqdefault.jpg`}
                            alt={mv.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <Play className="h-3.5 w-3.5 text-white fill-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-bold line-clamp-2 leading-snug ${
                              active ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {mv.title}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                            {mv.artist}
                          </p>
                          <p className="text-[11px] font-medium text-amber-600/90 dark:text-amber-400/90 mt-0.5 truncate">
                            {mv.category}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Hymn Lyrics Modal */}
      {lyricsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setLyricsModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl max-h-[86vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {lyricsModal.track.hymnEdition === 'antiguo'
                    ? 'Himnario Adventista Antiguo (1962)'
                    : 'Himnario Adventista Nuevo (2009)'}
                  {lyricsModal.correlatedNumber
                    ? ` · Himno #${lyricsModal.correlatedNumber} en ed. 2009`
                    : ''}
                </p>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {lyricsModal.track.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLyricsModal(null)}
                aria-label="Cerrar letra"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {lyricsModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  <p className="text-sm">Cargando letra del himno...</p>
                </div>
              ) : lyricsModal.found ? (
                <div className="whitespace-pre-line font-serif text-base sm:text-lg leading-relaxed text-slate-800 dark:text-slate-100">
                  {lyricsModal.lyrics}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  La letra digital de este himno del Himnario Antiguo aún no se encuentra en el índice.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-5 py-3.5">
              <button
                type="button"
                onClick={() => {
                  const isCurrent = currentTrack?.id === lyricsModal.track.id;
                  if (isCurrent) {
                    togglePlayPause();
                  } else {
                    void resolveAndPlayHymn(lyricsModal.track, filteredHymns);
                  }
                }}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
              >
                {currentTrack?.id === lyricsModal.track.id && isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 fill-slate-950" />
                    Pausar himno
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-slate-950" />
                    Escuchar himno
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setLyricsModal(null)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
