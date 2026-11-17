import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Captions,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  Share2,
  UserCheck,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  increment,
  getDoc,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { formatVideoTime, sendYtCommand, useYouTubeProgress } from '../lib/youtubePlayer';
import { PublicProfile, VideoCategory, VideoComment, VideoPost } from '../types';

const CATEGORIES: Array<{ id: 'Todos' | VideoCategory; label: string }> = [
  { id: 'Todos', label: 'Todos' },
  { id: 'Predicas', label: 'Prédicas' },
  { id: 'Reflexion', label: 'Reflexión' },
  { id: 'Biblia', label: 'Biblia' },
  { id: 'EscuelaSabatica', label: 'Escuela Sabática' },
  { id: 'Musica', label: 'Música' },
  { id: 'Jovenes', label: 'Jóvenes' },
  { id: 'Testimonio', label: 'Testimonio' },
];

const CATEGORY_LABELS: Record<string, string> = {
  Predicas: 'Prédicas',
  Reflexion: 'Reflexión',
  Biblia: 'Biblia',
  EscuelaSabatica: 'Escuela Sabática',
  Musica: 'Música',
  Jovenes: 'Jóvenes',
  Testimonio: 'Testimonio',
};

const QUICK_VIDEO_SEARCHES = [
  'Prédicas Alejandro Bullón',
  'Prédicas Joel Flores',
  'Escrito Está Robert Costa',
  'Profecías Daniel y Apocalipsis',
  'Esteban Bohr',
  'Bruno Raso',
  'Música Adventista',
  'Escuela Sabática',
];

function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const vParam = url.searchParams.get('v');
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'shorts' || p === 'embed' || p === 'live');
    if (idx !== -1 && parts[idx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[idx + 1])) {
      return parts[idx + 1];
    }
  } catch {
    // not a valid URL
  }
  return null;
}

