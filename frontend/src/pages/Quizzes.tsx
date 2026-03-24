import { useState, useRef } from 'react';
import { Brain, Paperclip, X, Settings, Trophy, Check, ChevronRight } from 'lucide-react';

interface QuizQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation?: string;
}

export default function Quizzes() {
    const [topic, setTopic] = useState('');
    const [contextText, setContextText] = useState('');
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [numQuestions, setNumQuestions] = useState<number>(5);
    const [loading, setLoading] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Quiz State
    const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        // Handle images (for multimodal)
        if (file.type.startsWith('image/')) {
            reader.onload = (evt) => {
                const base64Str = evt.target?.result as string;
                setImageBase64(base64Str);
                setContextText(prev => prev ? prev + `\n[Attached Image: ${file.name}]` : `[Attached Image: ${file.name}]`);
            };
            reader.readAsDataURL(file);
        } else {
            // Handle plain text
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    setContextText(prev => prev + '\n\n' + evt.target?.result);
                }
            };
            reader.readAsText(file);
        }

        // reset input so the same file could be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = ''; 
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setQuestions(null);
        setCurrentIndex(0);
        setScore(0);
        setShowResults(false);
        setSelectedOption(null);

        try {
            const res = await fetch('http://localhost:5000/api/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topic, 
                    text: contextText,
                    imageBase64: imageBase64, // Send binary data if it's an image
                    numQuestions
                })
            });
            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
            } else {
                alert("Failed to generate quiz.");
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to server.");
        }
        setLoading(false);
    };

    const handleAnswer = (option: string) => {
        if (selectedOption !== null) return; // Prevent changing answer
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
        }
    };

    const handleRetake = () => {
        setQuestions(null);
        setCurrentIndex(0);
        setScore(0);
        setShowResults(false);
        setSelectedOption(null);
        // keep topic and context so they can easily regenerate
    };

    return (
        <div style={{ padding: '20px 20px 100px 20px', color: 'white', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}><Brain size={28} /> Concept Quizzes</h1>
            <p style={{ color: '#aaa', marginBottom: '40px', fontSize: '1.1rem' }}>Generate AI quizzes from any topic or upload your study material (docs, images) to ensure you have the concepts clear.</p>

            {!questions && !loading && (
                <form onSubmit={handleGenerate} style={{ backgroundColor: '#111', padding: '40px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>Topic / Subject</label>
                        <input 
                            type="text" required placeholder="e.g. Thermodynamics, World War 2, Javascript Promises" 
                            value={topic} onChange={e => setTopic(e.target.value)} 
                            style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.1rem', boxSizing: 'border-box' }} 
                        />
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>Number of Questions</label>
                        <input 
                            type="number" min="1" max="20" required
                            value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))} 
                            style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.1rem', boxSizing: 'border-box' }} 
                        />
                        <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '0.9rem' }}>Max 20. This may reduce based on the available content in your study material.</p>
                    </div>
                    
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontWeight: 'bold', color: '#888', fontSize: '1.1rem' }}>Study Material Context</label>
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
                            placeholder="Paste your notes here, or upload a file / diagram..." 
                            value={contextText} onChange={e => setContextText(e.target.value)} rows={6}
                            style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.05rem', boxSizing: 'border-box', resize: 'vertical' }} 
                        />
                    </div>
                    
                    <button type="submit" style={{ padding: '18px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', fontSize: '1.2rem', border: 'none', borderRadius: '10px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)' }}>
                        Generate Quiz
                    </button>
                </form>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: '#111', borderRadius: '20px', border: '1px solid #333' }}>
                    <div style={{ marginBottom: '20px', animation: 'spin 2s linear infinite', display: 'flex', justifyContent: 'center' }}><Settings size={40} /></div>
                    <h2 style={{ color: '#fff', fontSize: '1.8rem' }}>AI is analyzing your material...</h2>
                    <p style={{ color: '#888', fontSize: '1.1rem' }}>Preparing challenging questions just for you.</p>
                </div>
            )}

            {questions && !showResults && (
                <div style={{ backgroundColor: '#111', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                    {/* Progress Bar */}
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

                            // Logic for visual feedback
                            if (selectedOption) {
                                if (isCorrect) {
                                    bgColor = '#222'; 
                                    borderColor = '#fff';
                                    textColor = '#fff';
                                } else if (isSelected) {
                                    bgColor = '#0a0a0a'; 
                                    borderColor = '#555';
                                    textColor = '#888';
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
                                    {selectedOption && isCorrect && <span style={{ color: '#fff', display: 'inline-flex' }}><Check size={18} /></span>}
                                    {selectedOption && isSelected && !isCorrect && <span style={{ color: '#888', display: 'inline-flex' }}><X size={18} /></span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Explanation / Next Block */}
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
                    <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'grayscale(1)' }}>
                        <Trophy size={40} />
                    </div>
                    
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '15px', color: score === questions.length ? '#fff' : 'white' }}>
                        Quiz Complete!
                    </h2>
                    
                    <p style={{ fontSize: '1.4rem', color: '#aaa', marginBottom: '40px' }}>
                        You scored <strong style={{ color: 'white', fontSize: '2rem' }}>{score}</strong> out of <strong style={{ color: 'white', fontSize: '2rem' }}>{questions.length}</strong>
                    </p>
                    
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                        <button 
                            onClick={handleRetake}
                            style={{ padding: '15px 30px', backgroundColor: '#333', color: 'white', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                        >
                            Review & Retake
                        </button>
                        <button 
                            onClick={() => {
                                handleRetake();
                                setTopic('');
                                setContextText('');
                                setImageBase64(null);
                            }}
                            style={{ padding: '15px 30px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)' }}
                        >
                            New Topic
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
