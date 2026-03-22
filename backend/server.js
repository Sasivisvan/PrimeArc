import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import http from "http";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import ChatMessage from "./models/ChatMessage.js";

import { CreateUser, GetAllUsers } from "./controllers/UserController.js";
import {GetAiResponse} from "./routes/GetAiResponse.js";

// Initialize dotenv
dotenv.config();

// Initialize App
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

import apiRoutes from "./routes/api.js";
app.use("/api", apiRoutes);

// Basic Route
app.get("/", (req, res) => {
    res.json({ status: "Backend is running!", models: ["gemini-flash-latest", "ollama/qwen2.5:7b"] });
});

app.post("/airesponse", async(req, res) => {
    const response = await GetAiResponse(req.body.message);
    console.log(response);
    res.json({ reply: response });
});

app.get("/test", (req, res) => {
    res.send("This is a test");
});

app.get("/addme", (req, res) => {
    try {
        CreateUser(req,res);
    } catch(e) {
        console.log(e);
    }
});

// Database Connection (optional — Gemini chat works without it)
const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || '';
        // Detect common placeholder patterns like <PrimeArc> or <db_password>
        if (!uri || uri.includes('<')) {
            console.log("MongoDB: ⚠️  MONGO_URI has a placeholder password (e.g. <PrimeArc>).");
            console.log("         → Go to MongoDB Atlas → Database Access → edit user → set real password");
            console.log("         → Replace the <PrimeArc> part in your .env with that password");
            console.log("         → Chat still works without MongoDB (history won't persist to DB)");
            return;
        }
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log("MongoDB: ✅ Connected!");
    } catch (err) {
        const msg = err.message || '';
        if (msg.includes('auth') || msg.includes('Authentication')) {
            console.log("MongoDB: ❌ Wrong password — update MONGO_URI password in backend/.env");
            console.log("         → Atlas → Database Access → edit user → copy password → paste in .env");
        } else if (msg.includes('whitelist') || msg.includes('IP')) {
            console.log("MongoDB: ❌ IP not whitelisted → Atlas → Network Access → Add 0.0.0.0/0");
        } else {
            console.log("MongoDB: Connection failed (chat still works):", msg);
        }
    }
};
connectDB();

// Keep event loop alive so Node.js doesn't exit without a DB connection
const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

// Initialize Gemini model once (not per-request)
const geminiModel = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-flash-latest",
    maxOutputTokens: 2048,
});

// POST /chat - Send a message
app.post("/chat", async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        // Save user message to DB if connected
        if (mongoose.connection.readyState === 1) {
            const userMsg = new ChatMessage({ role: 'user', content: message });
            await userMsg.save();
        }

        // Format conversation history for LangChain
        const formattedHistory = history
            .slice(-10) // Only use last 10 messages for performance
            .map(msg => [msg.role === 'user' ? 'human' : 'ai', msg.content]);

        const response = await geminiModel.invoke([
            ["system", "You are PrimeArc AI — a highly intelligent, friendly assistant. Be clear, concise, and helpful."],
            ...formattedHistory,
            ["human", message]
        ]);

        // Save AI message to DB if connected
        if (mongoose.connection.readyState === 1) {
            const aiMsg = new ChatMessage({ role: 'ai', content: response.content });
            await aiMsg.save();
        }

        res.json({ reply: response.content });
    } catch (error) {
        console.error("Error in /chat:", error.message);
        if (error.status === 429) {
            res.status(429).json({ error: "Rate limit hit. Please wait a moment and try again." });
        } else {
            res.status(500).json({ error: "Failed to get a response. Check API key and model availability." });
        }
    }
});

// POST /api/ollama/chat — real-time streaming from local Ollama server
app.post("/api/ollama/chat", (req, res) => {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message cannot be empty" });
    }

    // Build messages array in Ollama format
    const messages = [
        { role: "system", content: "You are PrimeArc AI — a highly intelligent, friendly assistant. Be clear, concise, and helpful." },
        ...history.slice(-10).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
        { role: "user", content: message.trim() }
    ];

    const body = JSON.stringify({
        model: "qwen2.5:7b",
        messages,
        stream: true
    });

    const options = {
        hostname: "localhost",
        port: 11434,
        path: "/api/chat",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
        }
    };

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();

    const ollamaReq = http.request(options, (ollamaRes) => {
        ollamaRes.on("data", (chunk) => {
            res.write(chunk);
        });
        ollamaRes.on("end", () => {
            res.end();
        });
    });

    ollamaReq.on("error", (err) => {
        console.error("Ollama connection error:", err.message);
        if (!res.headersSent) {
            res.status(503).json({ error: "Ollama server is not running. Start it with: ollama serve" });
        } else {
            // Stream already started — send a final error chunk
            res.write(JSON.stringify({ error: "Ollama disconnected unexpectedly" }) + "\n");
            res.end();
        }
    });

    ollamaReq.write(body);
    ollamaReq.end();
});

// GET /chat-history - Load previous messages
app.get("/chat-history", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json([]); // Return empty array if no DB
        }
        const history = await ChatMessage.find().sort({ timestamp: 1 }).limit(100);
        res.json(history);
    } catch (error) {
        console.error("Error in /chat-history:", error.message);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n✅ PrimeArc Backend running on http://localhost:${PORT}`);
    console.log("   Model: gemini-flash-latest");
    console.log("   Press Ctrl+C to stop\n");
});
