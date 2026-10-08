import React, { useState, useMemo, useRef } from 'react';
import {
  Copy,
  Download,
  Check,
  Search,
  ExternalLink,
  Sparkles,
  FileText,
  AlignLeft,
  Clock,
  Globe,
  Loader2,
  ChevronDown,
  Play,
  RotateCcw,
  Languages,
} from 'lucide-react';
import type { VideoItem, TranscriptResult, TranscriptSegment } from '../types/index.ts';
import {
  formatTime,
  generatePlainText,
  generateTimestampedText,
  generateMarkdown,
  generateSrt,
  generateVtt,
  generateJson,
  generateCsv,
  triggerFileDownload,
} from '../utils/transcriptFormats.ts';

interface TranscriptViewerProps {
  video: VideoItem;
  transcript: TranscriptResult | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onChangeLanguage: (lang: string) => void;
  onBackToSearch?: () => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  video,
  transcript,
  isLoading,
  error,
  onRetry,
  onChangeLanguage,
  onBackToSearch,
}) => {
  // State
  const [viewMode, setViewMode] = useState<'timestamps' | 'prose' | 'srt' | 'ai'>('timestamps');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [currentTimeSeek, setCurrentTimeSeek] = useState<number | null>(null);

  // AI state
  const [aiMode, setAiMode] = useState<'summary' | 'chapters' | 'takeaways' | 'qa'>('summary');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Copy handler with visual feedback
  const handleCopy = async (type: 'clean' | 'timestamps' | 'markdown' | 'json' | 'srt') => {
    if (!transcript) return;
    let content = '';

    if (type === 'clean') {
      content = generatePlainText(transcript.segments);
    } else if (type === 'timestamps') {
      content = generateTimestampedText(transcript.segments, video.title);
    } else if (type === 'markdown') {
      content = generateMarkdown(transcript.segments, video.title, video.id);
    } else if (type === 'json') {
      content = generateJson(transcript.segments, video.title, video.id);
    } else if (type === 'srt') {
      content = generateSrt(transcript.segments);
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
      setShowCopyDropdown(false);
    } catch {
      // Fallback copy
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
      setShowCopyDropdown(false);
    }
  };

  // Download handler
  const handleDownload = (type: 'txt-clean' | 'txt-time' | 'srt' | 'vtt' | 'json' | 'csv') => {
    if (!transcript) return;
    const safeTitle = (video.title || 'transcript')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

    if (type === 'txt-clean') {
      const content = generatePlainText(transcript.segments);
      triggerFileDownload(`${safeTitle}_clean.txt`, content, 'text/plain;charset=utf-8');
    } else if (type === 'txt-time') {
      const content = generateTimestampedText(transcript.segments, video.title);
      triggerFileDownload(`${safeTitle}_timestamped.txt`, content, 'text/plain;charset=utf-8');
    } else if (type === 'srt') {
      const content = generateSrt(transcript.segments);
      triggerFileDownload(`${safeTitle}.srt`, content, 'text/plain;charset=utf-8');
    } else if (type === 'vtt') {
      const content = generateVtt(transcript.segments);
      triggerFileDownload(`${safeTitle}.vtt`, content, 'text/vtt;charset=utf-8');
    } else if (type === 'json') {
      const content = generateJson(transcript.segments, video.title, video.id);
      triggerFileDownload(`${safeTitle}.json`, content, 'application/json;charset=utf-8');
    } else if (type === 'csv') {
      const content = generateCsv(transcript.segments);
      triggerFileDownload(`${safeTitle}.csv`, content, 'text/csv;charset=utf-8');
    }
    setShowDownloadDropdown(false);
  };

  // Seek video iframe
  const handleSeek = (offsetMs: number) => {
    const seconds = Math.floor(offsetMs / 1000);
    setCurrentTimeSeek(seconds);
    // Send postMessage to YouTube iframe API
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [seconds, true],
        }),
        '*'
      );
    }
  };

  // Run AI analysis
  const handleRunAi = async (mode: 'summary' | 'chapters' | 'takeaways' | 'qa') => {
    if (!transcript) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    setAiMode(mode);

    try {
      const fullText = generateTimestampedText(transcript.segments, video.title);
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptText: fullText,
          videoTitle: video.title,
          mode,
          question: mode === 'qa' ? aiQuestion : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to process with AI');
      }

      const data = await res.json();
      setAiResult(data.result);
    } catch (err: any) {
      setAiError(err.message || 'Error executing AI analysis');
    } finally {
      setAiLoading(false);
    }
  };

  // Filtered segments based on search
  const filteredSegments = useMemo(() => {
    if (!transcript || !searchTerm.trim()) return transcript?.segments || [];
    const term = searchTerm.toLowerCase();
    return transcript.segments.filter((s) => s.text.toLowerCase().includes(term));
  }, [transcript, searchTerm]);

  // Reading stats
  const stats = useMemo(() => {
    if (!transcript) return { words: 0, readTimeMinutes: 0, segmentsCount: 0 };
    const words = transcript.totalWords;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return {
      words,
      readTimeMinutes,
      segmentsCount: transcript.segments.length,
    };
  }, [transcript]);

  return (
    <div className="space-y-6">
      {/* Top back navigation & quick info */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        {onBackToSearch && (
          <button
            onClick={onBackToSearch}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            ← Back to Search Results
          </button>
        )}
        <div className="flex items-center gap-3">
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-red-600 transition-colors"
          >
            <span>Watch on YouTube</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Main Studio Layout: 2-column on desktop (Video on left, Transcript on right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column: Video Player & Metadata (5 cols on lg) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Responsive Embedded YouTube Player */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-200 bg-black shadow-xs">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&autoplay=0${
                currentTimeSeek !== null ? `&start=${currentTimeSeek}` : ''
              }`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>

          {/* Video Metadata Card */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs space-y-3">
            <h2 className="text-base font-semibold text-neutral-900 leading-snug">
              {video.title}
            </h2>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <span className="font-medium text-neutral-800">{video.channelTitle}</span>
              {video.duration && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{video.duration}</span>
                </>
              )}
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

            {transcript && (
              <div className="rounded-md bg-neutral-50 p-2.5 text-xs text-neutral-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Words:</span>
                  <span className="font-mono font-medium text-neutral-900 tabular-nums">
                    {stats.words.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Reading Time:</span>
                  <span className="font-mono font-medium text-neutral-900 tabular-nums">
                    ~{stats.readTimeMinutes} min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Subtitle Blocks:</span>
                  <span className="font-mono font-medium text-neutral-900 tabular-nums">
                    {stats.segmentsCount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {video.description && (
              <details className="text-xs text-neutral-600">
                <summary className="cursor-pointer font-medium text-neutral-700 hover:text-neutral-900">
                  Video Description
                </summary>
                <p className="mt-2 whitespace-pre-line text-neutral-500 max-h-48 overflow-y-auto">
                  {video.description}
                </p>
              </details>
            )}
          </div>
        </div>

        {/* Right column: Transcript Studio Workspace (7 cols on lg) */}
        <div className="space-y-4 lg:col-span-7">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-xs">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 rounded-md bg-neutral-100 p-0.5 text-xs">
              <button
                onClick={() => setViewMode('timestamps')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'timestamps'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Timestamps
              </button>
              <button
                onClick={() => setViewMode('prose')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'prose'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Clean Prose
              </button>
              <button
                onClick={() => setViewMode('srt')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'srt'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                SRT Code
              </button>
              <button
                onClick={() => setViewMode('ai')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'ai'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Sparkles className="h-3 w-3 text-red-500" />
                <span>AI Insights</span>
              </button>
            </div>

            {/* Language Selector (if tracks available) */}
            {transcript && transcript.availableLanguages && transcript.availableLanguages.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Languages className="h-3.5 w-3.5 text-neutral-400" />
                <select
                  value={transcript.selectedLanguage}
                  onChange={(e) => onChangeLanguage(e.target.value)}
                  className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 shadow-xs focus:border-neutral-900 focus:outline-none"
                >
                  {transcript.availableLanguages.map((track) => (
                    <option key={track.languageCode} value={track.languageCode}>
                      {track.name} {track.isAutoGenerated ? '(Auto)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* COPY & DOWNLOAD ACTION BUTTONS */}
            <div className="flex items-center gap-2">
              {/* Copy Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowCopyDropdown(!showCopyDropdown);
                    setShowDownloadDropdown(false);
                  }}
                  disabled={!transcript || isLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-xs hover:border-neutral-300 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  {copiedType ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-neutral-500" />
                      <span>Copy</span>
                      <ChevronDown className="h-3 w-3 text-neutral-400" />
                    </>
                  )}
                </button>

                {showCopyDropdown && (
                  <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border border-neutral-200 bg-white py-1 shadow-lg text-xs">
                    <button
                      onClick={() => handleCopy('clean')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Copy Clean Text (No Timestamps)</span>
                      {copiedType === 'clean' && <Check className="h-3 w-3 text-emerald-600" />}
                    </button>
                    <button
                      onClick={() => handleCopy('timestamps')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Copy with Timestamps [MM:SS]</span>
                      {copiedType === 'timestamps' && <Check className="h-3 w-3 text-emerald-600" />}
                    </button>
                    <button
                      onClick={() => handleCopy('markdown')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Copy as Markdown</span>
                      {copiedType === 'markdown' && <Check className="h-3 w-3 text-emerald-600" />}
                    </button>
                    <button
                      onClick={() => handleCopy('srt')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Copy SubRip (SRT)</span>
                      {copiedType === 'srt' && <Check className="h-3 w-3 text-emerald-600" />}
                    </button>
                    <button
                      onClick={() => handleCopy('json')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Copy Raw JSON</span>
                      {copiedType === 'json' && <Check className="h-3 w-3 text-emerald-600" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Download Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowDownloadDropdown(!showDownloadDropdown);
                    setShowCopyDropdown(false);
                  }}
                  disabled={!transcript || isLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                  <ChevronDown className="h-3 w-3 text-neutral-400" />
                </button>

                {showDownloadDropdown && (
                  <div className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-neutral-200 bg-white py-1 shadow-lg text-xs">
                    <div className="px-3 py-1 font-semibold text-neutral-400 text-[10px] uppercase">
                      Text Files
                    </div>
                    <button
                      onClick={() => handleDownload('txt-clean')}
                      className="flex w-full items-center px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Clean Text (.txt)</span>
                    </button>
                    <button
                      onClick={() => handleDownload('txt-time')}
                      className="flex w-full items-center px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Timestamped (.txt)</span>
                    </button>

                    <div className="mt-1 border-t border-neutral-100 px-3 py-1 font-semibold text-neutral-400 text-[10px] uppercase">
                      Subtitles & Data
                    </div>
                    <button
                      onClick={() => handleDownload('srt')}
                      className="flex w-full items-center px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>SubRip Subtitles (.srt)</span>
                    </button>
                    <button
                      onClick={() => handleDownload('vtt')}
                      className="flex w-full items-center px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>WebVTT Subtitles (.vtt)</span>
                    </button>
                    <button
                      onClick={() => handleDownload('json')}
                      className="flex w-full items-center px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Structured JSON (.json)</span>
                    </button>
                    <button
                      onClick={() => handleDownload('csv')}
                      className="flex w-full items-center px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Spreadsheet (.csv)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search within transcript bar (for timestamp & prose views) */}
          {(viewMode === 'timestamps' || viewMode === 'prose') && transcript && (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search words in transcript..."
                className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-8 text-xs text-neutral-800 placeholder-neutral-400 shadow-xs focus:border-neutral-900 focus:outline-none"
              />
              {searchTerm && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[11px] text-neutral-500">
                  {filteredSegments.length} matches
                </div>
              )}
            </div>
          )}

          {/* Transcript Content Container */}
          <div className="rounded-lg border border-neutral-200 bg-white shadow-xs">
            {/* Loading state */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-800" />
                <h4 className="mt-3 text-sm font-semibold text-neutral-800">
                  Extracting Full Video Transcript...
                </h4>
                <p className="mt-1 text-xs text-neutral-500">
                  Retrieving synchronized captions, duration offsets, and dialogue lines.
                </p>
              </div>
            )}

            {/* Error state */}
            {!isLoading && error && (
              <div className="p-8 text-center space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <FileText className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-neutral-800">Transcript Unavailable</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">{error}</p>
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retry Extraction</span>
                </button>
              </div>
            )}

            {/* Content Display: TIMESTAMPS VIEW */}
            {!isLoading && !error && transcript && viewMode === 'timestamps' && (
              <div className="max-h-[600px] overflow-y-auto divide-y divide-neutral-100 p-2">
                {filteredSegments.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    No transcript segments matching "{searchTerm}"
                  </div>
                ) : (
                  filteredSegments.map((seg, idx) => (
                    <div
                      key={idx}
                      className="group flex items-start gap-3 p-2.5 rounded hover:bg-neutral-50 transition-colors"
                    >
                      {/* Clickable timestamp that seeks video */}
                      <button
                        onClick={() => handleSeek(seg.offset)}
                        className="font-mono text-xs font-semibold text-red-600 hover:underline shrink-0 tabular-nums inline-flex items-center gap-1"
                        title="Click to jump video to this second"
                      >
                        <Play className="h-2.5 w-2.5 fill-current opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span>{formatTime(seg.offset)}</span>
                      </button>

                      {/* Line text */}
                      <p className="text-xs leading-relaxed text-neutral-800 flex-1">
                        {searchTerm ? (
                          <HighlightText text={seg.text} highlight={searchTerm} />
                        ) : (
                          seg.text
                        )}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Content Display: CLEAN PROSE VIEW */}
            {!isLoading && !error && transcript && viewMode === 'prose' && (
              <div className="max-h-[600px] overflow-y-auto p-6 space-y-4 text-sm leading-relaxed text-neutral-800">
                {generatePlainText(transcript.segments)
                  .split('\n\n')
                  .map((para, i) => (
                    <p key={i} className="text-justify">
                      {searchTerm ? (
                        <HighlightText text={para} highlight={searchTerm} />
                      ) : (
                        para
                      )}
                    </p>
                  ))}
              </div>
            )}

            {/* Content Display: SRT CODE VIEW */}
            {!isLoading && !error && transcript && viewMode === 'srt' && (
              <div className="max-h-[600px] overflow-y-auto p-4 bg-neutral-900 rounded-b-lg">
                <pre className="font-mono text-xs text-neutral-200 leading-normal whitespace-pre-wrap">
                  {generateSrt(transcript.segments)}
                </pre>
              </div>
            )}

            {/* Content Display: AI INSIGHTS VIEW */}
            {!isLoading && !error && transcript && viewMode === 'ai' && (
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-3">
                  <span className="text-xs font-medium text-neutral-500">Analysis Mode:</span>
                  <button
                    onClick={() => handleRunAi('summary')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      aiMode === 'summary'
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Executive Summary
                  </button>
                  <button
                    onClick={() => handleRunAi('takeaways')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      aiMode === 'takeaways'
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Key Takeaways & Quotes
                  </button>
                  <button
                    onClick={() => handleRunAi('chapters')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      aiMode === 'chapters'
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Timed Chapter Outline
                  </button>
                </div>

                {/* Q&A Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ask a specific question about this video's transcript..."
                    className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 placeholder-neutral-400 shadow-xs focus:border-neutral-900 focus:outline-none"
                  />
                  <button
                    onClick={() => handleRunAi('qa')}
                    disabled={aiLoading || !aiQuestion.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-neutral-800 disabled:opacity-50"
                  >
                    Ask AI
                  </button>
                </div>

                {/* AI Output Area */}
                {aiLoading && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-800" />
                    <p className="mt-2 text-xs text-neutral-500">
                      Analyzing transcript with Gemini 3.8 Flash...
                    </p>
                  </div>
                )}

                {aiError && (
                  <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
                    {aiError}
                  </div>
                )}

                {!aiLoading && aiResult && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                      <span className="text-xs font-semibold text-neutral-900">
                        Gemini Analysis ({aiMode})
                      </span>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(aiResult);
                          setCopiedType('ai');
                          setTimeout(() => setCopiedType(null), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
                      >
                        {copiedType === 'ai' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedType === 'ai' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="max-h-[450px] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-neutral-800 font-sans">
                      {aiResult}
                    </div>
                  </div>
                )}

                {!aiLoading && !aiResult && !aiError && (
                  <div className="py-10 text-center text-xs text-neutral-500">
                    Click "Executive Summary", "Key Takeaways", or ask a question to generate intelligent insights from the video transcript.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component to highlight search terms
function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-neutral-900 rounded-xs px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
