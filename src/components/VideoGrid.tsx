import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Film, RefreshCw, ArrowUp } from 'lucide-react';
import { VideoCard } from './VideoCard.tsx';
import type { VideoItem } from '../types/index.ts';

interface VideoGridProps {
  videos: VideoItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  selectedVideoId?: string;
  onSelectVideo: (video: VideoItem) => void;
  query: string;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  selectedVideoId,
  onSelectVideo,
  query,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Monitor window scroll for "Back to top" button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    if (!hasMore || isLoadingMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, isLoadingMore, isLoading, onLoadMore]);

  // Loading skeleton state
  if (isLoading && videos.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white"
          >
            <div className="aspect-video w-full animate-pulse bg-neutral-100" />
            <div className="p-3.5 space-y-2.5">
              <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (!isLoading && videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-center">
        <Film className="h-10 w-10 text-neutral-300" />
        <h3 className="mt-3 text-sm font-semibold text-neutral-800">No videos found</h3>
        <p className="mt-1 text-xs text-neutral-500 max-w-sm">
          {query
            ? `No search results for "${query}". Try different search terms or paste a direct YouTube video URL.`
            : 'Enter a search term above or click one of the popular topics to discover videos.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          Showing <span className="font-semibold text-neutral-900 tabular-nums">{videos.length}</span> videos
          {query ? ` for "${query}"` : ''}
        </span>
        <span className="hidden sm:inline">Click any card to inspect & extract transcript</span>
      </div>

      {/* Grid of video cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((video, idx) => (
          <VideoCard
            key={`${video.id}-${idx}`}
            video={video}
            isSelected={video.id === selectedVideoId}
            onSelect={onSelectVideo}
          />
        ))}
      </div>

      {/* Infinite scrolling sentinel & Manual Load More */}
      <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center">
        {isLoadingMore ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-700 shadow-xs">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-900" />
            <span>Fetching more videos infinitely...</span>
          </div>
        ) : hasMore ? (
          <button
            onClick={onLoadMore}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-700 shadow-xs hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Load More Videos</span>
          </button>
        ) : (
          videos.length > 0 && (
            <span className="text-xs text-neutral-400">
              Reached end of search results
            </span>
          )
        )}
      </div>

      {/* Floating Back to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition-transform hover:scale-105 hover:bg-neutral-800"
          title="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
