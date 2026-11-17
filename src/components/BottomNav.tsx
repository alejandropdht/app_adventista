import { BookOpen, Clapperboard, GraduationCap, Music2, Tv, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppTab } from '../types';

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  icon: typeof Tv;
}> = [
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'videos', label: 'Videos', icon: Clapperboard },
  { id: 'music', label: 'Música', icon: Music2 },
  { id: 'bible', label: 'Biblia', icon: BookOpen },
  { id: 'sabbath', label: 'Escuela', icon: GraduationCap },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function BottomNav() {
  const { activeTab, setActiveTab, profile } = useApp();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md pb-safe"
    >
      <div className="mx-auto grid max-w-4xl grid-cols-6 items-center h-16 px-0.5 sm:px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-amber-500 ${
                isActive
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {item.id === 'profile' && profile?.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className={`h-[21px] w-[21px] rounded-full object-cover ring-2 transition-all ${
                    isActive
                      ? 'ring-amber-500'
                      : 'ring-transparent group-hover:ring-slate-300 dark:group-hover:ring-slate-700'
                  }`}
                />
              ) : (
                <Icon
                  className="h-[21px] w-[21px] shrink-0 transition-transform duration-150 group-active:scale-95"
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
              )}
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
