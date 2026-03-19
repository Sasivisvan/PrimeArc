import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
const NOTE_COLORS = ['#1a1a2e', '#0f2a0f', '#1a0f2a', '#2a1a0f', '#0f1a2a', '#2a0f1a'];
const NOTE_ACCENTS = ['#b14fff', '#00e5a0', '#f4c430', '#ff4d6d', '#00e5ff', '#ff7043'];
const STORAGE_KEY = 'primearc_notes';
const MAX_FILE_SIZE_MB = 5;

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
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    return '📎';
};

export default function Notes() {
    const { classLevel, username } = useUser();
    
    const [localNotes, setLocalNotes] = useState<Note[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [communityNotes, setCommunityNotes] = useState<Note[]>([]);
    const [activeTab, setActiveTab] = useState<'my_notes' | 'community'>('my_notes');

    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newColorIndex, setNewColorIndex] = useState(0);
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
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchCommunityNotes = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/notes?classLevel=${classLevel}&isPublic=true`);
            if (res.ok) {
                const data = await res.json();
                // Map DB schema to UI schema
                const mapped = data.map((n: any) => ({
                    id: n._id,
                    title: n.title,
                    content: n.content,
                    author: n.author,
                    isPublic: true,
                    colorIndex: Math.floor(Math.random() * NOTE_COLORS.length),
                    createdAt: new Date(n.createdAt).getTime(),
                    updatedAt: new Date(n.createdAt).getTime(),
                }));
                setCommunityNotes(mapped);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localNotes));
    }, [localNotes]);

    useEffect(() => {
        fetchCommunityNotes();
    }, [classLevel]);

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

        if (isPublic) {
            // Save to DB
            try {
                await fetch('http://localhost:5000/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, author: username, classLevel, isPublic: true })
                });
                fetchCommunityNotes();
                setActiveTab('community');
            } catch (err) { console.error(err); }
        } else {
            // Save locally
            const note: Note = {
                id: Date.now().toString(),
                title, content, colorIndex: newColorIndex, files: pendingFiles,
                createdAt: Date.now(), updatedAt: Date.now(), isPublic: false
            };
            setLocalNotes(prev => [note, ...prev]);
            setActiveTab('my_notes');
        }

        setNewTitle(''); setNewContent(''); setNewColorIndex(0); setPendingFiles([]); setIsPublic(false); setShowAddForm(false);
    };

    const deleteLocalNote = (id: string) => {
        setLocalNotes(prev => prev.filter(n => n.id !== id));
    };

    const updateLocalNote = (id: string, field: 'title' | 'content', value: string) => {
        setLocalNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value, updatedAt: Date.now() } : n));
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
            }
        } catch (err) {
            console.error(err);
        }
    };

    const activeNotes = activeTab === 'my_notes' ? localNotes : communityNotes;
    const filtered = activeNotes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="page-container" style={{ position: 'relative' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notes</h1>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button onClick={() => setActiveTab('my_notes')} style={{ padding: '8px 16px', borderRadius: '20px', backgroundColor: activeTab === 'my_notes' ? '#4a90e2' : '#333', color: 'white', border: 'none', cursor: 'pointer' }}>My Notes</button>
                        <button onClick={() => setActiveTab('community')} style={{ padding: '8px 16px', borderRadius: '20px', backgroundColor: activeTab === 'community' ? '#4ade80' : '#333', color: activeTab === 'community' ? '#111' : 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Class {classLevel} Notes</button>
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
                    {showAddForm ? '✕ Cancel' : '+ New Note'}
                </button>
            </div>

            <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input className="form-input" type="text" placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {showAddForm && (
                <div className="glass-card add-form" style={{ marginBottom: '20px' }}>
                    <input className="form-input" placeholder="Note title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                    <textarea className="form-textarea" placeholder="Write your note..." value={newContent} onChange={e => setNewContent(e.target.value)} rows={4} />
                    
                    <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
                        <span>📎 Attach files</span>
                        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFilePick} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px', color: '#ffb86c' }}>
                        {activeTab === 'my_notes' ? (
                            <>
                                <input type="checkbox" id="publicToggle" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} style={{ cursor: 'pointer', width: '20px', height: '20px' }} />
                                <label htmlFor="publicToggle" style={{ cursor: 'pointer' }}>Share to Class {classLevel} Community</label>
                            </>
                        ) : (
                            <span style={{ color: '#00e5ff', fontSize: '0.9rem' }}>
                                <span style={{ marginRight: '8px' }}>✓</span> This note will be published publicly to Class {classLevel}.
                            </span>
                        )}
                    </div>

                    <div className="form-row" style={{ marginTop: '15px' }}>
                        <div className="color-picker">
                            {NOTE_ACCENTS.map((color, i) => (
                                <button
                                    key={i}
                                    style={{ 
                                        width: '32px', height: '32px', borderRadius: '50%', 
                                        backgroundColor: color, border: newColorIndex === i ? '3px solid white' : 'none',
                                        cursor: 'pointer', flexShrink: 0
                                    }}
                                    onClick={(e) => { e.preventDefault(); setNewColorIndex(i); }}
                                />
                            ))}</div>
                        <button className="btn-primary" onClick={addNote}>Save {isPublic ? 'Public Note' : 'Note'}</button>
                    </div>
                </div>
            )}

            {/* Float Highlight Ask Button */}
            {highlightData && (
                <button 
                    onClick={() => setShowAskModal(true)}
                    style={{ position: 'fixed', left: highlightData.x, top: highlightData.y, transform: 'translateX(-50%)', backgroundColor: '#f59e0b', color: '#111', fontWeight: 'bold', padding: '5px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
                >
                    Ask Q&A?
                </button>
            )}

            {/* Ask Modal */}
            {showAskModal && highlightData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                    <div style={{ backgroundColor: '#2a2a35', padding: '30px', borderRadius: '15px', width: '400px', maxWidth: '90%' }}>
                        <h2 style={{ margin: '0 0 15px', color: 'white' }}>Ask Community</h2>
                        <div style={{ backgroundColor: '#1a1a25', padding: '10px', borderRadius: '5px', color: '#f59e0b', fontStyle: 'italic', marginBottom: '15px', fontSize: '0.9rem' }}>
                            "{highlightData.text}"
                        </div>
                        <form onSubmit={submitHighlightQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input type="text" required placeholder="Question Title" value={questionTitle} onChange={e => setQuestionTitle(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: 'none' }} />
                            <textarea required placeholder="More details..." value={questionBody} onChange={e => setQuestionBody(e.target.value)} rows={3} style={{ padding: '10px', borderRadius: '5px', border: 'none' }} />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => { setShowAskModal(false); setHighlightData(null); }} style={{ flex: 1, padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '5px', backgroundColor: '#4a90e2', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Post</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="notes-grid">
                {filtered.map(note => (
                    <div key={note.id} className="note-card" style={{ background: NOTE_COLORS[note.colorIndex], borderColor: NOTE_ACCENTS[note.colorIndex] }}>
                        <div className="note-card-header">
                            <h3 style={{ margin: 0 }}>{note.title}</h3>
                            {activeTab === 'my_notes' && (
                                <button className="icon-btn-ghost" onClick={() => deleteLocalNote(note.id)}>✕</button>
                            )}
                        </div>
                        {activeTab === 'community' && <small style={{ color: '#888', display: 'block', marginBottom: '10px' }}>Shared by {note.author}</small>}
                        
                        <div onMouseUp={() => handleMouseUp(note.id)} style={{ position: 'relative' }}>
                            <p style={{ whiteSpace: 'pre-wrap', color: '#eee' }}>{note.content}</p>
                        </div>
                        
                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #333', textAlign: 'center' }}>
                            <button 
                                onClick={() => generateFlashcards(note.content)}
                                disabled={loadingFlashcards}
                                style={{ backgroundColor: '#b14fff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                            >
                                {loadingFlashcards ? 'Generating...' : '⚡ AI Flashcards'}
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
                        style={{ backgroundColor: showAnswer ? '#4a90e2' : '#2a2a35', width: '500px', height: '300px', maxWidth: '90%', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                    >
                        <h3 style={{ color: 'white', fontSize: '1.5rem', fontWeight: showAnswer ? 'normal' : 'bold' }}>
                            {showAnswer ? flashcards[activeFlashcardIndex].back : flashcards[activeFlashcardIndex].front}
                        </h3>
                    </div>
                    <p style={{ color: '#aaa', marginTop: '15px' }}>Click card to flip</p>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                        <button onClick={() => { setActiveFlashcardIndex(Math.max(0, activeFlashcardIndex - 1)); setShowAnswer(false); }} disabled={activeFlashcardIndex === 0} style={{ padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>Previous</button>
                        <button onClick={() => setFlashcards(null)} style={{ padding: '10px 20px', borderRadius: '5px', backgroundColor: '#ff4d4d', color: 'white', border: 'none', cursor: 'pointer' }}>Close</button>
                        <button onClick={() => { setActiveFlashcardIndex(Math.min(flashcards.length - 1, activeFlashcardIndex + 1)); setShowAnswer(false); }} disabled={activeFlashcardIndex === flashcards.length - 1} style={{ padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', backgroundColor: '#4ade80', border: 'none' }}>Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}
