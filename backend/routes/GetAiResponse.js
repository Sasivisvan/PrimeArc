import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// 1. Initialize dotenv to ensure process.env is ready
dotenv.config();
// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({});

export async function GetAiResponse(Prompt) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // NOTE: Check if "gemini-3-flash" is valid; "gemini-2.0-flash" is the current standard.
      contents: Prompt,
    });
    console.log(response.text);
    
    // CRITICAL: You must RETURN the text
    return response.text; // Note: In newer SDKs this might be a function call .text()
  } catch (e) {
    console.error(e);
    return "Error generating response.";
  }
}

function ParseResponse(response){
    
}
