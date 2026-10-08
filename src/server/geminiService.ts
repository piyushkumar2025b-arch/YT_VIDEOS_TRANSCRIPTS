import { GoogleGenAI } from '@google/genai';

export async function processTranscriptWithAi(
  transcriptText: string,
  videoTitle: string,
  mode: 'summary' | 'chapters' | 'takeaways' | 'qa',
  question?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }

  const ai = new GoogleGenAI({});

  // Limit transcript length if gigantic to avoid token overflow
  const truncatedTranscript = transcriptText.slice(0, 40000);

  let systemPrompt = '';
  let prompt = '';

  if (mode === 'summary') {
    systemPrompt =
      'You are an expert executive transcription analyst. Provide a well-structured, clear, and comprehensive summary of the YouTube video transcript.';
    prompt = `Video Title: "${videoTitle}"\n\nTranscript Content:\n${truncatedTranscript}\n\nPlease generate:\n1. **Executive Overview** (2-3 crisp paragraphs summarizing the core message).\n2. **Key Concepts & Findings** (bullet points).\n3. **Conclusion & Impact**.`;
  } else if (mode === 'chapters') {
    systemPrompt =
      'You are an expert video editor. Identify logical narrative chapters and timestamps from the video transcript.';
    prompt = `Video Title: "${videoTitle}"\n\nTranscript Content:\n${truncatedTranscript}\n\nPlease generate a clean list of chronological chapters with a title and brief 1-2 sentence description for each section.`;
  } else if (mode === 'takeaways') {
    systemPrompt =
      'You are an action-oriented executive synthesizer. Extract high-impact actionable takeaways, memorable quotes, and practical steps from this video.';
    prompt = `Video Title: "${videoTitle}"\n\nTranscript Content:\n${truncatedTranscript}\n\nPlease output the top actionable lessons, memorable insights, and quotes.`;
  } else if (mode === 'qa') {
    systemPrompt =
      'You are a knowledgeable assistant answering questions strictly based on the provided video transcript.';
    prompt = `Video Title: "${videoTitle}"\n\nUser Question: ${question || 'What is this video mainly about?'}\n\nTranscript Content:\n${truncatedTranscript}\n\nAnswer accurately and concisely based on the transcript.`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `${systemPrompt}\n\n${prompt}`,
  });

  return response.text || 'No response generated.';
}
