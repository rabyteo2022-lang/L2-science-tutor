import { GoogleGenAI, Type, Schema } from "@google/genai";
import { QuizQuestion, Slide } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = "gemini-2.5-flash"; 

// Helper for exponential backoff
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.message?.includes('429') ||
        error?.message?.includes('quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isRateLimit && attempt < retries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Gemini API Rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${retries})`);
        await wait(delay);
        attempt++;
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries reached");
}

export const generateSummary = async (topicContent: string): Promise<string> => {
  const prompt = `
    You are an expert science teacher. 
    Create comprehensive study notes for the following topic content.
    The notes MUST cover ALL the "Learning Outcomes" listed in the content.
    
    Structure it clearly with:
    1. **Key Learning Outcomes**: A checklist of what the student needs to know.
    2. **Detailed Concepts**: Explain the core theories and facts simply but thoroughly.
    3. **Important Definitions**: Key terms and their scientific definitions.
    4. **Common Pitfalls/Misconceptions**: What students usually get wrong.
    5. **Summary Table**: A quick reference table if applicable.
    
    Topic Content:
    ${topicContent}
  `;

  return withRetry(async () => {
    const response = await genAI.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "Failed to generate summary.";
  });
};

export const generateQuizQuestion = async (
  topicContent: string, 
  previousWrongQuestion?: string,
  quizContext: string[] = []
): Promise<QuizQuestion> => {
  let prompt = `
    Generate a single multiple-choice question (MCQ) based on the following science topic content.
    The question should explicitly test the student's understanding of the "Learning Outcomes".
    Return the result strictly as a JSON object.
    
    Topic Content:
    ${topicContent}
  `;

  if (previousWrongQuestion) {
    prompt += `
      The student previously got this question wrong: "${previousWrongQuestion}".
      Generate a NEW question that tests the same underlying concept/learning outcome but with different phrasing, scenario, or values to help them practice and master the concept.
    `;
  } else if (quizContext.length > 0) {
    prompt += `
      The student has already answered questions related to: ${JSON.stringify(quizContext)}.
      Generate a question that covers a DIFFERENT Learning Outcome or concept from the topic content to ensure the entire chapter is tested. 
      Do not repeat concepts if possible.
    `;
  }

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        minItems: 4,
        maxItems: 4
      },
      correctAnswer: { type: Type.STRING },
      explanation: { type: Type.STRING, description: "Detailed text explanation of why the correct answer is correct and why the others are incorrect." }
    },
    required: ["question", "options", "correctAnswer", "explanation"]
  };

  return withRetry(async () => {
    const response = await genAI.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as QuizQuestion;
    }
    throw new Error("Failed to generate quiz");
  });
};

export const generateLessonSlides = async (topicContent: string): Promise<Slide[]> => {
  const prompt = `
    You are a world-class science educator creating a premium video lesson script.
    Create a comprehensive, in-depth teaching script based on the content below.
    
    CRITICAL REQUIREMENTS:
    1. **Length & Depth**: The lesson must be substantial. Break it down into **12-15 detailed slides**.
    2. **Content**: Do not just summarize. **Teach** the material. Explain *why* and *how*. Provide real-world examples. Break down complex ideas step-by-step. Cover EVERY "Learning Outcome" listed in the text thoroughly.
    3. **Pacing**: Ensure the flow is logical and builds understanding gradually.
    
    For each slide, provide:
    1. 'script': The spoken narration. It should be conversational, engaging, and highly explanatory. It should feel like a real teacher talking to a student, not just reading a textbook. Use simple language to explain hard concepts.
    2. 'visualDescription': A highly specific description for an AI image generator to create a clear, educational diagram. It must illustrate the *exact* concept being discussed in the script. Specify labels, cross-sections, or flowcharts where necessary.
    
    Topic Content:
    ${topicContent}
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        script: { type: Type.STRING },
        visualDescription: { type: Type.STRING }
      },
      required: ["script", "visualDescription"]
    }
  };

  return withRetry(async () => {
    const response = await genAI.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Slide[];
    }
    return [];
  });
};

export const generateSlideImage = async (visualDescription: string): Promise<string> => {
  // Use gemini-2.5-flash-image for generation as per instructions for "General Image Generation"
  // Enhanced prompt to ensure explanatory nature of the image
  const prompt = `Create a clear, high-quality, educational, textbook-style diagram or illustration for a science lesson: ${visualDescription}. The image should be explanatory, showing labels, processes, or structures clearly. White background, clear lines, high contrast, photorealistic or clean vector style.`;
  
  const generate = async () => {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      // Note: responseMimeType is not supported for nano banana series models, so we do not set it.
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data returned");
  };

  try {
    // Retry up to 2 times for images with 2s initial delay
    return await withRetry(generate, 2, 2000);
  } catch (e) {
    console.warn("Image gen failed after retries, falling back to placeholder");
    return `https://picsum.photos/seed/${encodeURIComponent(visualDescription.substring(0, 20))}/1280/720`; 
  }
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer | null> => {
  const generate = async () => {
    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text }] },
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Aoede' }
                }
            }
        }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    throw new Error("No audio data returned");
  };

  try {
    // Retry up to 2 times for audio with 2s initial delay
    return await withRetry(generate, 2, 2000);
  } catch (e) {
    console.error("Speech gen failed after retries", e);
    return null;
  }
}