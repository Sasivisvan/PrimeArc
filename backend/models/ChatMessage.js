import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'ai'], required: true },
    content: { type: String, required: true },
    user: { type: String, default: 'anonymous' },
    timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("ChatMessage", ChatMessageSchema);
