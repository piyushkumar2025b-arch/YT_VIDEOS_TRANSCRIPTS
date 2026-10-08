import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowUpDown, Clock, Command, History } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string, order?: string, duration?: string) => void;
  isLoading: boolean;
  initialQuery?: string;
  hasApiKey: boolean;
  onOpenApiKeyModal: () => void;
}

const QUICK_TOPICS = [
  'TED Talks',
  'Lex Fridman Podcast',
  'Veritasium',
  'Y Combinator',
  'Machine Learning',
  'Khan Academy',
  'Huberman Lab',
  'Tech Reviews',
];

const LOCAL_STORAGE_RECENTS = 'yt_recent_searches';

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  initialQuery = '',
  hasApiKey,
  onOpenApiKeyModal,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [order, setOrder] = useState('relevance');
  const [duration, setDuration] = useState('any');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RECENTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey: press '/' or 'Cmd/Ctrl + K' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const saveRecentSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
      try {
        localStorage.setItem(LOCAL_STORAGE_RECENTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query);
      onSearch(query.trim(), order, duration);
    }
  };

  const handleTopicClick = (topic: string) => {
    setQuery(topic);
    saveRecentSearch(topic);
    onSearch(topic, order, duration);
  };

  return (
    <div className="w-full space-y-3">
      {/* Search Input Bar */}
      <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search millions of YouTube videos (e.g. AI ethics, pod lectures, science documentary)..."
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-20 text-sm text-neutral-900 placeholder-neutral-400 shadow-xs transition-colors focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />

          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 gap-1.5">
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                title="Clear input"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Filter Segmented Controls & API Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Interactive Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Duration Selector */}
          <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
            <span className="px-1.5 text-[11px] font-medium text-neutral-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="hidden sm:inline">Length:</span>
            </span>
            {[
              { id: 'any', label: 'All' },
              { id: 'short', label: '< 4m' },
              { id: 'medium', label: '4-20m' },
              { id: 'long', label: '> 20m' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDuration(d.id);
                  if (query.trim()) onSearch(query.trim(), order, d.id);
                }}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  duration === d.id
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Sort Order Selector */}
          <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
            <span className="px-1.5 text-[11px] font-medium text-neutral-400 flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" />
              <span className="hidden sm:inline">Sort:</span>
            </span>
            {[
              { id: 'relevance', label: 'Relevance' },
              { id: 'date', label: 'Latest' },
              { id: 'viewCount', label: 'Views' },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setOrder(o.id);
                  if (query.trim()) onSearch(query.trim(), o.id, duration);
                }}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  order === o.id
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Quota indicator */}
        <div className="flex items-center gap-2">
          {hasApiKey ? (
            <span className="text-neutral-500 font-medium">
              YouTube Data API Key Active <span aria-hidden="true">·</span> High Quota
            </span>
          ) : (
            <button
              onClick={onOpenApiKeyModal}
              className="text-neutral-500 hover:text-red-600 transition-colors underline decoration-neutral-300 underline-offset-2"
            >
              Standard Mode <span aria-hidden="true">·</span> Click to add YouTube Data API Key
            </button>
          )}
        </div>
      </div>

      {/* Discovery & Recent Searches */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {recentSearches.length > 0 && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
              <History className="h-3 w-3" /> Recent:
            </span>
            {recentSearches.map((rec) => (
              <button
                key={rec}
                type="button"
                onClick={() => handleTopicClick(rec)}
                className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                {rec}
              </button>
            ))}
            <span className="text-neutral-300" aria-hidden="true">|</span>
          </div>
        )}

        <span className="text-[11px] text-neutral-400">Popular:</span>
        {QUICK_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => handleTopicClick(topic)}
            className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-100"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
};
