import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema({
    body: { type: String, required: true },
    author: { type: String, default: 'Student' },
    upvotes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

const QuestionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    author: { type: String, default: 'Student' },
    classLevel: { type: Number, required: true },
    tags: [{ type: String }],
    upvotes: { type: Number, default: 0 },
    answers: [AnswerSchema],
    // For in-context Q&A highlighting
    contextRef: {
        noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' },
        highlightedText: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Question", QuestionSchema);
