import React, { useState } from 'react';
import { Play, FileText, Check } from 'lucide-react';
import type { VideoItem } from '../types/index.ts';

interface VideoCardProps {
  video: VideoItem;
  isSelected?: boolean;
  onSelect: (video: VideoItem) => void;
  onQuickCopy?: (video: VideoItem) => void;
  isCopied?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isSelected = false,
  onSelect,
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={() => onSelect(video)}
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white text-left transition-all cursor-pointer ${
        isSelected
          ? 'border-neutral-900 ring-1 ring-neutral-900 shadow-sm'
          : 'border-neutral-200 hover:border-neutral-300 hover:shadow-xs'
      }`}
    >
      {/* Thumbnail container */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
        {!imgError ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-neutral-400">
            <Play className="h-8 w-8" />
          </div>
        )}

        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-white">
            {video.duration}
          </div>
        )}

        {/* Hover overlay play button */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-md">
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Video Content Details */}
      <div className="flex flex-1 flex-col p-3.5">
        <h3
          className="line-clamp-2 text-sm font-medium text-neutral-900 group-hover:text-red-600 transition-colors"
          title={video.title}
        >
          {video.title}
        </h3>

        {/* Clean unboxed metadata (anti-pill discipline) */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <span className="font-medium text-neutral-700 truncate max-w-[140px]">
            {video.channelTitle}
          </span>
          {video.viewCount && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{video.viewCount} views</span>
            </>
          )}
          {video.publishedAt && (
            <>
              <span aria-hidden="true">·</span>
              <span>{video.publishedAt.slice(0, 10)}</span>
            </>
          )}
        </div>

        {video.description && (
          <p className="mt-2 line-clamp-2 text-xs text-neutral-400">
            {video.description}
          </p>
        )}

        {/* Bottom Action Footer */}
        <div className="mt-auto pt-3 border-t border-neutral-100 flex items-center justify-between">
          <span className="text-[11px] font-mono text-neutral-400">
            ID: {video.id}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 group-hover:text-red-600 transition-colors">
            <FileText className="h-3.5 w-3.5" />
            <span>Get Transcript</span>
          </span>
        </div>
      </div>
    </div>
  );
};
