import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottomNav } from './components/BottomNav';
import { TvView } from './components/TvView';
import { SocialFeedView } from './components/SocialFeedView';
import { MusicView } from './components/MusicView';
import { MiniAudioPlayer } from './components/MiniAudioPlayer';
import { BibleView } from './components/BibleView';
import { SabbathSchoolView } from './components/SabbathSchoolView';
import { ProfileView } from './components/ProfileView';

function MainShell() {
  const { activeTab, toast, currentTrack } = useApp();
  const miniPlayerVisible = Boolean(currentTrack && activeTab !== 'music');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {activeTab === 'tv' && <TvView />}
      {activeTab === 'videos' && <SocialFeedView />}
      {activeTab === 'music' && <MusicView />}
      {activeTab === 'bible' && <BibleView />}
      {activeTab === 'sabbath' && <SabbathSchoolView />}
      {activeTab === 'profile' && <ProfileView />}

      <MiniAudioPlayer />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 dark:bg-white px-4 py-2.5 text-xs font-semibold text-white dark:text-slate-950 shadow-lg whitespace-nowrap ${
            miniPlayerVisible ? 'bottom-36' : 'bottom-20'
          }`}
        >
          {toast}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
