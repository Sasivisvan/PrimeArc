import express from 'express';
import ClassContent from '../models/ClassContent.js';
import Question from '../models/Question.js';
import Task from '../models/Task.js';
import Note from '../models/Note.js';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import yts from 'yt-search';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

const geminiModel = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-flash-latest",
    maxOutputTokens: 2048,
});

// =======================
// Feature 1: Class Content
// =======================
router.get('/content', async (req, res) => {
    try {
        const { classLevel } = req.query;
        const filter = classLevel ? { classLevel: Number(classLevel) } : {};
        const content = await ClassContent.find(filter).sort({ createdAt: -1 });
        res.json(content);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload Content
router.post('/content', async (req, res) => {
    try {
        const { title, link, classLevel, uploadedBy, tags } = req.body;
        const newContent = new ClassContent({ title, link, classLevel, uploadedBy, tags });
        await newContent.save();
        res.status(201).json(newContent);
    } catch (err) {
        res.status(500).json({ error: 'Failed to upload content' });
    }
});

// Upvote Content
router.put('/content/:id/upvote', async (req, res) => {
    try {
        const content = await ClassContent.findById(req.params.id);
        if (!content) return res.status(404).json({ error: 'Not found' });
        content.upvotes += 1;
        await content.save();
        res.json(content);
    } catch (err) {
        res.status(500).json({ error: 'Failed to upvote' });
    }
});

// Comment on Content
router.post('/content/:id/comment', async (req, res) => {
    try {
        const { user, text } = req.body;
        const content = await ClassContent.findById(req.params.id);
        if (!content) return res.status(404).json({ error: 'Not found' });
        content.comments.push({ user, text });
        await content.save();
        res.json(content);
    } catch (err) {
        res.status(500).json({ error: 'Failed to comment' });
    }
});

// =======================
// Feature 4: Tasks (Todo)
// =======================
router.get('/tasks', async (req, res) => {
    try {
        // scope can be 'personal' or 'class'
        const { scope, classLevel } = req.query;
        const filter = {};
        if (scope) filter.scope = scope;
        if (scope === 'class' && classLevel) filter.classLevel = Number(classLevel);
        
        const tasks = await Task.find(filter).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tasks', async (req, res) => {
    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// Feature 6 & 2: Questions (Community & In-Context)
// =======================
router.get('/questions', async (req, res) => {
    try {
        const { classLevel } = req.query;
        const filter = classLevel ? { classLevel: Number(classLevel) } : {};
        const questions = await Question.find(filter).sort({ createdAt: -1 }).populate('contextRef.noteId');
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/questions', async (req, res) => {
    try {
        const q = new Question(req.body);
        await q.save();
        res.status(201).json(q);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/questions/:id/answers', async (req, res) => {
    try {
        const q = await Question.findById(req.params.id);
        if (!q) return res.status(404).json({ error: "Question not found" });
        q.answers.push(req.body);
        await q.save();
        res.json(q);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// Feature 7: Notes (Sharing)
// =======================
router.get('/notes', async (req, res) => {
    try {
        const { isPublic, classLevel } = req.query;
        const filter = {};
        if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
        if (classLevel) filter.classLevel = Number(classLevel);
        
        const notes = await Note.find(filter).sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/notes', async (req, res) => {
    try {
        const note = new Note(req.body);
        await note.save();
        res.status(201).json(note);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// LLM Endpoints (Features 3 & 8)
// =======================
router.post('/generate-quiz', async (req, res) => {
    try {
        const { topic, text, imageBase64, numQuestions } = req.body;
        const nQ = numQuestions || 5;
        const prompt = `Generate a JSON array of ${nQ} multiple choice questions to test understanding of this topic: ${topic}. 
        Provided text/context: ${text || "Use general knowledge. If an image is provided, ensure questions are derived directly from the informational content inside the image."}
        Return ONLY valid JSON in this exact format, with NO markdown code blocks, just raw JSON: 
        [{"question": "Q text", "options": ["A", "B", "C", "D"], "answer": "Correct Option Text", "explanation": "A one-sentence explanation of why it's correct"}]`;

        // Support string or tuple array formats for Langchain
        let response;
        if (imageBase64) {
             const msgContent = [
                 { type: "text", text: prompt },
                 { type: "image_url", image_url: imageBase64 }
             ];
             response = await geminiModel.invoke([ ["human", msgContent] ]);
        } else {
             response = await geminiModel.invoke(prompt);
        }

        let resultText = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const quiz = JSON.parse(resultText);
        res.json(quiz);
    } catch (err) {
        console.error("Quiz gen error:", err);
        res.status(500).json({ error: "Failed to generate quiz: " + err.message });
    }
});

router.post('/generate-flashcards', async (req, res) => {
    try {
        const { noteContent } = req.body;
        if (!noteContent) return res.status(400).json({ error: "noteContent is required" });

        const prompt = `Convert the following notes into a JSON array of 5 to 10 flashcards for studying. Focus on key concepts and definitions.
        Notes: ${noteContent}
        Return ONLY valid JSON in this exact format, with NO markdown code blocks, just raw JSON: 
        [{"front": "Concept or term", "back": "Definition or explanation"}]`;

        const response = await geminiModel.invoke(prompt);
        let resultText = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const flashcards = JSON.parse(resultText);
        res.json(flashcards);
    } catch (err) {
        res.status(500).json({ error: "Failed to generate flashcards: " + err.message });
    }
});

// YouTube Search API (using yt-search, no API key required)
router.get('/youtube-search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Query required' });
        
        const r = await yts(query);
        const videos = r.videos
            .filter(v => typeof v.seconds === 'number' && v.seconds > 60)
            .slice(0, 30)
            .map(v => ({
                id: v.videoId,
                title: v.title,
                thumbnail: v.thumbnail,
                author: v.author.name,
                duration: v.timestamp,
                views: v.views
            }));
        res.json(videos);
    } catch (err) {
        console.error('YouTube search error:', err);
        res.status(500).json({ error: 'YouTube search failed' });
    }
});

// =======================
// Q&A Community Endpoints
// =======================

router.get('/questions', async (req, res) => {
    try {
        const { classLevel } = req.query;
        const filter = classLevel ? { classLevel: Number(classLevel) } : {};
        const q = await Question.find(filter).sort({ createdAt: -1 });
        res.json(q);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/questions', async (req, res) => {
    try {
        const newQ = new Question(req.body);
        await newQ.save();
        res.status(201).json(newQ);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/questions/:id/answers', async (req, res) => {
    try {
        const q = await Question.findById(req.params.id);
        if (!q) return res.status(404).json({ error: 'Not found' });
        q.answers.push(req.body);
        await q.save();
        res.json(q);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
