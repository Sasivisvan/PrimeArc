import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUser } from '../context/UserContext';
import { Search, Paperclip, X, Check, FileImage, FileText, FileSpreadsheet, Video, Music, PaperclipIcon, Sparkles } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, SendHorizontal, Bot, MessageSquare, Plus, ArrowLeft, User, Trash2, Upload } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const MAX_FILE_SIZE_MB = 5;

function apiBaseUrl() {
    return import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000';
}

interface AttachedFile {
    name: string;
    type: string;
    size: number;
    dataUrl: string; // base64
}

interface Note {
    id: string;      // local id or _id from db
    title: string;
    content: string;
    colorIndex: number;
    files?: AttachedFile[];
    author?: string; // from db
    isPublic?: boolean; // from db
    createdAt: number;
    updatedAt: number;
}

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImage size={14} />;
    if (type === 'application/pdf' || type.includes('word')) return <FileText size={14} />;
    if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet size={14} />;
    if (type.startsWith('video/')) return <Video size={14} />;
    if (type.startsWith('audio/')) return <Music size={14} />;
    return <PaperclipIcon size={14} />;
};

export default function Notes() {
    const { classLevel, username } = useUser();
    
    const [myNotes, setMyNotes] = useState<Note[]>([]);
    const [communityNotes, setCommunityNotes] = useState<Note[]>([]);
    const [activeTab, setActiveTab] = useState<'my_notes' | 'community'>('my_notes');

    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [simulatedFile, setSimulatedFile] = useState<File | null>(null);
    
    // Feature: Flashcards
    const [flashcards, setFlashcards] = useState<any[] | null>(null);
    const [loadingFlashcards, setLoadingFlashcards] = useState(false);
    const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);

    // Feature: Highlight Q&A
    const [highlightData, setHighlightData] = useState<{ text: string; noteId: string; x: number; y: number } | null>(null);
    const [showAskModal, setShowAskModal] = useState(false);
    const [questionTitle, setQuestionTitle] = useState('');
    const [questionBody, setQuestionBody] = useState('');
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiMessages, setAiMessages] = useState<{role:'user'|'ai', content:string}[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    // PDF Viewer states
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const [currentPageText, setCurrentPageText] = useState('');
    const [currentPageImage, setCurrentPageImage] = useState<string | null>(null);
    const viewerPageRef = useRef<HTMLDivElement | null>(null);

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

    const handleAiSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiPrompt.trim()) return;
        
        const currentPrompt = aiPrompt;
        setAiPrompt('');
        setIsAiLoading(true);
        const historyForRequest = [...aiMessages, { role: 'user' as const, content: currentPrompt }];
        setAiMessages(historyForRequest);

        try {
            const baseUrl = apiBaseUrl();
            const activeNote = activeNotes.find(n => n.id === activeNoteId);
            
            // Build text context for the AI
            const contextItems = [];
            if (activeNote?.content) contextItems.push(`Note Content: ${activeNote.content}`);
            
            const res = await fetch(`${baseUrl}/api/airesponse`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: currentPrompt, 
                    history: historyForRequest,
                    pageNumber,
                    pageText: currentPageText || contextItems.join('\n\n'),
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


    const [isSavingNote, setIsSavingNote] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const mapApiNote = (n: any): Note => ({
        id: n._id,
        title: n.title,
        content: n.content,
        author: n.author,
        isPublic: !!n.isPublic,
        colorIndex: 0,
        files: Array.isArray(n.files) ? n.files : [],
        createdAt: new Date(n.createdAt).getTime(),
        updatedAt: new Date(n.updatedAt || n.createdAt).getTime(),
    });

    const fetchMyNotes = async () => {
        if (!username) {
            setMyNotes([]);
            return;
        }
        try {
            const baseUrl = apiBaseUrl();
            const res = await fetch(`${baseUrl}/api/notes?classLevel=${classLevel}&author=${encodeURIComponent(username)}`);
            if (res.ok) {
                const data = await res.json();
                setMyNotes(data.map(mapApiNote));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCommunityNotes = async () => {
        try {
            const baseUrl = apiBaseUrl();
            const res = await fetch(`${baseUrl}/api/notes?classLevel=${classLevel}&isPublic=true`);
            if (res.ok) {
                const data = await res.json();
                const mapped = data.map(mapApiNote);
                setCommunityNotes(mapped);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchMyNotes();
        fetchCommunityNotes();
    }, [classLevel, username]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSimulatedFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingNote(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            if (simulatedFile) formData.append('file', simulatedFile);
            formData.append('title', title.trim() || 'Untitled Note');
            formData.append('content', content.trim());
            formData.append('classLevel', String(classLevel));
            formData.append('author', username || '');
            formData.append('isPublic', String(isPublic));

            const baseUrl = apiBaseUrl();
            const endpoint = simulatedFile ? `${baseUrl}/api/notes/upload` : `${baseUrl}/api/notes`;
            
            const xhr = new XMLHttpRequest();
            const result = await new Promise<{ ok: boolean; status: number; data: any }>((resolve, reject) => {
                xhr.open('POST', endpoint);
                if (!simulatedFile) {
                    xhr.setRequestHeader('Content-Type', 'application/json');
                }
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        setUploadProgress(Math.round((event.loaded / event.total) * 100));
                    }
                };
                xhr.onload = () => {
                    try {
                        const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
                        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
                    } catch (err) { reject(err); }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                
                if (simulatedFile) {
                    xhr.send(formData);
                } else {
                    xhr.send(JSON.stringify({ 
                        title: title.trim() || 'Untitled Note', 
                        content: content.trim(), 
                        author: username, 
                        classLevel, 
                        isPublic 
                    }));
                }
            });

            if (!result.ok) {
                alert(`Upload failed: ${result.data?.error || 'Server error'}`);
                return;
            }

            await Promise.all([fetchMyNotes(), fetchCommunityNotes()]);
            setActiveTab(isPublic ? 'community' : 'my_notes');
            setTitle('');
            setContent('');
            setSimulatedFile(null);
            setIsPublic(false);
            setShowAddForm(false);
        } catch (err: any) {
            console.error(err);
            alert(`Network error: ${err.message}`);
        } finally {
            setIsSavingNote(false);
            setTimeout(() => setUploadProgress(null), 400);
        }
    };

    const deleteMyNote = async (id: string) => {
        try {
            const baseUrl = apiBaseUrl();
            const res = await fetch(`${baseUrl}/api/notes/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(`Failed to delete note: ${data.error || 'Server error'}`);
                return;
            }
            fetchMyNotes();
            fetchCommunityNotes();
        } catch (err: any) {
            console.error(err);
            alert(`Network error: ${err.message}`);
        }
    };

    // Feature 8: Generate Flashcards
    const generateFlashcards = async (noteContent: string) => {
        if (!noteContent.trim()) return alert("Note is empty!");
        setLoadingFlashcards(true);
        setFlashcards(null);
        try {
            const res = await fetch('http://localhost:5000/api/generate-flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ noteContent })
            });
            if (res.ok) {
                const data = await res.json();
                setFlashcards(data);
                setActiveFlashcardIndex(0);
                setShowAnswer(false);
            } else {
                alert("Failed to generate flashcards.");
            }
        } catch (err) {
            console.error(err);
        }
        setLoadingFlashcards(false);
    };

    // Feature 2: Highlighting Text for Q&A
    const handleMouseUp = (noteId: string) => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && selection.toString().trim().length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setHighlightData({
                text: selection.toString().trim(),
                noteId,
                x: rect.left + rect.width / 2,
                y: rect.top - 40 // Show above text
            });
        } else {
            setHighlightData(null);
        }
    };

    const submitHighlightQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!highlightData) return;
        try {
            const res = await fetch('http://localhost:5000/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: questionTitle,
                    body: questionBody,
                    author: username,
                    classLevel,
                    contextRef: {
                        noteId: highlightData.noteId,
                        highlightedText: highlightData.text
                    }
                })
            });
            if (res.ok) {
                setShowAskModal(false);
                setQuestionTitle('');
                setQuestionBody('');
                setHighlightData(null);
                alert("Question posted to Q&A Community successfully!");
            } else {
                const data = await res.json();
                alert(`Failed to post question: ${data.error || 'Server error'}`);
            }
        } catch (err: any) {
            console.error(err);
            alert(`Network error: ${err.message}`);
        }
    };

    const activeNotes = activeTab === 'my_notes' ? myNotes : communityNotes;
    const filtered = activeNotes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));

    
    const activeNote = activeTab === 'my_notes' ? myNotes.find(n => n.id === activeNoteId) : communityNotes.find(n => n.id === activeNoteId);
    
    if (activeNoteId && activeNote) {
        const firstPdfFile = activeNote.files?.find(f => f.type === 'application/pdf');
        
        return (
            <div className="flex flex-col h-full w-full bg-black text-white absolute inset-0 z-50 overflow-hidden">
                {/* Top Bar */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setActiveNoteId(null)} 
                            className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition text-white flex items-center gap-2 text-sm font-bold pr-4"
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                        <h2 className="text-xl font-bold m-0">{activeNote.title}</h2>
                        <span className="text-gray-400 text-sm">Author: {activeNote.author}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col sm:flex-row relative">
                    {/* LEFT: Main Viewer Area (≈75%) */}
                    <div className="w-full sm:w-3/4 flex flex-col border-r border-white/10 bg-[#0a0a0a] relative group/viewer overflow-hidden">
                        {firstPdfFile ? (
                            <div className="flex-1 overflow-auto flex flex-col items-center py-10 scrollbar-hide bg-[#1a1a1a] relative">
                                {/* PDF Toolbar - Absolute Centered Floating Pill */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full opacity-0 group-hover/viewer:opacity-100 transition-opacity duration-300 shadow-2xl">
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); setPageNumber(p => Math.max(1, p - 1)); }} disabled={pageNumber <= 1} className="p-1.5 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                                        <span className="text-[10px] font-bold px-2 whitespace-nowrap min-w-[80px] text-center uppercase tracking-tight">Page {pageNumber} of {numPages || '--'}</span>
                                        <button onClick={(e) => { e.stopPropagation(); setPageNumber(p => Math.min(numPages || p, p + 1)); }} disabled={pageNumber >= (numPages || 1)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                                    </div>
                                    <div className="w-px h-4 bg-white/10 mx-1" />
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.2)); }} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><ZoomOut className="w-4 h-4" /></button>
                                        <span className="text-[10px] font-bold px-2 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                                        <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(3, s + 0.2)); }} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><ZoomIn className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                
                                <div ref={viewerPageRef} className="shadow-2xl shadow-black ring-1 ring-white/10 bg-white">
                                        <Document file={firstPdfFile.dataUrl.startsWith('http') ? firstPdfFile.dataUrl : `${apiBaseUrl()}${firstPdfFile.dataUrl}`} onLoadSuccess={onDocumentLoadSuccess}>
                                            <Page 
                                                pageNumber={pageNumber} 
                                                scale={scale} 
                                                onRenderSuccess={() => requestAnimationFrame(() => requestAnimationFrame(captureCurrentPageContext))}
                                                renderAnnotationLayer={false}
                                                renderTextLayer={true}
                                                className="rounded-sm overflow-hidden"
                                            />
                                        </Document>
                                    </div>
                                        <div className="mt-8 p-6 glass w-full max-w-4xl text-left mx-auto shrink-0 shadow-lg border border-white/5">
                                            <h3 className="font-bold mb-4 border-b border-white/10 pb-2 flex items-center gap-2">
                                                <div className="w-1 h-4 bg-white/20 rounded-full" />
                                                Author Note
                                            </h3>
                                            <p className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed">{activeNote.content}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 max-w-4xl mx-auto w-full" ref={viewerPageRef}>
                                <div className="glass p-8 rounded-2xl mb-8">
                                    <h2 className="text-3xl font-bold mb-6">{activeNote.title}</h2>
                                    <p className="whitespace-pre-wrap text-lg leading-relaxed text-gray-200">{activeNote.content}</p>
                                </div>
                                {activeNote.files && activeNote.files.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {activeNote.files.map((file, idx) => (
                                            <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col items-center text-center justify-center gap-3">
                                                {file.type.startsWith('image/') ? (
                                                    <img src={file.dataUrl} alt={file.name} className="max-w-full max-h-60 object-contain rounded-lg" />
                                                ) : (
                                                    <div className="p-4 bg-white/10 rounded-full">{fileIcon(file.type)}</div>
                                                )}
                                                <a href={file.dataUrl.startsWith('http') ? file.dataUrl : `${apiBaseUrl()}${file.dataUrl}`} download={file.name} className="text-sm font-bold truncate w-full hover:underline text-blue-400">Download {file.name}</a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Document Sidebar (≈25%) */}
                    <div className="w-full sm:w-1/4 flex flex-col glass rounded-l-lg overflow-hidden shrink-0">
                        <div className="flex border-b border-white/10 shrink-0">
                            <button className="flex-1 py-4 text-xs font-bold border-b-2 transition-colors flex justify-center items-center gap-2 border-white text-white">
                                <Bot className="w-4 h-4" /> PrimeArc AI
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto relative h-full">
                            <div className="p-4 flex flex-col h-full absolute inset-0">
                                <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4 pr-2">
                                    <div className="rounded-xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-white/10 p-4 shrink-0 shadow-lg">
                                        <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                                            <Sparkles className="w-4 h-4 text-blue-400" />
                                            Document AI
                                        </h3>
                                        <p className="text-gray-300 text-xs mt-2 leading-relaxed">
                                            Ask me to summarize, explain key concepts, or generate study questions based on this Note.
                                        </p>
                                    </div>
                                    {aiMessages.length > 0 && (
                                        <div className="flex justify-end mb-2 pr-2">
                                            <button 
                                                onClick={() => setAiMessages([])}
                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                                title="Clear AI Conversation"
                                            >
                                                <Trash2 size={12} /> Clear Chat
                                            </button>
                                        </div>
                                    )}
                                    {aiMessages.map((msg, idx) => (
                                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-white text-black' : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'}`}>
                                                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                            </div>
                                            <div className={`p-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-white text-black rounded-tr-sm' : 'bg-white/10 border border-white/10 text-white rounded-tl-sm'}`}>
                                                {msg.role === 'user' ? (
                                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                                ) : (
                                                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-headings:font-bold prose-headings:text-white prose-a:text-blue-400">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {isAiLoading && (
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shrink-0">
                                                <Bot size={14} />
                                            </div>
                                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm flex gap-1">
                                                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"></div>
                                                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <form onSubmit={handleAiSubmit} className="flex gap-2 shrink-0 pt-3 border-t border-white/10 mt-auto bg-black/20 backdrop-blur-md p-4 rounded-xl">
                                    <input 
                                        type="text" 
                                        placeholder="Ask PrimeArc AI..." 
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white focus:bg-white/10 transition-all font-medium"
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!aiPrompt.trim() || isAiLoading}
                                        className="p-2.5 bg-white text-black rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        <SendHorizontal className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="page-container" style={{ position: 'relative' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notes</h1>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button onClick={() => setActiveTab('my_notes')} style={{ padding: '8px 16px', borderRadius: '20px', backgroundColor: activeTab === 'my_notes' ? '#fff' : '#333', color: activeTab === 'my_notes' ? '#000' : 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>My Notes</button>
                        <button onClick={() => setActiveTab('community')} style={{ padding: '8px 16px', borderRadius: '20px', backgroundColor: activeTab === 'community' ? '#fff' : '#333', color: activeTab === 'community' ? '#000' : 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{classLevel} Notes</button>
                    </div>
                </div>
                {/* New Note Button available on both tabs */}
                <button 
                    className="btn-primary" 
                    onClick={() => {
                        setShowAddForm(!showAddForm);
                        if (!showAddForm && activeTab === 'community') setIsPublic(true);
                    }}
                >
                    {showAddForm ? 'Cancel' : 'New Note'}
                </button>
            </div>

            <div className="search-bar">
                <span className="search-icon"><Search size={14} /></span>
                <input className="form-input" type="text" placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {showAddForm && (
                <div className="glass p-8 mb-10 border border-white/10 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="p-1.5 bg-white/10 rounded-lg text-lg inline-flex"><Upload className="w-4 h-4" /></span>
                        Create Note
                    </h2>
                    <form onSubmit={handleUpload} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-widest font-bold text-gray-500 ml-1">Note Title</label>
                                <input 
                                    type="text" placeholder="e.g. Chapter 4 Key Concepts" required
                                    value={title} onChange={e => setTitle(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/30 focus:bg-white/[0.08] outline-none transition-all"
                                />
                                
                                <label className="text-xs uppercase tracking-widest font-bold text-gray-500 ml-1 mt-4">Note Content (Optional)</label>
                                <textarea 
                                    placeholder="Write your textual notes here..." 
                                    value={content} onChange={e => setContent(e.target.value)} rows={4}
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/30 focus:bg-white/[0.08] outline-none transition-all resize-none"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs uppercase tracking-widest font-bold text-gray-500 ml-1">Upload PDF Document</label>
                                <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-white/30 transition-all cursor-pointer group relative bg-black/20 h-full min-h-[160px]">
                                    <input 
                                        type="file" accept="application/pdf"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <Upload className="w-10 h-10 text-gray-500 mb-4 group-hover:text-white transition-colors group-hover:scale-110 duration-300" />
                                    <span className="text-sm font-bold text-gray-300 mb-2">Drag & drop your PDF here or click to browse</span>
                                    <span className="text-xs text-gray-500">Attach a PDF alongside your notes for PrimeArc AI to analyze</span>
                                </div>
                                {simulatedFile && (
                                    <div className="mt-2 text-sm text-green-400 font-bold bg-green-500/10 p-3 rounded-xl border border-green-500/20 flex justify-between items-center">
                                        📄 {simulatedFile.name}
                                        <button type="button" onClick={() => setSimulatedFile(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {uploadProgress !== null && (
                            <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-bold text-white flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                        {isSavingNote ? 'Uploading properties and documents...' : 'Upload complete'}
                                    </span>
                                    <span className="text-sm font-bold text-gray-400">{uploadProgress}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-white transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 pt-6 border-t border-white/10">
                            {activeTab === 'my_notes' ? (
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isPublic ? 'bg-white border-white text-black' : 'border-white/30 text-transparent group-hover:border-white'}`}>
                                        <Check size={14} className={isPublic ? 'opacity-100' : 'opacity-0'} />
                                    </div>
                                    <input type="checkbox" className="hidden" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Submit to {classLevel} shared community</span>
                                </label>
                            ) : (
                                <span className="text-sm text-gray-300 flex items-center gap-2">
                                    <Check size={16} className="text-white" /> Note will be published publicly.
                                </span>
                            )}
                            
                            <button 
                                type="submit" 
                                disabled={isSavingNote || (!content && !simulatedFile)}
                                className={`ml-auto px-10 py-3.5 rounded-full font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:hover:scale-100 ${isSavingNote ? 'bg-white/20 text-white cursor-not-allowed' : 'bg-white text-black'}`}
                            >
                                {isSavingNote ? 'Uploading...' : 'Save Note'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Float Highlight Ask Button */}
            {highlightData && (
                <button 
                    onClick={() => setShowAskModal(true)}
                    style={{ position: 'fixed', left: highlightData.x, top: highlightData.y, transform: 'translateX(-50%)', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', padding: '5px 10px', borderRadius: '5px', border: '1px solid #333', cursor: 'pointer', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }}
                >
                    Ask Q&A?
                </button>
            )}

            {/* Ask Modal */}
            {showAskModal && highlightData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                    <div style={{ backgroundColor: '#111', padding: '30px', borderRadius: '15px', width: '400px', maxWidth: '90%', border: '1px solid #333' }}>
                        <h2 style={{ margin: '0 0 15px', color: 'white' }}>Ask Community</h2>
                        <div style={{ backgroundColor: '#222', padding: '10px', borderRadius: '5px', color: '#ccc', fontStyle: 'italic', marginBottom: '15px', fontSize: '0.9rem', borderLeft: '3px solid #555' }}>
                            "{highlightData.text}"
                        </div>
                        <form onSubmit={submitHighlightQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input type="text" required placeholder="Question Title" value={questionTitle} onChange={e => setQuestionTitle(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #444', backgroundColor: '#000', color: '#fff' }} />
                            <textarea required placeholder="More details..." value={questionBody} onChange={e => setQuestionBody(e.target.value)} rows={3} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #444', backgroundColor: '#000', color: '#fff' }} />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => { setShowAskModal(false); setHighlightData(null); }} style={{ flex: 1, padding: '10px', borderRadius: '5px', cursor: 'pointer', backgroundColor: '#333', color: '#fff', border: 'none' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '5px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Post</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="notes-grid">
                {filtered.map(note => (
                    <div key={note.id} className="note-card cursor-pointer hover:bg-white/[0.05] transition-colors" style={{ background: '#111111', borderColor: '#2b2b2b' }} onClick={() => setActiveNoteId(note.id)}>
                        <div className="note-card-header">
                            <h3 style={{ margin: 0 }}>{note.title}</h3>
                            {activeTab === 'my_notes' && (
                                <button className="icon-btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); deleteMyNote(note.id); }}><X size={16} /></button>
                            )}
                        </div>
                        {activeTab === 'community' && <small style={{ color: '#888', display: 'block', marginBottom: '10px' }}>Shared by {note.author}</small>}
                        
                        <div onMouseUp={() => handleMouseUp(note.id)} style={{ position: 'relative' }}>
                            <p style={{ whiteSpace: 'pre-wrap', color: '#eee' }}>{note.content}</p>
                        </div>
                        
                        {note.files && note.files.length > 0 && (
                            <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {note.files.map((file, idx) => (
                                    <a 
                                        key={idx} 
                                        href={file.dataUrl.startsWith('http') ? file.dataUrl : `${apiBaseUrl()}${file.dataUrl}`} 
                                        download={file.type === 'application/pdf' ? undefined : file.name}
                                        target={file.type === 'application/pdf' ? "_blank" : undefined}
                                        rel="noopener noreferrer"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', transition: 'background 0.2s' }}
                                    >
                                        <span>{fileIcon(file.type)}</span>
                                        <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                        <span style={{ color: '#aaa', fontSize: '0.8rem' }}>({formatSize(file.size)})</span>
                                    </a>
                                ))}
                            </div>
                        )}
                        
                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #333', textAlign: 'center' }}>
                            <button 
                                onClick={(e) => { e.stopPropagation(); generateFlashcards(note.content); }}
                                disabled={loadingFlashcards}
                                style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{loadingFlashcards ? 'Generating...' : <><Sparkles size={14} /> AI Flashcards</>}</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Flashcard Modal */}
            {flashcards && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, flexDirection: 'column' }}>
                    <h2 style={{ color: 'white', marginBottom: '20px' }}>AI Flashcards ({activeFlashcardIndex + 1}/{flashcards.length})</h2>
                    <div 
                        onClick={() => setShowAnswer(!showAnswer)}
                        style={{ backgroundColor: showAnswer ? '#fff' : '#111', width: '500px', height: '300px', maxWidth: '90%', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: showAnswer ? 'none' : '1px solid #444' }}
                    >
                        <h3 style={{ color: showAnswer ? '#000' : 'white', fontSize: '1.5rem', fontWeight: showAnswer ? 'normal' : 'bold' }}>
                            {showAnswer ? flashcards[activeFlashcardIndex].back : flashcards[activeFlashcardIndex].front}
                        </h3>
                    </div>
                    <p style={{ color: '#aaa', marginTop: '15px' }}>Click card to flip</p>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                        <button onClick={() => { setActiveFlashcardIndex(Math.max(0, activeFlashcardIndex - 1)); setShowAnswer(false); }} disabled={activeFlashcardIndex === 0} style={{ padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', backgroundColor: '#333', color: '#fff', border: 'none' }}>Previous</button>
                        <button onClick={() => setFlashcards(null)} style={{ padding: '10px 20px', borderRadius: '5px', backgroundColor: '#111', color: '#fff', border: '1px solid #555', cursor: 'pointer' }}>Close</button>
                        <button onClick={() => { setActiveFlashcardIndex(Math.min(flashcards.length - 1, activeFlashcardIndex + 1)); setShowAnswer(false); }} disabled={activeFlashcardIndex === flashcards.length - 1} style={{ padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', backgroundColor: '#fff', color: '#000', border: 'none', fontWeight: 'bold' }}>Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}
