import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

interface Comment {
    _id?: string;
    user: string;
    text: string;
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
    createdAt: string;
    localFileDemo?: { name: string; size: number };
}

const AVAILABLE_TAGS = ['Math', 'Science', 'History', 'English', 'Computer Science', 'General'];

export default function Content() {
    const { classLevel, username } = useUser();
    const [contents, setContents] = useState<ContentItem[]>([]);
    
    // Upload form state
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [simulatedFile, setSimulatedFile] = useState<File | null>(null);
    
    // UI state
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');

    const fetchContent = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/content?classLevel=${classLevel}`);
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
        
        let localFileDemoObj = undefined;
        
        // Demo feature: If an actual file is chosen, we save its metadata to localStorage to simulate a database upload
        if (simulatedFile) {
            localFileDemoObj = { name: simulatedFile.name, size: simulatedFile.size };
            
            const newItem = {
                _id: 'local_' + Date.now(),
                title: title,
                link: link || '#', // Placeholder if they uploaded a local file
                classLevel,
                uploadedBy: username,
                tags: selectedTags,
                upvotes: 0,
                comments: [],
                createdAt: new Date().toISOString(),
                localFileDemo: localFileDemoObj
            };
            
            const localStr = localStorage.getItem(`primearc_local_content_${classLevel}`);
            const localDocs = localStr ? JSON.parse(localStr) : [];
            localDocs.push(newItem);
            localStorage.setItem(`primearc_local_content_${classLevel}`, JSON.stringify(localDocs));
        } else {
            // Standard external link database upload
            try {
                await fetch('http://localhost:5000/api/content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title, link, classLevel, uploadedBy: username, tags: selectedTags
                    })
                });
            } catch (err) {
                console.error(err);
            }
        }
        
        setTitle('');
        setLink('');
        setSelectedTags([]);
        setSimulatedFile(null);
        setShowUploadForm(false);
        fetchContent();
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
            await fetch(`http://localhost:5000/api/content/${id}/upvote`, { method: 'PUT' });
            fetchContent();
        } catch (err) { console.error(err); }
    };

    const handleComment = async (e: React.FormEvent, id: string, isLocal: boolean) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        if (isLocal) {
            const localStr = localStorage.getItem(`primearc_local_content_${classLevel}`);
            if (localStr) {
                const localDocs = JSON.parse(localStr);
                const doc = localDocs.find((d:any) => d._id === id);
                if (doc) { 
                    doc.comments = doc.comments || [];
                    doc.comments.push({ user: username, text: commentText, createdAt: new Date().toISOString() }); 
                }
                localStorage.setItem(`primearc_local_content_${classLevel}`, JSON.stringify(localDocs));
            }
            setCommentText('');
            fetchContent();
            return;
        }

        try {
            await fetch(`http://localhost:5000/api/content/${id}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: username, text: commentText })
            });
            setCommentText('');
            fetchContent();
        } catch (err) { console.error(err); }
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const filteredContents = activeFilter 
        ? contents.filter(c => c.tags && c.tags.includes(activeFilter))
        : contents;

    return (
        <div style={{ padding: '20px', color: 'white', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '2rem', margin: 0 }}>Class {classLevel} Content</h1>
                <button 
                    onClick={handleToggleForm}
                    style={{ padding: '10px 20px', backgroundColor: showUploadForm ? '#e74c3c' : '#4a90e2', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                    {showUploadForm ? 'Cancel' : 'Upload Material'}
                </button>
            </div>

            {/* Tag Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
                <button 
                    onClick={() => setActiveFilter(null)}
                    style={{ padding: '6px 15px', borderRadius: '20px', border: '1px solid #555', backgroundColor: activeFilter === null ? '#4ade80' : 'transparent', color: activeFilter === null ? '#111' : '#ccc', cursor: 'pointer', fontWeight: activeFilter === null ? 'bold' : 'normal' }}
                >
                    All
                </button>
                {AVAILABLE_TAGS.map(tag => (
                    <button 
                        key={tag}
                        onClick={() => setActiveFilter(tag)}
                        style={{ padding: '6px 15px', borderRadius: '20px', border: '1px solid #555', backgroundColor: activeFilter === tag ? '#4ade80' : 'transparent', color: activeFilter === tag ? '#111' : '#ccc', cursor: 'pointer', fontWeight: activeFilter === tag ? 'bold' : 'normal' }}
                    >
                        {tag}
                    </button>
                ))}
            </div>

            {showUploadForm && (
                <form onSubmit={handleUpload} style={{ backgroundColor: '#2a2a35', padding: '20px', borderRadius: '10px', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h3 style={{ margin: '0 0 5px 0' }}>Upload Resource</h3>
                    
                    <input type="text" placeholder="Material Title (e.g., Chapter 1 Math PDF)" required value={title} onChange={e => setTitle(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: 'none', backgroundColor: '#1a1a25', color: 'white' }} />
                    
                    <div style={{ padding: '20px', border: '1px dashed #4a90e2', borderRadius: '10px', backgroundColor: '#1a1a25', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#ccc' }}><strong>Upload a Local File</strong> (Demo)</p>
                        <label style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: '#333', color: 'white', borderRadius: '8px', cursor: 'pointer', border: '1px solid #555', fontWeight: 'bold', transition: 'background 0.2s' }}>
                            Choose File...
                            <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                        </label>
                        {simulatedFile && <p style={{ margin: '15px 0 0 0', color: '#4ade80', fontSize: '0.95rem', fontWeight: 'bold' }}>✓ Selected: {simulatedFile.name}</p>}
                    </div>

                    <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', fontSize: '0.9rem', margin: '-5px 0' }}>— OR —</div>

                    <input type="url" placeholder="Resource Link (Drive, Docs, etc.)" value={link} onChange={e => setLink(e.target.value)} disabled={!!simulatedFile} style={{ padding: '10px', borderRadius: '5px', border: 'none', backgroundColor: '#1a1a25', color: 'white', opacity: simulatedFile ? 0.5 : 1 }} />
                    
                    <div>
                        <span style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Select Tags:</span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {AVAILABLE_TAGS.map(tag => (
                                <button
                                    type="button"
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    style={{ padding: '5px 12px', borderRadius: '15px', border: '1px solid #b14fff', backgroundColor: selectedTags.includes(tag) ? '#b14fff' : 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <button type="submit" style={{ padding: '12px', backgroundColor: '#4ade80', color: '#111', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' }}>Upload to Class {classLevel}</button>
                </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {filteredContents.map(item => {
                    const isLocal = item._id.toString().startsWith('local_');
                    return (
                    <div key={item._id} style={{ backgroundColor: '#2a2a35', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    {item.tags?.map(tag => (
                                        <span key={tag} style={{ padding: '3px 10px', backgroundColor: '#1a1a25', borderRadius: '12px', fontSize: '0.8rem', color: '#00e5ff' }}>{tag}</span>
                                    ))}
                                    {isLocal && <span style={{ padding: '3px 10px', backgroundColor: '#4a90e233', borderRadius: '12px', fontSize: '0.8rem', color: '#4a90e2' }}>📄 Local File</span>}
                                </div>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem' }}>
                                    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#4a90e2', textDecoration: 'none' }}>{item.title}</a>
                                </h3>
                                <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
                                    Uploaded by {item.uploadedBy} • {new Date(item.createdAt).toLocaleDateString()}
                                </p>
                                {item.localFileDemo && (
                                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1a1a25', borderRadius: '5px', fontSize: '0.9rem', color: '#ccc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span>📎 {item.localFileDemo.name}</span>
                                        <span style={{ color: '#666' }}>({Math.round(item.localFileDemo.size / 1024)} KB)</span>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                                <button onClick={() => handleUpvote(item._id, isLocal)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: '1.5rem', marginBottom: '5px' }}>▲</button>
                                <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'white' }}>{item.upvotes || 0}</span>
                            </div>
                        </div>

                        {/* Actions bar */}
                        <div style={{ backgroundColor: '#1a1a25', padding: '10px 20px', borderTop: '1px solid #333', display: 'flex', gap: '20px' }}>
                            <a href={item.link} onClick={(e) => { if(isLocal || item.link === '#') e.preventDefault() }} style={{ color: isLocal ? '#555' : '#aaa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.95rem' }}>
                                🔗 {isLocal ? 'Offline File' : 'Open Resource'}
                            </a>
                            <button 
                                onClick={() => setActiveCommentId(activeCommentId === item._id ? null : item._id)}
                                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.95rem', padding: 0 }}
                            >
                                💬 {item.comments?.length || 0} Comments
                            </button>
                        </div>

                        {/* Comments Section */}
                        {activeCommentId === item._id && (
                            <div style={{ backgroundColor: '#151520', padding: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                                    {(!item.comments || item.comments.length === 0) ? (
                                        <p style={{ color: '#666', fontStyle: 'italic', margin: 0 }}>No comments yet.</p>
                                    ) : (
                                        item.comments.map((c, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '10px' }}>
                                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#4a90e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                                                    {c.user.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ backgroundColor: '#2a2a35', padding: '10px 15px', borderRadius: '0 10px 10px 10px', flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                        <strong style={{ color: '#eee', fontSize: '0.9rem' }}>{c.user}</strong>
                                                    </div>
                                                    <p style={{ margin: 0, color: '#ccc', fontSize: '0.95rem' }}>{c.text}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <form onSubmit={(e) => handleComment(e, item._id, isLocal)} style={{ display: 'flex', gap: '10px' }}>
                                    <input 
                                        type="text" placeholder="Write a comment..." required
                                        value={commentText} onChange={e => setCommentText(e.target.value)}
                                        style={{ flex: 1, padding: '12px', borderRadius: '25px', border: '1px solid #444', backgroundColor: 'transparent', color: 'white' }}
                                    />
                                    <button type="submit" style={{ padding: '0 20px', borderRadius: '25px', border: 'none', backgroundColor: '#4a90e2', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                                        Send
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                )})}

                {filteredContents.length === 0 && (
                   <p style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>No materials found for Class {classLevel}.</p>
                )}
            </div>

            {/* Custom Discard Modal */}
            {showDiscardModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: '#2a2a35', padding: '30px', borderRadius: '15px', width: '380px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', animation: 'fadeIn 0.3s ease', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚠️</div>
                        <h3 style={{ margin: '0 0 15px 0', color: '#ff4d4d', fontSize: '1.4rem' }}>Discard Upload?</h3>
                        <p style={{ color: '#ccc', fontSize: '1.05rem', marginBottom: '25px', lineHeight: '1.5' }}>
                            Are you sure you want to discard <strong>{simulatedFile ? simulatedFile.name : (title || 'this un-submitted material')}</strong>? All progress will be lost.
                        </p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={() => setShowDiscardModal(false)} style={{ padding: '12px 20px', backgroundColor: '#444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Keep Editing</button>
                            <button onClick={() => { setShowDiscardModal(false); setShowUploadForm(false); setTitle(''); setLink(''); setSelectedTags([]); setSimulatedFile(null); }} style={{ padding: '12px 20px', backgroundColor: '#ff4d4d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(255, 77, 77, 0.3)' }}>Yes, Discard</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
