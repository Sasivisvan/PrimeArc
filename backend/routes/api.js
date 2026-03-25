import express from 'express';
import ClassContent from '../models/ClassContent.js';
import Question from '../models/Question.js';
import Task from '../models/Task.js';
import Note from '../models/Note.js';
import Quiz from '../models/Quiz.js';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import yts from 'yt-search';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { randomBytes } from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
dotenv.config();

const router = express.Router();

const CONTENT_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'content');
fs.mkdirSync(CONTENT_UPLOAD_DIR, { recursive: true });
const contentPdfStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CONTENT_UPLOAD_DIR),
    filename: (_req, _file, cb) => cb(null, `${randomBytes(16).toString('hex')}.pdf`),
});
const uploadContentPdf = multer({
    storage: contentPdfStorage,
    limits: { fileSize: 35 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
        cb(ok ? null : new Error('Only PDF files are allowed'), ok);
    },
});

const geminiModel = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    maxOutputTokens: 2048,
});

function normalizeClassLevelValue(classLevel) {
    if (classLevel === undefined || classLevel === null || classLevel === '') return undefined;
    const num = Number(classLevel);
    return Number.isNaN(num) ? classLevel : num;
}

function canonicalContentFilePath(linkOrName) {
    const match = `${linkOrName || ''}`.match(/\/api\/content-files\/([a-f0-9]{32}\.pdf)/i)
        || `${linkOrName || ''}`.match(/^([a-f0-9]{32}\.pdf)$/i);
    return match ? `/api/content-files/${match[1]}` : null;
}

// =======================
// Feature 1: Class Content
// =======================
router.get('/content', async (req, res) => {
    try {
        const { classLevel } = req.query;
        let filter = {};
        if (classLevel) {
            const num = Number(classLevel);
            filter.classLevel = isNaN(num) ? classLevel : num;
        }
        const content = await ClassContent.find(filter).sort({ createdAt: -1 }).lean();
        const normalizedContent = content.map((item) => {
            const canonicalLink = canonicalContentFilePath(item.link);
            return canonicalLink ? { ...item, link: canonicalLink } : item;
        });
        res.json(normalizedContent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper: Extract text from PDF link
async function extractPdfText(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const data = await pdf(response.data);
        // Basic split by page if possible, pdf-parse doesn't do perfect page splitting by default
        // But we can join and simulate or use a more advanced strategy if needed
        // For now, let's just store the full text as page 1 for simplicity, 
        // OR try to use a more granular approach if we have one.
        // Actually, we can just save it as a single chunk if we don't have page markers.
        return [{ page: 1, content: data.text }];
    } catch (err) {
        console.error("PDF Extraction error:", err);
        return [];
    }
}

// Upload Content
router.post('/content', async (req, res) => {
    try {
        const { title, link, classLevel, uploadedBy, tags } = req.body;
        
        let extractedText = [];
        if (link && link.toLowerCase().endsWith('.pdf')) {
            extractedText = await extractPdfText(link);
        }

        const newContent = new ClassContent({ title, link, classLevel, uploadedBy, tags, extractedText });
        await newContent.save();
        res.status(201).json(newContent);
    } catch (err) {
        console.error("Upload error:", err.message);
        res.status(500).json({ error: 'Failed to upload content', details: err.message });
    }
});

router.post('/content/upload', (req, res, next) => {
    uploadContentPdf.single('file')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'PDF file required' });

        const { title, classLevel, uploadedBy, tags: tagsRaw } = req.body;
        if (!title || classLevel === undefined || classLevel === '') {
            if (req.file.path) fs.unlink(req.file.path, () => {});
            return res.status(400).json({ error: 'title and classLevel are required' });
        }

        let tags = [];
        if (tagsRaw) {
            try {
                tags = typeof tagsRaw === 'string' ? JSON.parse(tagsRaw) : tagsRaw;
                if (!Array.isArray(tags)) tags = [];
            } catch {
                tags = [];
            }
        }

        const link = `/api/content-files/${req.file.filename}`;

        let extractedText = [];
        try {
            const buf = await fs.promises.readFile(req.file.path);
            const data = await pdf(buf);
            extractedText = [{ page: 1, content: data.text }];
        } catch (e) {
            console.error('PDF extraction (upload):', e.message);
        }

        const newContent = new ClassContent({
            title,
            link,
            classLevel,
            uploadedBy: uploadedBy || 'anonymous',
            tags,
            extractedText,
        });
        await newContent.save();
        res.status(201).json(newContent);
    } catch (err) {
        console.error('content/upload:', err.message);
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: 'Failed to save uploaded content', details: err.message });
    }
});

