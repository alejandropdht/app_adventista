import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Eye,
  HeartHandshake,
  List,
  Save,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FE_DE_JESUS_LESSONS, FeQuestion } from '../data/feDeJesus';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { BibleVerse } from '../types';

export function FeDeJesusView() {
  const {
    user,
    lessonProgress,
    preferredBibleVersion,
    openBibleAt,
    signInWithGoogle,
    showToast,
  } = useApp();

  const [selectedId, setSelectedId] = useState<string>('01');
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [expandedVerses, setExpandedVerses] = useState<Record<string, BibleVerse[]>>({});
  const [loadingVerseKey, setLoadingVerseKey] = useState<string | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [savingNote, setSavingNote] = useState(false);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const currentIndex = FE_DE_JESUS_LESSONS.findIndex((l) => l.id === selectedId);
  const lesson = FE_DE_JESUS_LESSONS[currentIndex] || FE_DE_JESUS_LESSONS[0];

  const progressKey = `fe_de_jesus_${lesson.id}`;
  const savedProgress = lessonProgress[progressKey];
  const noteValue =
    draftNotes[lesson.id] !== undefined ? draftNotes[lesson.id] : savedProgress?.note || '';

  const completedCount = FE_DE_JESUS_LESSONS.filter(
    (l) => lessonProgress[`fe_de_jesus_${l.id}`]?.completed
  ).length;

  const progressPct = Math.round((completedCount / FE_DE_JESUS_LESSONS.length) * 100);

  const toggleVersePreview = async (q: FeQuestion) => {
    const key = `${lesson.id}_${q.number}_${preferredBibleVersion}`;
    if (expandedVerses[key]) {
      setExpandedVerses((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    setLoadingVerseKey(key);
    try {
      const res = await fetch(
        `/api/bible/chapter/${preferredBibleVersion}/${q.bookId}/${q.chapter}`
      );
      const data = (await res.json()) as BibleVerse[];
      const end = q.verseEnd || q.verseStart;
      const matched = data.filter((v) => v.verse >= q.verseStart && v.verse <= end);
      setExpandedVerses((prev) => ({ ...prev, [key]: matched }));
    } catch {
      showToast('No se pudo cargar el versículo');
    } finally {
      setLoadingVerseKey(null);
    }
  };

  const handleToggleCompleted = async () => {
    if (!user || !user.emailVerified) {
      await signInWithGoogle();
      return;
    }
    const nextCompleted = !savedProgress?.completed;
    const path = `users/${user.uid}/lessonProgress/${progressKey}`;
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'lessonProgress', progressKey),
        {
          id: progressKey,
          userId: user.uid,
          quarterlyId: 'fe-de-jesus',
          lessonId: lesson.id,
          dayId: 'estudio',
          completed: nextCompleted,
          note: noteValue.trim().slice(0, 1500),
          createdAt: savedProgress?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast(
        nextCompleted
          ? `Lección ${lesson.number} de La Fe de Jesús completada`
          : 'Marca removida'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleSaveNote = async () => {
    if (!user || !user.emailVerified) {
      await signInWithGoogle();
      return;
    }
    setSavingNote(true);
    const path = `users/${user.uid}/lessonProgress/${progressKey}`;
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'lessonProgress', progressKey),
        {
          id: progressKey,
          userId: user.uid,
          quarterlyId: 'fe-de-jesus',
          lessonId: lesson.id,
          dayId: 'estudio',
          completed: savedProgress?.completed ?? true,
          note: noteValue.trim().slice(0, 1500),
          createdAt: savedProgress?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast('Respuestas y compromiso guardados');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Course Hero & Progress Summary */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Curso Bíblico Oficial · Pr. Carlos E. Aeschlimann
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              La Fe de Jesús
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              20 lecciones doctrinales paso a paso con lectura bíblica en {preferredBibleVersion}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIndexModalOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 dark:bg-amber-500 px-4 py-2 text-xs sm:text-sm font-bold text-white dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            <List className="h-4 w-4" />
            Ver las 20 lecciones
          </button>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600 dark:text-slate-300">
              Avance del curso
            </span>
            <span className="font-mono-code tabular-nums text-amber-700 dark:text-amber-400">
              {completedCount}/20 completadas ({progressPct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Horizontal Quick Lesson Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {FE_DE_JESUS_LESSONS.map((l) => {
          const active = l.id === lesson.id;
          const done = Boolean(lessonProgress[`fe_de_jesus_${l.id}`]?.completed);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedId(l.id)}
              className={`min-h-[44px] shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border transition-colors ${
                active
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 border-transparent'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="font-mono-code tabular-nums">{l.number}.</span>
              <span className="max-w-[140px] truncate">{l.title.replace(/^Lo que la Biblia enseña acerca de(l| la)? /i, '')}</span>
              {done && (
                <CheckCircle2
                  className={`h-3.5 w-3.5 shrink-0 ${
                    active ? 'text-emerald-300 dark:text-slate-950' : 'text-emerald-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Lesson Content + Decision Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <article className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-6">
          <div className="pb-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="font-mono-code text-xs font-bold text-amber-600 dark:text-amber-400">
                Lección {lesson.number} de 20 · Texto clave: {lesson.keyVerseLabel}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1.5 text-balance">
                {lesson.title}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                {lesson.intro}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleCompleted}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors shrink-0 ${
                savedProgress?.completed
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {savedProgress?.completed ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Lección completada
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4" />
                  Marcar completada
                </>
              )}
            </button>
          </div>

          {/* 5 Questions */}
          <div className="space-y-5">
            {lesson.questions.map((q) => {
              const vKey = `${lesson.id}_${q.number}_${preferredBibleVersion}`;
              const loadedVerses = expandedVerses[vKey];
              const answerShown = Boolean(revealedAnswers[`${lesson.id}_${q.number}`]);

              return (
                <div
                  key={q.number}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono-code text-xs font-bold h-7 w-7 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 tabular-nums mt-0.5">
                      {q.number}
                    </span>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {q.prompt}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-10">
                    <button
                      type="button"
                      onClick={() => toggleVersePreview(q)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>
                        {loadingVerseKey === vKey
                          ? 'Cargando...'
                          : `${q.refLabel} (${preferredBibleVersion})`}
                      </span>
                      {loadedVerses ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setRevealedAnswers((prev) => ({
                          ...prev,
                          [`${lesson.id}_${q.number}`]: !answerShown,
                        }))
                      }
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {answerShown ? 'Ocultar respuesta' : 'Ver respuesta'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openBibleAt(q.bookId, q.chapter, q.verseStart)}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                    >
                      Ir al capítulo
                    </button>
                  </div>

                  {loadedVerses && loadedVerses.length > 0 && (
                    <div className="ml-10 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-900/50 p-3.5 space-y-1.5">
                      {loadedVerses.map((v) => (
                        <p key={v.verse} className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                          <sup className="font-mono-code text-[11px] font-bold text-amber-600 dark:text-amber-400 mr-1.5 tabular-nums">
                            {v.verse}
                          </sup>
                          {v.text}
                        </p>
                      ))}
                    </div>
                  )}

                  {answerShown && (
                    <div className="ml-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3.5 text-sm text-emerald-950 dark:text-emerald-200 leading-relaxed">
                      <strong>Respuesta bíblica:</strong> {q.answerSummary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Prev / Next Lesson */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={currentIndex <= 0}
              onClick={() => {
                if (currentIndex > 0) {
                  setSelectedId(FE_DE_JESUS_LESSONS[currentIndex - 1].id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            <span className="font-mono-code text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {lesson.number} / 20
            </span>

            <button
              type="button"
              disabled={currentIndex >= FE_DE_JESUS_LESSONS.length - 1}
              onClick={() => {
                if (currentIndex < FE_DE_JESUS_LESSONS.length - 1) {
                  setSelectedId(FE_DE_JESUS_LESSONS[currentIndex + 1].id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-35"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </article>

        {/* Decision & Personal Notes Column */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-display text-lg font-bold">
              <HeartHandshake className="h-5 w-5" />
              Mi decisión de fe
            </div>
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed italic">
              &ldquo;{lesson.decision}&rdquo;
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="font-display text-lg font-bold">Tus respuestas y notas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Guarda tus apuntes personales de esta lección en tu perfil.
            </p>
            <textarea
              rows={5}
              maxLength={1500}
              value={noteValue}
              onChange={(e) =>
                setDraftNotes((prev) => ({ ...prev, [lesson.id]: e.target.value }))
              }
              placeholder="Escribe tus respuestas o tu oración de compromiso..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              disabled={savingNote}
              onClick={handleSaveNote}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
            >
              <Save className="h-4 w-4" />
              {savingNote ? 'Guardando...' : 'Guardar progreso'}
            </button>
          </div>
        </aside>
      </div>

      {/* All 20 Lessons Index Modal */}
      {indexModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-lg font-bold">
                La Fe de Jesús · 20 Lecciones
              </h3>
              <button
                type="button"
                onClick={() => setIndexModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {FE_DE_JESUS_LESSONS.map((l) => {
                const active = l.id === lesson.id;
                const done = Boolean(lessonProgress[`fe_de_jesus_${l.id}`]?.completed);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(l.id);
                      setIndexModalOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 rounded-xl p-3 text-left transition-colors ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-mono-code text-sm font-bold h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 tabular-nums">
                      {l.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-snug">{l.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {l.keyVerseLabel}
                      </p>
                    </div>
                    {done && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
