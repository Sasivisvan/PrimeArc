import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Paperclip, X, Settings, Check, ChevronRight, ChevronLeft, Sparkles, AlertCircle, FileText, Layers } from 'lucide-react';
import { useUser } from '../context/UserContext';

interface Flashcard {
    front: string;
    back: string;
}

interface ContentItem {
    _id: string;
    title: string;
    classLevel: number;
    extractedText?: { page: number; content: string }[];
    createdAt: string;
}

interface SavedFlashcardSet {
    _id: string;
    topic: string;
    cards: Flashcard[];
    createdAt: string;
}

export default function Flashcards() {
    const { username, classLevel } = useUser();
    
    // Form and Setup State
    const [contents, setContents] = useState<ContentItem[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>('custom');
    const [topic, setTopic] = useState('');
    const [contextText, setContextText] = useState('');
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [numCards, setNumCards] = useState<number>(10);
    const [loading, setLoading] = useState(false);
    
    // Saved Sets for the selected doc
    const [docSets, setDocSets] = useState<SavedFlashcardSet[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Active Flashcard State
    const [cards, setCards] = useState<Flashcard[] | null>(null);
    const [activeSetId, setActiveSetId] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    // Fetch available content on mount
    useEffect(() => {
        const fetchContent = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
                const res = await fetch(`${baseUrl}/api/content?classLevel=${classLevel}`);
                if (res.ok) {
                    const data = await res.json();
                    setContents(data);
                }
            } catch (err) {
                console.error("Failed to fetch content:", err);
            }
        };
        fetchContent();
    }, [classLevel]);

    // Fetch doc flashcard sets when selection changes
    useEffect(() => {
        if (selectedDocId === 'custom') {
            setDocSets([]);
            return;
        }
        const fetchDocSets = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
                const res = await fetch(`${baseUrl}/api/flashcard-sets?user=${encodeURIComponent(username || '')}&documentId=${selectedDocId}`);
                if (res.ok) setDocSets(await res.json());
            } catch(err) { console.error(err); }
        };
        fetchDocSets();
        
        // Auto-fill topic placeholder
        const selectedDoc = contents.find(c => c._id === selectedDocId);
        if (selectedDoc && !topic) {
             setTopic(`Key concepts from: ${selectedDoc.title}`);
        }
    }, [selectedDocId, username, contents]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        if (file.type.startsWith('image/')) {
            reader.onload = (evt) => {
                const base64Str = evt.target?.result as string;
                setImageBase64(base64Str);
                setContextText(prev => prev ? prev + `\n[Attached Image: ${file.name}]` : `[Attached Image: ${file.name}]`);
            };
            reader.readAsDataURL(file);
        } else {
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    setContextText(prev => prev + '\n\n' + evt.target?.result);
                }
            };
            reader.readAsText(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = ''; 
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setCards(null);
        setActiveSetId(null);
        setCurrentIndex(0);
        setIsFlipped(false);

        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            
            let finalContextText = contextText;
            let documentTitle = undefined;
            
            // If an existing document is selected, pull its text to send to AI
            if (selectedDocId !== 'custom') {
                const item = contents.find(c => c._id === selectedDocId);
                if (item) {
                    documentTitle = item.title;
                    const extractedSections = (item.extractedText || [])
                        .map(entry => entry.content?.replace(/\s+/g, ' ').trim())
                        .filter(Boolean);
                    if (extractedSections.length > 0) {
                        finalContextText = `Document text:\n${extractedSections.join('\n\n')}\n\n${contextText}`.slice(0, 24000);
                    }
                }
            }

            const res = await fetch(`${baseUrl}/api/generate-flashcards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contentId: selectedDocId !== 'custom' ? selectedDocId : undefined,
                    topic,
                    documentTitle,
                    text: finalContextText,
                    imageBase64,
                    numCards
                })
            });
            const generatedCards = await res.json();
            
            if (res.ok && Array.isArray(generatedCards) && generatedCards.length > 0) {
                setCards(generatedCards);
                
                // If attached to a document, save the generated set automatically
                if (selectedDocId !== 'custom' && username) {
                    const saveRes = await fetch(`${baseUrl}/api/flashcard-sets`, {
                        method: 'POST',
                        headers:{ 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user: username,
                            documentId: selectedDocId,
                            topic: documentTitle || topic,
                            cards: generatedCards
                        })
                    });
                    if (saveRes.ok) {
                        // refresh sidebar list
                        const freshRes = await fetch(`${baseUrl}/api/flashcard-sets?user=${encodeURIComponent(username)}&documentId=${selectedDocId}`);
                        if (freshRes.ok) setDocSets(await freshRes.json());
                        
                        const saveJson = await saveRes.json();
                        setActiveSetId(saveJson?._id);
                    }
                }
            } else {
                console.error("Backend response:", generatedCards);
                alert(`Failed to generate valid flashcards.\nError: ${generatedCards.error || "Invalid response format"}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to server.");
        }
        setLoading(false);
    };

    const handleNext = () => {
        if (!cards) return;
        if (currentIndex < cards.length - 1) {
            setIsFlipped(false);
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!cards) return;
        if (currentIndex > 0) {
            setIsFlipped(false);
            setCurrentIndex(prev => prev - 1);
        }
    };

    const loadSavedSet = (set: SavedFlashcardSet) => {
        setCards(set.cards);
        setActiveSetId(set._id);
        setCurrentIndex(0);
        setIsFlipped(false);
    };

    const handleRetake = () => {
        setCards(null);
        setActiveSetId(null);
        setCurrentIndex(0);
        setIsFlipped(false);
    };

    return (
        <div style={{ padding: '20px 20px 100px 20px', color: 'white', maxWidth: '1000px', margin: '0 auto', minHeight: '100vh', display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            
            {/* MAIN COLUMN (Generator / Viewer) */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}><Layers size={28} /> AI Flashcards</h1>
                <p style={{ color: '#aaa', marginBottom: '30px', fontSize: '1.1rem' }}>Select a study material or define a custom topic to generate a smart flashcard deck.</p>

                {!cards && !loading && (
                    <form onSubmit={handleGenerate} style={{ backgroundColor: '#111', padding: '40px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '25px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                        
                        {/* 1. Select Study Material */}
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                <FileText size={18} /> Select Source Material
                            </label>
                            <select 
                                value={selectedDocId} 
                                onChange={e => setSelectedDocId(e.target.value)}
                                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.05rem', boxSizing: 'border-box', cursor: 'pointer' }}
                            >
                                <option value="custom">-- Custom / Manual Upload --</option>
                                {contents.map(c => (
                                    <option key={c._id} value={c._id}>{c.title}</option>
                                ))}
                            </select>
                            {selectedDocId !== 'custom' && (
                                <p style={{ color: '#8b949e', margin: '8px 0 0 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <AlertCircle size={14} /> The AI will read the extracted text from this document to generate the cards.
                                </p>
                            )}
                        </div>

                        {/* 2. Custom Instructions & Topic */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>Custom Instructions / Topic Focus</label>
                            <input 
                                type="text" placeholder={selectedDocId !== 'custom' ? "e.g. Focus on key definitions and formulas" : "e.g. French vocabulary for beginners"} 
                                value={topic} onChange={e => setTopic(e.target.value)} 
                                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.05rem', boxSizing: 'border-box' }} 
                            />
                        </div>
                        
                        {/* 3. Count Row */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>Number of Cards</label>
                            <select 
                                value={numCards} onChange={e => setNumCards(Number(e.target.value))} 
                                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.05rem', boxSizing: 'border-box' }}
                            >
                                <option value={5}>5 Cards</option>
                                <option value={10}>10 Cards</option>
                                <option value={20}>20 Cards</option>
                                <option value={30}>30 Cards</option>
                            </select>
                        </div>
                        
                        {/* 4. Manual Uploads (always visible as supplemental text/images) */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontWeight: 'bold', color: '#888', fontSize: '1.1rem' }}>Supplemental Context</label>
                                <button 
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ padding: '8px 15px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Paperclip size={14} /> Upload File/Image</span>
                                </button>
                                <input 
                                    type="file" accept=".txt,.csv,image/*" ref={fileInputRef} style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                />
                            </div>

                            {imageBase64 && (
                                <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#000', border: '1px solid #444', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <img src={imageBase64} alt="Upload preview" style={{ height: '40px', borderRadius: '5px' }} />
                                        <span style={{ color: '#aaa', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Check size={14} /> Image attached for AI analysis</span>
                                    </div>
                                    <button type="button" onClick={() => setImageBase64(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' }}><X size={16} /></button>
                                </div>
                            )}

                            <textarea 
                                placeholder="Paste additional notes or custom context here..." 
                                value={contextText} onChange={e => setContextText(e.target.value)} rows={4}
                                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.05rem', boxSizing: 'border-box', resize: 'vertical' }} 
                            />
                        </div>
                        
                        <button type="submit" disabled={loading} style={{ padding: '18px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', fontSize: '1.2rem', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px', boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Sparkles size={18} /> Generate Flashcards
                            </span>
                        </button>
                    </form>
                )}

                {loading && (
                    <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: '#111', borderRadius: '20px', border: '1px solid #333' }}>
                        <div style={{ marginBottom: '20px', animation: 'spin 2s linear infinite', display: 'flex', justifyContent: 'center' }}><Settings size={40} /></div>
                        <h2 style={{ color: '#fff', fontSize: '1.8rem' }}>AI is analyzing the material...</h2>
                        <p style={{ color: '#888', fontSize: '1.1rem' }}>Extracting core concepts for your deck.</p>
                    </div>
                )}

                {/* The Flashcard Viewer */}
                {cards && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <button onClick={handleRetake} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', alignSelf: 'flex-start' }}>
                            <X size={16} /> Exit Deck
                        </button>

                        <div style={{ width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${((currentIndex + 1) / cards.length) * 100}%`, height: '100%', backgroundColor: '#fff', transition: 'width 0.3s ease' }}></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontWeight: 'bold', fontSize: '1.1rem' }}>
                            <span>Card {currentIndex + 1} of {cards.length}</span>
                        </div>

                        {/* Card Container with Flip Animation properties */}
                        <div 
                            style={{ 
                                perspective: '1000px', 
                                width: '100%', 
                                height: '400px',
                                cursor: 'pointer'
                            }}
                            onClick={() => setIsFlipped(!isFlipped)}
                        >
                            <div style={{
                                width: '100%',
                                height: '100%',
                                transition: 'transform 0.6s',
                                transformStyle: 'preserve-3d',
                                transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)',
                                position: 'relative'
                            }}>
                                {/* Front */}
                                <div style={{
                                    position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                                    backgroundColor: '#111', border: '1px solid #444', borderRadius: '20px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)', textAlign: 'center'
                                }}>
                                    <h2 style={{ fontSize: '2.2rem', color: 'white', margin: 0 }}>{cards[currentIndex].front}</h2>
                                    <div style={{ position: 'absolute', bottom: '20px', color: '#666', fontSize: '0.9rem' }}>Click to flip</div>
                                </div>

                                {/* Back */}
                                <div style={{
                                    position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                                    backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '20px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px',
                                    transform: 'rotateX(180deg)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', textAlign: 'center'
                                }}>
                                    <h2 style={{ fontSize: '1.8rem', color: '#000', margin: 0, lineHeight: '1.5' }}>{cards[currentIndex].back}</h2>
                                    <div style={{ position: 'absolute', bottom: '20px', color: '#666', fontSize: '0.9rem' }}>Click to flip back</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                            <button 
                                onClick={handlePrev} disabled={currentIndex === 0}
                                style={{ padding: '15px 30px', backgroundColor: '#222', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid #444', borderRadius: '10px', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentIndex === 0 ? 0.3 : 1 }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><ChevronLeft size={18} /> Prev</span>
                            </button>
                            <button 
                                onClick={handleNext} disabled={currentIndex === cards.length - 1}
                                style={{ padding: '15px 30px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', borderRadius: '10px', cursor: currentIndex === cards.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIndex === cards.length - 1 ? 0.3 : 1 }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>Next <ChevronRight size={18} /></span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* SIDEBAR COLUMN (Saved Sets for Document) */}
            {selectedDocId !== 'custom' && !loading && !cards && (
                <div style={{ width: '320px', flexShrink: 0, marginTop: '10px' }}>
                    <div style={{ backgroundColor: '#111', borderRadius: '16px', border: '1px solid #333', padding: '20px', position: 'sticky', top: '20px' }}>
                        <h3 style={{ fontSize: '1.2rem', margin: '0 0 15px 0', borderBottom: '1px solid #222', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={18} /> Saved Flashcards
                        </h3>
                        
                        {docSets.length === 0 ? (
                            <p style={{ color: '#666', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                                No flashcards generated for this document yet.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {docSets.map((set) => (
                                    <div key={set._id} style={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '15px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>
                                                {set.cards.length} Cards
                                            </span>
                                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                                                {new Date(set.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            Topic: {set.topic || 'General'}
                                        </div>
                                        <button 
                                            onClick={() => loadSavedSet(set)}
                                            style={{ width: '100%', padding: '8px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
                                        >
                                            Study Deck
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}