router.get('/content-files/:name', (req, res) => {
    const name = req.params.name;
    if (!/^[a-f0-9]{32}\.pdf$/i.test(name)) {
        return res.status(400).send('Invalid file');
    }
    const filePath = path.join(CONTENT_UPLOAD_DIR, name);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    res.sendFile(path.resolve(filePath), (err) => {
        if (err && !res.headersSent) res.status(404).send('Not found');
    });
});

// Delete Content
router.delete('/content/:id', async (req, res) => {
    try {
        const content = await ClassContent.findById(req.params.id);
        if (!content) return res.status(404).json({ error: 'Not found' });

        const m = content.link && content.link.match(/\/api\/content-files\/([a-f0-9]{32}\.pdf)/i);
        if (m) {
            const fp = path.join(CONTENT_UPLOAD_DIR, m[1]);
            fs.unlink(fp, () => {});
        }

        await ClassContent.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete content' });
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
        const { user, text, page } = req.body;
        const content = await ClassContent.findById(req.params.id);
        if (!content) return res.status(404).json({ error: 'Not found' });
        content.comments.push({ user, text, page });
        await content.save();
        res.json(content);
    } catch (err) {
        res.status(500).json({ error: 'Failed to comment' });
    }
});

router.put('/content/:id/study-progress', async (req, res) => {
    try {
        const { user, pages } = req.body;
        const normalizedUser = typeof user === 'string' && user.trim() ? user.trim() : '';
        if (!normalizedUser) return res.status(400).json({ error: 'user is required' });
        if (!Array.isArray(pages)) return res.status(400).json({ error: 'pages must be an array' });

        const content = await ClassContent.findById(req.params.id);
        if (!content) return res.status(404).json({ error: 'Not found' });

        const normalizedPages = [...new Set(
            pages
                .map((page) => Number(page))
                .filter((page) => Number.isInteger(page) && page > 0)
        )].sort((a, b) => a - b);

        const existingProgress = content.studyProgress.find((entry) => entry.user === normalizedUser);
        if (existingProgress) {
            existingProgress.pages = normalizedPages;
            existingProgress.updatedAt = new Date();
        } else {
            content.studyProgress.push({
                user: normalizedUser,
                pages: normalizedPages,
                updatedAt: new Date()
            });
        }

        await content.save();
        res.json({
            ok: true,
            studyProgress: content.studyProgress.find((entry) => entry.user === normalizedUser)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save study progress', details: err.message });
    }
});

// =======================
// Feature 4: Tasks (Todo)
// =======================
router.get('/tasks', async (req, res) => {
    try {
        // scope can be 'personal' or 'class'
        const { scope, classLevel, username } = req.query;
        let filter = {};
        const normalizedClassLevel = normalizeClassLevelValue(classLevel);
        if (scope) {
            filter.scope = scope;
            if (scope === 'class' && normalizedClassLevel !== undefined) filter.classLevel = normalizedClassLevel;
            if (scope === 'personal' && username) filter.createdBy = username;
        } else {
            if (normalizedClassLevel !== undefined && username) {
                filter = {
                    $or: [
                        { scope: 'class', classLevel: normalizedClassLevel },
                        { scope: 'personal', createdBy: username }
                    ]
                };
            } else if (normalizedClassLevel !== undefined) {
                filter.classLevel = normalizedClassLevel;
                filter.scope = 'class';
            }
        }
        
        const normalizedUser = typeof username === 'string' && username.trim() ? username.trim() : '';
        const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean();
        const resolvedTasks = tasks.map((task) => {
            if (task.scope !== 'class') return task;
            const completedBy = Array.isArray(task.completedBy) ? task.completedBy : [];
            return {
                ...task,
                completed: normalizedUser ? completedBy.includes(normalizedUser) : false
            };
        });
        res.json(resolvedTasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tasks', async (req, res) => {
    try {
        const payload = { ...req.body };
        if (payload.scope === 'class') {
            payload.classLevel = normalizeClassLevelValue(payload.classLevel);
            payload.completed = false;
            payload.completedBy = [];
        }
        const task = new Task(payload);
        await task.save();
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        if (task.scope === 'class' && Object.prototype.hasOwnProperty.call(req.body, 'completed')) {
            const normalizedUser = typeof req.body.username === 'string' && req.body.username.trim()
                ? req.body.username.trim()
                : '';
            if (!normalizedUser) {
                return res.status(400).json({ error: 'username is required to update class task completion' });
            }

            const completedBy = new Set(Array.isArray(task.completedBy) ? task.completedBy : []);
            if (req.body.completed) {
                completedBy.add(normalizedUser);
            } else {
                completedBy.delete(normalizedUser);
            }
            task.completedBy = Array.from(completedBy);
        } else {
            if (Object.prototype.hasOwnProperty.call(req.body, 'completed')) {
                task.completed = !!req.body.completed;
            }
        }

        if (typeof req.body.title === 'string') task.title = req.body.title;
        if (typeof req.body.description === 'string') task.description = req.body.description;
        if (typeof req.body.priority === 'string') task.priority = req.body.priority;
        if (Object.prototype.hasOwnProperty.call(req.body, 'dueDate')) {
            task.dueDate = req.body.dueDate || undefined;
        }
        await task.save();

        const normalizedUser = typeof req.body.username === 'string' && req.body.username.trim()
            ? req.body.username.trim()
            : '';
        const responseTask = task.toObject();
        if (responseTask.scope === 'class') {
            responseTask.completed = normalizedUser ? responseTask.completedBy?.includes(normalizedUser) : false;
        }
        res.json(responseTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json({ success: true });
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
        const { isPublic, classLevel, author } = req.query;
        const filter = {};
        if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
        if (classLevel) filter.classLevel = Number(classLevel);
        if (author) filter.author = author;
        
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

router.put('/notes/:id', async (req, res) => {
    try {
        const note = await Note.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!note) return res.status(404).json({ error: 'Not found' });
        res.json(note);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/notes/:id', async (req, res) => {
    try {
        const note = await Note.findByIdAndDelete(req.params.id);
        if (!note) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// LLM Endpoints (Features 3 & 8)
// =======================
router.post('/generate-quiz', async (req, res) => {
    try {
        const { topic, text, imageBase64, numQuestions, difficulty, contentId, documentTitle, pageNumber, pageText } = req.body;
        const nQ = numQuestions || 5;
        const diff = difficulty || 'medium';

        let storedDocumentText = '';
        let pdfBase64Data = null;
        if (contentId && !contentId.toString().startsWith('local_')) {
            try {
                const content = await ClassContent.findById(contentId).lean();
                if (content?.link) {
                    // Fetch the actual PDF to send natively to Gemini
                    const pdfUrl = content.link.startsWith('http') ? content.link : `http://localhost:${process.env.PORT || 5000}${content.link}`;
                    try {
                        const pdfResp = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
                        pdfBase64Data = Buffer.from(pdfResp.data).toString('base64');
                    } catch (fetchErr) {
                        console.error("Failed to fetch PDF for Gemini:", fetchErr.message);
                    }
                }
                
                if (content?.extractedText?.length) {
                    storedDocumentText = content.extractedText
                        .map((entry) => {
                            const normalized = `${entry?.content || ''}`.replace(/\s+/g, ' ').trim();
                            return normalized ? `[Page ${entry.page}] ${normalized}` : '';
                        })
                        .filter(Boolean)
                        .join('\n\n');
                }
            } catch (dbErr) {
                console.error("Skipping DB fetch for quiz generation:", dbErr.message);
            }
        }

        const normalizedPageText = `${pageText || ''}`.replace(/\s+/g, ' ').trim();
        const combinedContext = [text, storedDocumentText]
            .map((part) => `${part || ''}`.trim())
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 30000);

        if (!combinedContext && !imageBase64 && !pdfBase64Data) {
            return res.status(400).json({ error: 'Document material is required to generate a grounded quiz.' });
        }

        const prompt = `Generate a JSON array of ${nQ} multiple choice questions strictly based on the provided study material or attached PDF document.
        Topic: ${topic}
        Document title: ${documentTitle || 'Unknown'}
        Difficulty: ${diff}
        Target Page Number: ${pageNumber || 'Unknown'} (Focus strongly on this page if a full document is provided)
        Page text snippet: ${normalizedPageText || 'Not provided'}

        Instructions:
        1. Base your questions exclusively on the informational content in the provided document, images, or text context.
        2. Do not include unrelated general-knowledge questions.
        3. Ensure every answer is factually supported by the current material.
        4. If the material is too short for ${nQ} questions, simply return fewer valid questions.

        TEXT CONTEXT (if any):
        ${combinedContext || 'No additional text provided.'}

        Return ONLY valid JSON in this exact format, with NO markdown formatting around the output:
        [{"question": "Q text", "options": ["A", "B", "C", "D"], "answer": "Correct Option Text", "explanation": "A concise explanation of why it's correct based on the text."}]`;

        // Send to Gemini using natively supported media types or image URLs
        let response;
        if (pdfBase64Data) {
            // Using the native PDF support inside Gemini 1.5/2.5 for incredibly accurate OCR and context!
            const msgContent = [
                { type: "text", text: prompt },
                { type: "media", mimeType: "application/pdf", data: pdfBase64Data }
            ];
            response = await geminiModel.invoke([ ["human", msgContent] ]);
        } else if (imageBase64) {
            const msgContent = [
                { type: "text", text: prompt },
                { type: "image_url", image_url: imageBase64 }
            ];
            response = await geminiModel.invoke([ ["human", msgContent] ]);
        } else {
            response = await geminiModel.invoke(prompt);
        }

        let contentStr = typeof response.content === 'string' 
            ? response.content 
            : (Array.isArray(response.content) ? response.content.map(c => c.text || JSON.stringify(c)).join(' ') : JSON.stringify(response.content));

        let resultText = contentStr.replace(/```[jJ][sS][oO][nN]/g, '').replace(/```/g, '').trim();
        const startIdx = resultText.indexOf('[');
        const endIdx = resultText.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
            resultText = resultText.substring(startIdx, endIdx + 1);
        }
        const quiz = JSON.parse(resultText);
        res.json(quiz);
    } catch (err) {
        console.error("Quiz gen error:", err);
        require('fs').writeFileSync('/tmp/quiz_err.log', (err.stack || err.message) + '\n');
        res.status(500).json({ error: "Failed to generate quiz: " + err.message, details: err.stack });
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

router.post('/airesponse', async (req, res) => {
    try {
        const { prompt, contentId, history = [], pageNumber, pageText, imageBase64 } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt is required" });

        let context = "";
        if (contentId && !contentId.toString().startsWith('local_')) {
            try {
                const content = await ClassContent.findById(contentId);
                if (content && content.extractedText && content.extractedText.length > 0) {
                    context = content.extractedText.map(t => `[Page ${t.page}]: ${t.content}`).join("\n\n");
                }
            } catch (dbErr) {
                console.error("Skipping DB fetch for AI response:", dbErr.message);
            }
        }

        const systemInstruction = `You are PrimeArc AI, a helpful educational assistant.
        The user is viewing a PDF document and may ask page-specific questions.
        Prioritize the CURRENT PAGE context first, then use the broader document context.
        If the information is in the current page or document, mention the page number clearly (e.g., "According to page 3...").
        If the answer is uncertain because the page image/text is unclear, say that directly.
        If the answer isn't in the document, say so briefly and then help with general knowledge.

        CURRENT PAGE:
        Page number: ${pageNumber || "Unknown"}
        Page text: ${pageText || "No page-specific text provided."}

        CONTEXT:
        ${context || "No specific document context provided."}
        `;

        const formattedHistory = Array.isArray(history)
            ? history.slice(-10).map((msg) => [
                msg.role === 'user' ? 'human' : 'ai',
                msg.content
            ])
            : [];

        let response;
        if (imageBase64) {
            const humanContent = [
                {
                    type: "text",
                    text: `User question about page ${pageNumber || "current page"}:\n${prompt}`
                },
                {
                    type: "image_url",
                    image_url: imageBase64
                }
            ];
            response = await geminiModel.invoke([
                ['system', systemInstruction],
                ...formattedHistory,
                ['human', humanContent]
            ]);
        } else {
            response = await geminiModel.invoke([
                ['system', systemInstruction],
                ...formattedHistory,
                ['human', prompt]
            ]);
        }

        res.json({ content: response.content });
    } catch (err) {
        console.error("AI Response error:", err);
        res.status(500).json({ error: "Failed to generate AI response: " + err.message });
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
// Quiz Persistence Endpoints
// =======================

router.get('/quizzes', async (req, res) => {
    try {
        const { user, documentId } = req.query;
        let filter = {};
        if (user) filter.user = user;
        if (documentId) filter.documentId = documentId;
        const quizzes = await Quiz.find(filter).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/quizzes', async (req, res) => {
    try {
        const quiz = new Quiz(req.body);
        await quiz.save();
        res.status(201).json(quiz);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/quizzes/:id/score', async (req, res) => {
    try {
        const { score } = req.body;
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Not found' });
        
        quiz.attempts += 1;
        if (score > quiz.bestScore) quiz.bestScore = score;
        
        await quiz.save();
        res.json(quiz);
    } catch (err) { res.status(500).json({ error: err.message }); }
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

router.get('/proxy-pdf', async (req, res) => {
    try {
        const raw = req.query.url;
        const targetUrl = typeof raw === 'string' ? raw : Array.isArray(raw) && raw[0] ? String(raw[0]) : '';
        if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
            return res.status(400).send('Valid http(s) URL required');
        }

        const forwardHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/pdf,*/*;q=0.8',
        };
        // Some hosts (like tmpfiles.org) enforce anti-hotlink rules and require browser context.
        // Forward what the browser sent us to the upstream PDF host.
        if (req.headers.referer) forwardHeaders.Referer = req.headers.referer;
        if (req.headers.origin) forwardHeaders.Origin = req.headers.origin;
        if (req.headers['accept-language']) forwardHeaders['Accept-Language'] = req.headers['accept-language'];
        if (req.headers.range) forwardHeaders.Range = req.headers.range;

        const response = await axios.get(targetUrl, {
            responseType: 'stream',
            headers: forwardHeaders,
            maxRedirects: 5,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: () => true,
        });

        if (response.status < 200 || response.status >= 300) {
            return res.status(502).send('Upstream returned non-OK status');
        }

        const ct = response.headers['content-type'] || 'application/pdf';
        res.setHeader('Content-Type', ct.includes('pdf') ? ct : 'application/pdf');

        // Ensure PDF.js can read these headers in the browser via CORS.
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

        if (response.headers['content-length'])
            res.setHeader('Content-Length', response.headers['content-length']);
        if (response.headers['content-range'])
            res.setHeader('Content-Range', response.headers['content-range']);
        if (response.headers['accept-ranges'])
            res.setHeader('Accept-Ranges', response.headers['accept-ranges']);

        res.status(response.status);

        response.data.on('error', () => {
            if (!res.destroyed) res.destroy();
        });
        response.data.pipe(res);
    } catch (err) {
        console.error('proxy-pdf:', err.message);
        if (!res.headersSent) res.status(500).send('Error proxying PDF');
    }
});

export default router;
