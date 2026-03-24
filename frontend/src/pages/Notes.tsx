import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { Search, Paperclip, X, Check, FileImage, FileText, FileSpreadsheet, Video, Music, PaperclipIcon, Sparkles } from 'lucide-react';
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
    
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([]);
    
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
    const [noteUploadProgress, setNoteUploadProgress] = useState<number | null>(null);
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

    const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const results: AttachedFile[] = [];
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) continue;
            const reader = new FileReader();
            reader.readAsDataURL(file);
            await new Promise(r => reader.onload = r);
            results.push({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result as string });
        }
        setPendingFiles(prev => [...prev, ...results]);
        e.target.value = '';
    };

    const addNote = async () => {
        const title = newTitle.trim() || 'Untitled Note';
        const content = newContent.trim();
        if (!content && pendingFiles.length === 0) return;

        setIsSavingNote(true);
        setNoteUploadProgress(0);
        try {
            const baseUrl = apiBaseUrl();
            const xhr = new XMLHttpRequest();
            const result = await new Promise<{ ok: boolean; status: number; data: any }>((resolve, reject) => {
                xhr.open('POST', `${baseUrl}/api/notes`);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        setNoteUploadProgress(Math.round((event.loaded / event.total) * 100));
                    }
                };
                xhr.onload = () => {
                    try {
                        const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
                        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
                    } catch (err) {
                        reject(err);
                    }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(JSON.stringify({ title, content, author: username, classLevel, isPublic, files: pendingFiles }));
            });

            if (!result.ok) {
                alert(`Failed to add note: ${result.data?.error || 'Server error'}\n${result.data?.details || 'Please check MongoDB IP whitelist.'}`);
                return;
            }

            await Promise.all([fetchMyNotes(), fetchCommunityNotes()]);
            setActiveTab(isPublic ? 'community' : 'my_notes');
            setNewTitle('');
            setNewContent('');
            setPendingFiles([]);
            setIsPublic(false);
            setShowAddForm(false);
        } catch (err: any) { 
            console.error(err); 
            alert(`Network error: ${err.message}`);
            return;
        } finally {
            setIsSavingNote(false);
            setTimeout(() => setNoteUploadProgress(null), 400);
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
                <div className="glass-card add-form" style={{ marginBottom: '20px' }}>
                    <input className="form-input" placeholder="Note title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                    <textarea className="form-textarea" placeholder="Write your note..." value={newContent} onChange={e => setNewContent(e.target.value)} rows={4} />
                    
                    <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Paperclip size={14} /> Attach files</span>
                        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFilePick} />
                    </div>
                    {pendingFiles.length > 0 && (
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {pendingFiles.map((pf, idx) => (
                                <span key={idx} style={{ padding: '5px 10px', background: '#333', borderRadius: '5px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    {fileIcon(pf.type)} {pf.name} ({formatSize(pf.size)})
                                    <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '5px', display: 'inline-flex', alignItems: 'center' }}><X size={14} /></button>
                                </span>
                            ))}
                        </div>
                    )}

                    {noteUploadProgress !== null && (
                        <div style={{ marginTop: '15px', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
                                    {isSavingNote ? 'Uploading note to cloud...' : 'Upload complete'}
                                </span>
                                <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>{noteUploadProgress}%</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ width: `${noteUploadProgress}%`, height: '100%', background: '#fff', transition: 'width 0.2s ease' }} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px', color: '#ccc' }}>
                        {activeTab === 'my_notes' ? (
                            <>
                                <input type="checkbox" id="publicToggle" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} style={{ cursor: 'pointer', width: '20px', height: '20px' }} />
                                <label htmlFor="publicToggle" style={{ cursor: 'pointer' }}>Share to {classLevel} Community</label>
                            </>
                        ) : (
                            <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                                <span style={{ marginRight: '8px', display: 'inline-flex', verticalAlign: 'middle' }}><Check size={14} /></span> This note will be published publicly to {classLevel}.
                            </span>
                        )}
                    </div>

                    <div className="form-row" style={{ marginTop: '15px' }}>
                        <div style={{ color: '#8c8c8c', fontSize: '0.9rem' }}>Notes are saved to the cloud.</div>
                        <button className="btn-primary" onClick={addNote} disabled={isSavingNote}>{isSavingNote ? 'Uploading...' : `Save ${isPublic ? 'Public Note' : 'Note'}`}</button>
                    </div>
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
                    <div key={note.id} className="note-card" style={{ background: '#111111', borderColor: '#2b2b2b' }}>
                        <div className="note-card-header">
                            <h3 style={{ margin: 0 }}>{note.title}</h3>
                            {activeTab === 'my_notes' && (
                                <button className="icon-btn-ghost" onClick={() => deleteMyNote(note.id)}><X size={16} /></button>
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
                                        href={file.dataUrl} 
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
                                onClick={() => generateFlashcards(note.content)}
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
