import { YoutubeTranscript } from 'youtube-transcript';
import type { VideoItem, SearchResult, TranscriptResult, CaptionTrackInfo, TranscriptSegment } from '../types/index.js';

// Parse ISO 8601 duration e.g. PT1H2M3S or PT4M12S
export function parseIsoDuration(durationStr: string): { formatted: string; seconds: number } {
  if (!durationStr) return { formatted: '', seconds: 0 };
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { formatted: durationStr, seconds: 0 };

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return { formatted, seconds: totalSeconds };
}

// Format numbers (e.g., 1420000 -> 1.4M)
export function formatCompactNumber(numStr?: string | number): string {
  if (!numStr) return '0';
  const num = typeof numStr === 'string' ? parseInt(numStr, 10) : numStr;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

// Decode HTML entities
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

// Search using YouTube Data API v3
export async function searchWithYoutubeApi(
  query: string,
  apiKey: string,
  pageToken?: string,
  order: string = 'relevance',
  maxResults: number = 24
): Promise<SearchResult> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', maxResults.toString());
  url.searchParams.set('order', order);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`YouTube API Error (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const rawItems = data.items || [];
  const videoIds = rawItems.map((item: any) => item.id?.videoId).filter(Boolean);

  let detailsMap: Record<string, any> = {};
  if (videoIds.length > 0) {
    try {
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
      detailsUrl.searchParams.set('id', videoIds.join(','));
      detailsUrl.searchParams.set('key', apiKey);

      const detailsRes = await fetch(detailsUrl.toString());
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        for (const item of detailsData.items || []) {
          detailsMap[item.id] = item;
        }
      }
    } catch {
      // Continue even if enrichment fails
    }
  }

  const items: VideoItem[] = rawItems.map((item: any) => {
    const vid = item.id?.videoId;
    const details = detailsMap[vid];
    const durationParsed = details?.contentDetails?.duration
      ? parseIsoDuration(details.contentDetails.duration)
      : undefined;

    return {
      id: vid,
      title: decodeEntities(item.snippet?.title || ''),
      description: item.snippet?.description || '',
      channelTitle: decodeEntities(item.snippet?.channelTitle || ''),
      channelId: item.snippet?.channelId,
      publishedAt: item.snippet?.publishedAt || '',
      thumbnailUrl:
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      duration: durationParsed?.formatted,
      durationSeconds: durationParsed?.seconds,
      viewCount: details?.statistics?.viewCount
        ? formatCompactNumber(details.statistics.viewCount)
        : undefined,
      likeCount: details?.statistics?.likeCount
        ? formatCompactNumber(details.statistics.likeCount)
        : undefined,
    };
  });

  const seenApiIds = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (!item.id || seenApiIds.has(item.id)) return false;
    seenApiIds.add(item.id);
    return true;
  });

  return {
    items: uniqueItems,
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo?.totalResults,
    source: 'youtube-data-api',
  };
}

// Fallback search using YouTube public Innertube endpoint (for when user has not entered API key yet)
export async function searchWithPublicYoutube(
  query: string,
  continuation?: string
): Promise<SearchResult> {
  const endpoint = 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false';
  const body: any = {
    context: {
      client: {
        hl: 'en',
        gl: 'US',
        clientName: 'WEB',
        clientVersion: '2.20240101.01.00',
      },
    },
  };

  if (continuation) {
    body.continuation = continuation;
  } else {
    body.query = query;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`YouTube public search failed with status ${res.status}`);
  }

  const data = await res.json();
  const items: VideoItem[] = [];
  let nextContinuation: string | null = null;

  try {
    // Dig through YouTube's nested response
    let contents: any[] = [];
    if (!continuation) {
      const sectionList =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      for (const section of sectionList) {
        const itemSection = section.itemSectionRenderer?.contents || [];
        contents.push(...itemSection);
      }
    } else {
      const continuationActions =
        data.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction?.continuationItems || [];
      for (const item of continuationActions) {
        if (item.itemSectionRenderer?.contents) {
          contents.push(...item.itemSectionRenderer.contents);
        } else if (item.continuationItemRenderer) {
          nextContinuation =
            item.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || null;
        }
      }
    }

    for (const entry of contents) {
      if (entry.videoRenderer) {
        const v = entry.videoRenderer;
        const vid = v.videoId;
        if (!vid) continue;

        const title = v.title?.runs?.[0]?.text || '';
        const channelTitle = v.ownerText?.runs?.[0]?.text || '';
        const publishedAt = v.publishedTimeText?.simpleText || '';
        const duration = v.lengthText?.simpleText || '';
        const viewCount = v.viewCountText?.simpleText || '';
        const thumbs = v.thumbnail?.thumbnails || [];
        const thumbUrl = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        const description = v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') || '';

        items.push({
          id: vid,
          title: decodeEntities(title),
          description,
          channelTitle: decodeEntities(channelTitle),
          publishedAt,
          thumbnailUrl: thumbUrl,
          duration,
          viewCount,
        });
      } else if (entry.continuationItemRenderer) {
        nextContinuation =
          entry.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || null;
      }
    }
  } catch (err) {
    console.error('Error parsing YouTube public search:', err);
  }

  // Deduplicate items by ID
  const seenIds = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });

  return {
    items: uniqueItems,
    nextPageToken: nextContinuation,
    source: 'fallback-search',
  };
}

// Fetch single video details (via API or public oEmbed/watch page)
export async function getVideoDetails(videoId: string, apiKey?: string): Promise<VideoItem> {
  if (apiKey) {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,contentDetails,statistics');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      const item = data.items?.[0];
      if (item) {
        const dur = parseIsoDuration(item.contentDetails?.duration);
        return {
          id: videoId,
          title: decodeEntities(item.snippet?.title || ''),
          description: item.snippet?.description || '',
          channelTitle: decodeEntities(item.snippet?.channelTitle || ''),
          channelId: item.snippet?.channelId,
          publishedAt: item.snippet?.publishedAt || '',
          thumbnailUrl:
            item.snippet?.thumbnails?.maxres?.url ||
            item.snippet?.thumbnails?.high?.url ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: dur.formatted,
          durationSeconds: dur.seconds,
          viewCount: formatCompactNumber(item.statistics?.viewCount),
          likeCount: formatCompactNumber(item.statistics?.likeCount),
        };
      }
    }
  }

  // Fallback via oembed
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const oembedRes = await fetch(oembedUrl);
  if (oembedRes.ok) {
    const data = await oembedRes.json();
    return {
      id: videoId,
      title: decodeEntities(data.title || 'YouTube Video'),
      description: '',
      channelTitle: decodeEntities(data.author_name || 'Channel'),
      publishedAt: '',
      thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  return {
    id: videoId,
    title: `Video (${videoId})`,
    description: '',
    channelTitle: '',
    publishedAt: '',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

// Parse WebVTT content into uniform TranscriptSegment format
export function parseVttCues(vttText: string): TranscriptSegment[] {
  const lines = vttText.split(/\r?\n/);
  const segments: TranscriptSegment[] = [];
  let currentStart = 0;
  let currentEnd = 0;
  let currentText: string[] = [];

  const parseVttTime = (timeStr: string) => {
    const parts = timeStr.trim().split(':');
    let s = 0;
    if (parts.length === 3) {
      s = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      s = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return Math.round(s * 1000);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('WEBVTT') || line.startsWith('Kind:') || line.startsWith('Language:')) {
      continue;
    }

    if (line.includes('-->')) {
      if (currentText.length > 0) {
        segments.push({
          offset: currentStart,
          duration: Math.max(500, currentEnd - currentStart),
          text: decodeEntities(currentText.join(' ')).replace(/<[^>]+>/g, '').trim(),
        });
        currentText = [];
      }
      const [startStr, endStr] = line.split('-->');
      currentStart = parseVttTime(startStr);
      currentEnd = parseVttTime(endStr.trim().split(' ')[0]);
    } else {
      const clean = line.replace(/<[^>]+>/g, '').trim();
      if (clean) currentText.push(clean);
    }
  }

  if (currentText.length > 0) {
    segments.push({
      offset: currentStart,
      duration: Math.max(500, currentEnd - currentStart),
      text: decodeEntities(currentText.join(' ')).replace(/<[^>]+>/g, '').trim(),
    });
  }

  return segments;
}

// Extract full transcript using multi-strategy fallback
export async function getFullTranscript(videoId: string, lang: string = 'en'): Promise<TranscriptResult> {
  const cleanId = videoId.trim();

  // Attempt 1: High-reliability signed timedtext pipeline
  try {
    const metaRes = await fetch(`https://youtube-transcript.ai/api/subtitles?v=${cleanId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (metaRes.ok) {
      const meta = await metaRes.json();
      const subs = meta.subtitles || [];
      if (subs.length > 0) {
        const availableLanguages: CaptionTrackInfo[] = subs.map((s: any) => ({
          languageCode: s.langCode || 'en',
          name: s.langName || s.langCode || 'English',
          isAutoGenerated: Boolean(s.isAsr),
        }));

        // Find track matching requested language or fallback to English or first track
        let selectedTrack =
          subs.find((s: any) => s.langCode === lang) ||
          subs.find((s: any) => s.langCode?.startsWith(lang.slice(0, 2))) ||
          subs.find((s: any) => s.langCode === 'en' || s.langCode?.startsWith('en')) ||
          subs[0];

        if (selectedTrack && selectedTrack.vttUrl) {
          const vttRes = await fetch(
            `https://youtube-transcript.ai/api/vtt?url=${encodeURIComponent(selectedTrack.vttUrl)}`,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            }
          );

          if (vttRes.ok) {
            const vttText = await vttRes.text();
            const segments = parseVttCues(vttText);
            if (segments.length > 0) {
              const plainText = segments.map((s) => s.text).join(' ');
              const totalWords = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

              return {
                videoId: cleanId,
                segments,
                availableLanguages,
                selectedLanguage: selectedTrack.langCode || lang,
                totalWords,
                plainText,
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Timedtext pipeline failed, falling back to local scrapers:', err);
  }

  // Attempt 2: Fallback via YoutubeTranscript library
  try {
    const rawSegments = await YoutubeTranscript.fetchTranscript(cleanId, { lang });
    if (rawSegments && rawSegments.length > 0) {
      const segments: TranscriptSegment[] = rawSegments.map((s: any) => ({
        text: decodeEntities(s.text || '').replace(/\s+/g, ' ').trim(),
        offset: typeof s.offset === 'number' ? s.offset : 0,
        duration: typeof s.duration === 'number' ? s.duration : 0,
      }));

      const plainText = segments.map((s) => s.text).join(' ');
      const totalWords = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
      return {
        videoId: cleanId,
        segments,
        availableLanguages: [{ languageCode: lang, name: 'Default Track' }],
        selectedLanguage: lang,
        totalWords,
        plainText,
      };
    }
  } catch (err: any) {
    // Continue to error message
  }

  throw new Error(
    'No transcripts or captions could be retrieved for this video. Captions might be disabled by the creator, or the video contains no spoken audio.'
  );
}
