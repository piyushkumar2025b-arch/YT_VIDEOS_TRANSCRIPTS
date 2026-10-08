import React, { useState } from 'react';
import { X, Link as LinkIcon, ArrowRight, AlertCircle } from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/youtubeUrl.ts';

interface DirectUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitVideoId: (videoId: string) => void;
}

export const DirectUrlModal: React.FC<DirectUrlModalProps> = ({
  isOpen,
  onClose,
  onSubmitVideoId,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const vid = extractYouTubeVideoId(urlInput);
    if (!vid) {
      setError('Invalid YouTube link or Video ID. Please check the URL format.');
      return;
    }

    onSubmitVideoId(vid);
    setUrlInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-white">
              <LinkIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                Direct Video Lookup
              </h3>
              <p className="text-xs text-neutral-500">
                Paste any YouTube video link or 11-char Video ID
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:text-neutral-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              YouTube Video URL or ID
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setError('');
              }}
              placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 shadow-xs focus:border-neutral-900 focus:outline-none"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded bg-neutral-50 p-2.5 text-[11px] text-neutral-500 space-y-1">
            <span className="font-semibold text-neutral-700">Supported formats:</span>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>youtube.com/watch?v=VIDEO_ID</li>
              <li>youtu.be/VIDEO_ID</li>
              <li>youtube.com/shorts/VIDEO_ID</li>
              <li>Direct 11-character Video ID</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-neutral-800 disabled:opacity-50"
            >
              <span>Get Transcript</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
