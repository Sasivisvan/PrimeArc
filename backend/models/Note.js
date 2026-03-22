import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, default: 'Student' },
    classLevel: { type: Number },
    isPublic: { type: Boolean, default: false }, // For sharing with others
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Note", NoteSchema);
