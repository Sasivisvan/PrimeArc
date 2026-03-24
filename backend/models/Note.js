import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, default: 'Student' },
    classLevel: { type: mongoose.Schema.Types.Mixed },
    isPublic: { type: Boolean, default: false }, // For sharing with others
    files: [{
        name: String,
        type: { type: String }, // MIME type
        size: Number,
        dataUrl: String
    }],
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Note", NoteSchema);
