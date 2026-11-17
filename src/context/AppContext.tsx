import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  AppTab,
  LessonProgress,
  MusicTrack,
  PublicProfile,
  SavedVerse,
} from '../types';
import { HIMNARIO_NUEVO_STARTER, getAudioCoverFallback } from '../data/musicCatalog';

interface BibleJumpTarget {
  bookId: number;
  chapter: number;
  verse?: number;
  nonce: number;
}

interface AppContextValue {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  studyMode: 'sabbath' | 'fe-de-jesus';
  setStudyMode: (mode: 'sabbath' | 'fe-de-jesus') => void;
  openFeDeJesus: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  user: User | null;
  authLoading: boolean;
  profile: PublicProfile | null;
  preferredBibleVersion: string;
  setPreferredBibleVersion: (version: string) => Promise<void>;
  savedVerses: SavedVerse[];
  lessonProgress: Record<string, LessonProgress>;
  followingIds: Set<string>;
  bibleJump: BibleJumpTarget | null;
  openBibleAt: (bookId: number, chapter: number, verse?: number) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  toast: string | null;
  showToast: (msg: string) => void;
  // Persistent Lock-Screen Audio Player
  currentTrack: MusicTrack | null;
  playQueue: MusicTrack[];
  isPlaying: boolean;
  audioLoading: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: boolean;
  favoriteTrackIds: Set<string>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleFavoriteTrack: (trackId: string) => void;
  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  seekTo: (seconds: number) => void;
  stopPlayer: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function sanitizeHandle(raw: string, fallbackUid: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_.]/g, '');
  if (cleaned.length >= 3) return cleaned.slice(0, 30);
  return `miembro_${fallbackUid.slice(0, 6)}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<AppTab>('tv');
  const [studyMode, setStudyMode] = useState<'sabbath' | 'fe-de-jesus'>('sabbath');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('maranata_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'dark';
  });

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [preferredBibleVersion, setPreferredBibleVersionState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('maranata_bible_version') || 'RV1960';
    }
    return 'RV1960';
  });
  const [savedVerses, setSavedVerses] = useState<SavedVerse[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgress>>({});
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [bibleJump, setBibleJump] = useState<BibleJumpTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Persistent Audio Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [playQueue, setPlayQueue] = useState<MusicTrack[]>(HIMNARIO_NUEVO_STARTER);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('maranata_fav_tracks');
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // ignore
    }
    return new Set();
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('maranata_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((current) => (current === msg ? null : current));
    }, 3200);
  };

  const openBibleAt = (bookId: number, chapter: number, verse?: number) => {
    setBibleJump({ bookId, chapter, verse, nonce: Date.now() });
    setActiveTab('bible');
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (firebaseUser && firebaseUser.emailVerified) {
        const publicRef = doc(db, 'publicProfiles', firebaseUser.uid);
        const privateRef = doc(db, 'users', firebaseUser.uid);

        try {
          const pubSnap = await getDoc(publicRef);
          if (!pubSnap.exists()) {
            const displayName = (firebaseUser.displayName || 'Hermano en Cristo').slice(0, 80);
            const handle = sanitizeHandle(
              firebaseUser.email?.split('@')[0] || displayName,
              firebaseUser.uid
            );
            await setDoc(publicRef, {
              uid: firebaseUser.uid,
              displayName,
              handle,
              church: 'Iglesia Adventista del Séptimo Día',
              bio: 'Compartiendo esperanza, Biblia y Escuela Sabática.',
              photoURL: firebaseUser.photoURL || '',
              followersCount: 0,
              followingCount: 0,
              postsCount: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          const privSnap = await getDoc(privateRef);
          if (!privSnap.exists()) {
            await setDoc(privateRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email || `${firebaseUser.uid}@adventista.app`,
              preferredBibleVersion: preferredBibleVersion || 'RV1960',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const privData = privSnap.data();
            if (privData?.preferredBibleVersion) {
              setPreferredBibleVersionState(privData.preferredBibleVersion);
            }
          }
        } catch (err) {
          console.error('Error initializing profile:', err);
        }
      } else {
        setProfile(null);
        setSavedVerses([]);
        setLessonProgress({});
        setFollowingIds(new Set());
      }
    });

    return () => unsub();
  }, []);

  // Subscribe to user's Firestore collections when authenticated
  useEffect(() => {
    if (!user || !user.emailVerified) return;

    const unsubProfile = onSnapshot(
      doc(db, 'publicProfiles', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as PublicProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `publicProfiles/${user.uid}`)
    );

    const unsubVerses = onSnapshot(
      collection(db, 'users', user.uid, 'savedVerses'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as SavedVerse);
        setSavedVerses(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/savedVerses`)
    );

    const unsubLessons = onSnapshot(
      collection(db, 'users', user.uid, 'lessonProgress'),
      (snap) => {
        const map: Record<string, LessonProgress> = {};
        snap.docs.forEach((d) => {
          const item = d.data() as LessonProgress;
          map[item.id] = item;
        });
        setLessonProgress(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/lessonProgress`)
    );

    const unsubFollowing = onSnapshot(
      collection(db, 'users', user.uid, 'following'),
      (snap) => {
        setFollowingIds(new Set(snap.docs.map((d) => d.id)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/following`)
    );

    return () => {
      unsubProfile();
      unsubVerses();
      unsubLessons();
      unsubFollowing();
    };
  }, [user]);

  const setPreferredBibleVersion = async (version: string) => {
    setPreferredBibleVersionState(version);
    localStorage.setItem('maranata_bible_version', version);
    if (user && user.emailVerified) {
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          preferredBibleVersion: version,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Sesión iniciada correctamente');
    } catch (err) {
      console.error('Google Sign-In error:', err);
      showToast('No se pudo iniciar sesión con Google');
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    showToast('Sesión cerrada');
  };

  const toggleFavoriteTrack = useCallback((trackId: string) => {
    setFavoriteTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      try {
        localStorage.setItem('maranata_fav_tracks', JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const playTrack = useCallback(
    (track: MusicTrack, queue?: MusicTrack[]) => {
      if (queue && queue.length > 0) {
        setPlayQueue(queue);
      }
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(track.durationSec);
      const audio = audioRef.current;
      if (!audio) return;

      const startPlayback = (resolvedUrl: string) => {
        setAudioLoading(true);
        audio.src = resolvedUrl;
        audio.load();
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            setAudioLoading(false);
          })
          .catch(() => {
            setIsPlaying(false);
            setAudioLoading(false);
          });
      };

      if (track.audioUrl) {
        startPlayback(track.audioUrl);
        return;
      }

      if (track.archiveIdentifier) {
        setAudioLoading(true);
        fetch(`/api/hymns/resolve?identifier=${encodeURIComponent(track.archiveIdentifier)}`)
          .then((r) => r.json())
          .then((data: { audioUrl?: string; durationSec?: number }) => {
            if (!data.audioUrl) throw new Error('Sin audio');
            const updated: MusicTrack = {
              ...track,
              audioUrl: data.audioUrl,
              durationSec: data.durationSec || track.durationSec,
            };
            setCurrentTrack((cur) => (cur?.id === track.id ? updated : cur));
            setPlayQueue((prev) => prev.map((t) => (t.id === track.id ? updated : t)));
            setDuration(updated.durationSec);
            startPlayback(data.audioUrl);
          })
          .catch(() => {
            setAudioLoading(false);
            setIsPlaying(false);
            showToast('No se pudo cargar el audio de este himno');
          });
      }
    },
    []
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack]);

  const playNext = useCallback(() => {
    if (!currentTrack || playQueue.length === 0) return;
    if (shuffle && playQueue.length > 1) {
      const candidates = playQueue.filter((t) => t.id !== currentTrack.id);
      const randomTrack = candidates[Math.floor(Math.random() * candidates.length)];
      if (randomTrack) playTrack(randomTrack);
      return;
    }
    const idx = playQueue.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (idx + 1) % playQueue.length;
    playTrack(playQueue[nextIdx]);
  }, [currentTrack, playQueue, shuffle, playTrack]);

  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (!currentTrack || playQueue.length === 0) return;
    const idx = playQueue.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + playQueue.length) % playQueue.length;
    playTrack(playQueue[prevIdx]);
  }, [currentTrack, playQueue, playTrack]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  const stopPlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // Lock-Screen MediaSession API integration so audio keeps playing & shows controls when phone locks
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    const resolvedCover = currentTrack.coverUrl || getAudioCoverFallback(currentTrack);
    const absoluteArtwork = resolvedCover.startsWith('http')
      ? resolvedCover
      : `${window.location.origin}${resolvedCover}`;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: [
        { src: absoluteArtwork, sizes: '512x512', type: 'image/jpeg' },
      ],
    });
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => {
        audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      }],
      ['pause', () => {
        audioRef.current?.pause();
        setIsPlaying(false);
      }],
      ['nexttrack', () => playNext()],
      ['previoustrack', () => playPrev()],
      ['seekto', (details) => {
        if (typeof details.seekTime === 'number') seekTo(details.seekTime);
      }],
      ['seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        seekTo(Math.max(0, (audioRef.current?.currentTime || 0) - offset));
      }],
      ['seekforward', (details) => {
        const offset = details.seekOffset || 10;
        const maxDur = audioRef.current?.duration || duration;
        seekTo(Math.min(maxDur, (audioRef.current?.currentTime || 0) + offset));
      }],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // action unsupported on this browser
      }
    }
  }, [playNext, playPrev, seekTo, duration]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        studyMode,
        setStudyMode,
        openFeDeJesus: () => {
          setStudyMode('fe-de-jesus');
          setActiveTab('sabbath');
        },
        theme,
        toggleTheme,
        user,
        authLoading,
        profile,
        preferredBibleVersion,
        setPreferredBibleVersion,
        savedVerses,
        lessonProgress,
        followingIds,
        bibleJump,
        openBibleAt,
        signInWithGoogle,
        signOutUser,
        toast,
        showToast,
        currentTrack,
        playQueue,
        isPlaying,
        audioLoading,
        currentTime,
        duration,
        shuffle,
        repeat,
        favoriteTrackIds,
        toggleShuffle: () => setShuffle((s) => !s),
        toggleRepeat: () => setRepeat((r) => !r),
        toggleFavoriteTrack,
        playTrack,
        togglePlayPause,
        playNext,
        playPrev,
        seekTo,
        stopPlayer,
      }}
    >
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setAudioLoading(true)}
        onCanPlay={() => setAudioLoading(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          const ct = e.currentTarget.currentTime;
          const d = e.currentTarget.duration;
          setCurrentTime(ct);
          if (Number.isFinite(d) && d > 0 && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            try {
              navigator.mediaSession.setPositionState({
                duration: d,
                playbackRate: e.currentTarget.playbackRate || 1,
                position: Math.min(ct, d),
              });
            } catch {
              // ignore invalid position state
            }
          }
        }}
        onEnded={() => {
          if (repeat && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } else {
            playNext();
          }
        }}
        onError={() => {
          setAudioLoading(false);
          setIsPlaying(false);
          showToast('No se pudo cargar este audio; intenta con otro canto');
        }}
      />
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
