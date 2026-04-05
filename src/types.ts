export interface NewsItem {
  id: string;
  rank?: string;
  score?: string;
  category: string;
  title: string;
  description: string;
  timestamp: string;
  imageUrl?: string;
  link: string;
}

export type ViewMode = 'home' | 'simple' | 'normal' | 'success';

export interface SuccessPanel {
  title: string;
  description: string;
}
