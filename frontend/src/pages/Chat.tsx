import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from '../context/UserContext';

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp?: number;
}

const BACKEND_URL = "http://localhost:5000";
const makeChatStorageKey = (username: string | null) =>
    `primearc_chat_session_${username || 'anonymous'}`;
const MAX_STORED_MESSAGES = 100;

// ─── Markdown Renderer ───────────────────────────────────────────────────────
const renderMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;

    const inlineFormat = (str: string, key: string | number): React.ReactNode => {
        const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
        return (
            <React.Fragment key={key}>
                {parts.map((part, pi) => {
                    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
                        return <code key={pi} className="md-inline-code">{part.slice(1, -1)}</code>;
                    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
                        return <strong key={pi} className="md-bold">{part.slice(2, -2)}</strong>;
                    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
                        return <em key={pi} className="md-italic">{part.slice(1, -1)}</em>;
                    return part;
                })}
            </React.Fragment>
        );
    };

    while (i < lines.length) {
        const line = lines[i];

        // Fenced code block
        if (line.trimStart().startsWith('```')) {
            const lang = line.trim().replace(/^```/, '').trim() || 'code';
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            const codeText = codeLines.join('\n');
            nodes.push(
                <div key={i} className="md-code-block">
                    <div className="md-code-header">
                        <span className="md-code-lang">{lang}</span>
                        <button className="md-copy-btn" onClick={() => {
                            navigator.clipboard.writeText(codeText);
                        }}>📋 Copy</button>
                    </div>
                    <pre className="md-pre"><code>{codeText}</code></pre>
                </div>
            );
            i++; continue;
        }

        // Headings
        const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const Tag = `h${level + 2}` as 'h3' | 'h4' | 'h5';
            nodes.push(<Tag key={i} className={`md-h${level}`}>{inlineFormat(headingMatch[2], `ih-${i}`)}</Tag>);
            i++; continue;
        }

        // Bullet list
        if (/^[\s]*[-*]\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
                items.push(lines[i].replace(/^[\s]*[-*]\s/, ''));
                i++;
            }
            nodes.push(<ul key={i} className="md-ul">{items.map((item, li) => <li key={li}>{inlineFormat(item, li)}</li>)}</ul>);
            continue;
        }

        // Numbered list
        if (/^\d+\.\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                items.push(lines[i].replace(/^\d+\.\s/, ''));
                i++;
            }
            nodes.push(<ol key={i} className="md-ol">{items.map((item, li) => <li key={li}>{inlineFormat(item, li)}</li>)}</ol>);
            continue;
        }

        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
            nodes.push(<hr key={i} className="md-hr" />);
            i++; continue;
        }

        // Blank line
        if (line.trim() === '') {
            nodes.push(<div key={i} className="md-spacer" />);
            i++; continue;
        }

        // Paragraph
        nodes.push(<p key={i} className="md-p">{inlineFormat(line, `ip-${i}`)}</p>);
        i++;
    }

    return nodes;
};

// ─── Component ───────────────────────────────────────────────────────────────
type ModelChoice = 'gemini' | 'ollama';

const makeInitialMessage = (model: ModelChoice): Message => ({
    role: 'ai',
    content: model === 'ollama'
        ? 'Hi! I\'m **PrimeArc AI**, running **offline** via Ollama (`qwen2.5:7b`). Ask me anything! 🦙\n\n*Responses stream token-by-token in real time.*'
        : 'Hi! I\'m **PrimeArc AI**, powered by Gemini Flash. Ask me anything! 🚀\n\nI can help with:\n- Writing & editing\n- Code & debugging\n- Research & analysis\n- Learning & explanations',
    timestamp: Date.now(),
});

const INITIAL_MESSAGE: Message = makeInitialMessage('gemini');

const Chat = () => {
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [message, setMessage] = useState("");
    const [model, setModel] = useState<ModelChoice>('gemini');
    const [ollamaStatus, setOllamaStatus] = useState<'online' | 'offline' | 'checking'>('checking');

    const { username } = useUser();
    const CHAT_STORAGE_KEY = makeChatStorageKey(username);

    const [history, setHistory] = useState<Message[]>(() => {
        try {
            const saved = localStorage.getItem(CHAT_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch { /* ignore */ }
        return [INITIAL_MESSAGE];
    });

    const [isLoading, setIsLoading] = useState(false);
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        try {
            const toStore = history.slice(-MAX_STORED_MESSAGES);
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore));
        } catch { /* quota exceeded */ }
    }, [history]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { scrollToBottom(); }, [history, isLoading]);

    const autoResize = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }, []);

    useEffect(() => { autoResize(); }, [message, autoResize]);

    // Check Node backend status
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/`);
                setBackendStatus(res.ok ? 'online' : 'offline');
            } catch { setBackendStatus('offline'); }
        };
        checkStatus();
    }, []);

    // Check Ollama server status whenever model toggles
    useEffect(() => {
        const checkOllama = async () => {
            setOllamaStatus('checking');
            try {
                const res = await fetch('http://localhost:11434/api/tags');
                setOllamaStatus(res.ok ? 'online' : 'offline');
            } catch { setOllamaStatus('offline'); }
        };
        checkOllama();
    }, [model]);

    const switchModel = (m: ModelChoice) => {
        if (m === model) return;
        setModel(m);
        // Persist history seamlessly across offline/online toggles, simply injecting an alert.
        setHistory(prev => [...prev, { 
            role: 'ai', 
            content: `*[System: Switched backend architecture to ${m === 'ollama' ? 'Ollama Offline 🦙' : 'Gemini Cloud Flash ✨'}]*`, 
            timestamp: Date.now() 
        }]);
    };

    // ── Gemini send (non-streaming) ──────────────────────────────────────────
    const sendGemini = async (trimmed: string, newHistory: Message[]) => {
        try {
            const res = await fetch(`${BACKEND_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: trimmed,
                    user: username,
                    history: history.slice(-10).map(({ role, content }) => ({ role, content }))
                })
            });
            const data = await res.json();
            const reply = data.reply || data.error || "No response received.";
            setHistory([...newHistory, { role: 'ai', content: reply, timestamp: Date.now() }]);
            if (backendStatus !== 'online') setBackendStatus('online');
        } catch {
            setHistory([...newHistory, {
                role: 'ai',
                content: "⚠️ Backend is offline. Please run `npm start` in the backend folder.",
                timestamp: Date.now()
            }]);
            setBackendStatus('offline');
        }
    };

    // ── Ollama send (real-time streaming) ───────────────────────────────────
    const sendOllama = async (trimmed: string, newHistory: Message[]) => {
        const aiMsgTs = Date.now();
        // Insert empty placeholder AI message that we'll fill token-by-token
        setHistory([...newHistory, { role: 'ai', content: '', timestamp: aiMsgTs }]);

        try {
            const res = await fetch(`${BACKEND_URL}/api/ollama/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: trimmed,
                    user: username,
                    history: history.slice(-10).map(({ role, content }) => ({ role, content }))
                })
            });

            if (!res.ok || !res.body) {
                const errData = await res.json().catch(() => ({ error: "Ollama unavailable" }));
                setHistory([...newHistory, {
                    role: 'ai',
                    content: `⚠️ ${errData.error || "Ollama server not reachable. Run: ollama serve"}`,
                    timestamp: aiMsgTs
                }]);
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const raw = decoder.decode(value, { stream: true });
                // Each chunk may hold multiple newline-delimited JSON lines
                for (const line of raw.split('\n')) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message?.content) {
                            accumulated += parsed.message.content;
                            setHistory(prev => {
                                const next = [...prev];
                                next[next.length - 1] = { role: 'ai', content: accumulated, timestamp: aiMsgTs };
                                return next;
                            });
                        }
                    } catch { /* partial line — skip */ }
                }
            }
        } catch {
            setHistory([...newHistory, {
                role: 'ai',
                content: "⚠️ Could not reach Ollama. Make sure it's running: `ollama serve`",
                timestamp: aiMsgTs
            }]);
        }
    };

    const sendMessage = async () => {
        const trimmed = message.trim();
        if (!trimmed || isLoading) return;

        const newUserMsg: Message = { role: 'user', content: trimmed, timestamp: Date.now() };
        const newHistory = [...history, newUserMsg];
        setHistory(newHistory);
        setMessage("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setIsLoading(true);

        try {
            if (model === 'ollama') await sendOllama(trimmed, newHistory);
            else await sendGemini(trimmed, newHistory);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const clearHistory = () => {
        if (window.confirm('Clear all chat history?')) {
            setHistory([makeInitialMessage(model)]);
            localStorage.removeItem(CHAT_STORAGE_KEY);
        }
    };

    const formatTime = (ts?: number) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <React.Fragment>
            <nav className="nav-bar">
                <h2 className="sidebar-header">Chat History</h2>
                <ul className="chat-list">
                    <li className="chat-list-item active">🔥 Current Session</li>
                    <li className="chat-list-item" onClick={clearHistory} style={{ cursor: 'pointer', color: '#ff4d6d44' }}>
                        🗑 Clear History
                    </li>
                </ul>
                <div style={{ padding: '0 25px', marginTop: 'auto' }}>
                    <p style={{ fontSize: '0.75rem', color: '#333', lineHeight: '1.5' }}>
                        {history.length - 1} message{history.length !== 2 ? 's' : ''} in session<br />
                        Saved locally ✓
                    </p>
                </div>
            </nav>

            <main className="chat-main">
                <button className="toggle-details-btn" onClick={() => setShowRightPanel(!showRightPanel)}>
                    {showRightPanel ? '◀ Hide Panel' : '▶ Details'}
                </button>

                <div className="message-list">
                    {history.map((msg, index) => (
                        <div key={index} className={`msg-wrapper ${msg.role}`}>
                            {msg.role === 'ai' && (
                                <div className={`msg-avatar ai-avatar ${isLoading && index === history.length - 1 ? 'ai-loading-ring' : ''}`}>
                                    {model === 'ollama' ? '🦙' : '✨'}
                                </div>
                            )}
                            <div className={`msg ${msg.role}`}>
                                {msg.role === 'ai'
                                    ? <div className="msg-formatted">{renderMarkdown(msg.content)}</div>
                                    : msg.content
                                }
                                {msg.timestamp && (
                                    <div className="msg-time">{formatTime(msg.timestamp)}</div>
                                )}
                            </div>
                            {msg.role === 'user' && <div className="msg-avatar user-avatar">You</div>}
                        </div>
                    ))}

                    {/* Typing indicator only for Gemini (Ollama streams live into history) */}
                    {isLoading && model === 'gemini' && (
                        <div className="msg-wrapper ai">
                            <div className="msg-avatar ai-avatar ai-loading-ring">✨</div>
                            <div className="msg ai typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="input-area-container">
                    {/* ── Model selector ── */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', justifyContent: 'center' }}>
                        <button
                            onClick={() => switchModel('gemini')}
                            style={{
                                padding: '5px 16px',
                                borderRadius: '20px',
                                border: model === 'gemini' ? '2px solid #7c3aed' : '1px solid #444',
                                background: model === 'gemini' ? 'rgba(124,58,237,0.18)' : 'transparent',
                                color: model === 'gemini' ? '#a78bfa' : '#666',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: model === 'gemini' ? 700 : 400,
                                transition: 'all 0.2s',
                            }}
                        >
                            ✨ Gemini Flash
                        </button>
                        <button
                            onClick={() => switchModel('ollama')}
                            style={{
                                padding: '5px 16px',
                                borderRadius: '20px',
                                border: model === 'ollama' ? '2px solid #555' : '1px solid #333',
                                background: model === 'ollama' ? '#111' : 'transparent',
                                color: model === 'ollama' ? '#fff' : '#888',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: model === 'ollama' ? 700 : 400,
                                transition: 'all 0.2s',
                            }}
                        >
                            🦙 Ollama (offline)
                        </button>
                    </div>

                    <div className={`input-box ${isLoading ? 'loading' : ''}`}>
                        <textarea
                            ref={textareaRef}
                            className="chat-input chat-textarea"
                            placeholder={isLoading ? "PrimeArc AI is thinking..." : "Message PrimeArc AI… (Enter to send, Shift+Enter for newline)"}
                            value={message}
                            rows={1}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        <button className="send-btn" onClick={sendMessage} disabled={isLoading}>
                            {isLoading
                                ? <svg viewBox="0 0 24 24" className="spin-icon"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 14.93 20 13.51 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 9.07 4 10.49 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                                : <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                            }
                        </button>
                    </div>
                    <p className="input-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</p>
                </div>
            </main>

            {showRightPanel && (
                <aside className="right-panel">
                    <h3 className="sidebar-header" style={{ padding: 0 }}>System Details</h3>

                    <div className="details-card">
                        <div className="details-card-title">Active Model</div>
                        <div className="details-card-value" style={{ color: model === 'ollama' ? '#fff' : '#ccc' }}>
                            {model === 'ollama' ? '🦙 qwen2.5:7b' : '✨ Gemini Flash'}
                        </div>
                    </div>

                    <div className="details-card">
                        <div className="details-card-title">Mode</div>
                        <div className="details-card-value" style={{ fontSize: '0.8rem', color: model === 'ollama' ? '#fff' : '#ccc' }}>
                            {model === 'ollama' ? '🔒 Offline / Local' : '☁️ Cloud / API'}
                        </div>
                    </div>

                    <div className="details-card">
                        <div className="details-card-title">Engine</div>
                        <div className="details-card-value">{model === 'ollama' ? 'Ollama' : 'LangChain.js'}</div>
                    </div>

                    <div className="details-card">
                        <div className="details-card-title">Backend</div>
                        <div className="details-card-value">
                            <span className={`status-pill status-${backendStatus}`}>
                                {backendStatus === 'online' ? '● Online' : backendStatus === 'offline' ? '● Offline' : '● Checking'}
                            </span>
                        </div>
                    </div>

                    {model === 'ollama' && (
                        <div className="details-card">
                            <div className="details-card-title">Ollama Server</div>
                            <div className="details-card-value">
                                <span className={`status-pill status-${ollamaStatus}`}>
                                    {ollamaStatus === 'online' ? '● Running' : ollamaStatus === 'offline' ? '● Stopped' : '● Checking'}
                                </span>
                                {ollamaStatus === 'offline' && (
                                    <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '5px' }}>
                                        Run: <code style={{ background: '#1a1a1a', padding: '1px 5px', borderRadius: '3px' }}>ollama serve</code>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="details-card">
                        <div className="details-card-title">Session Messages</div>
                        <div className="details-card-value">{history.length - 1}</div>
                    </div>

                    <div className="details-card">
                        <div className="details-card-title">Shortcuts</div>
                        <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: '1.8' }}>
                            <div><kbd className="kbd">Enter</kbd> Send</div>
                            <div><kbd className="kbd">Shift+Enter</kbd> New line</div>
                        </div>
                    </div>
                </aside>
            )}
        </React.Fragment>
    );
};

export default Chat;
