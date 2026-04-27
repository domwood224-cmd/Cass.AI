import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function chatWithCassidey(prompt: string, context: string = "") {
  try {
    const ai = getGenAI();
    const fullPrompt = `Context: ${context}\n\nUser: ${prompt}\n\nCassidey:`;
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt
    });
    return result.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm having trouble processing that right now. My local learning engine is still active, however. (Note: Ensure GEMINI_API_KEY is set in Secrets)";
  }
}
