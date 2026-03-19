import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

interface Answer {
    _id: string;
    body: string;
    author: string;
    upvotes: number;
    createdAt: string;
}

interface Question {
    _id: string;
    title: string;
    body: string;
    author: string;
    classLevel: number;
    upvotes: number;
    answers: Answer[];
    createdAt: string;
    contextRef?: {
        noteId: any;
        highlightedText: string;
    };
}

export default function Community() {
    const { classLevel, username } = useUser();
    const [questions, setQuestions] = useState<Question[]>([]);
    
    // UI State
    const [showAskForm, setShowAskForm] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [answerBody, setAnswerBody] = useState('');

    const fetchQuestions = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/questions?classLevel=${classLevel}`);
            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, [classLevel]);

    const handleAskQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch('http://localhost:5000/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, author: username, classLevel })
            });
            setTitle(''); setBody(''); setShowAskForm(false);
            fetchQuestions();
        } catch (err) { console.error(err); }
    };

    const handlePostAnswer = async (e: React.FormEvent, questionId: string) => {
        e.preventDefault();
        if(!answerBody.trim()) return;
        try {
            await fetch(`http://localhost:5000/api/questions/${questionId}/answers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: answerBody, author: username })
            });
            setAnswerBody('');
            fetchQuestions();
        } catch (err) { console.error(err); }
    };

    // Helper to generate a consistent avatar color for a username
    const getAvatarColor = (name: string) => {
        const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div style={{ padding: '20px', color: 'white', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '2.2rem', margin: '0 0 5px 0' }}>Class {classLevel} Q&A</h1>
                    <p style={{ margin: 0, color: '#888' }}>Ask questions, get answers, and help your classmates.</p>
                </div>
                <button 
                    onClick={() => setShowAskForm(!showAskForm)}
                    style={{ padding: '12px 24px', backgroundColor: '#4a90e2', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem', boxShadow: '0 4px 10px rgba(74, 144, 226, 0.3)', marginLeft: 'auto' }}>
                    {showAskForm ? '✕ Cancel' : 'Ask a Question'}
                </button>
            </div>

            {showAskForm && (
                <form onSubmit={handleAskQuestion} style={{ backgroundColor: '#2a2a35', padding: '25px', borderRadius: '12px', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                    <h2 style={{ margin: '0 0 10px 0', fontSize: '1.3rem' }}>Ask the Community</h2>
                    <input 
                        type="text" placeholder="Be specific and imagine you’re asking a question to another person" required 
                        value={title} onChange={e => setTitle(e.target.value)} 
                        style={{ padding: '15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1a1a25', color: 'white', fontSize: '1.1rem' }} 
                    />
                    <textarea 
                        placeholder="Include all the information someone would need to answer your question..." required rows={6}
                        value={body} onChange={e => setBody(e.target.value)} 
                        style={{ padding: '15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1a1a25', color: 'white', fontSize: '1rem', resize: 'vertical' }} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                        <button type="submit" style={{ padding: '12px 30px', backgroundColor: '#4ade80', color: '#111', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.05rem' }}>Post Question</button>
                    </div>
                </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {questions.map(q => (
                    <div key={q._id} style={{ backgroundColor: '#1a1a25', borderRadius: '12px', padding: '20px', display: 'flex', gap: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        {/* Vote Sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '50px' }}>
                            <button style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.8rem', cursor: 'pointer', padding: 0 }}>▲</button>
                            <span style={{ fontWeight: 'bold', fontSize: '1.3rem', color: q.upvotes > 0 ? '#4ade80' : '#888' }}>{q.upvotes}</span>
                            <button style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.8rem', cursor: 'pointer', padding: 0 }}>▼</button>
                        </div>

                        {/* Question Content */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', color: '#4a90e2', cursor: 'pointer' }} onClick={() => setActiveQuestionId(activeQuestionId === q._id ? null : q._id)}>
                                {q.title}
                            </h3>
                            
                            {q.contextRef?.highlightedText && (
                                <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '15px', color: '#bbb', fontStyle: 'italic', marginBottom: '15px', backgroundColor: '#2a2a35', padding: '10px 15px', borderRadius: '0 8px 8px 0' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Context from Notes</span>
                                    "{q.contextRef.highlightedText}"
                                </div>
                            )}
                            
                            <p style={{ margin: '0 0 15px 0', color: '#ddd', fontSize: '1.05rem', lineHeight: '1.5' }}>{q.body}</p>
                            
                            {/* Author Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: activeQuestionId === q._id ? 'none' : '1px solid #333', paddingTop: '15px' }}>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <span style={{ color: '#888', fontSize: '0.9rem' }}>{q.answers.length} {q.answers.length === 1 ? 'answer' : 'answers'}</span>
                                    <span style={{ color: '#888', fontSize: '0.9rem' }}>Asked {new Date(q.createdAt).toLocaleDateString()}</span>
                                    <button 
                                        onClick={() => setActiveQuestionId(activeQuestionId === q._id ? null : q._id)}
                                        style={{ padding: '5px 12px', borderRadius: '15px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer', fontSize: '0.85rem', marginLeft: '10px' }}
                                    >
                                        Reply / View
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#2a2a35', padding: '5px 15px', borderRadius: '20px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: getAvatarColor(q.author), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                        {q.author.charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ color: '#4a90e2', fontWeight: 'bold', fontSize: '0.9rem' }}>{q.author}</span>
                                </div>
                            </div>

                            {/* Expanded Answers Section */}
                            {activeQuestionId === q._id && (
                                <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                                    <h4 style={{ margin: '0 0 20px 0', color: '#bbb', fontSize: '1.2rem' }}>{q.answers.length} {q.answers.length === 1 ? 'Answer' : 'Answers'}</h4>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                                        {q.answers.map(ans => (
                                            <div key={ans._id} style={{ display: 'flex', gap: '15px' }}>
                                                {/* Answer Vote Placeholder */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '30px', color: '#666' }}>
                                                    <button style={{ background: 'none', border: 'none', color: '#666', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>▲</button>
                                                    <span style={{ fontSize: '1rem' }}>0</span>
                                                </div>
                                                
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ margin: '0 0 10px 0', color: '#eee', lineHeight: '1.5' }}>{ans.body}</p>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: '#666', fontSize: '0.8rem' }}>Answered by</span>
                                                        <span style={{ color: '#b14fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{ans.author}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Answer Form */}
                                    <form onSubmit={(e) => handlePostAnswer(e, q._id)} style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#2a2a35', padding: '20px', borderRadius: '8px' }}>
                                        <h5 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: '#eee' }}>Your Answer</h5>
                                        <textarea 
                                            required rows={4} placeholder="Write a detailed answer..." 
                                            value={answerBody} onChange={e => setAnswerBody(e.target.value)}
                                            style={{ padding: '15px', borderRadius: '5px', border: '1px solid #444', backgroundColor: '#1a1a25', color: 'white', resize: 'vertical' }}
                                        />
                                        <button type="submit" style={{ alignSelf: 'flex-start', padding: '10px 24px', backgroundColor: '#4a90e2', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Post Your Answer</button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {questions.length === 0 && !showAskForm && (
                   <div style={{ textAlign: 'center', padding: '50px 0', backgroundColor: '#1a1a25', borderRadius: '12px' }}>
                       <span style={{ fontSize: '3rem' }}>👥</span>
                       <h3 style={{ color: '#aaa', marginTop: '15px' }}>No questions yet for Class {classLevel}</h3>
                       <p style={{ color: '#666' }}>Be the first to start a discussion!</p>
                   </div>
                )}
            </div>
        </div>
    );
}
