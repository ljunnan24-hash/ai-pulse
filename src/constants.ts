import { NewsItem } from './types';

export const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    rank: '01',
    score: '98.4',
    category: 'Critical Update',
    title: 'GPT-4o Omnimodal Integration',
    description: 'Real-time low-latency voice and vision capabilities set a new benchmark for human-AI interaction across all platforms.',
    timestamp: '4 mins ago',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1200',
    link: '#'
  },
  {
    id: '2',
    rank: '02',
    score: '94.2',
    category: 'Tech Infrastructure',
    title: 'Claude 3.5 Sonnet',
    description: "Anthropic's latest model achieves significant gains in coding and visual reasoning, outperforming peers in several benchmarks.",
    timestamp: '1 hour ago',
    imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=600',
    link: '#'
  },
  {
    id: '3',
    rank: '03',
    score: '91.8',
    category: 'Applied Science',
    title: 'Llama 3 400B',
    description: "Meta's massive open-weights model begins private testing for frontier performance, promising a new era of open-source AI.",
    timestamp: '3 hours ago',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600',
    link: '#'
  },
  {
    id: '4',
    category: 'Ethics & Policy',
    title: 'Silicon ethics board proposes a standardized "Digital Consciousness" framework',
    description: 'A new framework for sentient simulation tests aims to establish ethical boundaries for advanced AI development.',
    timestamp: '14:02',
    link: '#'
  },
  {
    id: '5',
    category: 'Open Source',
    title: 'Open-source weights for the Luminous-8B vision model released',
    description: 'Outperforming proprietary sets in spatial awareness, this new model is a win for the open-source community.',
    timestamp: '11:45',
    link: '#'
  }
];
