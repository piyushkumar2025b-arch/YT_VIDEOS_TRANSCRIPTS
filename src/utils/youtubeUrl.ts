// Extracts video ID from YouTube URLs or checks if already a valid 11-char ID
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Direct video ID (e.g. dQw4w9WgXcQ)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Standard youtube.com/watch?v=...
  const watchMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (watchMatch && watchMatch[1]) {
    return watchMatch[1];
  }

  // Shorts url e.g. youtube.com/shorts/...
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([^"&?\/\s]{11})/);
  if (shortsMatch && shortsMatch[1]) {
    return shortsMatch[1];
  }

  // Live url e.g. youtube.com/live/...
  const liveMatch = trimmed.match(/youtube\.com\/live\/([^"&?\/\s]{11})/);
  if (liveMatch && liveMatch[1]) {
    return liveMatch[1];
  }

  return null;
}
