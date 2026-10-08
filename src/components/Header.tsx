import React from 'react';
import { KeyRound, Link as LinkIcon, History, Search } from 'lucide-react';

interface HeaderProps {
  currentTab: 'search' | 'studio' | 'history';
  onSelectTab: (tab: 'search' | 'studio' | 'history') => void;
  hasActiveVideo: boolean;
  hasCustomApiKey: boolean;
  onOpenApiKeyModal: () => void;
  onOpenDirectUrlModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  hasActiveVideo,
  hasCustomApiKey,
  onOpenApiKeyModal,
  onOpenDirectUrlModal,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single wordmark brand */}
        <button
          onClick={() => onSelectTab('search')}
          className="text-left font-semibold tracking-tight text-neutral-900 transition-colors hover:text-red-600"
        >
          TubeTranscript
        </button>

        {/* Zone 2: Clean navigation links */}
        <nav className="hidden items-center gap-6 sm:flex">
          <button
            onClick={() => onSelectTab('search')}
            className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
              currentTab === 'search'
                ? 'text-neutral-900 font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search & Explore</span>
          </button>

          <button
            onClick={() => onSelectTab('studio')}
            disabled={!hasActiveVideo}
            className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
              !hasActiveVideo
                ? 'text-neutral-300 cursor-not-allowed'
                : currentTab === 'studio'
                ? 'text-neutral-900 font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <span>Transcript Studio</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
              currentTab === 'history'
                ? 'text-neutral-900 font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Saved Transcripts</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenDirectUrlModal}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs hover:border-neutral-300 hover:bg-neutral-50 transition-colors whitespace-nowrap"
            title="Paste YouTube video link directly"
          >
            <LinkIcon className="h-3.5 w-3.5 text-neutral-500" />
            <span className="hidden md:inline">Paste Video URL</span>
            <span className="md:hidden">URL</span>
          </button>

          <button
            onClick={onOpenApiKeyModal}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              hasCustomApiKey
                ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                : 'bg-red-600 text-white hover:bg-red-700 shadow-xs'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{hasCustomApiKey ? 'YouTube API Key' : 'Add API Key'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
