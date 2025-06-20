import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export const extractLocationFromText = async (text) => {
  const prompt = `From the following text, extract only the most specific physical location name (like "Manhattan, NYC" or "Downtown Los Angeles"). If no location is found, respond with "N/A". Text: "${text}"`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const location = response.text().trim();
    return location === 'N/A' ? null : location;
  } catch (error) {
    console.error('Error with Gemini API:', error);
    return null;
  }
};

export const verifyImageWithGemini = async (imageUrl) => {
    // Note: Gemini Vision API with remote URLs is more complex.
    // This is a simplified text-based "verification" for demonstration.
    // A real implementation would need to fetch the image data first.
    const prompt = `Analyze this description of an image and determine if it seems authentic for a disaster scenario. Image source: ${imageUrl}. Provide a brief analysis and a conclusion of "likely authentic", "likely manipulated", or "inconclusive".`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('Error with Gemini Vision API:', error);
        return 'Verification failed due to an API error.';
    }
}