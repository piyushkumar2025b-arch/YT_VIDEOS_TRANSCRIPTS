import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Copy,
  Download,
  Check,
  Search,
  ExternalLink,
  Sparkles,
  Play,
  RotateCcw,
  Languages,
  ChevronDown,
  ChevronUp,
  Share2,
  Bookmark,
  Volume2,
  FileCode,
  AlignLeft,
  List,
  Sparkle,
  MessageSquare,
  HelpCircle,
  Eye,
  Type,
  ArrowUp,
  ArrowDown,
  Repeat,
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
  generateHtmlExport,
  generatePromptAi,
  triggerFileDownload,
} from '../utils/transcriptFormats.ts';
import {
  extractKeyTopics,
  generateAutoChapters,
  extractHighlightQuotes,
} from '../utils/transcriptAnalysis.ts';

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
  // View & formatting modes
  const [viewMode, setViewMode] = useState<'timestamps' | 'prose' | 'insights' | 'srt'>('timestamps');
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [autoScroll, setAutoScroll] = useState(true);

  // Search within transcript
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // Copy & Download dropdown states
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  // Video Player state & current seek time
  const [currentTimeSeek, setCurrentTimeSeek] = useState<number | null>(null);
  const [currentPlayingSeconds, setCurrentPlayingSeconds] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLoopingSegment, setIsLoopingSegment] = useState<number | null>(null);

  // AI state
  const [aiMode, setAiMode] = useState<'summary' | 'chapters' | 'takeaways' | 'qa'>('summary');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Listen to postMessage from YouTube player if available, or simulate playback timer when video playing
  useEffect(() => {
    let interval: any = null;
    if (currentTimeSeek !== null) {
      setCurrentPlayingSeconds(currentTimeSeek);
      interval = setInterval(() => {
        setCurrentPlayingSeconds((prev) => prev + playbackSpeed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTimeSeek, playbackSpeed]);

  // Find active segment based on current playing seconds
  const activeSegmentIndex = useMemo(() => {
    if (!transcript || transcript.segments.length === 0) return -1;
    const currentMs = currentPlayingSeconds * 1000;
    return transcript.segments.findIndex(
      (s) => currentMs >= s.offset && currentMs < s.offset + s.duration
    );
  }, [transcript, currentPlayingSeconds]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (!autoScroll || activeSegmentIndex === -1) return;
    const el = segmentRefs.current.get(activeSegmentIndex);
    if (el && listContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSegmentIndex, autoScroll]);

  // Seek video iframe
  const handleSeek = (offsetMs: number) => {
    const seconds = Math.floor(offsetMs / 1000);
    setCurrentTimeSeek(seconds);
    setCurrentPlayingSeconds(seconds);

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

  // Set playback speed
  const handleSetSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'setPlaybackRate',
          args: [speed],
        }),
        '*'
      );
    }
  };

  // Copy handler with visual feedback
  const handleCopy = async (
    type: 'clean' | 'timestamps' | 'markdown' | 'json' | 'srt' | 'prompt-ai'
  ) => {
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
    } else if (type === 'prompt-ai') {
      content = generatePromptAi(transcript.segments, video.title, video.id, 'summary');
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
      setShowCopyDropdown(false);
    } catch {
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

  // Copy single sentence or timestamp link
  const handleCopySegment = async (seg: TranscriptSegment) => {
    const text = `[${formatTime(seg.offset)}] ${seg.text}`;
    await navigator.clipboard.writeText(text);
    setCopiedType(`seg-${seg.offset}`);
    setTimeout(() => setCopiedType(null), 1500);
  };

  const handleCopyTimestampLink = async (offsetMs: number) => {
    const seconds = Math.floor(offsetMs / 1000);
    const url = `https://youtu.be/${video.id}?t=${seconds}`;
    await navigator.clipboard.writeText(url);
    setCopiedType(`link-${offsetMs}`);
    setTimeout(() => setCopiedType(null), 1500);
  };

  // Download handler
  const handleDownload = (
    type: 'txt-clean' | 'txt-time' | 'srt' | 'vtt' | 'json' | 'csv' | 'md' | 'html'
  ) => {
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
    } else if (type === 'md') {
      const content = generateMarkdown(transcript.segments, video.title, video.id);
      triggerFileDownload(`${safeTitle}.md`, content, 'text/markdown;charset=utf-8');
    } else if (type === 'html') {
      const content = generateHtmlExport(transcript.segments, video.title, video.id);
      triggerFileDownload(`${safeTitle}_reader.html`, content, 'text/html;charset=utf-8');
    }
    setShowDownloadDropdown(false);
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

  // Navigate matching search items
  const handleNextMatch = () => {
    if (filteredSegments.length === 0) return;
    const next = (currentMatchIdx + 1) % filteredSegments.length;
    setCurrentMatchIdx(next);
    handleSeek(filteredSegments[next].offset);
  };

  const handlePrevMatch = () => {
    if (filteredSegments.length === 0) return;
    const prev = (currentMatchIdx - 1 + filteredSegments.length) % filteredSegments.length;
    setCurrentMatchIdx(prev);
    handleSeek(filteredSegments[prev].offset);
  };

  // Local instant analytics
  const keyTopics = useMemo(() => {
    return transcript ? extractKeyTopics(transcript.segments, 8) : [];
  }, [transcript]);

  const autoChapters = useMemo(() => {
    return transcript ? generateAutoChapters(transcript.segments) : [];
  }, [transcript]);

  const highlightQuotes = useMemo(() => {
    return transcript ? extractHighlightQuotes(transcript.segments, 3) : [];
  }, [transcript]);

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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-2">
          {onBackToSearch && (
            <button
              onClick={onBackToSearch}
              className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 shadow-xs transition-colors"
            >
              ← Search Results
            </button>
          )}
          <span className="text-xs text-neutral-400">·</span>
          <span className="text-xs font-medium text-neutral-700 truncate max-w-md">
            {video.title}
          </span>
        </div>

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
        {/* Left column: Video Player & Controls & Key Topics (5 cols on lg) */}
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

          {/* Player controls toolbar: speed & jump */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-2.5 text-xs shadow-xs">
            <div className="flex items-center gap-1 text-neutral-600">
              <span className="text-[11px] font-medium text-neutral-400">Speed:</span>
              {[1, 1.25, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSetSpeed(s)}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums transition-colors ${
                    playbackSpeed === s
                      ? 'bg-neutral-900 text-white font-medium'
                      : 'hover:bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
              <span className="font-mono tabular-nums">
                {formatTime(currentPlayingSeconds * 1000)}
              </span>
              {video.duration && (
                <>
                  <span>/</span>
                  <span className="font-mono tabular-nums">{video.duration}</span>
                </>
              )}
            </div>
          </div>

          {/* Video Metadata Card */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900 leading-snug">
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

            {/* Reading stats */}
            {transcript && (
              <div className="grid grid-cols-3 gap-2 rounded-md bg-neutral-50 p-2 text-center text-xs">
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-medium">Words</div>
                  <div className="font-mono font-semibold text-neutral-900 tabular-nums">
                    {stats.words.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-medium">Read Time</div>
                  <div className="font-mono font-semibold text-neutral-900 tabular-nums">
                    ~{stats.readTimeMinutes} min
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-medium">Lines</div>
                  <div className="font-mono font-semibold text-neutral-900 tabular-nums">
                    {stats.segmentsCount.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Key Topics (Clickable chips to search within transcript) */}
            {keyTopics.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-neutral-400">
                  Key Topics Discussed (Click to filter):
                </span>
                <div className="flex flex-wrap gap-1">
                  {keyTopics.map((item) => (
                    <button
                      key={item.word}
                      onClick={() => setSearchTerm(item.word)}
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        searchTerm.toLowerCase() === item.word.toLowerCase()
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      {item.word} <span className="opacity-60 tabular-nums">({item.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Auto Chapters quick navigator */}
            {autoChapters.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                <span className="text-[11px] font-medium text-neutral-400">
                  Timeline Chapters:
                </span>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {autoChapters.map((ch, i) => (
                    <button
                      key={i}
                      onClick={() => handleSeek(ch.offsetMs)}
                      className="w-full text-left flex items-start gap-2 p-1.5 rounded hover:bg-neutral-50 transition-colors group"
                    >
                      <span className="font-mono text-[11px] font-semibold text-red-600 group-hover:underline tabular-nums shrink-0 mt-0.5">
                        {ch.time}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-neutral-800 truncate">
                          {ch.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 line-clamp-1">
                          {ch.summary}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Transcript Studio Workspace (7 cols on lg) */}
        <div className="space-y-3 lg:col-span-7">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-neutral-200 bg-white p-3 shadow-xs">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 rounded-md bg-neutral-100 p-0.5 text-xs">
              <button
                onClick={() => setViewMode('timestamps')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'timestamps'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>Timestamps</span>
              </button>

              <button
                onClick={() => setViewMode('prose')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'prose'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <AlignLeft className="h-3.5 w-3.5" />
                <span>Clean Prose</span>
              </button>

              <button
                onClick={() => setViewMode('insights')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'insights'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-red-500" />
                <span>AI & Insights</span>
              </button>

              <button
                onClick={() => setViewMode('srt')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'srt'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" />
                <span>SRT</span>
              </button>
            </div>

            {/* Language Selector */}
            {transcript && transcript.availableLanguages && transcript.availableLanguages.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Languages className="h-3.5 w-3.5 text-neutral-400" />
                <select
                  value={transcript.selectedLanguage}
                  onChange={(e) => onChangeLanguage(e.target.value)}
                  className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 shadow-xs focus:border-neutral-900 focus:outline-none"
                >
                  {transcript.availableLanguages.map((track, idx) => (
                    <option key={`${track.languageCode}-${idx}`} value={track.languageCode}>
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
                  {copiedType && !copiedType.startsWith('seg-') && !copiedType.startsWith('link-') ? (
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
                  <div className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-neutral-200 bg-white py-1 shadow-lg text-xs">
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
                      <span>Copy as Markdown (.md)</span>
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
                    <div className="border-t border-neutral-100 my-1" />
                    <button
                      onClick={() => handleCopy('prompt-ai')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-red-600 hover:bg-red-50 font-medium"
                    >
                      <span>Copy ChatGPT / Claude Prompt</span>
                      {copiedType === 'prompt-ai' && <Check className="h-3 w-3 text-emerald-600" />}
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
                  <div className="absolute right-0 z-50 mt-1 w-60 rounded-md border border-neutral-200 bg-white py-1 shadow-lg text-xs">
                    <div className="px-3 py-1 font-semibold text-neutral-400 text-[10px] uppercase">
                      Documents & Text
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
                    <button
                      onClick={() => handleDownload('md')}
                      className="flex w-full items-center px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Markdown Document (.md)</span>
                    </button>
                    <button
                      onClick={() => handleDownload('html')}
                      className="flex w-full items-center px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>Interactive Offline Reader (.html)</span>
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

          {/* Search bar & reading comfort controls (shown on timestamps & prose view) */}
          {(viewMode === 'timestamps' || viewMode === 'prose') && transcript && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-2 shadow-xs">
              {/* Search with Prev/Next Match Navigation */}
              <div className="relative flex-1 min-w-[200px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-neutral-400">
                  <Search className="h-3.5 w-3.5" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentMatchIdx(0);
                  }}
                  placeholder="Search in transcript..."
                  className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-8 pr-16 text-xs text-neutral-800 placeholder-neutral-400 shadow-xs focus:border-neutral-900 focus:outline-none"
                />
                {searchTerm && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                    <span className="text-[11px] text-neutral-400 tabular-nums">
                      {filteredSegments.length > 0 ? `${currentMatchIdx + 1}/${filteredSegments.length}` : '0'}
                    </span>
                    <button
                      onClick={handlePrevMatch}
                      disabled={filteredSegments.length === 0}
                      className="p-0.5 text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
                      title="Previous match"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={handleNextMatch}
                      disabled={filteredSegments.length === 0}
                      className="p-0.5 text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
                      title="Next match"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Reading controls: font size, auto-scroll toggle */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded border border-neutral-200 p-0.5 text-[11px]">
                  {(['sm', 'base', 'lg'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setTextSize(sz)}
                      className={`px-1.5 py-0.5 rounded uppercase font-medium ${
                        textSize === sz ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      {sz === 'sm' ? 'S' : sz === 'base' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                    autoScroll
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                  title="Auto-scroll transcript along with video playback"
                >
                  <Eye className="h-3 w-3" />
                  <span>Auto-Scroll</span>
                </button>
              </div>
            </div>
          )}

          {/* Transcript Content Container */}
          <div className="rounded-lg border border-neutral-200 bg-white shadow-xs">
            {/* Loading state */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
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
                  <HelpCircle className="h-5 w-5" />
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
              <div
                ref={listContainerRef}
                className="max-h-[620px] overflow-y-auto divide-y divide-neutral-100 p-2"
              >
                {filteredSegments.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    No transcript segments matching "{searchTerm}"
                  </div>
                ) : (
                  filteredSegments.map((seg, idx) => {
                    const isActive = activeSegmentIndex === idx;
                    return (
                      <div
                        key={idx}
                        ref={(el) => {
                          if (el) segmentRefs.current.set(idx, el);
                          else segmentRefs.current.delete(idx);
                        }}
                        className={`group flex items-start gap-3 p-2.5 rounded transition-colors ${
                          isActive
                            ? 'bg-red-50/80 ring-1 ring-red-200'
                            : 'hover:bg-neutral-50'
                        }`}
                      >
                        {/* Clickable timestamp that seeks video */}
                        <button
                          onClick={() => handleSeek(seg.offset)}
                          className={`font-mono font-semibold tabular-nums shrink-0 inline-flex items-center gap-1 ${
                            textSize === 'sm' ? 'text-[11px]' : textSize === 'lg' ? 'text-sm' : 'text-xs'
                          } ${
                            isActive ? 'text-red-700' : 'text-red-600 hover:underline'
                          }`}
                          title="Click to jump video to this second"
                        >
                          <Play className="h-2.5 w-2.5 fill-current" />
                          <span>{formatTime(seg.offset)}</span>
                        </button>

                        {/* Dialogue Text */}
                        <p
                          className={`leading-relaxed text-neutral-800 flex-1 ${
                            textSize === 'sm' ? 'text-xs' : textSize === 'lg' ? 'text-base' : 'text-sm'
                          }`}
                        >
                          {searchTerm ? (
                            <HighlightText text={seg.text} highlight={searchTerm} />
                          ) : (
                            seg.text
                          )}
                        </p>

                        {/* Hover Quick Action Buttons */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                          <button
                            onClick={() => handleCopySegment(seg)}
                            className="p-1 text-neutral-400 hover:text-neutral-700 rounded hover:bg-neutral-200/60"
                            title="Copy sentence"
                          >
                            {copiedType === `seg-${seg.offset}` ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleCopyTimestampLink(seg.offset)}
                            className="p-1 text-neutral-400 hover:text-neutral-700 rounded hover:bg-neutral-200/60"
                            title="Copy link to this timestamp"
                          >
                            {copiedType === `link-${seg.offset}` ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Share2 className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Content Display: CLEAN PROSE VIEW */}
            {!isLoading && !error && transcript && viewMode === 'prose' && (
              <div
                className={`max-h-[620px] overflow-y-auto p-6 space-y-4 leading-relaxed text-neutral-800 ${
                  textSize === 'sm' ? 'text-xs' : textSize === 'lg' ? 'text-base' : 'text-sm'
                }`}
              >
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
              <div className="max-h-[620px] overflow-y-auto p-4 bg-neutral-900 rounded-b-lg">
                <pre className="font-mono text-xs text-neutral-200 leading-normal whitespace-pre-wrap">
                  {generateSrt(transcript.segments)}
                </pre>
              </div>
            )}

            {/* Content Display: AI & INSIGHTS VIEW */}
            {!isLoading && !error && transcript && viewMode === 'insights' && (
              <div className="p-5 space-y-6">
                {/* Instant Local Highlight Quotes */}
                {highlightQuotes.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                      <Bookmark className="h-3.5 w-3.5 text-neutral-500" />
                      Key Dialogue Highlights
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {highlightQuotes.map((q, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3"
                        >
                          <div className="space-y-1">
                            <p className="text-xs italic text-neutral-800 leading-relaxed">
                              {q.text}
                            </p>
                            <button
                              onClick={() => handleSeek(q.offset)}
                              className="font-mono text-[11px] font-semibold text-red-600 hover:underline"
                            >
                              Jump to {q.time}
                            </button>
                          </div>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(q.text);
                              setCopiedType(`quote-${idx}`);
                              setTimeout(() => setCopiedType(null), 1500);
                            }}
                            className="p-1 text-neutral-400 hover:text-neutral-700"
                            title="Copy quote"
                          >
                            {copiedType === `quote-${idx}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Processing Controls */}
                <div className="space-y-3 border-t border-neutral-100 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-red-600" />
                      Deep AI Synthesis (Gemini 3.8 Flash)
                    </span>

                    <button
                      onClick={() => handleCopy('prompt-ai')}
                      className="text-xs text-neutral-600 hover:text-neutral-900 font-medium underline decoration-neutral-300"
                    >
                      Copy Prompt for External AI
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'summary', label: 'Executive Summary' },
                      { id: 'takeaways', label: 'Actionable Takeaways' },
                      { id: 'chapters', label: 'Chapter Outline' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleRunAi(m.id as any)}
                        className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                          aiMode === m.id
                            ? 'bg-neutral-900 text-white'
                            : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Ask Question Bar */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      placeholder="Ask a specific question about this transcript..."
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

                  {/* AI Results Display */}
                  {aiLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
                      <p className="mt-2 text-xs text-neutral-500">
                        Synthesizing transcript with Gemini 3.8 Flash...
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
                          Synthesis Result ({aiMode})
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
                </div>
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
