import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ type: String }],
    answer: { type: String, required: true },
    explanation: { type: String, required: true }
});

const quizSchema = new mongoose.Schema({
    user: { type: String, required: true },
    documentId: { type: String, required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, required: true },
    questions: [questionSchema],
    bestScore: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 }
}, {timestamps: true});

export default mongoose.model("Quiz", quizSchema);
