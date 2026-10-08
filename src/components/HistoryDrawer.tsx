import React from 'react';
import { History, FileText, Trash2, ArrowRight } from 'lucide-react';
import type { VideoItem, TranscriptResult } from '../types/index.ts';

export interface HistoryItem {
  video: VideoItem;
  transcript: TranscriptResult;
  timestamp: number;
}

interface HistoryViewProps {
  history: HistoryItem[];
  onSelectHistoryItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onBackToSearch: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onSelectHistoryItem,
  onClearHistory,
  onBackToSearch,
}) => {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-center">
        <History className="h-10 w-10 text-neutral-300" />
        <h3 className="mt-3 text-sm font-semibold text-neutral-800">No saved transcripts yet</h3>
        <p className="mt-1 text-xs text-neutral-500 max-w-sm">
          Transcripts you extract will automatically appear here for quick access, copy, and download.
        </p>
        <button
          onClick={onBackToSearch}
          className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-neutral-800"
        >
          Explore & Search Videos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            Saved Transcripts ({history.length})
          </h2>
          <p className="text-xs text-neutral-500">
            Locally saved transcript extractions ready for review and export
          </p>
        </div>
        <button
          onClick={onClearHistory}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {history.map((item) => (
          <div
            key={`${item.video.id}-${item.timestamp}`}
            onClick={() => onSelectHistoryItem(item)}
            className="flex items-center justify-between p-4 hover:bg-neutral-50 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded bg-neutral-100">
                <img
                  src={item.video.thumbnailUrl}
                  alt={item.video.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-neutral-900 group-hover:text-red-600 line-clamp-1">
                  {item.video.title}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  <span>{item.video.channelTitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {item.transcript.totalWords.toLocaleString()} words
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-neutral-400 group-hover:text-neutral-900">
              <span className="text-xs font-medium hidden sm:inline">Open Studio</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
