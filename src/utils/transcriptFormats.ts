import type { TranscriptSegment } from '../types/index.ts';

// Format milliseconds to MM:SS or HH:MM:SS
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Format milliseconds to SRT format (00:00:00,000)
export function formatSrtTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Format milliseconds to WebVTT format (00:00:00.000)
export function formatVttTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

// Generate clean plain text (prose with natural paragraphs)
export function generatePlainText(segments: TranscriptSegment[]): string {
  if (!segments || segments.length === 0) return '';
  // Group into readable paragraphs roughly every 4-6 sentences or 60-80 words
  let paragraphs: string[] = [];
  let currentPara: string[] = [];
  let wordCount = 0;

  for (const seg of segments) {
    currentPara.push(seg.text);
    wordCount += seg.text.split(' ').length;
    // If ending with punctuation and reached decent length, start new paragraph
    if (wordCount >= 60 && /[.?!]$/.test(seg.text.trim())) {
      paragraphs.push(currentPara.join(' '));
      currentPara = [];
      wordCount = 0;
    }
  }

  if (currentPara.length > 0) {
    paragraphs.push(currentPara.join(' '));
  }

  return paragraphs.join('\n\n');
}

// Generate timestamped text format ([01:23] Text)
export function generateTimestampedText(segments: TranscriptSegment[], videoTitle?: string): string {
  const header = videoTitle ? `Transcript: ${videoTitle}\n${'='.repeat(videoTitle.length + 12)}\n\n` : '';
  const lines = segments.map((seg) => `[${formatTime(seg.offset)}] ${seg.text}`);
  return header + lines.join('\n');
}

// Generate Markdown format
export function generateMarkdown(segments: TranscriptSegment[], videoTitle: string, videoId: string): string {
  let md = `# ${videoTitle}\n\n`;
  md += `**Video URL**: https://www.youtube.com/watch?v=${videoId}\n\n`;
  md += `---\n\n## Transcript\n\n`;

  for (const seg of segments) {
    const time = formatTime(seg.offset);
    const link = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seg.offset / 1000)}s`;
    md += `* [${time}](${link}) — ${seg.text}\n`;
  }

  return md;
}

// Generate SRT subtitle file format
export function generateSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, idx) => {
      const start = formatSrtTimestamp(seg.offset);
      const end = formatSrtTimestamp(seg.offset + seg.duration);
      return `${idx + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join('\n');
}

// Generate WebVTT subtitle file format
export function generateVtt(segments: TranscriptSegment[]): string {
  let vtt = 'WEBVTT\n\n';
  vtt += segments
    .map((seg, idx) => {
      const start = formatVttTimestamp(seg.offset);
      const end = formatVttTimestamp(seg.offset + seg.duration);
      return `${idx + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join('\n');
  return vtt;
}

// Generate JSON format
export function generateJson(segments: TranscriptSegment[], videoTitle?: string, videoId?: string): string {
  return JSON.stringify(
    {
      videoId,
      title: videoTitle,
      exportedAt: new Date().toISOString(),
      totalSegments: segments.length,
      transcript: segments.map((seg) => ({
        timestamp: formatTime(seg.offset),
        startMs: seg.offset,
        durationMs: seg.duration,
        text: seg.text,
      })),
    },
    null,
    2
  );
}

// Generate CSV format
export function generateCsv(segments: TranscriptSegment[]): string {
  const header = 'Index,Timestamp,StartMs,DurationMs,Text\n';
  const rows = segments.map((seg, idx) => {
    const escapedText = `"${seg.text.replace(/"/g, '""')}"`;
    return `${idx + 1},${formatTime(seg.offset)},${seg.offset},${seg.duration},${escapedText}`;
  });
  return header + rows.join('\n');
}

// Browser file download trigger
export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
