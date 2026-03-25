import mongoose from 'mongoose';

const classContentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    classLevel: { type: mongoose.Schema.Types.Mixed, required: true },
    uploadedBy: { type: String, required: true },
    tags: [{ type: String }],
    upvotes: { type: Number, default: 0 },
    comments: [{
        user: String,
        text: String,
        page: Number,
        createdAt: { type: Date, default: Date.now },
        replies: [{
            user: String,
            text: String,
            createdAt: { type: Date, default: Date.now }
        }]
    }],
    studyProgress: [{
        user: { type: String, required: true },
        pages: [{ type: Number }],
        updatedAt: { type: Date, default: Date.now }
    }],
    extractedText: [{
        page: Number,
        content: String
    }],
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('ClassContent', classContentSchema);
