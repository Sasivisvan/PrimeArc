import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'ai'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("ChatMessage", ChatMessageSchema);
