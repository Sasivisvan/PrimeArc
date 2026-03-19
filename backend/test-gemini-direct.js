import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
dotenv.config();

async function testGemini() {
  console.log("Starting Gemini test...");
  try {
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-flash-latest",
      maxOutputTokens: 2048,
    });

    console.log("Calling model.invoke...");
    const response = await model.invoke([
      ["human", "Hello! Are you there?"]
    ]);
    console.log("Response:", response.content);
  } catch (error) {
    console.error("Gemini call failed:");
    console.error("- Message:", error.message);
    if (error.status) console.error("- Status:", error.status);
  }
}

testGemini();
