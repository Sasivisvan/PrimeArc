import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';

interface Comment {
    _id?: string;
    user: string;
    text: string;
    page?: number;
    createdAt?: string;
}

interface ContentItem {
    _id: string;
    title: string;
    link: string;
    classLevel: number;
    uploadedBy: string;
    tags: string[];
    upvotes: number;
    comments: Comment[];
    studyProgress?: {
        user: string;
        pages: number[];
        updatedAt?: string;
    }[];
    extractedText?: {
        page: number;
        content: string;
    }[];
    createdAt: string;
    localFileDemo?: { name: string; size: number };
}

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Bot, Sparkles, Trophy, Upload, FileText, User, Trash2, Eye, MessageSquare, FolderOpen, AlertCircle, SendHorizontal, CheckSquare, Square } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

function apiBaseUrl() {
    return import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000';
}

/** PDFs stored on our API are loaded directly; external URLs go through the proxy (CORS). */
function contentPdfDocumentSrc(link: string) {
    const base = apiBaseUrl();
    const t = link.trim();
    if (/\/api\/content-files\/[a-f0-9]{32}\.pdf/i.test(t)) {
        try {
            return new URL(t).href;
        } catch {
            return `${base}${t.startsWith('/') ? t : `/${t}`}`;
        }
    }
    return `${base}/api/proxy-pdf?url=${encodeURIComponent(t)}`;
}

const AVAILABLE_TAGS = [
    'Mathematics for Computing 4', 
    'Introduction to Communication & IoT', 
    'Design and Analysis of Algorithms', 
    'Machine Learning', 
    'Introduction to AI Robotics', 
    'Intelligence of Biological Systems 2', 
    'Leadership from Ramayana', 
    'Environmental Science', 
    'Soft Skills I'
];

