import mongoose from "mongoose";

const FlashcardSetSchema = new mongoose.Schema({
    user: { type: String, required: true },
    documentId: { type: String }, // Optional, can be empty for custom quizzes/flashcards
    topic: { type: String, required: true },
    cards: [{
        front: { type: String, required: true },
        back: { type: String, required: true }
    }]
}, {
    timestamps: true,
});

export default mongoose.model("FlashcardSet", FlashcardSetSchema);
