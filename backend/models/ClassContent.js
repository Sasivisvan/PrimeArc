import mongoose from 'mongoose';

const classContentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    classLevel: { type: Number, required: true },
    uploadedBy: { type: String, required: true },
    tags: [{ type: String }],
    upvotes: { type: Number, default: 0 },
    comments: [{
        user: String,
        text: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('ClassContent', classContentSchema);