export default function Content() {
    const { classLevel, username, role } = useUser();
    const [contents, setContents] = useState<ContentItem[]>([]);
    
    // Upload form state
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [simulatedFile, setSimulatedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    
    // UI state
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [activeViewerId, setActiveViewerId] = useState<string | null>(null);
    const [viewerTab, setViewerTab] = useState<'ai' | 'qa' | 'quizzes'>('qa');
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiMessages, setAiMessages] = useState<{role:'user'|'ai', content:string}[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    // Quiz states
    const [docQuizzes, setDocQuizzes] = useState<any[]>([]);
    const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
    const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
    const [quizResult, setQuizResult] = useState<any | null>(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [quizDifficulty, setQuizDifficulty] = useState('medium');
    const [quizCount, setQuizCount] = useState<number>(5);
    
    // PDF Viewer states
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const [currentPageText, setCurrentPageText] = useState('');
    const [currentPageImage, setCurrentPageImage] = useState<string | null>(null);
    const [studiedPages, setStudiedPages] = useState<number[]>([]);
    const [isSavingStudyProgress, setIsSavingStudyProgress] = useState(false);
    
    const [commentText, setCommentText] = useState('');
    const [commentPage, setCommentPage] = useState('');
    const viewerPageRef = useRef<HTMLDivElement | null>(null);

    const jumpToPage = (targetPage?: number) => {
        if (!targetPage || !Number.isFinite(targetPage) || targetPage < 1) return;
        const nextPage = numPages ? Math.min(numPages, targetPage) : targetPage;
        setPageNumber(nextPage);
    };

    const aiChatStorageKey = `primearc_ai_chat_${classLevel}_${username || 'anonymous'}_${activeViewerId || 'none'}`;
    const activeViewerItem = activeViewerId ? contents.find(c => c._id === activeViewerId) : null;
    const activeViewerUsesHostedFile = !!activeViewerItem?.link && /\/api\/content-files\/[a-f0-9]{32}\.pdf/i.test(activeViewerItem.link);

    const fetchContent = async () => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            const res = await fetch(`${baseUrl}/api/content?classLevel=${classLevel}`);
            if (res.ok) {
                const data = await res.json();
                
                // Demo logic: merge any "local" files stored in localStorage just for visual demo
                const localStr = localStorage.getItem(`primearc_local_content_${classLevel}`);
                const localDocs = localStr ? JSON.parse(localStr) : [];
                
                // Sort combined data by date (newest first)
                const combined = [...localDocs, ...data].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setContents(combined);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchContent();
    }, [classLevel]);

    // Load/save AI chat per user + document.
    useEffect(() => {
        if (!username) return;
        if (!activeViewerId) {
            setAiMessages([]);
            return;
        }
        try {
            const saved = localStorage.getItem(aiChatStorageKey);
            if (!saved) {
                setAiMessages([]);
                return;
            }
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setAiMessages(parsed);
        } catch {
            // ignore
        }
    }, [aiChatStorageKey, activeViewerId, username]);

    useEffect(() => {
        if (!username) return;
        if (!activeViewerId) return;
        try {
            localStorage.setItem(aiChatStorageKey, JSON.stringify(aiMessages.slice(-60)));
        } catch {
            // ignore quota errors
        }
    }, [aiChatStorageKey, activeViewerId, username, aiMessages]);

    useEffect(() => {
        if (activeViewerId && viewerTab === 'qa') {
            setCommentPage(String(pageNumber));
        }
    }, [activeViewerId, viewerTab, pageNumber]);

    useEffect(() => {
        if (!activeViewerId) {
            setCurrentPageText('');
            setCurrentPageImage(null);
            setStudiedPages([]);
        }
    }, [activeViewerId]);

    useEffect(() => {
        if (!activeViewerItem || !username) {
            setStudiedPages([]);
            return;
        }

        const userProgress = activeViewerItem.studyProgress?.find((entry) => entry.user === username);
        const pages = Array.isArray(userProgress?.pages)
            ? userProgress!.pages
                .map((page) => Number(page))
                .filter((page) => Number.isInteger(page) && page > 0)
                .sort((a, b) => a - b)
            : [];
        setStudiedPages(pages);
    }, [activeViewerItem, username]);

    useEffect(() => {
        if (!activeViewerId) return;

        const handleViewerKeydown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName;
            const isTypingTarget =
                target?.isContentEditable ||
                tagName === 'INPUT' ||
                tagName === 'TEXTAREA' ||
                tagName === 'SELECT';

            if (isTypingTarget) return;

            if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
                event.preventDefault();
                jumpToPage(pageNumber - 1);
                return;
            }

            if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
                event.preventDefault();
                jumpToPage(pageNumber + 1);
            }
        };

        window.addEventListener('keydown', handleViewerKeydown);
        return () => window.removeEventListener('keydown', handleViewerKeydown);
    }, [activeViewerId, pageNumber, numPages]);

    const handleToggleForm = () => {
        if (showUploadForm && (title || link || simulatedFile || selectedTags.length > 0)) {
            setShowDiscardModal(true);
            return;
        }
        setShowUploadForm(!showUploadForm);
        // Reset if closed
        if(showUploadForm) {
            setTitle(''); setLink(''); setSelectedTags([]); setSimulatedFile(null);
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSimulatedFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (simulatedFile) {
            setUploadProgress(0);

            const formData = new FormData();
            formData.append('file', simulatedFile);
            formData.append('title', title);
            formData.append('classLevel', String(classLevel));
            formData.append('uploadedBy', username || '');
            formData.append('tags', JSON.stringify(selectedTags));

            const baseUrl = apiBaseUrl();
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${baseUrl}/api/content/upload`);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    setUploadProgress(Math.round((event.loaded / event.total) * 100));
                }
            };

            xhr.onload = () => {
                setUploadProgress(null);
                if (xhr.status >= 200 && xhr.status < 300) {
                    setTitle('');
                    setLink('');
                    setSelectedTags([]);
                    setSimulatedFile(null);
                    setShowUploadForm(false);
                    fetchContent();
                } else {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        alert(`Upload failed: ${data.error || data.details || xhr.statusText}`);
                    } catch {
                        alert(`Upload failed (${xhr.status})`);
                    }
                }
            };

            xhr.onerror = () => {
                alert('Network error during upload.');
                setUploadProgress(null);
            };

            xhr.send(formData);
        } else {
            // Standard external link database upload
            try {
                const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
                const res = await fetch(`${baseUrl}/api/content`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title, link, classLevel, uploadedBy: username, tags: selectedTags
                    })
                });
                
                if (!res.ok) {
                    const data = await res.json();
                    alert(`Upload failed: ${data.error || 'Server error'}\n${data.details || 'Please check if backend/database is connected.'}`);
                    return; // Stop here and don't close the form
                }
            } catch (err: any) {
                console.error(err);
                alert(`Upload failed: ${err.message || 'Network error'}`);
                return;
            }
            
            setTitle('');
            setLink('');
            setSelectedTags([]);
            setSimulatedFile(null);
            setShowUploadForm(false);
            fetchContent();
        }
    };

    const handleUpvote = async (id: string, isLocal: boolean) => {
        if (isLocal) {
            // Demo upvoting for local files
            const localStr = localStorage.getItem(`primearc_local_content_${classLevel}`);
            if (localStr) {
                const localDocs = JSON.parse(localStr);
                const doc = localDocs.find((d:any) => d._id === id);
                if (doc) { doc.upvotes = (doc.upvotes || 0) + 1; }
                localStorage.setItem(`primearc_local_content_${classLevel}`, JSON.stringify(localDocs));
            }
            fetchContent();
            return;
        }

        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            await fetch(`${baseUrl}/api/content/${id}/upvote`, { method: 'PUT' });
            fetchContent();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id: string, isLocal: boolean) => {
        if (!window.confirm("Are you sure you want to delete this educational material?")) return;
        
        if (isLocal) {
            const localStr = localStorage.getItem(`primearc_local_content_${classLevel}`);
            if (localStr) {
                let localDocs = JSON.parse(localStr);
                localDocs = localDocs.filter((d:any) => d._id !== id);
                localStorage.setItem(`primearc_local_content_${classLevel}`, JSON.stringify(localDocs));
            }
            fetchContent();
            return;
        }

        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            const res = await fetch(`${baseUrl}/api/content/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchContent();
            } else {
                alert("Failed to delete content.");
            }
        } catch (err) { console.error(err); }
    };

    const handleComment = async (e: React.FormEvent, id: string, isLocal: boolean) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        const parsedPage = commentPage ? Number(commentPage) : pageNumber;
        const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : pageNumber;

        if (isLocal) {
            const localStr = localStorage.getItem(`primearc_local_content_${classLevel}`);
            if (localStr) {
                const localDocs = JSON.parse(localStr);
                const doc = localDocs.find((d:any) => d._id === id);
                if (doc) { 
                    doc.comments = doc.comments || [];
                    doc.comments.push({ user: username, text: commentText, page: pageNum, createdAt: new Date().toISOString() }); 
                }
                localStorage.setItem(`primearc_local_content_${classLevel}`, JSON.stringify(localDocs));
            }
            setCommentText('');
            setCommentPage(String(pageNumber));
            fetchContent();
            return;
        }

        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            await fetch(`${baseUrl}/api/content/${id}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: username, text: commentText, page: pageNum })
            });
            setCommentText('');
            setCommentPage(String(pageNumber));
            fetchContent();
        } catch (err) { console.error(err); }
    };

    const handleAiSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiPrompt.trim()) return;
        
        const currentPrompt = aiPrompt;
        setAiPrompt('');
        setIsAiLoading(true);
        const historyForRequest = [...aiMessages, { role: 'user' as const, content: currentPrompt }];
        setAiMessages(historyForRequest);

        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            const res = await fetch(`${baseUrl}/api/airesponse`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: currentPrompt, 
                    contentId: activeViewerId,
                    history: historyForRequest,
                    pageNumber,
                    pageText: currentPageText,
                    imageBase64: currentPageImage
                })
            });
            const data = await res.json();
            if (res.ok) {
                setAiMessages(prev => [...prev, { role: 'ai', content: data.content || data.reply || data.text || "Empty response." }]);
            } else {
                setAiMessages(prev => [...prev, { role: 'ai', content: "Error: " + (data.error || "Unknown error") }]);
            }
        } catch (err: any) {
            setAiMessages(prev => [...prev, { role: 'ai', content: "Error connecting to AI." }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setPageNumber(1);
    }

    const captureCurrentPageContext = () => {
        const container = viewerPageRef.current;
        if (!container) return;

        const textSpans = Array.from(container.querySelectorAll('.react-pdf__Page__textContent span'));
        const text = textSpans
            .map((span) => (span.textContent || '').trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        setCurrentPageText(text);

        const canvas = container.querySelector('canvas');
        if (!canvas) {
            setCurrentPageImage(null);
            return;
        }

        try {
            const image = canvas.toDataURL('image/jpeg', 0.72);
            setCurrentPageImage(image);
        } catch {
            setCurrentPageImage(null);
        }
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const fetchDocQuizzes = async (docId: string) => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            const res = await fetch(`${baseUrl}/api/quizzes?user=${encodeURIComponent(username || '')}&documentId=${docId}`);
            if (res.ok) setDocQuizzes(await res.json());
        } catch(err) { console.error(err); }
    };

    const persistStudyProgress = async (contentId: string, pages: number[]) => {
        if (!username) return;
        setIsSavingStudyProgress(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            const res = await fetch(`${baseUrl}/api/content/${contentId}/study-progress`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: username, pages })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to save study progress');
            }
            fetchContent();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSavingStudyProgress(false);
        }
    };

    const buildQuizSourceText = (item: ContentItem) => {
        const sections: string[] = [];
        const pageText = currentPageText.trim();
        const extractedSections = (item.extractedText || [])
            .map((entry) => {
                const normalized = entry.content?.replace(/\s+/g, ' ').trim();
                return normalized ? `[Page ${entry.page}] ${normalized}` : '';
            })
            .filter(Boolean);

        if (pageText) {
            sections.push(`Current visible page (${pageNumber}): ${pageText}`);
        }
        if (extractedSections.length > 0) {
            sections.push(`Document text:\n${extractedSections.join('\n\n')}`);
        }

        const combined = sections.join('\n\n').trim();
        return combined.slice(0, 24000);
    };

    const toggleStudiedPage = async () => {
        if (!activeViewerItem || !username) return;
        if (activeViewerItem._id.toString().startsWith('local_')) return;
        const isStudied = studiedPages.includes(pageNumber);
        const nextPages = isStudied
            ? studiedPages.filter((page) => page !== pageNumber)
            : [...studiedPages, pageNumber].sort((a, b) => a - b);
        setStudiedPages(nextPages);
        await persistStudyProgress(activeViewerItem._id, nextPages);
    };

    const handleGenerateQuiz = async () => {
        if (!activeViewerId) return;
        const item = contents.find(c => c._id === activeViewerId);
        if (!item) return;

        setIsGeneratingQuiz(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            const sourceText = buildQuizSourceText(item);
            const res = await fetch(`${baseUrl}/api/generate-quiz`, {
                method: 'POST',
                headers:{ 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: item._id,
                    topic: `Questions based on the educational document titled: ${item.title}`,
                    documentTitle: item.title,
                    pageNumber,
                    pageText: currentPageText,
                    text: sourceText,
                    difficulty: quizDifficulty,
                    numQuestions: quizCount
                })
            });
            const generatedQs = await res.json();
            
            if (Array.isArray(generatedQs) && generatedQs.length > 0) {
                const saveRes = await fetch(`${baseUrl}/api/quizzes`, {
                    method: 'POST',
                    headers:{ 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user: username,
                        documentId: activeViewerId,
                        topic: item.title,
                        difficulty: quizDifficulty,
                        questions: generatedQs
                    })
                });
                if (saveRes.ok) {
                    fetchDocQuizzes(activeViewerId);
                }
            } else {
                alert("Failed to generate valid questions. Try again.");
            }
        } catch(er) {
            console.error(er);
            alert('Error generating quiz');
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const calculateQuizScore = async () => {
        if (!activeQuiz) return;
        
        let correct = 0;
        activeQuiz.questions.forEach((q: any, i: number) => {
            if (quizAnswers[i] === q.answer) correct++;
        });

        const score = Math.round((correct / activeQuiz.questions.length) * 100);
        setQuizResult({ correct, total: activeQuiz.questions.length, score });

        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            await fetch(`${baseUrl}/api/quizzes/${activeQuiz._id}/score`, {
                method: 'PUT',
                headers:{ 'Content-Type': 'application/json' },
                body: JSON.stringify({ score })
            });
            fetchDocQuizzes(activeQuiz.documentId);
        } catch(er) { console.error(er); }
    };

    const filteredContents = activeFilter 
        ? contents.filter(c => c.tags && c.tags.includes(activeFilter))
        : contents;

    const isCurrentPageStudied = studiedPages.includes(pageNumber);

    if (activeViewerItem) {
        const isLocal = activeViewerItem._id.toString().startsWith('local_');
        return (
            <div className="flex flex-col h-full w-full bg-gradient-to-b from-black to-gray-900 text-white absolute inset-0 z-50 overflow-hidden">
                {/* Top Bar */}
                <div className="glass flex items-center justify-between p-4 w-full gap-4">
                    <button
                        onClick={() => { setActiveViewerId(null); setViewerTab('qa'); }}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
                    >
                        Back
                    </button>
                    <div className="flex items-center gap-3 min-w-0 flex-1 justify-center">
                        <h2 className="text-xl font-bold truncate max-w-2xl text-center">{activeViewerItem.title}</h2>
                        <span className="text-xs font-bold px-3 py-1 rounded-full border border-white/10 bg-white/5 text-gray-300 whitespace-nowrap">
                            {studiedPages.length}/{numPages || '...'} Studied
                        </span>
                    </div>
                    <a href={activeViewerItem.link} target="_blank" rel="noreferrer" className="text-sm text-gray-400 hover:text-white underline">
                        Open externally
                    </a>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
                    {/* LEFT: Document Viewer (≈75%) */}
                    <div className="w-full sm:w-3/4 flex flex-col border-r border-white/5 bg-[#0a0a0a] relative group/viewer">
                        {/* Custom PDF Toolbar */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full opacity-0 group-hover/viewer:opacity-100 transition-opacity duration-300 shadow-2xl">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setPageNumber(p => Math.max(1, p - 1)); }} 
                                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[10px] font-bold px-2 whitespace-nowrap min-w-[80px] text-center uppercase tracking-tighter">
                                Page {pageNumber} / {numPages || '...'}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setPageNumber(p => Math.min(numPages || p, p + 1)); }} 
                                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            <button 
                                onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.1)); }} 
                                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(3, s + 0.1)); }} 
                                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            <a href={activeViewerItem.link} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                                <Download className="w-4 h-4" />
                            </a>
                            {username && (
                                <>
                                    <div className="w-px h-4 bg-white/10 mx-1" />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleStudiedPage();
                                        }}
                                        disabled={isLocal}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isCurrentPageStudied ? 'bg-white text-black' : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'}`}
                                        title="Mark current page as studied"
                                    >
                                        {isCurrentPageStudied ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                        {isSavingStudyProgress ? 'Saving' : 'Studied'}
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto flex flex-col items-center py-10 scrollbar-hide">
                            <div ref={viewerPageRef} className="shadow-2xl shadow-black ring-1 ring-white/10">
                                <Document
                                    file={contentPdfDocumentSrc(activeViewerItem.link)}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    loading={
                                        <div className="flex flex-col items-center justify-center p-20 text-gray-500">
                                            <div className="w-10 h-10 border-4 border-white/10 border-t-white rounded-full animate-spin mb-4" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Igniting Engine...</p>
                                        </div>
                                    }
                                    error={
                                        <div className="p-20 text-center">
                                            <p className="text-red-400 font-bold mb-3">Document unavailable</p>
                                            <p className="text-gray-400 text-sm mb-5 max-w-md">
                                                {activeViewerUsesHostedFile
                                                    ? 'The PDF could not be read from PrimeArc storage. Try opening it directly or re-uploading the file.'
                                                    : 'This external PDF link is unavailable or expired. Re-upload the PDF to PrimeArc storage instead of relying on a temporary external link.'}
                                            </p>
                                            <a href={activeViewerItem.link} target="_blank" rel="noreferrer" className="px-6 py-2 bg-white text-black rounded-full font-bold">Open Direct Link</a>
                                        </div>
                                    }
                                >
                                    <Page 
                                        pageNumber={pageNumber} 
                                        scale={scale} 
                                        onRenderSuccess={() => {
                                            requestAnimationFrame(() => {
                                                requestAnimationFrame(captureCurrentPageContext);
                                            });
                                        }}
                                        renderAnnotationLayer={false}
                                        renderTextLayer={true}
                                        className="rounded-sm overflow-hidden"
                                    />
                                </Document>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Document Sidebar (≈25%) */}
                    <div className="w-full sm:w-1/4 flex flex-col glass rounded-l-lg overflow-hidden">
                        <div className="flex border-b border-white/10 shrink-0">
                            <button
                                onClick={() => setViewerTab('qa')}
                                className={`flex-1 py-4 text-xs font-bold border-b-2 transition-colors ${viewerTab === 'qa' ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                Q&A Section
                            </button>
                            <button
                                onClick={() => setViewerTab('ai')}
                                className={`flex-1 py-4 text-xs font-bold border-b-2 transition-colors flex justify-center items-center gap-2 ${viewerTab === 'ai' ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                PrimeArc AI
                            </button>
                            <button
                                onClick={() => { setViewerTab('quizzes'); fetchDocQuizzes(activeViewerItem._id); }}
                                className={`flex-1 py-4 text-xs font-bold border-b-2 transition-colors flex justify-center items-center gap-2 ${viewerTab === 'quizzes' ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                Quizzes
                            </button>
                        </div>


                    <div className="flex-1 overflow-y-auto relative h-full">
                        {viewerTab === 'qa' && (
                            <div className="p-4 flex flex-col h-full absolute inset-0">
                                <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4 pr-2">
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <h3 className="text-white font-bold text-sm">Questions & Discussion</h3>
                                        <p className="text-gray-400 text-xs mt-1">Ask questions about this material and discuss page-specific points with the class.</p>
                                    </div>
                                    {(!activeViewerItem.comments || activeViewerItem.comments.length === 0) ? (
                                        <div className="text-center mt-10">
                                            <p className="text-gray-300 font-bold mb-1">No questions yet</p>
                                            <p className="text-gray-500 text-sm">Be the first to ask the class a question about this material.</p>
                                        </div>
                                    ) : (
                                        activeViewerItem.comments.map((c, i) => (
                                            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.08] transition-all group">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold shadow-lg shadow-white/10 shrink-0">
                                                        {c.user.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm text-white">{c.user}</span>
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Student</span>
                                                    </div>
                                                    {c.page !== undefined && (
                                                        <button
                                                            type="button"
                                                            onClick={() => jumpToPage(c.page)}
                                                            className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-300 border border-white/10 ml-auto font-medium hover:bg-white hover:text-black transition-colors"
                                                            title={`Go to page ${c.page}`}
                                                        >
                                                            Pg {c.page}
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap pl-10 border-l border-white/5 group-hover:border-white/20 transition-colors">{c.text}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <form onSubmit={(e) => handleComment(e, activeViewerItem._id, isLocal)} className="flex flex-col gap-3 shrink-0 pt-3 border-t border-white/10 mt-auto bg-black/20 backdrop-blur-md p-4 rounded-xl">
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" placeholder="Pg #" min="1"
                                            value={commentPage} onChange={e => setCommentPage(e.target.value)}
                                            className="w-16 bg-white/5 border border-white/20 rounded-lg px-2 py-2 text-sm text-white outline-none focus:border-white focus:bg-white/10 transition-all text-center"
                                        />
                                        <input 
                                            type="text" placeholder="Ask a question..." required
                                            value={commentText} onChange={e => setCommentText(e.target.value)}
                                            className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white focus:bg-white/10 transition-all"
                                        />
                                    </div>
                                    <button type="submit" className="w-full py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-white/5">
                                        Post Question
                                    </button>
                                </form>
                            </div>
                        )}

                        {viewerTab === 'ai' && (
                            <div className="p-4 flex flex-col h-full absolute inset-0">
                                <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4 pr-2">
                                    {aiMessages.length === 0 && (
                                        <div className="text-center mt-10">
                                            <div className="text-3xl mb-3 flex justify-center"><Bot size={28} /></div>
                                            <p className="text-white font-bold mb-1">AI Assistant</p>
                                            <p className="text-sm text-gray-400">Ask me to summarize this document, explain concepts, or extract key notes.</p>
                                        </div>
                                    )}
                                    {aiMessages.map((msg, idx) => (
                                        <div key={idx} className={`p-4 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-xl backdrop-blur-md transition-all ${
                                            msg.role === 'user' 
                                            ? 'bg-white text-black self-end rounded-tr-none border-transparent' 
                                            : 'bg-white/10 border border-white/10 text-gray-200 self-start rounded-tl-none'
                                        }`}>
                                            <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase font-bold tracking-widest">
                                                {msg.role === 'user' ? 'You' : 'PrimeArc AI'}
                                            </div>
                                            {msg.content}
                                        </div>
                                    ))}
                                    {isAiLoading && (
                                        <div className="text-gray-500 text-sm self-start flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                            Thinking...
                                        </div>
                                    )}
                                </div>
                                <form onSubmit={handleAiSubmit} className="flex gap-2 shrink-0 pt-3 border-t border-white/10 mt-auto bg-black/20 backdrop-blur-md p-4 rounded-xl">
                                    <input 
                                        type="text" placeholder="Message AI..." required
                                        value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} disabled={isAiLoading}
                                        className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white focus:bg-white/10 transition-all disabled:opacity-50"
                                    />
                                    <button type="submit" disabled={isAiLoading} className="px-4 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-white/5">
                                        <SendHorizontal size={16} />
                                    </button>
                                </form>
                            </div>
                        )}

                        {viewerTab === 'quizzes' && (
                            <div className="p-4 flex flex-col h-full absolute inset-0 overflow-y-auto">
                                {!activeQuiz ? (
                                    <div className="flex flex-col gap-6 w-full">
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                            <h3 className="font-bold text-white mb-3">Generate New Quiz</h3>
                                            <div className="flex flex-col gap-3">
                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1">Difficulty</label>
                                                    <select value={quizDifficulty} onChange={e=>setQuizDifficulty(e.target.value)} className="w-full bg-[#111] border border-white/20 rounded-lg px-2 py-2 text-sm text-white outline-none">
                                                        <option value="easy">Easy</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="hard">Hard</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1">Number of Questions</label>
                                                    <select value={quizCount} onChange={e=>setQuizCount(Number(e.target.value))} className="w-full bg-[#111] border border-white/20 rounded-lg px-2 py-2 text-sm text-white outline-none">
                                                        <option value={3}>3 Questions</option>
                                                        <option value={5}>5 Questions</option>
                                                        <option value={10}>10 Questions</option>
                                                    </select>
                                                </div>
                                                <button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz} className="w-full mt-2 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
                                                    {isGeneratingQuiz ? 'Generating...' : <span className="inline-flex items-center gap-2 justify-center"><Sparkles className="w-4 h-4" /> Generate AI Quiz</span>}
                                                </button>
                                            </div>
                                        </div>

                                        {docQuizzes.length > 0 && (
                                            <div>
                                                <h3 className="font-bold text-white mb-3 text-sm border-b border-white/10 pb-2">Your Saved Quizzes</h3>
                                                <div className="flex flex-col gap-3">
                                                    {docQuizzes.map((q, idx) => (
                                                        <div key={q._id || idx} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-sm text-white">{q.difficulty.toUpperCase()} • {q.questions.length} Qs</span>
                                                                <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">Best: {q.bestScore}%</span>
                                                            </div>
                                                            <div className="text-xs text-gray-400">Attempts: {q.attempts}</div>
                                                            <button onClick={() => { setActiveQuiz(q); setQuizAnswers({}); setQuizResult(null); }} className="w-full py-1.5 mt-1 bg-[#222] text-white border border-[#444] text-xs font-bold rounded hover:bg-[#333] transition-colors">
                                                                Take Quiz
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4 w-full pb-8">
                                        <button onClick={() => { setActiveQuiz(null); setQuizResult(null); }} className="self-start text-xs text-gray-400 hover:text-white pb-2">Back to Quizzes</button>
                                        
                                        {!quizResult ? (
                                            <div className="flex flex-col gap-6">
                                                {activeQuiz.questions.map((q: any, i: number) => (
                                                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                                        <h4 className="font-bold text-sm text-white mb-4">{i + 1}. {q.question}</h4>
                                                        <div className="flex flex-col gap-2">
                                                            {q.options.map((opt: string, optIdx: number) => (
                                                                <label key={optIdx} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-white/5">
                                                                    <input type="radio" name={`question-${i}`} value={opt} checked={quizAnswers[i] === opt} onChange={() => setQuizAnswers(prev => ({...prev, [i]: opt}))} className="mt-1" />
                                                                    <span className="text-sm text-gray-300 leading-tight">{opt}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                <button onClick={calculateQuizScore} disabled={Object.keys(quizAnswers).length < activeQuiz.questions.length} className="w-full py-3 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
                                                    Submit Answers
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-6 items-center text-center py-8">
                                                <div className="text-5xl mb-2 flex justify-center"><Trophy className="w-10 h-10" /></div>
                                                <h3 className="text-2xl font-bold text-white">{quizResult.score}%</h3>
                                                <p className="text-gray-400">You got {quizResult.correct} out of {quizResult.total} questions correct.</p>
                                                
                                                {/* Iterating answer review */}
                                                <div className="flex flex-col gap-4 text-left w-full mt-4">
                                                    {activeQuiz.questions.map((q:any, i:number) => {
                                                        const isCorrect = quizAnswers[i] === q.answer;
                                                        return (
                                                            <div key={i} className={`p-3 rounded-lg border flex flex-col gap-1 text-sm ${isCorrect ? 'bg-green-900/10 border-green-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                                                                <strong className="text-white">{i + 1}. {q.question}</strong>
                                                                <span className={isCorrect ? 'text-green-400' : 'text-red-400'}>
                                                                    Your answer: {quizAnswers[i]}
                                                                </span>
                                                                {!isCorrect && (
                                                                    <span className="text-green-400">Correct: {q.answer}</span>
                                                                )}
                                                                <span className="text-gray-400 text-xs italic mt-1">{q.explanation}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <div className="flex gap-3 mt-4 w-full">
                                                    <button onClick={() => { setQuizAnswers({}); setQuizResult(null); }} className="flex-1 py-2.5 bg-[#222] text-white border border-[#444] text-sm font-bold rounded-lg hover:bg-[#333] transition-colors">
                                                        Retake Quiz
                                                    </button>
                                                    <button onClick={() => { setActiveQuiz(null); setQuizResult(null); }} className="flex-1 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors">
                                                        Done
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        );
    }

    return (
        <div className="p-5 text-white max-w-5xl mx-auto min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">{classLevel} Content</h1>
                <button 
                    onClick={handleToggleForm}
                    className={`px-6 py-2.5 rounded-full font-bold transition-all transform active:scale-95 shadow-lg ${showUploadForm ? 'bg-white/10 text-white border border-white/20' : 'bg-white text-black hover:bg-gray-200 shadow-white/5'}`}>
                    {showUploadForm ? 'Cancel' : '+ Upload Material'}
                </button>
            </div>

            {/* Tag Filter Bar */}
            <div className="flex flex-wrap gap-2 mb-10">
                <button 
                    onClick={() => setActiveFilter(null)}
                    className={`px-5 py-1.5 rounded-full border transition-all text-sm font-medium whitespace-nowrap ${activeFilter === null ? 'bg-white text-black border-white' : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}
                >
                    All Materials
                </button>
                {AVAILABLE_TAGS.map(tag => (
                    <button 
                        key={tag}
                        onClick={() => setActiveFilter(tag)}
                        className={`px-5 py-1.5 rounded-full border transition-all text-sm font-medium whitespace-nowrap ${activeFilter === tag ? 'bg-white text-black border-white' : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}
                    >
                        {tag}
                    </button>
                ))}
            </div>

            {showUploadForm && (
                <div className="glass p-8 mb-10 border border-white/10 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="p-1.5 bg-white/10 rounded-lg text-lg inline-flex"><Upload className="w-4 h-4" /></span>
                        Share Material
                    </h2>
                    <form onSubmit={handleUpload} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-widest font-bold text-gray-500 ml-1">Title</label>
                                <input 
                                    type="text" placeholder="e.g. Unit 4 - ML Algorithms" required
                                    value={title} onChange={e => setTitle(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/30 focus:bg-white/[0.08] outline-none transition-all"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-widest font-bold text-gray-500 ml-1">Upload PDF or External Link</label>
                                <div className="flex flex-col gap-2">
                                    <input 
                                        type="file" accept="application/pdf"
                                        onChange={handleFileChange}
                                        className="text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all cursor-pointer"
                                    />
                                    {!simulatedFile && (
                                        <input 
                                            type="url" placeholder="https://..." 
                                            value={link} onChange={e => setLink(e.target.value)}
                                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/30 focus:bg-white/[0.08] outline-none transition-all"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <label className="text-xs uppercase tracking-widest font-bold text-gray-500 ml-1">Tags (Subject)</label>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_TAGS.map(tag => (
                                    <button 
                                        key={tag} type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedTags.includes(tag) ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {uploadProgress !== null && (
                            <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-bold text-white flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                        Uploading PDF...
                                    </span>
                                    <span className="text-sm font-extrabold text-white">{uploadProgress}%</span>
                                </div>
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.5)]" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            </div>
                        )}
                        
                        <button type="submit" disabled={uploadProgress !== null} className={`w-full py-4 mt-2 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl ${uploadProgress !== null ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 hover:scale-[1.01] active:scale-[0.99] shadow-white/5'}`}>
                            {uploadProgress !== null ? 'Syncing...' : `Submit Material`}
                        </button>
                    </form>
                </div>
            )}

            <div className="flex flex-col gap-6">
                {filteredContents.map(item => {
                    const isLocal = item._id.toString().startsWith('local_');
                    const userProgress = item.studyProgress?.find((entry) => entry.user === username);
                    const completedPages = Array.isArray(userProgress?.pages)
                        ? Array.from(
                            new Set(
                                userProgress.pages
                                    .map((page) => Number(page))
                                    .filter((page) => Number.isInteger(page) && page > 0)
                            )
                        ).length
                        : 0;
                    return (
                        <div key={item._id} className="glass-card overflow-hidden group">
                            <div className="p-6 flex flex-col sm:flex-row justify-between items-start gap-6">
                                <div className="flex-1">
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {item.tags?.map(tag => (
                                            <span key={tag} className="px-3 py-1 bg-white/10 border border-white/5 rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-300">{tag}</span>
                                        ))}
                                        {isLocal && <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1"><FileText className="w-3 h-3" /> Offline Demo</span>}
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2 group-hover:text-white/90 transition-colors">
                                        <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={(e) => { 
                                            if(!isLocal && item.link !== '#') {
                                                e.preventDefault();
                                                setActiveViewerId(item._id);
                                                setViewerTab('qa');
                                            }
                                        }} className="hover:underline underline-offset-4 decoration-white/20">{item.title}</a>
                                    </h3>
                                    <p className="text-gray-500 text-sm flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white"><User className="w-3 h-3" /></span>
                                        {item.uploadedBy} • {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    {username && !isLocal && (
                                        <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
                                            {completedPages} page{completedPages === 1 ? '' : 's'} completed
                                        </p>
                                    )}
                                    
                                    {item.localFileDemo && (
                                        <div className="mt-4 p-3 bg-black/20 border border-white/5 rounded-xl flex items-center gap-3 text-xs text-gray-400">
                                            <span className="text-lg inline-flex"><FileText className="w-4 h-4" /></span>
                                            <div className="flex flex-col">
                                                <span className="text-gray-300 font-medium">{item.localFileDemo.name}</span>
                                                <span>{Math.round(item.localFileDemo.size / 1024)} KB</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex flex-row sm:flex-col items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10">
                                    <button onClick={() => handleUpvote(item._id, isLocal)} className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90 text-xl" title="Upvote">▲</button>
                                    <span className="text-lg font-black text-white">{item.upvotes || 0}</span>
                                    {(role === 'Class Leader' || role === 'Teacher') && (
                                        <button onClick={() => handleDelete(item._id, isLocal)} className="p-2 hover:bg-red-500/20 text-red-500/70 hover:text-red-500 rounded-xl transition-all active:scale-90 inline-flex" title="Delete Material"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white/[0.02] border-t border-white/5 px-6 py-4 flex flex-wrap gap-6 items-center">
                                <button 
                                    onClick={() => { 
                                        if(!isLocal && item.link !== '#') { 
                                            setActiveViewerId(item._id); 
                                            setViewerTab('qa'); 
                                        } 
                                    }}
                                    className="flex items-center gap-2.5 text-xs font-bold text-gray-400 hover:text-white transition-colors group/btn"
                                >
                                    <span className="text-lg group-hover/btn:scale-110 transition-transform inline-flex"><Eye className="w-4 h-4" /></span> 
                                    {isLocal ? 'Offline Preview Only' : 'Immersive Viewer'}
                                </button>
                                <button 
                                    onClick={() => { 
                                        if(!isLocal && item.link !== '#') { 
                                            setActiveViewerId(item._id); 
                                            setViewerTab('qa'); 
                                        } 
                                    }}
                                    className="flex items-center gap-2.5 text-xs font-bold text-gray-400 hover:text-white transition-colors group/btn"
                                >
                                    <span className="text-lg group-hover/btn:scale-110 transition-transform inline-flex"><MessageSquare className="w-4 h-4" /></span>
                                    {item.comments?.length || 0} Questions & Discussion
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredContents.length === 0 && (
                   <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5 border-dashed">
                       <div className="text-4xl mb-4 opacity-20 flex justify-center"><FolderOpen className="w-8 h-8" /></div>
                       <p className="text-gray-500 font-medium italic">No materials found for {classLevel}. Be the first to upload!</p>
                   </div>
                )}
            </div>

            {/* Custom Discard Modal */}
            {showDiscardModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl shadow-black text-center">
                        <div className="text-5xl mb-4 flex justify-center"><AlertCircle className="w-10 h-10" /></div>
                        <h3 className="text-xl font-bold text-white mb-2">Discard Upload?</h3>
                        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                            Are you sure you want to discard <strong>{simulatedFile ? simulatedFile.name : (title || 'this un-submitted material')}</strong>? All progress will be lost.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDiscardModal(false)} className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all">Keep Editing</button>
                            <button onClick={() => { setShowDiscardModal(false); setShowUploadForm(false); setTitle(''); setLink(''); setSelectedTags([]); setSimulatedFile(null); }} className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all shadow-lg shadow-white/5">Yes, Discard</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