export function SocialFeedView() {
  const { user, profile, followingIds, signInWithGoogle, showToast } = useApp();
  const [curatedVideos, setCuratedVideos] = useState<VideoPost[]>([]);
  const [communityVideos, setCommunityVideos] = useState<VideoPost[]>([]);
  const [pinnedVideos, setPinnedVideos] = useState<VideoPost[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VideoPost[]>([]);
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState<'Todos' | VideoCategory>('Todos');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [resumeStartSec, setResumeStartSec] = useState(0);
  const [localLikes, setLocalLikes] = useState<Record<string, boolean>>({});
  const [firestoreLikes, setFirestoreLikes] = useState<Record<string, boolean>>({});

  // Comments Drawer
  const [commentsOpenFor, setCommentsOpenFor] = useState<VideoPost | null>(null);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Publish Modal
  const [publishOpen, setPublishOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newCategory, setNewCategory] = useState<VideoCategory>('Predicas');
  const [publishing, setPublishing] = useState(false);

  // Creator Preview Modal
  const [creatorModal, setCreatorModal] = useState<PublicProfile | null>(null);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const activeIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Load curated real Shorts + Prédicas from backend
  useEffect(() => {
    fetch('/api/videos/feed')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) {
          const mapped: VideoPost[] = data.items.map((item: VideoPost, i: number) => ({
            ...item,
            likesCount: 120 + i * 37,
            commentsCount: 8 + i * 3,
            isCommunity: false,
          }));
          setCuratedVideos(mapped);
        }
      })
      .catch(() => {
        // handled silently
      });
  }, []);

  // Load Firestore community videos
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...(d.data() as VideoPost),
          isCommunity: true,
        }));
        setCommunityVideos(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'videos')
    );
    return () => unsub();
  }, []);

  const allVideos = useMemo(() => {
    const baseMerged = [...pinnedVideos, ...communityVideos, ...curatedVideos];
    const deduped: VideoPost[] = [];
    const seen = new Set<string>();
    for (const v of baseMerged) {
      if (seen.has(v.youtubeId)) continue;
      seen.add(v.youtubeId);
      deduped.push(v);
    }
    if (category === 'Todos') return deduped;
    return deduped.filter((v) => v.category === category);
  }, [pinnedVideos, communityVideos, curatedVideos, category]);

  const activeVideo = allVideos[activeIndex] || null;
  const {
    currentTime: ytCurrentTime,
    duration: ytDuration,
    seekBy: seekVideoBy,
    seekTo: seekVideoTo,
    onIframeLoad: onVideoIframeLoad,
  } = useYouTubeProgress(activeIframeRef, activeVideo?.youtubeId || '');

  useEffect(() => {
    setActiveIndex(0);
    setVideoPaused(false);
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [category]);

  useEffect(() => {
    setVideoPaused(false);
    setResumeStartSec(0);
  }, [activeIndex]);

  const toggleActivePlay = () => {
    if (videoPaused) {
      sendYtCommand(activeIframeRef.current, 'playVideo');
      setVideoPaused(false);
    } else {
      sendYtCommand(activeIframeRef.current, 'pauseVideo');
      setVideoPaused(true);
    }
  };

  const toggleActiveMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (nextMuted) {
      sendYtCommand(activeIframeRef.current, 'mute');
    } else {
      sendYtCommand(activeIframeRef.current, 'unMute');
      sendYtCommand(activeIframeRef.current, 'setVolume', [100]);
      sendYtCommand(activeIframeRef.current, 'playVideo');
      setVideoPaused(false);
    }
  };

  const runVideoSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/videos/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          youtubeId: string;
          title: string;
          authorName: string;
          authorHandle: string;
          duration?: string;
          category: VideoCategory;
        }>;
      };
      if (Array.isArray(data.items)) {
        const mapped: VideoPost[] = data.items.map((item, idx) => ({
          id: `search_${item.youtubeId}`,
          youtubeId: item.youtubeId,
          title: item.title,
          caption: `Resultado para "${q}"`,
          authorId: `search_author_${idx}`,
          authorName: item.authorName,
          authorHandle: item.authorHandle,
          authorAvatar: '/src/assets/images/maranata_emblem_1794943377605.jpg',
          category: item.category || 'Predicas',
          duration: item.duration,
          likesCount: 45 + idx * 12,
          commentsCount: 4 + idx,
          isCommunity: false,
        }));
        setSearchResults(mapped);
      }
    } catch {
      // keep local matches
    } finally {
      setSearching(false);
    }
  };

  // Debounced live title search inside Search Modal
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      runVideoSearch(q);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchOpen]);

  const modalListedVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const localAll = [...communityVideos, ...curatedVideos];
    const localFiltered = !q
      ? localAll
      : localAll.filter(
          (v) =>
            v.title.toLowerCase().includes(q) ||
            (v.caption || '').toLowerCase().includes(q) ||
            v.authorName.toLowerCase().includes(q) ||
            v.category.toLowerCase().includes(q)
        );
    const merged = [...searchResults, ...localFiltered];
    const deduped: VideoPost[] = [];
    const seen = new Set<string>();
    for (const v of merged) {
      if (seen.has(v.youtubeId)) continue;
      seen.add(v.youtubeId);
      deduped.push(v);
    }
    return deduped;
  }, [searchQuery, searchResults, communityVideos, curatedVideos]);

  const handleSelectVideoFromSearch = (chosen: VideoPost) => {
    setPinnedVideos((prev) => [
      chosen,
      ...prev.filter((p) => p.youtubeId !== chosen.youtubeId),
    ]);
    setCategory('Todos');
    setSearchOpen(false);
    setActiveIndex(0);
    setVideoPaused(false);
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  // Check Firestore like status for active community video
  useEffect(() => {
    if (!user || !user.emailVerified || !activeVideo?.isCommunity) return;
    getDoc(doc(db, 'videos', activeVideo.id, 'likes', user.uid))
      .then((snap) => {
        setFirestoreLikes((prev) => ({ ...prev, [activeVideo.id]: snap.exists() }));
      })
      .catch(() => {});
  }, [user, activeVideo?.id, activeVideo?.isCommunity]);

  // Subscribe to comments when drawer is open
  useEffect(() => {
    if (!commentsOpenFor || !commentsOpenFor.isCommunity) {
      setComments([]);
      return;
    }
    const q = query(
      collection(db, 'videos', commentsOpenFor.id, 'comments'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => d.data() as VideoComment));
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `videos/${commentsOpenFor.id}/comments`)
    );
    return () => unsub();
  }, [commentsOpenFor]);

  const scrollToVideo = (index: number) => {
    if (!feedRef.current) return;
    const clamped = Math.max(0, Math.min(allVideos.length - 1, index));
    const slideHeight = feedRef.current.clientHeight;
    feedRef.current.scrollTo({ top: clamped * slideHeight, behavior: 'smooth' });
    setActiveIndex(clamped);
  };

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, clientHeight } = feedRef.current;
    if (clientHeight > 0) {
      const idx = Math.round(scrollTop / clientHeight);
      if (idx !== activeIndex && idx >= 0 && idx < allVideos.length) {
        setActiveIndex(idx);
      }
    }
  };

  const isLiked = (video: VideoPost) => {
    if (video.isCommunity) return Boolean(firestoreLikes[video.id]);
    return Boolean(localLikes[video.id]);
  };

  const toggleLike = async (video: VideoPost) => {
    if (!video.isCommunity) {
      setLocalLikes((prev) => ({ ...prev, [video.id]: !prev[video.id] }));
      return;
    }
    if (!user || !user.emailVerified) {
      showToast('Inicia sesión con Google para dar Me gusta');
      return;
    }
    const currentlyLiked = Boolean(firestoreLikes[video.id]);
    const videoRef = doc(db, 'videos', video.id);
    const likeRef = doc(db, 'videos', video.id, 'likes', user.uid);
    const batch = writeBatch(db);

    if (currentlyLiked) {
      batch.delete(likeRef);
      batch.update(videoRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(likeRef, {
        userId: user.uid,
        videoId: video.id,
        createdAt: serverTimestamp(),
      });
      batch.update(videoRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      setFirestoreLikes((prev) => ({ ...prev, [video.id]: !currentlyLiked }));
      await batch.commit();
    } catch (err) {
      setFirestoreLikes((prev) => ({ ...prev, [video.id]: currentlyLiked }));
      handleFirestoreError(err, OperationType.WRITE, `videos/${video.id}/likes/${user.uid}`);
    }
  };

  const toggleFollow = async (video: VideoPost) => {
    if (!user || !user.emailVerified) {
      showToast('Inicia sesión para seguir a creadores');
      return;
    }
    if (video.authorId === user.uid) return;
    const targetRef = doc(db, 'users', user.uid, 'following', video.authorId);
    const profileRef = doc(db, 'publicProfiles', user.uid);
    const currentlyFollowing = followingIds.has(video.authorId);

    const batch = writeBatch(db);
    if (currentlyFollowing) {
      batch.delete(targetRef);
      if (profile) {
        batch.update(profileRef, {
          followingCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      batch.set(targetRef, {
        targetId: video.authorId,
        targetName: video.authorName.slice(0, 80),
        targetHandle: video.authorHandle.slice(0, 40),
        createdAt: serverTimestamp(),
      });
      if (profile) {
        batch.update(profileRef, {
          followingCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }
    }
    try {
      await batch.commit();
      showToast(
        currentlyFollowing
          ? `Dejaste de seguir a ${video.authorName}`
          : `Siguiendo a ${video.authorName}`
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `users/${user.uid}/following/${video.authorId}`
      );
    }
  };

  const handleOpenCreator = async (video: VideoPost) => {
    if (video.isCommunity) {
      try {
        const snap = await getDoc(doc(db, 'publicProfiles', video.authorId));
        if (snap.exists()) {
          setCreatorModal(snap.data() as PublicProfile);
          return;
        }
      } catch {
        // fallback below
      }
    }
    setCreatorModal({
      uid: video.authorId,
      displayName: video.authorName,
      handle: video.authorHandle,
      church: 'Ministerio Adventista Digital',
      bio: 'Compartiendo mensajes bíblicos, música y esperanza cristiana en Maranata.',
      photoURL: video.authorAvatar,
      followersCount: 1240,
      followingCount: 48,
      postsCount: 12,
    });
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified || !profile) {
      await signInWithGoogle();
      return;
    }
    const ytId = extractYoutubeId(newYoutubeUrl);
    if (!ytId) {
      showToast('Pega un enlace válido de YouTube o YouTube Shorts');
      return;
    }
    if (!newTitle.trim()) {
      showToast('Escribe un título para tu video');
      return;
    }

    setPublishing(true);
    const videoId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const batch = writeBatch(db);
    batch.set(doc(db, 'videos', videoId), {
      id: videoId,
      authorId: user.uid,
      authorName: profile.displayName.slice(0, 80),
      authorHandle: profile.handle.slice(0, 40),
      authorAvatar: profile.photoURL || '',
      title: newTitle.trim().slice(0, 140),
      caption: newCaption.trim().slice(0, 400),
      youtubeId: ytId,
      category: newCategory,
      likesCount: 0,
      commentsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'publicProfiles', user.uid), {
      postsCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      setNewTitle('');
      setNewYoutubeUrl('');
      setNewCaption('');
      setPublishOpen(false);
      showToast('¡Video publicado en la comunidad!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `videos/${videoId}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentsOpenFor || !commentText.trim()) return;
    if (!user || !user.emailVerified || !profile) {
      showToast('Inicia sesión con Google para comentar');
      return;
    }
    if (!commentsOpenFor.isCommunity) {
      showToast('Los comentarios están disponibles en videos de miembros de Maranata');
      return;
    }

    setSendingComment(true);
    const commentId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const batch = writeBatch(db);
    batch.set(doc(db, 'videos', commentsOpenFor.id, 'comments', commentId), {
      id: commentId,
      videoId: commentsOpenFor.id,
      authorId: user.uid,
      authorName: profile.displayName.slice(0, 80),
      authorAvatar: profile.photoURL || '',
      text: commentText.trim().slice(0, 400),
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'videos', commentsOpenFor.id), {
      commentsCount: increment(1),
      lastCommentId: commentId,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      setCommentText('');
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `videos/${commentsOpenFor.id}/comments/${commentId}`
      );
    } finally {
      setSendingComment(false);
    }
  };

  const handleShareVideo = async (video: VideoPost) => {
    const shareUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Enlace del video copiado');
      }
    } catch {
      // cancelled
    }
  };

  return (
    <div className="relative h-[calc(100dvh-64px)] w-full overflow-hidden bg-slate-950 text-white">
      {/* Top Overlay Category Filter, Search Trigger & Publish Trigger */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 via-black/45 to-transparent px-3 sm:px-6 pt-3 pb-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  category === cat.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white/10 text-white/85 hover:bg-white/20'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar videos y prédicas"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition-colors whitespace-nowrap"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Buscar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  signInWithGoogle();
                } else {
                  setPublishOpen(true);
                }
              }}
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Publicar
            </button>
          </div>
        </div>
      </div>

      {/* Vertical TikTok-Style Snap Feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            scrollToVideo(activeIndex + 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            scrollToVideo(activeIndex - 1);
          }
        }}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar outline-none"
      >
        {allVideos.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-sm space-y-3">
              <p className="font-display text-xl font-bold">
                No hay videos en esta categoría todavía
              </p>
              <p className="text-sm text-slate-300">
                Sé el primero en compartir un mensaje adventista de esperanza.
              </p>
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950"
              >
                Publicar video
              </button>
            </div>
          </div>
        ) : (
          allVideos.map((video, index) => {
            const isActive = index === activeIndex;
            const liked = isLiked(video);
            const following = followingIds.has(video.authorId);
            const displayLikes = video.likesCount + (liked && !video.isCommunity ? 1 : 0);

            return (
              <section
                key={video.id}
                className="relative h-[calc(100dvh-64px)] w-full snap-start snap-always flex items-center justify-center bg-slate-950"
              >
                {/* Centered 9:16 Vertical Stage on Desktop, Full-Screen on Mobile */}
                <div className="relative h-full w-full lg:w-[440px] lg:max-h-[calc(100dvh-88px)] lg:rounded-3xl overflow-hidden bg-black shadow-2xl border-0 lg:border lg:border-slate-800">
                  {/* Poster Fallback */}
                  <img
                    src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                    alt={video.title}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover opacity-55"
                  />

                  {/* Active Unbranded Video Embed (controls hidden, no YouTube logo bar) */}
                  {isActive && (
                    <iframe
                      ref={activeIframeRef}
                      key={`${video.youtubeId}-${subtitlesOn ? 'cc1' : 'cc0'}`}
                      onLoad={onVideoIframeLoad}
                      src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&mute=${
                        muted ? 1 : 0
                      }&loop=1&playlist=${video.youtubeId}&playsinline=1&controls=0&iv_load_policy=3&disablekb=1&fs=0&modestbranding=1&rel=0&enablejsapi=1&cc_load_policy=${
                        subtitlesOn ? 1 : 0
                      }&cc_lang_pref=es${resumeStartSec > 0 ? `&start=${resumeStartSec}` : ''}`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="relative z-10 h-full w-full border-0"
                    />
                  )}

                  {/* Tap Overlay to Play/Pause cleanly without exposing YouTube logo/hover bar */}
                  {isActive && (
                    <button
                      type="button"
                      onClick={toggleActivePlay}
                      aria-label={videoPaused ? 'Reproducir video' : 'Pausar video'}
                      className="absolute inset-0 z-15 flex items-center justify-center bg-transparent focus:outline-none"
                    >
                      {videoPaused && (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm shadow-md">
                          <Play className="h-4 w-4 fill-white ml-0.5" />
                        </span>
                      )}
                    </button>
                  )}

                  {/* Bottom Contrast Scrim + Creator Info + Seek Controls */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3.5 pr-12 pt-16">
                    <div className="pointer-events-auto space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenCreator(video)}
                          className="flex items-center gap-2 text-left group"
                        >
                          <img
                            src={
                              video.authorAvatar ||
                              '/src/assets/images/maranata_emblem_1794943377605.jpg'
                            }
                            alt={video.authorName}
                            referrerPolicy="no-referrer"
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-white/40"
                          />
                          <div>
                            <p className="text-xs font-bold text-white group-hover:underline">
                              {video.authorName}
                            </p>
                            <p className="text-[11px] text-slate-300">
                              @{video.authorHandle} · {CATEGORY_LABELS[video.category] || video.category}
                            </p>
                          </div>
                        </button>
                      </div>
                      <h2 className="font-display text-sm sm:text-base font-bold text-white leading-snug line-clamp-2">
                        {video.title}
                      </h2>
                      {video.caption && (
                        <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                          {video.caption}
                        </p>
                      )}

                      {/* Compact Rewind / Play / Forward + Timeline Scrubber */}
                      {isActive && (
                        <div className="space-y-1 pt-1">
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
                                aria-label="Posición del video"
                                className="h-1 flex-1 accent-amber-500 cursor-pointer"
                              />
                              <span className="font-mono-code text-[10px] tabular-nums text-white/75 shrink-0">
                                {formatVideoTime(ytDuration)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => seekVideoBy(-10)}
                              aria-label="Retroceder 10 segundos"
                              className="inline-flex h-7 items-center gap-0.5 rounded-lg bg-white/15 px-2 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                            >
                              <RotateCcw className="h-3 w-3" />
                              10s
                            </button>
                            <button
                              type="button"
                              onClick={toggleActivePlay}
                              aria-label={videoPaused ? 'Reproducir' : 'Pausar'}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                            >
                              {videoPaused ? (
                                <Play className="h-3 w-3 fill-white ml-0.5" />
                              ) : (
                                <Pause className="h-3 w-3 fill-white" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => seekVideoBy(10)}
                              aria-label="Avanzar 10 segundos"
                              className="inline-flex h-7 items-center gap-0.5 rounded-lg bg-white/15 px-2 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                            >
                              10s
                              <RotateCw className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Compact Right Vertical Action Bar */}
                  <div className="absolute right-2 bottom-14 z-20 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFollow(video)}
                      aria-label={following ? 'Siguiendo' : 'Seguir creador'}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
                    >
                      {following ? (
                        <UserCheck className="h-4 w-4 text-amber-400" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleLike(video)}
                      aria-label="Me gusta"
                      className="flex flex-col items-center gap-0.5"
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-transform active:scale-90 ${
                          liked ? 'text-rose-500' : 'text-white'
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${liked ? 'fill-rose-500' : ''}`} />
                      </span>
                      <span className="font-mono-code text-[10px] font-semibold tabular-nums text-white drop-shadow">
                        {displayLikes}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCommentsOpenFor(video)}
                      aria-label="Comentarios"
                      className="flex flex-col items-center gap-0.5"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white hover:bg-black/70">
                        <MessageCircle className="h-4 w-4" />
                      </span>
                      <span className="font-mono-code text-[10px] font-semibold tabular-nums text-white drop-shadow">
                        {video.commentsCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareVideo(video)}
                      aria-label="Compartir video"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white hover:bg-black/70"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={toggleActiveMute}
                      aria-label={muted ? 'Activar sonido' : 'Silenciar'}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm text-white hover:bg-black/70"
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setResumeStartSec(Math.floor(ytCurrentTime));
                        setSubtitlesOn((s) => !s);
                      }}
                      aria-label={subtitlesOn ? 'Quitar subtítulos' : 'Poner subtítulos'}
                      title={subtitlesOn ? 'Quitar subtítulos' : 'Poner subtítulos'}
                      className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
                        subtitlesOn
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'bg-black/45 text-white hover:bg-black/70'
                      }`}
                    >
                      <Captions className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Desktop Quick Next/Prev Controls */}
                <div className="hidden lg:flex flex-col gap-3 ml-5">
                  <button
                    type="button"
                    disabled={activeIndex === 0}
                    onClick={() => scrollToVideo(activeIndex - 1)}
                    aria-label="Video anterior"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-white disabled:opacity-30 hover:bg-slate-800 transition-colors"
                  >
                    <ChevronUp className="h-6 w-6" />
                  </button>
                  <span className="text-center font-mono-code text-xs tabular-nums text-slate-400">
                    {activeIndex + 1}/{allVideos.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeIndex >= allVideos.length - 1}
                    onClick={() => scrollToVideo(activeIndex + 1)}
                    aria-label="Siguiente video"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-white disabled:opacity-30 hover:bg-slate-800 transition-colors"
                  >
                    <ChevronDown className="h-6 w-6" />
                  </button>
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* Comments Sheet */}
      {commentsOpenFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-base font-bold">
                Comentarios · {commentsOpenFor.title.slice(0, 32)}
              </h3>
              <button
                type="button"
                onClick={() => setCommentsOpenFor(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!commentsOpenFor.isCommunity ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                  Video destacado de la red Nuevo Tiempo. Publica tus propios videos con el botón
                  &ldquo;Publicar&rdquo; para abrir debates comunitarios.
                </p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                  Sé el primero en dejar una palabra de ánimo.
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <img
                      src={
                        c.authorAvatar ||
                        '/src/assets/images/maranata_emblem_1794943377605.jpg'
                      }
                      alt={c.authorName}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {c.authorName}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 break-words">
                        {c.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {commentsOpenFor.isCommunity && (
              <form
                onSubmit={handleSendComment}
                className="flex items-center gap-2 p-4 border-t border-slate-200 dark:border-slate-800"
              >
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={400}
                  placeholder="Escribe un comentario edificante..."
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={sendingComment || !commentText.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-slate-950 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Publish Video Modal */}
      {publishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <form
            onSubmit={handlePublish}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Publicar video en Maranata</h3>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Enlace de YouTube o YouTube Shorts
              </label>
              <input
                type="text"
                required
                value={newYoutubeUrl}
                onChange={(e) => setNewYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/shorts/..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Título del mensaje
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Promesa de Isaías 41:10 para tu semana"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Categoría
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as VideoCategory)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="Predicas">Prédicas</option>
                <option value="Reflexion">Reflexión</option>
                <option value="Biblia">Biblia</option>
                <option value="EscuelaSabatica">Escuela Sabática</option>
                <option value="Musica">Música</option>
                <option value="Jovenes">Jóvenes</option>
                <option value="Testimonio">Testimonio</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Descripción (opcional)
              </label>
              <textarea
                rows={3}
                maxLength={400}
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                placeholder="Comparte una breve reflexión o versículo..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={publishing}
              className="w-full min-h-[44px] rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              {publishing ? 'Publicando...' : 'Publicar en el feed'}
            </button>
          </form>
        </div>
      )}

      {/* Public Creator Profile Modal */}
      {creatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={
                    creatorModal.photoURL ||
                    '/src/assets/images/maranata_emblem_1794943377605.jpg'
                  }
                  alt={creatorModal.displayName}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-display text-lg font-bold">{creatorModal.displayName}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    @{creatorModal.handle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatorModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {creatorModal.church && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {creatorModal.church}
              </p>
            )}
            {creatorModal.bio && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {creatorModal.bio}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 border-t border-slate-200 dark:border-slate-800 pt-4 text-center">
              <div>
                <p className="font-mono-code text-base font-bold tabular-nums">
                  {creatorModal.postsCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Videos</p>
              </div>
              <div>
                <p className="font-mono-code text-base font-bold tabular-nums">
                  {creatorModal.followersCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Seguidores</p>
              </div>
              <div>
                <p className="font-mono-code text-base font-bold tabular-nums">
                  {creatorModal.followingCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Siguiendo</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Search Drawer showing Browseable List of Video Titles */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <div className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3">
            <div className="mx-auto max-w-3xl space-y-3">
              <div className="flex items-center gap-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runVideoSearch(searchQuery);
                  }}
                  className="flex flex-1 items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar prédicas, temas bíblicos, testimonios, alabanzas..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-10 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        aria-label="Limpiar búsqueda"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={searching || searchQuery.trim().length < 2}
                    className="min-h-[42px] rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-45 shrink-0"
                  >
                    {searching ? 'Buscando...' : 'Buscar'}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Cerrar búsqueda"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Quick Suggested Topics */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {QUICK_VIDEO_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchQuery(term);
                      runVideoSearch(term);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 whitespace-nowrap shrink-0 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable List of Video Titles */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="mx-auto max-w-3xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <span>
                  {searchQuery.trim()
                    ? `Títulos encontrados (${modalListedVideos.length})`
                    : `Todas las prédicas y videos (${modalListedVideos.length})`}
                </span>
                {searching && <span className="text-amber-500 font-semibold">Cargando títulos...</span>}
              </div>

              {modalListedVideos.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No encontramos videos con ese nombre. Presiona &ldquo;Buscar&rdquo; para consultar más títulos adventistas.
                </p>
              ) : (
                modalListedVideos.map((item) => (
                  <button
                    key={item.youtubeId}
                    type="button"
                    onClick={() => handleSelectVideoFromSearch(item)}
                    className="w-full flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-left hover:border-amber-500/60 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors"
                  >
                    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                      <img
                        src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Play className="h-4 w-4 text-white fill-white" />
                      </div>
                      {item.duration && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 font-mono-code text-[10px] font-semibold text-white">
                          {item.duration}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                        {item.authorName} · {CATEGORY_LABELS[item.category] || item.category}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
