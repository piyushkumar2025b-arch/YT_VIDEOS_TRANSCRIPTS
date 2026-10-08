import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { SearchBar } from './components/SearchBar.tsx';
import { VideoGrid } from './components/VideoGrid.tsx';
import { TranscriptViewer } from './components/TranscriptViewer.tsx';
import { ApiKeyModal } from './components/ApiKeyModal.tsx';
import { DirectUrlModal } from './components/DirectUrlModal.tsx';
import { HistoryView, type HistoryItem } from './components/HistoryDrawer.tsx';
import type { VideoItem, TranscriptResult } from './types/index.ts';

const LOCAL_STORAGE_API_KEY = 'yt_api_key';
const LOCAL_STORAGE_HISTORY = 'yt_transcripts_history';

export default function App() {
  // Navigation & Modal states
  const [currentTab, setCurrentTab] = useState<'search' | 'studio' | 'history'>('search');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isDirectUrlModalOpen, setIsDirectUrlModalOpen] = useState(false);

  // YouTube API Key state
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_API_KEY) || '';
  });

  // Search & Infinite Pagination states
  const [searchQuery, setSearchQuery] = useState('Machine Learning Explained');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentOrder, setCurrentOrder] = useState('relevance');
  const [currentDuration, setCurrentDuration] = useState('any');

  // Video & Transcript states
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save history to localStorage
  const saveToHistory = useCallback((vid: VideoItem, trans: TranscriptResult) => {
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.video.id !== vid.id);
      const updated = [{ video: vid, transcript: trans, timestamp: Date.now() }, ...filtered].slice(0, 30);
      try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save history:', err);
      }
      return updated;
    });
  }, []);

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_HISTORY);
    } catch {}
  };

  // Save API Key
  const handleSaveApiKey = (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem(LOCAL_STORAGE_API_KEY, trimmed);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_API_KEY);
    }
  };

  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem(LOCAL_STORAGE_API_KEY);
  };

  // Perform video search
  const performSearch = useCallback(
    async (queryText: string, order: string = 'relevance', duration: string = 'any') => {
      if (!queryText.trim()) return;

      setIsSearching(true);
      setSearchQuery(queryText);
      setCurrentOrder(order);
      setCurrentDuration(duration);

      try {
        const url = new URL('/api/search', window.location.origin);
        url.searchParams.set('q', queryText);
        url.searchParams.set('order', order);
        if (duration !== 'any') url.searchParams.set('videoDuration', duration);

        const headers: Record<string, string> = {};
        if (apiKey) {
          headers['x-youtube-api-key'] = apiKey;
        }

        const res = await fetch(url.toString(), { headers });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Search failed with status ${res.status}`);
        }

        const data = await res.json();
        const rawItems: VideoItem[] = data.items || [];
        const seen = new Set<string>();
        const uniqueItems = rawItems.filter((item) => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        setVideos(uniqueItems);
        setNextPageToken(data.nextPageToken || null);
      } catch (err: any) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [apiKey]
  );

  // Load more videos infinitely
  const loadMoreVideos = useCallback(async () => {
    if (!nextPageToken || isLoadingMore || isSearching) return;

    setIsLoadingMore(true);
    try {
      const url = new URL('/api/search', window.location.origin);
      url.searchParams.set('q', searchQuery);
      url.searchParams.set('pageToken', nextPageToken);
      url.searchParams.set('order', currentOrder);
      if (currentDuration !== 'any') url.searchParams.set('videoDuration', currentDuration);

      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['x-youtube-api-key'] = apiKey;
      }

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error('Failed to load more videos');

      const data = await res.json();
      const newItems: VideoItem[] = data.items || [];
      setVideos((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const uniqueNew = newItems.filter((item) => item.id && !existingIds.has(item.id));
        return [...prev, ...uniqueNew];
      });
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextPageToken, isLoadingMore, isSearching, searchQuery, currentOrder, currentDuration, apiKey]);

  // Fetch full transcript for a video
  const fetchTranscript = useCallback(
    async (vid: VideoItem, lang: string = 'en') => {
      setActiveVideo(vid);
      setIsTranscriptLoading(true);
      setTranscriptError(null);
      setCurrentTab('studio');

      try {
        const url = new URL('/api/transcript', window.location.origin);
        url.searchParams.set('videoId', vid.id);
        url.searchParams.set('lang', lang);

        const res = await fetch(url.toString());
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error ||
              'Transcript could not be extracted for this video. The creator might have disabled captions or transcripts.'
          );
        }

        const data: TranscriptResult = await res.json();
        setTranscript(data);
        saveToHistory(vid, data);
      } catch (err: any) {
        console.error('Transcript fetch error:', err);
        setTranscriptError(err.message || 'Error loading transcript.');
        setTranscript(null);
      } finally {
        setIsTranscriptLoading(false);
      }
    },
    [saveToHistory]
  );

  // Direct video ID lookup
  const handleDirectLookup = async (videoId: string) => {
    setIsTranscriptLoading(true);
    setTranscriptError(null);
    setCurrentTab('studio');

    try {
      // Fetch video details first
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-youtube-api-key'] = apiKey;

      const detailsRes = await fetch(`/api/video/${videoId}`, { headers });
      const videoData: VideoItem = detailsRes.ok
        ? await detailsRes.json()
        : {
            id: videoId,
            title: `YouTube Video (${videoId})`,
            description: '',
            channelTitle: 'YouTube',
            publishedAt: '',
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          };

      setActiveVideo(videoData);

      // Fetch transcript
      await fetchTranscript(videoData);
    } catch (err: any) {
      setTranscriptError(err.message || 'Could not load video details');
    }
  };

  // Initial search on first mount
  useEffect(() => {
    performSearch(searchQuery);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans">
      {/* Top Bar Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        hasActiveVideo={Boolean(activeVideo)}
        hasCustomApiKey={Boolean(apiKey)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onOpenDirectUrlModal={() => setIsDirectUrlModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* TAB 1: SEARCH & INFINITE EXPLORE */}
        {currentTab === 'search' && (
          <div className="space-y-8">
            {/* Search Section Header */}
            <div className="space-y-4">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                Search Videos & Extract Transcripts
              </h1>
              <p className="text-sm text-neutral-600 max-w-2xl">
                Explore YouTube videos infinitely, select any video, and extract full synchronized transcripts in copyable prose, timestamps, and downloadable SRT, VTT, JSON, and CSV formats.
              </p>

              <SearchBar
                onSearch={performSearch}
                isLoading={isSearching}
                initialQuery={searchQuery}
                hasApiKey={Boolean(apiKey)}
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              />
            </div>

            {/* Video Cards Grid with Infinite Scroll */}
            <VideoGrid
              videos={videos}
              isLoading={isSearching}
              isLoadingMore={isLoadingMore}
              hasMore={Boolean(nextPageToken)}
              onLoadMore={loadMoreVideos}
              selectedVideoId={activeVideo?.id}
              onSelectVideo={(vid) => fetchTranscript(vid)}
              query={searchQuery}
            />

            {/* Active Video Floating Dock when exploring search */}
            {activeVideo && (
              <div className="sticky bottom-6 z-30 mx-auto max-w-xl">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/95 p-3 text-white shadow-2xl backdrop-blur-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={activeVideo.thumbnailUrl}
                      alt={activeVideo.title}
                      className="h-9 w-14 rounded object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate text-neutral-100">
                        {activeVideo.title}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        {activeVideo.channelTitle} · Ready in Studio
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentTab('studio')}
                    className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors whitespace-nowrap shrink-0 shadow-xs"
                  >
                    Open Studio →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRANSCRIPT STUDIO */}
        {currentTab === 'studio' && (
          <div>
            {activeVideo ? (
              <TranscriptViewer
                video={activeVideo}
                transcript={transcript}
                isLoading={isTranscriptLoading}
                error={transcriptError}
                onRetry={() => activeVideo && fetchTranscript(activeVideo)}
                onChangeLanguage={(lang) => activeVideo && fetchTranscript(activeVideo, lang)}
                onBackToSearch={() => setCurrentTab('search')}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-20 text-center">
                <h3 className="text-sm font-semibold text-neutral-800">No active video selected</h3>
                <p className="mt-1 text-xs text-neutral-500 max-w-sm">
                  Search videos or paste a direct YouTube video URL to open the transcript studio.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => setCurrentTab('search')}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-neutral-800"
                  >
                    Go to Video Search
                  </button>
                  <button
                    onClick={() => setIsDirectUrlModalOpen(true)}
                    className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-xs"
                  >
                    Paste YouTube Link
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SAVED TRANSCRIPTS HISTORY */}
        {currentTab === 'history' && (
          <HistoryView
            history={history}
            onSelectHistoryItem={(item) => {
              setActiveVideo(item.video);
              setTranscript(item.transcript);
              setTranscriptError(null);
              setCurrentTab('studio');
            }}
            onClearHistory={handleClearHistory}
            onBackToSearch={() => setCurrentTab('search')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-neutral-500 sm:flex-row sm:px-6 lg:px-8">
          <span>TubeTranscript — YouTube Video Search & Full Transcript Studio</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="hover:text-neutral-900 transition-colors"
            >
              YouTube API Settings
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setIsDirectUrlModalOpen(true)}
              className="hover:text-neutral-900 transition-colors"
            >
              Paste Link
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setCurrentTab('history')}
              className="hover:text-neutral-900 transition-colors"
            >
              History ({history.length})
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveApiKey}
        onClearKey={handleClearApiKey}
      />

      <DirectUrlModal
        isOpen={isDirectUrlModalOpen}
        onClose={() => setIsDirectUrlModalOpen(false)}
        onSubmitVideoId={handleDirectLookup}
      />
    </div>
  );
}
