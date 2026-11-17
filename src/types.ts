export type AppTab = 'tv' | 'videos' | 'music' | 'bible' | 'sabbath' | 'profile';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  playlist: 'Heraldos' | 'Adoracion' | 'Himnario';
  durationSec: number;
  audioUrl: string;
  coverUrl: string;
  hymnNumber?: number;
  hymnEdition?: 'nuevo' | 'antiguo';
  archiveIdentifier?: string;
}

export interface MusicVideo {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  category: string;
}

export type VideoCategory =
  | 'Predicas'
  | 'Reflexion'
  | 'Musica'
  | 'EscuelaSabatica'
  | 'Testimonio'
  | 'Biblia'
  | 'Jovenes';

export interface PublicProfile {
  uid: string;
  displayName: string;
  handle: string;
  church?: string;
  bio?: string;
  photoURL?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VideoPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  title: string;
  caption?: string;
  youtubeId: string;
  category: VideoCategory;
  duration?: string;
  likesCount: number;
  commentsCount: number;
  lastCommentId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isCommunity?: boolean;
}

export interface VideoComment {
  id: string;
  videoId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt?: unknown;
}

export interface BibleVersion {
  id: string;
  name: string;
  short: string;
  year: string;
}

export interface BibleBook {
  bookid: number;
  chronorder: number;
  name: string;
  chapters: number;
}

export interface BibleVerse {
  pk?: number;
  verse: number;
  text: string;
}

export interface SavedVerse {
  id: string;
  userId: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
  highlightColor: 'amber' | 'sky' | 'emerald' | 'rose';
  note?: string;
  createdAt?: unknown;
}

export interface SSQuarterly {
  id: string;
  title: string;
  description: string;
  human_date: string;
  start_date: string;
  end_date: string;
  color_primary?: string;
  color_primary_dark?: string;
  splash?: string;
  cover?: string;
  group?: string;
  quarterly_group?: {
    name: string;
    order: number;
  };
}

export interface SSLessonSummary {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  cover?: string;
  index: string;
}

export interface SSDaySummary {
  id: string;
  title: string;
  date: string;
  index: string;
}

export interface SSPdf {
  id: string;
  src: string;
  title: string;
}

export interface SSDayRead {
  id: string;
  date: string;
  index: string;
  title: string;
  content: string;
  bible?: Array<{
    name: string;
    verses: Record<string, string>;
  }>;
}

export interface LessonProgress {
  id: string;
  userId: string;
  quarterlyId: string;
  lessonId: string;
  dayId: string;
  completed: boolean;
  note?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
