import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  Search,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { BibleBook, BibleVerse, BibleVersion, SavedVerse } from '../types';

const HIGHLIGHT_STYLES: Record<SavedVerse['highlightColor'], string> = {
  amber: 'bg-amber-100/80 dark:bg-amber-900/35',
  sky: 'bg-sky-100/80 dark:bg-sky-900/35',
  emerald: 'bg-emerald-100/80 dark:bg-emerald-900/35',
  rose: 'bg-rose-100/80 dark:bg-rose-900/35',
};

export function BibleView() {
  const {
    user,
    preferredBibleVersion,
    setPreferredBibleVersion,
    savedVerses,
    bibleJump,
    signInWithGoogle,
    showToast,
  } = useApp();

  const [versions, setVersions] = useState<BibleVersion[]>([
    { id: 'RV1960', name: 'Reina-Valera 1960', short: 'RV1960', year: '1960' },
    { id: 'NVI', name: 'Nueva Versión Internacional', short: 'NVI', year: '2015' },
    { id: 'NTV', name: 'Nueva Traducción Viviente', short: 'NTV', year: '2009' },
    { id: 'LBLA', name: 'La Biblia de las Américas', short: 'LBLA', year: '1997' },
    { id: 'PDT', name: 'Palabra de Dios para Todos', short: 'PDT', year: '2005' },
    { id: 'BTX3', name: 'La Biblia Textual 3ª Ed.', short: 'BTX3', year: '2010' },
  ]);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [bookId, setBookId] = useState<number>(43); // Juan
  const [chapter, setChapter] = useState<number>(3);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersion, setCompareVersion] = useState('NVI');
  const [compareVerses, setCompareVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Modals
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Book Picker State
  const [bookFilter, setBookFilter] = useState('');
  const [pickingChaptersFor, setPickingChaptersFor] = useState<BibleBook | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ book: number; chapter: number; verse: number; text: string }>
  >([]);
  const [searching, setSearching] = useState(false);

  // Selected Verse Action Sheet
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null);
  const [verseNote, setVerseNote] = useState('');
  const [verseColor, setVerseColor] = useState<SavedVerse['highlightColor']>('amber');

  useEffect(() => {
    fetch('/api/bible/versions')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.versions)) setVersions(data.versions);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/bible/books/${preferredBibleVersion}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBooks(data);
      })
      .catch(() => {});
  }, [preferredBibleVersion]);

  useEffect(() => {
    if (bibleJump) {
      setBookId(bibleJump.bookId);
      setChapter(bibleJump.chapter);
    }
  }, [bibleJump]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bible/chapter/${preferredBibleVersion}/${bookId}/${chapter}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setVerses(data);
      })
      .catch(() => {
        showToast('Error al cargar el capítulo');
      })
      .finally(() => setLoading(false));
  }, [preferredBibleVersion, bookId, chapter]);

  useEffect(() => {
    if (!compareMode) return;
    fetch(`/api/bible/chapter/${compareVersion}/${bookId}/${chapter}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCompareVerses(data);
      })
      .catch(() => {});
  }, [compareMode, compareVersion, bookId, chapter]);

  const currentBook = useMemo(
    () => books.find((b) => b.bookid === bookId) || { bookid: 43, name: 'Juan', chapters: 21, chronorder: 43 },
    [books, bookId]
  );

  const savedVerseMap = useMemo(() => {
    const map = new Map<number, SavedVerse>();
    savedVerses
      .filter((s) => s.bookId === bookId && s.chapter === chapter)
      .forEach((s) => map.set(s.verse, s));
    return map;
  }, [savedVerses, bookId, chapter]);

  const filteredBooks = useMemo(() => {
    const q = bookFilter.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => b.name.toLowerCase().includes(q));
  }, [books, bookFilter]);

  const oldTestament = useMemo(
    () => filteredBooks.filter((b) => b.bookid <= 39),
    [filteredBooks]
  );
  const newTestament = useMemo(
    () => filteredBooks.filter((b) => b.bookid > 39),
    [filteredBooks]
  );

  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/bible/search/${preferredBibleVersion}?q=${encodeURIComponent(searchQuery.trim())}`
      );
      const data = await res.json();
      if (Array.isArray(data)) setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePrevChapter = () => {
    if (chapter > 1) {
      setChapter(chapter - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (bookId > 1) {
      const prevBook = books.find((b) => b.bookid === bookId - 1);
      if (prevBook) {
        setBookId(prevBook.bookid);
        setChapter(prevBook.chapters);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleNextChapter = () => {
    if (chapter < currentBook.chapters) {
      setChapter(chapter + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (bookId < 66) {
      const nextBook = books.find((b) => b.bookid === bookId + 1);
      if (nextBook) {
        setBookId(nextBook.bookid);
        setChapter(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleSaveVerse = async () => {
    if (!selectedVerse) return;
    if (!user || !user.emailVerified) {
      await signInWithGoogle();
      return;
    }
    const verseKey = `${bookId}_${chapter}_${selectedVerse.verse}`;
    const refPath = `users/${user.uid}/savedVerses/${verseKey}`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'savedVerses', verseKey), {
        id: verseKey,
        userId: user.uid,
        bookId,
        bookName: currentBook.name,
        chapter,
        verse: selectedVerse.verse,
        version: preferredBibleVersion,
        text: selectedVerse.text.slice(0, 1200),
        highlightColor: verseColor,
        note: verseNote.trim().slice(0, 500),
        createdAt: serverTimestamp(),
      });
      setSelectedVerse(null);
      setVerseNote('');
      showToast(`Guardado: ${currentBook.name} ${chapter}:${selectedVerse.verse}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, refPath);
    }
  };

  const handleRemoveSavedVerse = async (verseNum: number) => {
    if (!user) return;
    const verseKey = `${bookId}_${chapter}_${verseNum}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedVerses', verseKey));
      setSelectedVerse(null);
      showToast('Versículo quitado de guardados');
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `users/${user.uid}/savedVerses/${verseKey}`
      );
    }
  };

  const textSizeClass =
    fontSize === 'sm'
      ? 'text-[15px] leading-[1.75]'
      : fontSize === 'lg'
        ? 'text-[19px] leading-[1.88]'
        : 'text-[17px] leading-[1.82]';

  return (
    <div className="min-h-screen pb-24 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sticky Straight Bible Header: [Book + Chapter] right beside [Version Initials] */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 sm:px-6 h-14">
          {/* Book + Chapter & Version Initials side by side */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                setPickingChaptersFor(null);
                setBookModalOpen(true);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 text-sm font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-none">
                {currentBook.name} {chapter}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setVersionModalOpen(true)}
              aria-label="Cambiar versión de la Biblia"
              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1.5 font-mono-code text-xs font-bold tracking-tight text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap shrink-0"
            >
              {preferredBibleVersion}
              <ChevronDown className="h-3 w-3 opacity-75" />
            </button>
          </div>

          {/* Reader Utilities */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              aria-label="Buscar en la Biblia"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setCompareMode((c) => !c)}
              aria-label="Comparar dos versiones"
              className={`hidden sm:inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors ${
                compareMode
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <Columns2 className="h-4 w-4" />
              Comparar
            </button>

            <button
              type="button"
              onClick={() =>
                setFontSize((s) => (s === 'sm' ? 'md' : s === 'md' ? 'lg' : 'sm'))
              }
              aria-label="Cambiar tamaño de letra"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              <Type className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Straight, Clean Bible Reading Column */}
      <main className={`mx-auto px-5 sm:px-8 pt-7 ${compareMode ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {/* Chapter Title Header */}
        <div className="mb-7 pb-5 border-b border-slate-200 dark:border-slate-800 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {versions.find((v) => v.id === preferredBibleVersion)?.name ||
                preferredBibleVersion}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              {currentBook.name} {chapter}
            </h1>
          </div>

          {compareMode && (
            <select
              value={compareVersion}
              onChange={(e) => setCompareVersion(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-code text-xs font-bold"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.short} · {v.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Straight Verses */}
        {loading ? (
          <div className="space-y-4 py-6">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="h-5 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse"
                style={{ width: `${78 + ((idx * 7) % 20)}%` }}
              />
            ))}
          </div>
        ) : compareMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <p className="font-mono-code text-xs font-bold text-amber-700 dark:text-amber-400">
                {preferredBibleVersion}
              </p>
              {verses.map((v) => (
                <p key={v.verse} className={`${textSizeClass} text-slate-800 dark:text-slate-200`}>
                  <sup className="font-mono-code text-xs font-bold text-amber-600 dark:text-amber-400 mr-1.5 tabular-nums">
                    {v.verse}
                  </sup>
                  {v.text}
                </p>
              ))}
            </div>
            <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-6 md:pt-0 md:pl-8">
              <p className="font-mono-code text-xs font-bold text-slate-500 dark:text-slate-400">
                {compareVersion}
              </p>
              {compareVerses.map((v) => (
                <p key={v.verse} className={`${textSizeClass} text-slate-800 dark:text-slate-200`}>
                  <sup className="font-mono-code text-xs font-bold text-slate-500 mr-1.5 tabular-nums">
                    {v.verse}
                  </sup>
                  {v.text}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <article className="max-w-[65ch] space-y-2.5">
            {verses.map((v) => {
              const saved = savedVerseMap.get(v.verse);
              const highlightCls = saved ? HIGHLIGHT_STYLES[saved.highlightColor] : '';
              return (
                <p
                  key={v.verse}
                  onClick={() => {
                    setSelectedVerse(v);
                    setVerseColor(saved?.highlightColor || 'amber');
                    setVerseNote(saved?.note || '');
                  }}
                  className={`${textSizeClass} cursor-pointer rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-900/80 ${highlightCls}`}
                >
                  <sup className="font-mono-code text-xs font-bold text-amber-600 dark:text-amber-400 mr-2 tabular-nums select-none">
                    {v.verse}
                  </sup>
                  <span className="text-slate-800 dark:text-slate-200">{v.text}</span>
                </p>
              );
            })}
          </article>
        )}

        {/* Chapter Previous / Next Controls */}
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={bookId === 1 && chapter === 1}
            onClick={handlePrevChapter}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold disabled:opacity-35 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          <span className="font-mono-code text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {currentBook.name} {chapter} / {currentBook.chapters}
          </span>

          <button
            type="button"
            disabled={bookId === 66 && chapter === currentBook.chapters}
            onClick={handleNextChapter}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold disabled:opacity-35 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </main>

      {/* Book & Chapter Picker Modal */}
      {bookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {pickingChaptersFor && (
                  <button
                    type="button"
                    onClick={() => setPickingChaptersFor(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <h3 className="font-display text-lg font-bold">
                  {pickingChaptersFor
                    ? `${pickingChaptersFor.name} · Elige capítulo`
                    : 'Seleccionar libro'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBookModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!pickingChaptersFor ? (
              <>
                <div className="px-5 pt-4 pb-2">
                  <input
                    type="text"
                    value={bookFilter}
                    onChange={(e) => setBookFilter(e.target.value)}
                    placeholder="Buscar libro (ej. Salmos, Daniel, Apocalipsis)..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {oldTestament.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
                        Antiguo Testamento
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {oldTestament.map((b) => (
                          <button
                            key={b.bookid}
                            type="button"
                            onClick={() => setPickingChaptersFor(b)}
                            className={`min-h-[44px] rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                              b.bookid === bookId
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {newTestament.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
                        Nuevo Testamento
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {newTestament.map((b) => (
                          <button
                            key={b.bookid}
                            type="button"
                            onClick={() => setPickingChaptersFor(b)}
                            className={`min-h-[44px] rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                              b.bookid === bookId
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {Array.from({ length: pickingChaptersFor.chapters }).map((_, idx) => {
                    const ch = idx + 1;
                    const active =
                      pickingChaptersFor.bookid === bookId && ch === chapter;
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => {
                          setBookId(pickingChaptersFor.bookid);
                          setChapter(ch);
                          setBookModalOpen(false);
                          setPickingChaptersFor(null);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`min-h-[44px] rounded-xl font-mono-code text-sm font-bold tabular-nums transition-colors ${
                          active
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Version Selector Modal */}
      {versionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-lg font-bold">Versiones de la Biblia</h3>
              <button
                type="button"
                onClick={() => setVersionModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {versions.map((v) => {
                const active = v.id === preferredBibleVersion;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setPreferredBibleVersion(v.id);
                      setVersionModalOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl p-3.5 text-left transition-colors ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {v.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Edición {v.year}
                      </p>
                    </div>
                    <span className="font-mono-code text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-400">
                      {v.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Keyword Search Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-lg font-bold">
                Buscar en {preferredBibleVersion}
              </h3>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleRunSearch} className="p-4 flex gap-2 border-b border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Palabra o frase (ej. sábado, esperanza, amor)..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={searching}
                className="min-h-[44px] rounded-xl bg-amber-500 px-4 text-sm font-bold text-slate-950"
              >
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </form>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {searchResults.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                  Escribe una palabra bíblica para encontrar versículos.
                </p>
              ) : (
                searchResults.map((res, idx) => {
                  const bName =
                    books.find((b) => b.bookid === res.book)?.name || `Libro ${res.book}`;
                  return (
                    <button
                      key={`${res.book}_${res.chapter}_${res.verse}_${idx}`}
                      type="button"
                      onClick={() => {
                        setBookId(res.book);
                        setChapter(res.chapter);
                        setSearchModalOpen(false);
                      }}
                      className="w-full text-left rounded-xl p-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                    >
                      <p className="font-mono-code text-xs font-bold text-amber-700 dark:text-amber-400">
                        {bName} {res.chapter}:{res.verse} ({preferredBibleVersion})
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 line-clamp-3">
                        {res.text}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Verse Bottom Sheet */}
      {selectedVerse && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono-code text-xs font-bold text-amber-700 dark:text-amber-400">
                  {currentBook.name} {chapter}:{selectedVerse.verse} ({preferredBibleVersion})
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                  &ldquo;{selectedVerse.text}&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVerse(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {(['amber', 'sky', 'emerald', 'rose'] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setVerseColor(color)}
                  aria-label={`Resaltar ${color}`}
                  className={`h-9 w-9 rounded-full border-2 transition-transform ${
                    color === 'amber'
                      ? 'bg-amber-300'
                      : color === 'sky'
                        ? 'bg-sky-300'
                        : color === 'emerald'
                          ? 'bg-emerald-300'
                          : 'bg-rose-300'
                  } ${
                    verseColor === color
                      ? 'border-slate-900 dark:border-white scale-110'
                      : 'border-transparent'
                  }`}
                />
              ))}
            </div>

            <textarea
              rows={2}
              maxLength={500}
              value={verseNote}
              onChange={(e) => setVerseNote(e.target.value)}
              placeholder="Nota personal de estudio (opcional)..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveVerse}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                <Bookmark className="h-4 w-4" />
                Guardar en perfil
              </button>

              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `"${selectedVerse.text}" — ${currentBook.name} ${chapter}:${selectedVerse.verse} (${preferredBibleVersion})`
                  );
                  showToast('Versículo copiado');
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-medium"
              >
                <Copy className="h-4 w-4" />
                Copiar
              </button>

              {savedVerseMap.has(selectedVerse.verse) && (
                <button
                  type="button"
                  onClick={() => handleRemoveSavedVerse(selectedVerse.verse)}
                  aria-label="Eliminar guardado"
                  className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900 px-3 text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
