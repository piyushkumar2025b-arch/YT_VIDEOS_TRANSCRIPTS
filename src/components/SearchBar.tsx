import React, { useState } from 'react';
import { Search, X, ArrowUpDown, Clock } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), order, duration);
    }
  };

  const handleTopicClick = (topic: string) => {
    setQuery(topic);
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
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search millions of YouTube videos (e.g. AI ethics, pod lectures, science documentary)..."
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-10 text-sm text-neutral-900 placeholder-neutral-400 shadow-xs transition-colors focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Filter controls & API Status Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-neutral-500">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                if (query.trim()) onSearch(query.trim(), e.target.value, duration);
              }}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-xs focus:border-neutral-900 focus:outline-none"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Upload Date</option>
              <option value="viewCount">View Count</option>
              <option value="rating">Rating</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-neutral-500">
            <Clock className="h-3.5 w-3.5" />
            <select
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value);
                if (query.trim()) onSearch(query.trim(), order, e.target.value);
              }}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-xs focus:border-neutral-900 focus:outline-none"
            >
              <option value="any">Any Duration</option>
              <option value="short">Short (&lt; 4 min)</option>
              <option value="medium">Medium (4 - 20 min)</option>
              <option value="long">Long (&gt; 20 min)</option>
            </select>
          </div>
        </div>

        {/* API Notice */}
        <div className="flex items-center gap-2">
          {hasApiKey ? (
            <span className="text-neutral-500">
              Using YouTube Data API Key <span aria-hidden="true">·</span> High Quota Active
            </span>
          ) : (
            <button
              onClick={onOpenApiKeyModal}
              className="text-neutral-500 hover:text-red-600 transition-colors underline decoration-neutral-300 underline-offset-2"
            >
              Running on Standard Mode <span aria-hidden="true">·</span> Click to add YouTube Data API Key
            </button>
          )}
        </div>
      </div>

      {/* Quick Discovery buttons */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-xs text-neutral-400">Popular:</span>
        {QUICK_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => handleTopicClick(topic)}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-100"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
};
