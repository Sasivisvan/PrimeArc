import mongoose from "mongoose";

const ChatEntrySchema = new mongoose.Schema({
    role: { type: String, enum: ["user", "ai"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Number, default: Date.now },
}, { _id: false });

const ChatSessionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, default: "New Chat" },
    model: { type: String, enum: ["gemini", "ollama"], default: "gemini" },
    createdAt: { type: Number, required: true },
    updatedAt: { type: Number, required: true },
    messages: { type: [ChatEntrySchema], default: [] },
}, { _id: false });

const ChatStateSchema = new mongoose.Schema({
    user: { type: String, required: true, unique: true, index: true },
    activeChatId: { type: String, required: true },
    chats: { type: [ChatSessionSchema], default: [] },
}, { timestamps: true });

export default mongoose.model("ChatState", ChatStateSchema);
