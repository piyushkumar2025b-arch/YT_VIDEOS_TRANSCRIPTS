import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  searchWithYoutubeApi,
  searchWithPublicYoutube,
  getVideoDetails,
  getFullTranscript,
} from './src/server/youtubeService.ts';
import { processTranscriptWithAi } from './src/server/geminiService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Helper to extract YouTube API key from request
  const getApiKey = (req: express.Request): string | undefined => {
    const headerKey = req.headers['x-youtube-api-key'] as string | undefined;
    const queryKey = req.query.apiKey as string | undefined;
    return headerKey?.trim() || queryKey?.trim() || process.env.YOUTUBE_API_KEY?.trim() || undefined;
  };

  // Status check endpoint
  app.get('/api/status', (req, res) => {
    res.json({
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasServerYoutubeKey: Boolean(process.env.YOUTUBE_API_KEY),
    });
  });

  // Search videos endpoint (supports infinite pagination)
  app.get('/api/search', async (req, res) => {
    try {
      const q = ((req.query.q as string) || '').trim();
      const pageToken = (req.query.pageToken as string) || undefined;
      const order = (req.query.order as string) || 'relevance';
      const apiKey = getApiKey(req);

      if (!q) {
        return res.status(400).json({ error: 'Search query "q" is required.' });
      }

      let result;
      if (apiKey) {
        try {
          result = await searchWithYoutubeApi(q, apiKey, pageToken, order);
        } catch (apiErr: any) {
          console.warn('YouTube API call failed, falling back to public search:', apiErr.message);
          // If quota exceeded or bad key, notify user clearly
          if (apiErr.message?.includes('quotaExceeded') || apiErr.message?.includes('API_KEY_INVALID')) {
            return res.status(400).json({
              error: apiErr.message,
              needsFallback: true,
            });
          }
          result = await searchWithPublicYoutube(q, pageToken);
        }
      } else {
        result = await searchWithPublicYoutube(q, pageToken);
      }

      res.json(result);
    } catch (err: any) {
      console.error('Search endpoint error:', err);
      res.status(500).json({ error: err.message || 'Failed to search videos' });
    }
  });

  // Get video details
  app.get('/api/video/:id', async (req, res) => {
    try {
      const videoId = req.params.id;
      const apiKey = getApiKey(req);
      const details = await getVideoDetails(videoId, apiKey);
      res.json(details);
    } catch (err: any) {
      console.error('Video details error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch video details' });
    }
  });

  // Get video transcript
  app.get('/api/transcript', async (req, res) => {
    try {
      const videoId = ((req.query.videoId as string) || '').trim();
      const lang = ((req.query.lang as string) || 'en').trim();

      if (!videoId) {
        return res.status(400).json({ error: 'Parameter "videoId" is required.' });
      }

      const transcript = await getFullTranscript(videoId, lang);
      res.json(transcript);
    } catch (err: any) {
      console.error('Transcript error:', err);
      res.status(404).json({
        error:
          err.message ||
          'Could not retrieve transcript. This video may not have captions enabled or may be restricted.',
      });
    }
  });

  // Process transcript with Gemini
  app.post('/api/ai/analyze', async (req, res) => {
    try {
      const { transcriptText, videoTitle, mode, question } = req.body;
      if (!transcriptText) {
        return res.status(400).json({ error: 'transcriptText is required' });
      }
      const response = await processTranscriptWithAi(
        transcriptText,
        videoTitle || 'YouTube Video',
        mode || 'summary',
        question
      );
      res.json({ result: response });
    } catch (err: any) {
      console.error('AI analyze error:', err);
      res.status(500).json({ error: err.message || 'Failed to process transcript with AI' });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
