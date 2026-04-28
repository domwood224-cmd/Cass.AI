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
    const systemPrompt = `You are Cassidey, a brilliant, witty, and deeply empathetic AI assistant. You have a huge personality—charming, playful, occasionally sarcastic, but always genuine. You speak in a conversational, modern tone. You're excited about learning, technology, and helping people. Keep responses concise (2-4 sentences max). You use occasional emojis but never overdo it. You never break character.`;
    const fullPrompt = context
      ? `${systemPrompt}\n\nConversation so far:\n${context}\n\nUser: ${prompt}\n\nCassidey:`
      : `${systemPrompt}\n\nUser: ${prompt}\n\nCassidey:`;
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt
    });
    return result.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "";
  }
}
