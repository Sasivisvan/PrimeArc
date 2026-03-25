import React, { useState, useRef, useEffect } from 'react';
import { Brain, Paperclip, X, Settings, Trophy, Check, ChevronRight, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { useUser } from '../context/UserContext';

interface QuizQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation?: string;
}

interface ContentItem {
    _id: string;
    title: string;
    classLevel: number;
    extractedText?: { page: number; content: string }[];
    createdAt: string;
}

interface SavedQuiz {
    _id: string;
    difficulty: string;
    questions: QuizQuestion[];
    bestScore: number;
    attempts: number;
}

export default function Quizzes() {
    const { username, classLevel } = useUser();
    
    // Form and Setup State
    const [contents, setContents] = useState<ContentItem[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>('custom');
    const [topic, setTopic] = useState('');
    const [contextText, setContextText] = useState('');
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [quizDifficulty, setQuizDifficulty] = useState('medium');
    const [quizCount, setQuizCount] = useState<number>(5);
    const [loading, setLoading] = useState(false);
    
    // Saved Quizzes for the selected doc
    const [docQuizzes, setDocQuizzes] = useState<SavedQuiz[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Active Quiz State
    const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
    const [activeQuizId, setActiveQuizId] = useState<string | null>(null); // To save score to DB if it's a saved quiz
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);

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

    // Fetch doc quizzes when selection changes
    useEffect(() => {
        if (selectedDocId === 'custom') {
            setDocQuizzes([]);
            return;
        }
        const fetchDocQuizzes = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
                const res = await fetch(`${baseUrl}/api/quizzes?user=${encodeURIComponent(username || '')}&documentId=${selectedDocId}`);
                if (res.ok) setDocQuizzes(await res.json());
            } catch(err) { console.error(err); }
        };
        fetchDocQuizzes();
        
        // Auto-fill topic placeholder
        const selectedDoc = contents.find(c => c._id === selectedDocId);
        if (selectedDoc && !topic) {
             setTopic(`Questions based on: ${selectedDoc.title}`);
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
        setQuestions(null);
        setActiveQuizId(null);
        setCurrentIndex(0);
        setScore(0);
        setShowResults(false);
        setSelectedOption(null);

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

            const res = await fetch(`${baseUrl}/api/generate-quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contentId: selectedDocId !== 'custom' ? selectedDocId : undefined,
                    topic,
                    documentTitle,
                    text: finalContextText,
                    imageBase64,
                    difficulty: quizDifficulty,
                    numQuestions: quizCount
                })
            });
            const generatedQs = await res.json();
            
            if (res.ok && Array.isArray(generatedQs) && generatedQs.length > 0) {
                setQuestions(generatedQs);
                
                // If attached to a document, save the generated quiz automatically
                if (selectedDocId !== 'custom' && username) {
                    const saveRes = await fetch(`${baseUrl}/api/quizzes`, {
                        method: 'POST',
                        headers:{ 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user: username,
                            documentId: selectedDocId,
                            topic: documentTitle || topic,
                            difficulty: quizDifficulty,
                            questions: generatedQs
                        })
                    });
                    if (saveRes.ok) {
                        // refreshing doc quizzes in background
                        const freshRes = await fetch(`${baseUrl}/api/quizzes?user=${encodeURIComponent(username)}&documentId=${selectedDocId}`);
                        if (freshRes.ok) setDocQuizzes(await freshRes.json());
                        
                        // Grab the returned ID so we can update the score later
                        const saveJson = await saveRes.json();
                        setActiveQuizId(saveJson?._id);
                    }
                }
            } else {
                console.error("Backend response:", generatedQs);
                alert(`Failed to generate valid questions.\nError: ${generatedQs.error || "Invalid response format"}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to server.");
        }
        setLoading(false);
    };

    const handleAnswer = (option: string) => {
        if (selectedOption !== null) return;
        setSelectedOption(option);
        
        if (questions && option.trim() === questions[currentIndex].answer.trim()) {
            setScore(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (!questions) return;
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOption(null);
        } else {
            setShowResults(true);
            saveScoreToDb();
        }
    };
    
    const saveScoreToDb = async () => {
        // Only save if it's tied to an active saved quiz (either just generated or loaded from history)
        if (!activeQuizId || !questions) return;
        
        let finalCorrect = score;
        // Check the final answer locally since state `score` might lag by half a tick in `handleNext` 
        if (selectedOption && selectedOption.trim() === questions[currentIndex].answer.trim()) {
            finalCorrect += 1;
        }

        const finalScorePercent = Math.round((finalCorrect / questions.length) * 100);
        
        try {
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            await fetch(`${baseUrl}/api/quizzes/${activeQuizId}/score`, {
                method: 'PUT',
                headers:{ 'Content-Type': 'application/json' },
                body: JSON.stringify({ score: finalScorePercent })
            });
            // refresh sidebar list
            const freshRes = await fetch(`${baseUrl}/api/quizzes?user=${encodeURIComponent(username || '')}&documentId=${selectedDocId}`);
            if (freshRes.ok) setDocQuizzes(await freshRes.json());
        } catch(er) { console.error(er); }
    };

    const loadSavedQuiz = (quiz: SavedQuiz) => {
        setQuestions(quiz.questions);
        setActiveQuizId(quiz._id);
        setCurrentIndex(0);
        setScore(0);
        setShowResults(false);
        setSelectedOption(null);
    };

    const handleRetake = () => {
        setQuestions(null);
        setActiveQuizId(null);
        setCurrentIndex(0);
        setScore(0);
        setShowResults(false);
        setSelectedOption(null);
    };

    return (
        <div style={{ padding: '20px 20px 100px 20px', color: 'white', maxWidth: '1000px', margin: '0 auto', minHeight: '100vh', display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            
            {/* MAIN COLUMN (Generator / Quiz Taker) */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}><Brain size={28} /> Concept Quizzes</h1>
                <p style={{ color: '#aaa', marginBottom: '30px', fontSize: '1.1rem' }}>Select a study material or define a custom topic to generate interactive quizzes.</p>

                {!questions && !loading && (
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
                                    <AlertCircle size={14} /> The AI will automatically read the extracted text from this document to generate the quiz.
                                </p>
                            )}
                        </div>

                        {/* 2. Custom Instructions & Topic */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>Custom Instructions / Topic</label>
                            <input 
                                type="text" placeholder={selectedDocId !== 'custom' ? "e.g. give me descriptive questions, or scenario based questions" : "e.g. Scenario based questions or Descriptive questions"} 
                                value={topic} onChange={e => setTopic(e.target.value)} 
                                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.05rem', boxSizing: 'border-box' }} 
                            />
                        </div>
                        
                        {/* 3. Difficulty & Count Row */}
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>Difficulty</label>
                                <select 
                                    value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)} 
                                    style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.05rem', boxSizing: 'border-box' }}
                                >
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>Number of Questions</label>
                                <select 
                                    value={quizCount} onChange={e => setQuizCount(Number(e.target.value))} 
                                    style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.05rem', boxSizing: 'border-box' }}
                                >
                                    <option value={3}>3 Questions</option>
                                    <option value={5}>5 Questions</option>
                                    <option value={10}>10 Questions</option>
                                    <option value={15}>15 Questions</option>
                                </select>
                            </div>
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
                                <Sparkles size={18} /> Generate AI Quiz
                            </span>
                        </button>
                    </form>
                )}

                {loading && (
                    <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: '#111', borderRadius: '20px', border: '1px solid #333' }}>
                        <div style={{ marginBottom: '20px', animation: 'spin 2s linear infinite', display: 'flex', justifyContent: 'center' }}><Settings size={40} /></div>
                        <h2 style={{ color: '#fff', fontSize: '1.8rem' }}>AI is analyzing the material...</h2>
                        <p style={{ color: '#888', fontSize: '1.1rem' }}>Preparing challenging questions just for you.</p>
                    </div>
                )}

                {/* The ongoing Interactive Quiz */}
                {questions && !showResults && (
                    <div style={{ backgroundColor: '#111', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                        
                        <button onClick={handleRetake} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
                            <X size={16} /> Exit Quiz
                        </button>

                        <div style={{ width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', marginBottom: '25px', overflow: 'hidden' }}>
                            <div style={{ width: `${((currentIndex + 1) / questions.length) * 100}%`, height: '100%', backgroundColor: '#fff', transition: 'width 0.3s ease' }}></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', color: '#888', fontWeight: 'bold', fontSize: '1.1rem' }}>
                            <span>Question {currentIndex + 1} of {questions.length}</span>
                            <span>Score: {score}</span>
                        </div>

                        <h2 style={{ fontSize: '1.6rem', marginBottom: '35px', lineHeight: '1.5', color: 'white' }}>
                            {questions[currentIndex].question}
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {questions[currentIndex].options.map((opt, i) => {
                                const isSelected = selectedOption === opt;
                                const isCorrect = opt.trim() === questions[currentIndex].answer.trim();
                                
                                let bgColor = '#000';
                                let borderColor = '#333';
                                let textColor = 'white';
                                let opacityVal = 1;

                                if (selectedOption) {
                                    if (isCorrect) {
                                        bgColor = 'rgba(34, 197, 94, 0.1)'; 
                                        borderColor = 'rgba(34, 197, 94, 0.4)';
                                        textColor = '#4ade80';
                                    } else if (isSelected) {
                                        bgColor = 'rgba(239, 68, 68, 0.1)'; 
                                        borderColor = 'rgba(239, 68, 68, 0.4)';
                                        textColor = '#f87171';
                                    } else {
                                        opacityVal = 0.5;
                                    }
                                }

                                return (
                                    <button 
                                        key={i}
                                        onClick={() => handleAnswer(opt)}
                                        disabled={selectedOption !== null}
                                        style={{ 
                                            padding: '18px 25px', textAlign: 'left', fontSize: '1.15rem', 
                                            backgroundColor: bgColor, border: `2px solid ${borderColor}`, borderRadius: '12px', 
                                            color: textColor, cursor: selectedOption ? 'default' : 'pointer',
                                            transition: 'all 0.2s', opacity: opacityVal,
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                    >
                                        <span>{opt}</span>
                                        {selectedOption && isCorrect && <span style={{ color: '#4ade80', display: 'inline-flex' }}><Check size={18} /></span>}
                                        {selectedOption && isSelected && !isCorrect && <span style={{ color: '#f87171', display: 'inline-flex' }}><X size={18} /></span>}
                                    </button>
                                );
                            })}
                        </div>

                        {selectedOption && (
                            <div style={{ marginTop: '25px', padding: '20px', borderRadius: '10px', backgroundColor: '#000', borderLeft: '4px solid #fff', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '1.2rem' }}>Explanation</h4>
                                <p style={{ margin: '0 0 20px 0', color: '#ddd', fontSize: '1.1rem', lineHeight: '1.5' }}>
                                    {questions[currentIndex].explanation || "No advanced explanation was provided by the AI for this question."}
                                </p>
                                <button 
                                    onClick={handleNext}
                                    style={{ alignSelf: 'flex-end', padding: '12px 30px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', fontSize: '1.15rem', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(255, 255, 255, 0.2)' }}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{currentIndex < questions.length - 1 ? 'Next Question' : 'View Final Score'} <ChevronRight size={16} /></span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {showResults && questions && (
                    <div style={{ backgroundColor: '#111', padding: '60px 40px', borderRadius: '20px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                        <div style={{ fontSize: '5rem', marginBottom: '20px' }}>
                            <Trophy size={40} color="#fff" />
                        </div>
                        
                        <h2 style={{ fontSize: '2.5rem', marginBottom: '15px', color: score === questions.length ? '#fff' : 'white' }}>
                            Quiz Complete!
                        </h2>
                        
                        <p style={{ fontSize: '1.4rem', color: '#aaa', marginBottom: '40px' }}>
                            You scored <strong style={{ color: 'white', fontSize: '2rem' }}>{score}</strong> out of <strong style={{ color: 'white', fontSize: '2rem' }}>{questions.length}</strong>
                        </p>
                        
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                            <button 
                                onClick={() => {
                                    setQuestions(quiz => quiz); 
                                    setCurrentIndex(0);
                                    setScore(0);
                                    setShowResults(false);
                                    setSelectedOption(null);
                                }}
                                style={{ padding: '15px 30px', backgroundColor: '#333', color: 'white', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                            >
                                Review & Retake
                            </button>
                            <button 
                                onClick={handleRetake}
                                style={{ padding: '15px 30px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)' }}
                            >
                                Back to Setup
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* SIDEBAR COLUMN (Saved Quizzes for Document) */}
            {selectedDocId !== 'custom' && !loading && !questions && (
                <div style={{ width: '320px', flexShrink: 0, marginTop: '10px' }}>
                    <div style={{ backgroundColor: '#111', borderRadius: '16px', border: '1px solid #333', padding: '20px', position: 'sticky', top: '20px' }}>
                        <h3 style={{ fontSize: '1.2rem', margin: '0 0 15px 0', borderBottom: '1px solid #222', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Trophy size={18} /> Saved Quizzes
                        </h3>
                        
                        {docQuizzes.length === 0 ? (
                            <p style={{ color: '#666', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                                No generated quizzes saved for this document yet. Generate one to see it here!
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {docQuizzes.map((q) => (
                                    <div key={q._id} style={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '15px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff', textTransform: 'uppercase' }}>
                                                {q.difficulty} • {q.questions.length} Qs
                                            </span>
                                            <span style={{ fontSize: '0.8rem', backgroundColor: '#222', padding: '2px 8px', borderRadius: '4px', color: '#aaa' }}>
                                                Best: {q.bestScore}%
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>
                                            Attempts: {q.attempts}
                                        </div>
                                        <button 
                                            onClick={() => loadSavedQuiz(q)}
                                            style={{ width: '100%', padding: '8px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
                                        >
                                            Take / Review
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
