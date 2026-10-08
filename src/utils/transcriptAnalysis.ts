import type { TranscriptSegment } from '../types/index.ts';
import { formatTime } from './transcriptFormats.ts';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i',
  'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'like', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
  'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'know', 'think', 'going',
  'really', 'actually', 'mean', 'kind', 'sort', 'yeah', 'okay', 'right', 'well', 'want', 'look'
]);

// Extract significant key concepts and their frequencies
export function extractKeyTopics(
  segments: TranscriptSegment[],
  limit = 8
): { word: string; count: number }[] {
  if (!segments || segments.length === 0) return [];

  const wordCounts = new Map<string, number>();

  for (const seg of segments) {
    const tokens = seg.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/);

    for (const token of tokens) {
      if (token.length >= 4 && !STOP_WORDS.has(token) && !/^\d+$/.test(token)) {
        wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
      }
    }
  }

  return Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word: word.charAt(0).toUpperCase() + word.slice(1), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Generate automatic chapters based on dialogue progression and speech pauses
export function generateAutoChapters(
  segments: TranscriptSegment[]
): { time: string; offsetMs: number; title: string; summary: string }[] {
  if (!segments || segments.length === 0) return [];

  const totalDuration = segments[segments.length - 1].offset + segments[segments.length - 1].duration;
  // If video is short (< 3 min), 2-3 chapters. If longer, 4-6 chapters.
  const targetCount = totalDuration < 180000 ? 2 : totalDuration < 600000 ? 4 : 5;
  const interval = totalDuration / targetCount;

  const chapters: { time: string; offsetMs: number; title: string; summary: string }[] = [];

  for (let i = 0; i < targetCount; i++) {
    const targetOffset = i * interval;
    // Find segment closest to this target offset
    const segIdx = segments.findIndex((s) => s.offset >= targetOffset);
    const chosenIdx = segIdx !== -1 ? segIdx : Math.floor((i / targetCount) * segments.length);
    const seg = segments[chosenIdx] || segments[0];

    // Pick 2-3 consecutive segments for a meaningful summary sentence
    const previewText = segments
      .slice(chosenIdx, chosenIdx + 3)
      .map((s) => s.text)
      .join(' ')
      .trim();

    let title = '';
    if (i === 0) {
      title = 'Introduction & Overview';
    } else if (i === targetCount - 1) {
      title = 'Conclusions & Wrap-up';
    } else {
      // Find prominent word in preview
      const words = previewText
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-Z]/g, ''))
        .filter((w) => w.length > 4 && !STOP_WORDS.has(w.toLowerCase()));
      title = words.length > 0 ? `Discussion: ${words[0]}` : `Part ${i + 1}`;
    }

    chapters.push({
      time: formatTime(seg.offset),
      offsetMs: seg.offset,
      title,
      summary: previewText.slice(0, 140) + (previewText.length > 140 ? '...' : ''),
    });
  }

  return chapters;
}

// Extract highlight quotes from the dialogue
export function extractHighlightQuotes(
  segments: TranscriptSegment[],
  count = 3
): { text: string; offset: number; time: string }[] {
  if (!segments || segments.length === 0) return [];

  // Filter segments that are full complete sentences with punctuation and decent length
  const candidates = segments.filter(
    (s) => s.text.length >= 35 && s.text.length <= 150 && /[.?!]$/.test(s.text.trim())
  );

  const pool = candidates.length >= count ? candidates : segments.filter((s) => s.text.length >= 25);
  // Pick evenly distributed quotes across the transcript
  const quotes: { text: string; offset: number; time: string }[] = [];
  const step = Math.max(1, Math.floor(pool.length / count));

  for (let i = 0; i < count && i * step < pool.length; i++) {
    const seg = pool[i * step];
    if (seg) {
      quotes.push({
        text: `"${seg.text.trim()}"`,
        offset: seg.offset,
        time: formatTime(seg.offset),
      });
    }
  }

  return quotes;
}
