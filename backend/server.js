import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import http from "http";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import ChatMessage from "./models/ChatMessage.js";
import ChatState from "./models/ChatState.js";
import Task from "./models/Task.js";

import { CreateUser, GetAllUsers } from "./controllers/UserController.js";

// Initialize dotenv
dotenv.config();

// Initialize App
const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// Middleware
// Expose PDF.js range-related headers so the browser can read them when fetching via proxy.
app.use(cors({
    origin: true,
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

import apiRoutes from "./routes/api.js";
app.use("/api", apiRoutes);

// Basic Route
app.get("/api", (req, res) => {
    res.json({ status: "Backend is running!", models: ["gemini-flash-latest", "ollama/qwen2.5:7b"] });
});

app.get("/api/test", (req, res) => {
    res.send("This is a test");
});

app.get("/api/addme", (req, res) => {
    try {
        CreateUser(req,res);
    } catch(e) {
        console.log(e);
    }
});

// Database Connection (optional — Gemini chat works without it)
export const connectDB = async () => {
    try {
        if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
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

// Initialize Gemini model lazily (not per-file load)
let _geminiModel = null;
function getGeminiModel() {
    if (!_geminiModel) {
        _geminiModel = new ChatGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY,
            model: "gemini-flash-latest",
            maxOutputTokens: 2048,
        });
    }
    return _geminiModel;
}

function normalizeClassLevelValue(classLevel) {
    if (classLevel === undefined || classLevel === null || classLevel === '') return undefined;
    const num = Number(classLevel);
    return Number.isNaN(num) ? classLevel : num;
}

async function buildTaskContext(chatUser, classLevel) {
    if (mongoose.connection.readyState !== 1 || !chatUser || chatUser === 'anonymous') return '';

    const normalizedClassLevel = normalizeClassLevelValue(classLevel);
    const filter = normalizedClassLevel !== undefined
        ? {
            $or: [
                { scope: 'personal', createdBy: chatUser },
                { scope: 'class', classLevel: normalizedClassLevel }
            ]
        }
        : { scope: 'personal', createdBy: chatUser };

    const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean();
    if (!tasks.length) return '';

    const lines = tasks.map((task, index) => {
        const dueDate = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : 'None';
        const createdAt = task.createdAt ? new Date(task.createdAt).toISOString().slice(0, 10) : 'Unknown';
        return [
            `${index + 1}. ${task.title}`,
            `scope=${task.scope}`,
            `status=${task.completed ? 'completed' : 'active'}`,
            `priority=${task.priority || 'Medium'}`,
            `dueDate=${dueDate}`,
            `createdBy=${task.createdBy || 'Unknown'}`,
            `createdAt=${createdAt}`,
            `description=${task.description || 'None'}`
        ].join(' | ');
    });

    return `USER TASKS:\n${lines.join('\n')}`;
}

// POST /api/chat - Send a message
app.post("/api/chat", async (req, res) => {
    try {
        const { message, history = [], user, classLevel } = req.body;
        const chatUser = typeof user === 'string' && user.trim() ? user.trim() : 'anonymous';
        
        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        // Save user message to DB if connected
        if (mongoose.connection.readyState === 1) {
            const userMsg = new ChatMessage({ role: 'user', content: message, user: chatUser });
            await userMsg.save();
        }

        // Format conversation history for LangChain
        const formattedHistory = history
            .slice(-10) // Only use last 10 messages for performance
            .map(msg => [msg.role === 'user' ? 'human' : 'ai', msg.content]);

        const taskContext = await buildTaskContext(chatUser, classLevel);
        const systemPrompt = `You are PrimeArc AI — a highly intelligent, friendly assistant. Be clear, concise, and helpful.
${taskContext ? `
You have access to the user's task list and metadata. When the user asks about their tasks, answer using that task data first.
If task information is missing from the provided task list, say so plainly instead of inventing details.

${taskContext}` : ''}`;

        const response = await getGeminiModel().invoke([
            ["system", systemPrompt],
            ...formattedHistory,
            ["human", message]
        ]);

        // Save AI message to DB if connected
        if (mongoose.connection.readyState === 1) {
            const aiMsg = new ChatMessage({ role: 'ai', content: response.content, user: chatUser });
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
    const { message, history = [], user, classLevel } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message cannot be empty" });
    }

    Promise.resolve()
        .then(async () => {
            const chatUser = typeof user === 'string' && user.trim() ? user.trim() : 'anonymous';
            const taskContext = await buildTaskContext(chatUser, classLevel);
            const systemPrompt = `You are PrimeArc AI — a highly intelligent, friendly assistant. Be clear, concise, and helpful.
${taskContext ? `
You have access to the user's task list and metadata. When the user asks about their tasks, answer using that task data first.
If task information is missing from the provided task list, say so plainly instead of inventing details.

${taskContext}` : ''}`;

            const messages = [
                { role: "system", content: systemPrompt },
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
                    res.write(JSON.stringify({ error: "Ollama disconnected unexpectedly" }) + "\n");
                    res.end();
                }
            });

            ollamaReq.write(body);
            ollamaReq.end();
        })
        .catch((err) => {
            console.error("Error in /api/ollama/chat:", err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to prepare task-aware chat context." });
            } else {
                res.write(JSON.stringify({ error: "Failed to prepare task-aware chat context." }) + "\n");
                res.end();
            }
        });
});

// GET /api/chat-history - Load previous messages
app.get("/api/chat-history", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json([]); // Return empty array if no DB
        }
        const reqUser = typeof req.query.user === 'string' && req.query.user.trim() ? req.query.user.trim() : 'anonymous';
        const history = await ChatMessage.find({ user: reqUser }).sort({ timestamp: 1 }).limit(100);
        res.json(history);
    } catch (error) {
        console.error("Error in /chat-history:", error.message);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
});

