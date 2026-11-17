import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clapperboard,
  Edit3,
  GraduationCap,
  LogIn,
  LogOut,
  Moon,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { VideoPost } from '../types';

export function ProfileView() {
  const {
    user,
    authLoading,
    profile,
    savedVerses,
    lessonProgress,
    followingIds,
    theme,
    toggleTheme,
    openBibleAt,
    setActiveTab,
    signInWithGoogle,
    signOutUser,
    showToast,
  } = useApp();

  const [subTab, setSubTab] = useState<'videos' | 'verses' | 'lessons'>('videos');
  const [myVideos, setMyVideos] = useState<VideoPost[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [church, setChurch] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setMyVideos([]);
      return;
    }
    const q = query(
      collection(db, 'videos'),
      where('authorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMyVideos(snap.docs.map((d) => d.data() as VideoPost));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'videos')
    );
    return () => unsub();
  }, [user]);

  const openEdit = () => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setHandle(profile.handle || '');
    setChurch(profile.church || '');
    setBio(profile.bio || '');
    setEditOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const cleanHandle = handle
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, '')
      .slice(0, 40);
    if (cleanHandle.length < 2) {
      showToast('El usuario debe tener al menos 2 caracteres válidos');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'publicProfiles', user.uid), {
        displayName: displayName.trim().slice(0, 80) || profile.displayName,
        handle: cleanHandle,
        church: church.trim().slice(0, 120),
        bio: bio.trim().slice(0, 280),
        updatedAt: serverTimestamp(),
      });
      setEditOpen(false);
      showToast('Perfil actualizado');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!user) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'videos', videoId));
    batch.update(doc(db, 'publicProfiles', user.uid), {
      postsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
      showToast('Video eliminado');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `videos/${videoId}`);
    }
  };

  const handleDeleteVerse = async (verseId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedVerses', verseId));
      showToast('Versículo eliminado');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/savedVerses/${verseId}`);
    }
  };

  const completedDays = Object.values(lessonProgress).filter((p) => p.completed || p.note);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 sm:px-6 h-14">
          <span className="font-display text-lg font-bold">
            {profile ? `@${profile.handle}` : 'Perfil Adventista'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Cambiar tema claro u oscuro"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user && (
              <button
                type="button"
                onClick={signOutUser}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 space-y-6">
        {!user ? (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-5">
            <img
              src="/src/assets/images/maranata_emblem_1794943377605.jpg"
              alt="Maranata"
              referrerPolicy="no-referrer"
              className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-md"
            />
            <div className="max-w-md mx-auto space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-balance">
                Tu perfil personal en Maranata
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Inicia sesión para crear tu perfil adventista, publicar videos edificantes, guardar
                tus versículos favoritos y sincronizar tu progreso de la Escuela Sabática.
              </p>
            </div>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Continuar con Google
            </button>
          </section>
        ) : (
          <>
            {/* Profile Hero Card */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={
                      profile?.photoURL ||
                      user.photoURL ||
                      '/src/assets/images/maranata_emblem_1794943377605.jpg'
                    }
                    alt={profile?.displayName || 'Mi perfil'}
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-amber-500/50 shrink-0"
                  />
                  <div className="min-w-0">
                    <h1 className="font-display text-2xl font-bold truncate">
                      {profile?.displayName || user.displayName}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      @{profile?.handle || 'miembro'}
                    </p>
                    {profile?.church && (
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
                        {profile.church}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openEdit}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                >
                  <Edit3 className="h-4 w-4" />
                  Editar perfil
                </button>
              </div>

              {profile?.bio && (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
                  {profile.bio}
                </p>
              )}

              <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <div>
                  <p className="font-mono-code text-lg font-bold tabular-nums">
                    {myVideos.length}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Videos</p>
                </div>
                <div>
                  <p className="font-mono-code text-lg font-bold tabular-nums">
                    {followingIds.size}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Siguiendo</p>
                </div>
                <div>
                  <p className="font-mono-code text-lg font-bold tabular-nums">
                    {savedVerses.length}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Versículos</p>
                </div>
                <div>
                  <p className="font-mono-code text-lg font-bold tabular-nums">
                    {completedDays.length}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Lecciones</p>
                </div>
              </div>
            </section>

            {/* Profile Sub-Tabs */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setSubTab('videos')}
                className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  subTab === 'videos'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Clapperboard className="h-4 w-4" />
                Videos
              </button>
              <button
                type="button"
                onClick={() => setSubTab('verses')}
                className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  subTab === 'verses'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Versículos
              </button>
              <button
                type="button"
                onClick={() => setSubTab('lessons')}
                className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  subTab === 'lessons'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                Escuela
              </button>
            </div>

            {/* Sub-Tab Content */}
            {subTab === 'videos' && (
              <section>
                {myVideos.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Aún no has publicado videos en la comunidad.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('videos')}
                      className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950"
                    >
                      Ir a Videos
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myVideos.map((v) => (
                      <div
                        key={v.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                      >
                        <div className="aspect-video bg-slate-900 relative">
                          <img
                            src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`}
                            alt={v.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-4 space-y-2">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                            {v.category}
                          </p>
                          <h3 className="font-display text-base font-bold line-clamp-2">
                            {v.title}
                          </h3>
                          <div className="flex items-center justify-between pt-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono-code tabular-nums">
                              {v.likesCount} me gusta · {v.commentsCount} comentarios
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteVideo(v.id)}
                              aria-label="Eliminar video"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {subTab === 'verses' && (
              <section className="space-y-3">
                {savedVerses.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Toca cualquier versículo en la Biblia para resaltarlo y guardarlo aquí.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('bible')}
                      className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950"
                    >
                      Abrir Biblia
                    </button>
                  </div>
                ) : (
                  savedVerses.map((sv) => (
                    <div
                      key={sv.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-start justify-between gap-4"
                    >
                      <button
                        type="button"
                        onClick={() => openBibleAt(sv.bookId, sv.chapter, sv.verse)}
                        className="text-left flex-1 space-y-1.5"
                      >
                        <p className="font-mono-code text-xs font-bold text-amber-600 dark:text-amber-400">
                          {sv.bookName} {sv.chapter}:{sv.verse} ({sv.version})
                        </p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                          &ldquo;{sv.text}&rdquo;
                        </p>
                        {sv.note && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                            Nota: {sv.note}
                          </p>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVerse(sv.id)}
                        aria-label="Eliminar versículo"
                        className="p-2 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </section>
            )}

            {subTab === 'lessons' && (
              <section className="space-y-3">
                {completedDays.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Marca los días estudiados en la Escuela Sabática para ver tu historial aquí.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('sabbath')}
                      className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950"
                    >
                      Ir a Escuela Sabática
                    </button>
                  </div>
                ) : (
                  completedDays.map((lp) => (
                    <div
                      key={lp.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-code text-xs font-bold text-slate-500 dark:text-slate-400">
                          {lp.quarterlyId === 'fe-de-jesus'
                            ? `La Fe de Jesús · Lección ${lp.lessonId}`
                            : `Trimestre ${lp.quarterlyId} · Lección ${lp.lessonId} · Día ${lp.dayId}`}
                        </span>
                        {lp.completed && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Estudiado
                          </span>
                        )}
                      </div>
                      {lp.note && (
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {lp.note}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveProfile}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Editar perfil</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Nombre completo
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Usuario (@handle)
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Iglesia Adventista local
              </label>
              <input
                type="text"
                maxLength={120}
                value={church}
                onChange={(e) => setChurch(e.target.value)}
                placeholder="Ej. IASD Central"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Biografía
              </label>
              <textarea
                rows={3}
                maxLength={280}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
