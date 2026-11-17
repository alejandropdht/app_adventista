import { useEffect, useRef, useState } from 'react';
import {
  Captions,
  HeartHandshake,
  Maximize2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Share2,
  Tv,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatVideoTime, sendYtCommand, useYouTubeProgress } from '../lib/youtubePlayer';

interface LiveData {
  videoId: string;
  title: string;
  isLive: boolean;
  channelHandle: string;
  channelUrl: string;
  recentStreams: Array<{ videoId: string; title: string }>;
}

export function TvView() {
  const { showToast, setActiveTab, setStudyMode, openFeDeJesus } = useApp();
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('NfwdLxxM5e8');
  const [selectedTitle, setSelectedTitle] = useState<string>(
    'Transmisión en vivo de TV Nuevo Tiempo'
  );
  const [loading, setLoading] = useState(true);
  const [amenCount, setAmenCount] = useState(142);
  const [hasPrayed, setHasPrayed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);

  const {
    currentTime: tvCurrentTime,
    duration: tvDuration,
    seekBy: seekTvBy,
    seekTo: seekTvTo,
    onIframeLoad: onTvIframeLoad,
  } = useYouTubeProgress(iframeRef, selectedVideoId);

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sendYtCommand(iframeRef.current, nextMuted ? 'mute' : 'unMute');
    if (!nextMuted) {
      sendYtCommand(iframeRef.current, 'setVolume', [100]);
      sendYtCommand(iframeRef.current, 'playVideo');
      setIsPaused(false);
    }
  };

  const togglePlay = () => {
    if (isPaused) {
      sendYtCommand(iframeRef.current, 'playVideo');
      setIsPaused(false);
    } else {
      sendYtCommand(iframeRef.current, 'pauseVideo');
      setIsPaused(true);
    }
  };

  const toggleFullscreen = () => {
    const el = playerWrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  };

  const loadLiveStream = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tv/live');
      if (!res.ok) throw new Error('No se pudo cargar la señal');
      const data = (await res.json()) as LiveData;
      setLiveData(data);
      setSelectedVideoId(data.videoId);
      setSelectedTitle(data.title);
    } catch {
      setLiveData({
        videoId: 'NfwdLxxM5e8',
        title: 'Transmisión en vivo de TV Nuevo Tiempo',
        isLive: true,
        channelHandle: '@nuevotiempotv',
        channelUrl: 'https://www.youtube.com/watch?v=NfwdLxxM5e8',
        recentStreams: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveStream();
  }, []);

  const handleShare = async () => {
    const shareUrl = `https://www.youtube.com/watch?v=${selectedVideoId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'TV Nuevo Tiempo En Vivo · Maranata',
          text: selectedTitle,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Enlace de TV Nuevo Tiempo copiado');
      }
    } catch {
      // user cancelled share
    }
  };

  const handleAmen = () => {
    if (hasPrayed) {
      setHasPrayed(false);
      setAmenCount((c) => Math.max(0, c - 1));
    } else {
      setHasPrayed(true);
      setAmenCount((c) => c + 1);
      showToast('Amén · Unido en oración con la iglesia');
    }
  };

  const isViewingMainLive =
    liveData && selectedVideoId === liveData.videoId;

  return (
    <div className="min-h-screen pb-24 bg-slate-50 dark:bg-slate-950">
      {/* Top Studio Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/src/assets/images/maranata_emblem_1794943377605.jpg"
              alt="Maranata"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-cover shrink-0"
            />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              Maranata
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadLiveStream}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar señal
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Primary Cinema Player Column */}
          <section className="lg:col-span-8 space-y-4">
            <div
              ref={playerWrapperRef}
              className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-800"
            >
              <div className="relative aspect-video w-full bg-slate-950">
                <img
                  src="/src/assets/images/tv_studio_backdrop_1794943379635.jpg"
                  alt="Estudio TV Nuevo Tiempo"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full object-cover opacity-25"
                />
                <iframe
                  ref={iframeRef}
                  key={`${selectedVideoId}-${subtitlesOn ? 'cc1' : 'cc0'}`}
                  onLoad={onTvIframeLoad}
                  src={`https://www.youtube-nocookie.com/embed/${selectedVideoId}?autoplay=1&mute=1&playsinline=1&controls=0&iv_load_policy=3&disablekb=1&fs=0&rel=0&modestbranding=1&enablejsapi=1&cc_load_policy=${
                    subtitlesOn ? 1 : 0
                  }&cc_lang_pref=es`}
                  title={selectedTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="relative z-10 h-full w-full border-0"
                />

                {/* Tap Overlay prevents YouTube hover logo/bar */}
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPaused ? 'Reproducir transmisión' : 'Pausar transmisión'}
                  className="absolute inset-0 z-15 flex items-center justify-center bg-transparent focus:outline-none"
                >
                  {isPaused && (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm shadow-md">
                      <Play className="h-4 w-4 fill-white ml-0.5" />
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleSound}
                  aria-label={isMuted ? 'Activar sonido del en vivo' : 'Silenciar en vivo'}
                  className={`absolute top-2.5 right-2.5 z-20 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold backdrop-blur-md transition-colors shadow-md ${
                    isMuted
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-black/65 text-white hover:bg-black/80'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="h-3.5 w-3.5" />
                      Activar sonido
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" />
                      Sonido activo
                    </>
                  )}
                </button>

                {/* Bottom Controls with -10s / +10s Seek + Scrubber */}
                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-6 space-y-1.5">
                  {tvDuration > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono-code text-[10px] tabular-nums text-white/90 shrink-0">
                        {formatVideoTime(tvCurrentTime)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(1, Math.floor(tvDuration))}
                        value={Math.floor(tvCurrentTime)}
                        onChange={(e) => seekTvTo(Number(e.target.value))}
                        aria-label="Posición de reproducción"
                        className="h-1 flex-1 accent-amber-500 cursor-pointer"
                      />
                      <span className="font-mono-code text-[10px] tabular-nums text-white/75 shrink-0">
                        {formatVideoTime(tvDuration)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={isPaused ? 'Reproducir' : 'Pausar'}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/85 transition-colors"
                      >
                        {isPaused ? (
                          <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5 fill-white" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => seekTvBy(-10)}
                        aria-label="Retroceder 10 segundos"
                        title="Retroceder 10s"
                        className="inline-flex h-8 items-center gap-0.5 rounded-lg bg-black/60 px-2 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-black/85 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        10s
                      </button>
                      <button
                        type="button"
                        onClick={() => seekTvBy(10)}
                        aria-label="Avanzar 10 segundos"
                        title="Avanzar 10s"
                        className="inline-flex h-8 items-center gap-0.5 rounded-lg bg-black/60 px-2 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-black/85 transition-colors"
                      >
                        10s
                        <RotateCw className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSubtitlesOn((s) => !s)}
                        aria-label={subtitlesOn ? 'Quitar subtítulos' : 'Poner subtítulos'}
                        title={subtitlesOn ? 'Quitar subtítulos' : 'Poner subtítulos'}
                        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold backdrop-blur-sm transition-colors ${
                          subtitlesOn
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : 'bg-black/60 text-white hover:bg-black/85'
                        }`}
                      >
                        <Captions className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Subtítulos</span>
                      </button>
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        aria-label="Pantalla completa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/85 transition-colors"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stream Details & Community Actions */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isViewingMainLive && liveData?.isLive ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                      <Radio className="h-3.5 w-3.5" />
                      Transmisión en vivo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                      <Tv className="h-3.5 w-3.5" />
                      Emisión Nuevo Tiempo
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Señal @nuevotiempotv</span>
                </div>

                {!isViewingMainLive && liveData && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVideoId(liveData.videoId);
                      setSelectedTitle(liveData.title);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    Volver al vivo
                  </button>
                )}
              </div>

              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug text-balance">
                {selectedTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAmen}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    hasPrayed
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <HeartHandshake className="h-4 w-4" />
                  <span>Amén</span>
                  <span className="font-mono-code tabular-nums text-xs opacity-90">
                    {amenCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  Compartir
                </button>
              </div>
            </div>
          </section>

          {/* Secondary Column: Recent Broadcasts & Quick Study Shortcuts */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Programas recientes
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Nuevo Tiempo
                </span>
              </div>

              {liveData?.recentStreams && liveData.recentStreams.length > 0 ? (
                <div className="space-y-2.5">
                  {liveData.recentStreams.map((stream) => {
                    const active = selectedVideoId === stream.videoId;
                    return (
                      <button
                        key={stream.videoId}
                        type="button"
                        onClick={() => {
                          setSelectedVideoId(stream.videoId);
                          setSelectedTitle(stream.title);
                        }}
                        className={`w-full flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors ${
                          active
                            ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500/50'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                          <img
                            src={`https://i.ytimg.com/vi/${stream.videoId}/hqdefault.jpg`}
                            alt={stream.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <Play className="h-4 w-4 text-white fill-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                            {stream.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            TV Nuevo Tiempo
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Sintonizando la señal continua de TV Nuevo Tiempo para toda Latinoamérica.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Continúa tu devocional
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Lee la Biblia en múltiples versiones o estudia la lección de hoy de la Escuela Sabática.
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('bible')}
                  className="min-h-[44px] rounded-xl bg-slate-900 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Abrir Biblia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudyMode('sabbath');
                    setActiveTab('sabbath');
                  }}
                  className="min-h-[44px] rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  Escuela Sabática
                </button>
                <button
                  type="button"
                  onClick={openFeDeJesus}
                  className="col-span-2 min-h-[44px] rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                >
                  Curso Bíblico · La Fe de Jesús (20 Lecciones)
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