// GET /api/chat-state - Load saved multi-chat state for a user
app.get("/api/chat-state", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json(null);
        }
        const reqUser = typeof req.query.user === 'string' && req.query.user.trim() ? req.query.user.trim() : 'anonymous';
        const state = await ChatState.findOne({ user: reqUser }).lean();
        res.json(state || null);
    } catch (error) {
        console.error("Error in /chat-state GET:", error.message);
        res.status(500).json({ error: "Failed to fetch saved chat state" });
    }
});

// PUT /api/chat-state - Persist multi-chat state for a user
app.put("/api/chat-state", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: "Database unavailable" });
        }

        const { user, activeChatId, chats } = req.body;
        const chatUser = typeof user === 'string' && user.trim() ? user.trim() : 'anonymous';

        if (!activeChatId || !Array.isArray(chats)) {
            return res.status(400).json({ error: "activeChatId and chats are required" });
        }

        const sanitizedChats = chats.slice(0, 25).map((chat) => ({
            id: String(chat.id || ''),
            title: String(chat.title || 'New Chat'),
            model: chat.model === 'ollama' ? 'ollama' : 'gemini',
            createdAt: Number(chat.createdAt || Date.now()),
            updatedAt: Number(chat.updatedAt || Date.now()),
            messages: Array.isArray(chat.messages)
                ? chat.messages.slice(-100).map((msg) => ({
                    role: msg.role === 'user' ? 'user' : 'ai',
                    content: String(msg.content || ''),
                    timestamp: Number(msg.timestamp || Date.now()),
                }))
                : [],
        })).filter((chat) => chat.id);

        const state = await ChatState.findOneAndUpdate(
            { user: chatUser },
            { user: chatUser, activeChatId, chats: sanitizedChats },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json({ ok: true, updatedAt: state.updatedAt });
    } catch (error) {
        console.error("Error in /chat-state PUT:", error.message);
        res.status(500).json({ error: "Failed to save chat state" });
    }
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`\n✅ PrimeArc Backend running on http://localhost:${PORT}`);
        console.log("   Model: gemini-flash-latest");
        console.log("   Press Ctrl+C to stop\n");
    });
}

export default app;
