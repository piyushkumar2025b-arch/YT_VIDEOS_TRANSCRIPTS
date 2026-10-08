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

// Generate self-contained offline HTML document with search
export function generateHtmlExport(segments: TranscriptSegment[], videoTitle: string, videoId: string): string {
  const plain = generatePlainText(segments);
  const rows = segments
    .map(
      (s) =>
        `<div class="row" data-time="${Math.floor(s.offset / 1000)}">
          <a class="time" href="https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(s.offset / 1000)}s" target="_blank">[${formatTime(s.offset)}]</a>
          <span class="text">${s.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
        </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${videoTitle.replace(/</g, '&lt;')} — Transcript</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1f2937; background: #fafafa; }
    @media (prefers-color-scheme: dark) { body { background: #0f172a; color: #f1f5f9; } .row:hover { background: #1e293b; } }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .meta { font-size: 0.85rem; color: #6b7280; margin-bottom: 1.5rem; }
    .search-box { width: 100%; padding: 10px 14px; font-size: 14px; border: 1px solid #d1d5db; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; background: inherit; color: inherit; }
    .row { display: flex; gap: 14px; padding: 6px 10px; border-radius: 6px; transition: background 0.15s; }
    .row:hover { background: #f3f4f6; }
    .time { font-family: ui-monospace, monospace; font-size: 0.85rem; color: #dc2626; text-decoration: none; font-weight: 600; shrink: 0; }
    .time:hover { text-decoration: underline; }
    .text { font-size: 0.95rem; }
    mark { background: #fef08a; padding: 1px 3px; border-radius: 2px; }
  </style>
</head>
<body>
  <h1>${videoTitle.replace(/</g, '&lt;')}</h1>
  <div class="meta">
    <span>YouTube: <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">https://www.youtube.com/watch?v=${videoId}</a></span> ·
    <span>Total Segments: ${segments.length}</span>
  </div>
  <input type="text" id="search" class="search-box" placeholder="Filter words in transcript..." oninput="filterTranscript()" />
  <div id="transcript">${rows}</div>
  <script>
    function filterTranscript() {
      const q = document.getElementById('search').value.toLowerCase();
      const rows = document.querySelectorAll('.row');
      rows.forEach(r => {
        const text = r.querySelector('.text').innerText.toLowerCase();
        r.style.display = text.includes(q) ? 'flex' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

// Generate formatted prompt for AI tools (ChatGPT, Claude, NotebookLM)
export function generatePromptAi(
  segments: TranscriptSegment[],
  videoTitle: string,
  videoId: string,
  promptType: 'summary' | 'keypoints' | 'qa' = 'summary'
): string {
  const plainText = generatePlainText(segments);

  let task = '';
  if (promptType === 'summary') {
    task = 'Provide an executive summary (TL;DR), followed by the 5 most important core takeaways and notable lessons.';
  } else if (promptType === 'keypoints') {
    task = 'Extract a detailed bulleted list of all key points, actionable advice, and memorable quotes with timestamps if applicable.';
  } else {
    task = 'Analyze the key themes discussed, compare the main arguments presented, and provide a study guide with review questions.';
  }

  return `You are an expert research synthesizer. Please thoroughly analyze this YouTube video transcript.

VIDEO TITLE: "${videoTitle}"
VIDEO URL: https://www.youtube.com/watch?v=${videoId}

TASK:
${task}

--- TRANSCRIPT CONTENT ---
${plainText.slice(0, 30000)}
${plainText.length > 30000 ? '\n...[Transcript truncated for token limit]...' : ''}
`;
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
