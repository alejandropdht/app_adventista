import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Save,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { SSDayRead, SSDaySummary, SSLessonSummary, SSPdf, SSQuarterly } from '../types';
import { FeDeJesusView } from './FeDeJesusView';

function parseDdMmYyyy(str: string): Date | null {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

const BOOK_CODE_TO_ID: Record<string, number> = {
  Gen: 1, Exod: 2, Lev: 3, Num: 4, Deut: 5, Josh: 6, Judg: 7, Ruth: 8,
  '1Sam': 9, '2Sam': 10, '1Kgs': 11, '2Kgs': 12, '1Chr': 13, '2Chr': 14,
  Ezra: 15, Neh: 16, Esth: 17, Job: 18, Ps: 19, Prov: 20, Eccl: 21, Song: 22,
  Isa: 23, Jer: 24, Lam: 25, Ezek: 26, Dan: 27, Hos: 28, Joel: 29, Amos: 30,
  Obad: 31, Jonah: 32, Mic: 33, Nah: 34, Hab: 35, Zeph: 36, Hag: 37, Zech: 38, Mal: 39,
  Matt: 40, Mark: 41, Luke: 42, John: 43, Acts: 44, Rom: 45, '1Cor': 46, '2Cor': 47,
  Gal: 48, Eph: 49, Phil: 50, Col: 51, '1Thess': 52, '2Thess': 53, '1Tim': 54,
  '2Tim': 55, Titus: 56, Phlm: 57, Heb: 58, Jas: 59, '1Pet': 60, '2Pet': 61,
  '1John': 62, '2John': 63, '3John': 64, Jude: 65, Rev: 66,
};

function parseVerseTarget(verseAttr: string): { bookId: number; chapter: number } | null {
  const m = verseAttr.match(/^([1-3]?[A-Za-z]+)(\d+)/);
  if (!m) return null;
  const bookId = BOOK_CODE_TO_ID[m[1]];
  if (!bookId) return null;
  const digits = m[2];
  // Adventech encodes e.g. John316 -> chapter 3, or 2Pet313 -> chapter 3
  const chapter = digits.length >= 3 ? Number(digits.slice(0, digits.length - 2)) : Number(digits);
  return { bookId, chapter: Math.max(1, chapter || 1) };
}

export function SabbathSchoolView() {
  const {
    user,
    lessonProgress,
    studyMode,
    setStudyMode,
    openBibleAt,
    signInWithGoogle,
    showToast,
  } = useApp();

  const [quarterlies, setQuarterlies] = useState<SSQuarterly[]>([]);
  const [selectedQuarterlyId, setSelectedQuarterlyId] = useState<string>('');
  const [lessons, setLessons] = useState<SSLessonSummary[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('01');
  const [days, setDays] = useState<SSDaySummary[]>([]);
  const [pdfs, setPdfs] = useState<SSPdf[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string>('01');
  const [dayRead, setDayRead] = useState<SSDayRead | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [quarterlyModalOpen, setQuarterlyModalOpen] = useState(false);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [verseModal, setVerseModal] = useState<{
    key: string;
    html: string;
    target: { bookId: number; chapter: number } | null;
  } | null>(null);

  // Study Reflection Note
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // 1. Load all Spanish quarterlies
  useEffect(() => {
    fetch('/api/sabbath-school/quarterlies')
      .then((r) => r.json())
      .then((data: SSQuarterly[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        setQuarterlies(data);

        const now = new Date();
        // Pick active adult quarterly matching today's date first
        const active =
          data.find((q) => {
            const s = parseDdMmYyyy(q.start_date);
            const e = parseDdMmYyyy(q.end_date);
            return s && e && now >= s && now <= e && !q.id.includes('-');
          }) ||
          data.find((q) => {
            const s = parseDdMmYyyy(q.start_date);
            const e = parseDdMmYyyy(q.end_date);
            return s && e && now >= s && now <= e;
          }) ||
          data[0];

        setSelectedQuarterlyId(active.id);
      })
      .catch(() => {
        showToast('No se pudieron cargar los trimestrales');
      });
  }, []);

  // 2. Load selected quarterly lessons
  useEffect(() => {
    if (!selectedQuarterlyId) return;
    fetch(`/api/sabbath-school/quarterly/${selectedQuarterlyId}`)
      .then((r) => r.json())
      .then((data) => {
        const list: SSLessonSummary[] = data.lessons || [];
        setLessons(list);
        if (list.length > 0) {
          const now = new Date();
          const current =
            list.find((l) => {
              const s = parseDdMmYyyy(l.start_date);
              const e = parseDdMmYyyy(l.end_date);
              return s && e && now >= s && now <= e;
            }) || list[0];
          setSelectedLessonId(current.id);
        }
      })
      .catch(() => {});
  }, [selectedQuarterlyId]);

  // 3. Load selected lesson days & PDFs
  useEffect(() => {
    if (!selectedQuarterlyId || !selectedLessonId) return;
    fetch(`/api/sabbath-school/lesson/${selectedQuarterlyId}/${selectedLessonId}`)
      .then((r) => r.json())
      .then((data) => {
        const dayList: SSDaySummary[] = data.days || [];
        setDays(dayList);
        setPdfs(data.pdfs || []);
        if (dayList.length > 0) {
          const now = new Date();
          const todayMatch = dayList.find((d) => {
            const dt = parseDdMmYyyy(d.date);
            return (
              dt &&
              dt.getDate() === now.getDate() &&
              dt.getMonth() === now.getMonth() &&
              dt.getFullYear() === now.getFullYear()
            );
          });
          setSelectedDayId(todayMatch ? todayMatch.id : dayList[0].id);
        }
      })
      .catch(() => {});
  }, [selectedQuarterlyId, selectedLessonId]);

  // 4. Load full reading content for selected day
  useEffect(() => {
    if (!selectedQuarterlyId || !selectedLessonId || !selectedDayId) return;
    setLoading(true);
    fetch(`/api/sabbath-school/day/${selectedQuarterlyId}/${selectedLessonId}/${selectedDayId}`)
      .then((r) => r.json())
      .then((data: SSDayRead) => {
        setDayRead(data);
      })
      .catch(() => {
        showToast('No se pudo cargar la lectura del día');
      })
      .finally(() => setLoading(false));
  }, [selectedQuarterlyId, selectedLessonId, selectedDayId]);

  const progressKey = `${selectedQuarterlyId}_${selectedLessonId}_${selectedDayId}`.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const currentProgress = lessonProgress[progressKey];

  useEffect(() => {
    setNoteText(currentProgress?.note || '');
  }, [progressKey, currentProgress?.note]);

  const activeQuarterly = useMemo(
    () => quarterlies.find((q) => q.id === selectedQuarterlyId) || null,
    [quarterlies, selectedQuarterlyId]
  );

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  );

  const activeDayIndex = days.findIndex((d) => d.id === selectedDayId);

  const completedInLesson = useMemo(() => {
    return days.filter((d) => {
      const k = `${selectedQuarterlyId}_${selectedLessonId}_${d.id}`.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      return lessonProgress[k]?.completed;
    }).length;
  }, [days, lessonProgress, selectedQuarterlyId, selectedLessonId]);

  const handleToggleCompleted = async () => {
    if (!user || !user.emailVerified) {
      await signInWithGoogle();
      return;
    }
    const nextCompleted = !currentProgress?.completed;
    const path = `users/${user.uid}/lessonProgress/${progressKey}`;
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'lessonProgress', progressKey),
        {
          id: progressKey,
          userId: user.uid,
          quarterlyId: selectedQuarterlyId,
          lessonId: selectedLessonId,
          dayId: selectedDayId,
          completed: nextCompleted,
          note: noteText.trim().slice(0, 1500),
          createdAt: currentProgress?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast(nextCompleted ? 'Día marcado como estudiado' : 'Marca removida');
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
          quarterlyId: selectedQuarterlyId,
          lessonId: selectedLessonId,
          dayId: selectedDayId,
          completed: currentProgress?.completed ?? true,
          note: noteText.trim().slice(0, 1500),
          createdAt: currentProgress?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast('Reflexión de estudio guardada');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSavingNote(false);
    }
  };

  const handleProseClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a.verse') as HTMLAnchorElement | null;
    if (!anchor) return;
    e.preventDefault();
    const verseKey = anchor.getAttribute('verse') || '';
    const versesDict = dayRead?.bible?.[0]?.verses || {};
    const html =
      versesDict[verseKey] ||
      Object.entries(versesDict).find(([k]) => k.includes(verseKey))?.[1] ||
      `<p>Cita bíblica: <strong>${anchor.textContent}</strong></p>`;
    setVerseModal({
      key: anchor.textContent || verseKey,
      html,
      target: parseVerseTarget(verseKey),
    });
  };

  return (
    <div className="min-h-screen pb-24 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar with Segmented Course Switcher */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 sm:px-6 h-14">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-900 p-1 shrink-0">
            <button
              type="button"
              onClick={() => setStudyMode('sabbath')}
              className={`min-h-[36px] rounded-lg px-2.5 sm:px-3.5 text-xs font-bold whitespace-nowrap transition-colors ${
                studyMode === 'sabbath'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Escuela Sabática
            </button>
            <button
              type="button"
              onClick={() => setStudyMode('fe-de-jesus')}
              className={`min-h-[36px] rounded-lg px-2.5 sm:px-3.5 text-xs font-bold whitespace-nowrap transition-colors ${
                studyMode === 'fe-de-jesus'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              La Fe de Jesús
            </button>
          </div>

          {studyMode === 'sabbath' && (
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setQuarterlyModalOpen(true)}
                className="hidden sm:inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-bold truncate max-w-[200px]"
              >
                <Calendar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">
                  {activeQuarterly?.title || 'Trimestral'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setLessonModalOpen(true)}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 whitespace-nowrap shrink-0"
              >
                Lec. {selectedLessonId}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 pt-5 space-y-6">
        {studyMode === 'fe-de-jesus' ? (
          <FeDeJesusView />
        ) : (
          <>
        {/* Quarterly + Lesson Selector Row on Mobile */}
        <div className="flex sm:hidden items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setQuarterlyModalOpen(true)}
            className="w-full inline-flex min-h-[42px] items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs font-bold"
          >
            <span className="inline-flex items-center gap-2 truncate">
              <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">{activeQuarterly?.title || 'Elegir folleto'}</span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
          </button>
        </div>

        {/* Quarterly + Lesson Banner */}
        {activeQuarterly && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden grid grid-cols-1 md:grid-cols-12">
            <div className="md:col-span-4 relative min-h-[160px] bg-slate-900">
              <img
                src={
                  activeLesson?.cover ||
                  activeQuarterly.cover ||
                  activeQuarterly.splash ||
                  '/src/assets/images/bible_study_banner_1794943380083.jpg'
                }
                alt={activeLesson?.title || activeQuarterly.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="md:col-span-8 p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {activeQuarterly.human_date} · Lección {selectedLessonId}
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 text-balance">
                  {activeLesson?.title || activeQuarterly.title}
                </h1>
                {activeLesson && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono-code tabular-nums">
                    {activeLesson.start_date} – {activeLesson.end_date}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono-code tabular-nums">
                    Progreso semanal: {completedInLesson}/{days.length || 7} días
                  </span>
                </div>

                {pdfs.length > 0 && (
                  <a
                    href={pdfs[0].src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    PDF oficial ({pdfs[0].title})
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Horizontal 7-Day Scroller */}
        <section aria-label="Días de la lección" className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {days.map((d, idx) => {
            const isSelected = d.id === selectedDayId;
            const k = `${selectedQuarterlyId}_${selectedLessonId}_${d.id}`.replace(
              /[^a-zA-Z0-9_-]/g,
              '_'
            );
            const isDone = Boolean(lessonProgress[k]?.completed);
            const dayNames = ['Sáb', 'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDayId(d.id)}
                className={`min-h-[54px] shrink-0 flex flex-col items-start justify-center rounded-xl px-4 py-2 text-left transition-colors border ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 border-transparent'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 w-full justify-between">
                  <span className="text-[11px] font-bold opacity-80">
                    {dayNames[idx] || `Día ${d.id}`}
                  </span>
                  {isDone && (
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${
                        isSelected ? 'text-emerald-300 dark:text-slate-950' : 'text-emerald-500'
                      }`}
                    />
                  )}
                </div>
                <span className="text-xs font-semibold truncate max-w-[130px] mt-0.5">
                  {d.title}
                </span>
              </button>
            );
          })}
        </section>

        {/* Full Day Reading + Personal Study Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <article className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8">
            {loading || !dayRead ? (
              <div className="space-y-4 py-8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 rounded bg-slate-200/70 dark:bg-slate-800/70 animate-pulse"
                    style={{ width: `${75 + ((i * 9) % 22)}%` }}
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono-code text-xs text-slate-500 dark:text-slate-400">
                      {dayRead.date}
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1 text-balance">
                      {dayRead.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleCompleted}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                      currentProgress?.completed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {currentProgress?.completed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Estudiado
                      </>
                    ) : (
                      <>
                        <Circle className="h-4 w-4" />
                        Marcar estudiado
                      </>
                    )}
                  </button>
                </div>

                <div
                  onClick={handleProseClick}
                  className="ss-prose text-slate-800 dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: dayRead.content }}
                />

                {/* Prev / Next Day Navigation */}
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    disabled={activeDayIndex <= 0}
                    onClick={() => {
                      if (activeDayIndex > 0) {
                        setSelectedDayId(days[activeDayIndex - 1].id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-35"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Día anterior
                  </button>

                  <button
                    type="button"
                    disabled={activeDayIndex === -1 || activeDayIndex >= days.length - 1}
                    onClick={() => {
                      if (activeDayIndex < days.length - 1) {
                        setSelectedDayId(days[activeDayIndex + 1].id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-35"
                  >
                    Siguiente día
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </article>

          {/* Personal Reflection & All PDFs Column */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="font-display text-lg font-bold">Tu nota de estudio</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Anota lo que Dios habló a tu corazón en la lección de hoy.
              </p>
              <textarea
                rows={5}
                maxLength={1500}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Escribe tus respuestas o apuntes personales..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                disabled={savingNote}
                onClick={handleSaveNote}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                <Save className="h-4 w-4" />
                {savingNote ? 'Guardando...' : 'Guardar reflexión'}
              </button>
            </div>

            {pdfs.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <h3 className="font-display text-base font-bold">Materiales oficiales (PDF)</h3>
                <div className="space-y-2">
                  {pdfs.map((pdf) => (
                    <a
                      key={pdf.id}
                      href={pdf.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span>{pdf.title}</span>
                      <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
          </>
        )}
      </main>

      {/* Quarterlies Modal */}
      {quarterlyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-lg font-bold">
                Todos los folletos · Escuela Sabática
              </h3>
              <button
                type="button"
                onClick={() => setQuarterlyModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {quarterlies.map((q) => {
                const active = q.id === selectedQuarterlyId;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setSelectedQuarterlyId(q.id);
                      setQuarterlyModalOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 rounded-xl p-3 text-left transition-colors ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <img
                      src={q.cover || q.splash || '/src/assets/images/bible_study_banner_1794943380083.jpg'}
                      alt={q.title}
                      referrerPolicy="no-referrer"
                      className="h-16 w-12 rounded-lg object-cover shrink-0 bg-slate-800"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        {q.quarterly_group?.name || q.human_date}
                      </p>
                      <p className="font-display text-base font-bold truncate">{q.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {q.human_date}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lessons List Modal */}
      {lessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-lg font-bold">
                13 Lecciones del Trimestre
              </h3>
              <button
                type="button"
                onClick={() => setLessonModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {lessons.map((l) => {
                const active = l.id === selectedLessonId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setSelectedLessonId(l.id);
                      setLessonModalOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 rounded-xl p-3 text-left transition-colors ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-mono-code text-sm font-bold h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 tabular-nums">
                      {l.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{l.title}</p>
                      <p className="font-mono-code text-xs text-slate-500 dark:text-slate-400">
                        {l.start_date} – {l.end_date}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Inline Bible Verse Popover Modal */}
      {verseModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-xs font-bold text-amber-700 dark:text-amber-400">
                Cita Bíblica · {verseModal.key}
              </span>
              <button
                type="button"
                onClick={() => setVerseModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="ss-prose text-sm text-slate-800 dark:text-slate-200"
              dangerouslySetInnerHTML={{ __html: verseModal.html }}
            />

            {verseModal.target && (
              <button
                type="button"
                onClick={() => {
                  const t = verseModal.target!;
                  setVerseModal(null);
                  openBibleAt(t.bookId, t.chapter);
                }}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-amber-500 px-4 py-2.5 text-sm font-bold text-white dark:text-slate-950"
              >
                <BookOpen className="h-4 w-4" />
                Abrir capítulo completo en Biblia
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
