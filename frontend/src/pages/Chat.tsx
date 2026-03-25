import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from '../context/UserContext';

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp?: number;
}

type ModelChoice = 'gemini' | 'ollama';

interface ChatSession {
    id: string;
    title: string;
    model: ModelChoice;
    createdAt: number;
    updatedAt: number;
    messages: Message[];
}

interface StoredChatState {
    activeChatId: string;
    chats: ChatSession[];
}

const BACKEND_URL = "http://localhost:5000";
const makeChatStorageKey = (username: string | null) =>
    `primearc_chat_sessions_${username || 'anonymous'}`;
const MAX_STORED_MESSAGES = 100;
const MAX_STORED_CHATS = 25;

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
                        }}>Copy</button>
                    </div>
                    <pre className="md-pre"><code>{codeText}</code></pre>
                </div>
            );
            i++;
            continue;
        }

        const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const Tag = `h${level + 2}` as 'h3' | 'h4' | 'h5';
            nodes.push(<Tag key={i} className={`md-h${level}`}>{inlineFormat(headingMatch[2], `ih-${i}`)}</Tag>);
            i++;
            continue;
        }

        if (/^[\s]*[-*]\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
                items.push(lines[i].replace(/^[\s]*[-*]\s/, ''));
                i++;
            }
            nodes.push(<ul key={i} className="md-ul">{items.map((item, li) => <li key={li}>{inlineFormat(item, li)}</li>)}</ul>);
            continue;
        }

        if (/^\d+\.\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                items.push(lines[i].replace(/^\d+\.\s/, ''));
                i++;
            }
            nodes.push(<ol key={i} className="md-ol">{items.map((item, li) => <li key={li}>{inlineFormat(item, li)}</li>)}</ol>);
            continue;
        }

        if (/^---+$/.test(line.trim())) {
            nodes.push(<hr key={i} className="md-hr" />);
            i++;
            continue;
        }

        if (line.trim() === '') {
            nodes.push(<div key={i} className="md-spacer" />);
            i++;
            continue;
        }

        nodes.push(<p key={i} className="md-p">{inlineFormat(line, `ip-${i}`)}</p>);
        i++;
    }

    return nodes;
};

const makeInitialMessage = (model: ModelChoice): Message => ({
    role: 'ai',
    content: model === 'ollama'
        ? 'PrimeArc AI is running offline via Ollama (`qwen2.5:7b`). Ask anything.\n\n*Responses stream token by token in real time.*'
        : 'PrimeArc AI is powered by Gemini Flash.\n\nI can help with:\n- Writing and editing\n- Code and debugging\n- Research and analysis\n- Learning and explanations',
    timestamp: Date.now(),
});

const makeAiMessage = (content: string, timestamp = Date.now()): Message => ({
    role: 'ai',
    content,
    timestamp
});

const buildChatTitle = (text: string) => {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return 'New Chat';
    return cleaned.length > 36 ? `${cleaned.slice(0, 36)}...` : cleaned;
};

const createChatSession = (model: ModelChoice = 'gemini'): ChatSession => {
    const now = Date.now();
    return {
        id: `chat_${now}_${Math.random().toString(36).slice(2, 8)}`,
        title: 'New Chat',
        model,
        createdAt: now,
        updatedAt: now,
        messages: [makeInitialMessage(model)]
    };
};

const parseStoredChats = (raw: string | null): StoredChatState | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.chats)) return null;

        const chats = parsed.chats
            .filter((chat: ChatSession) => chat && Array.isArray(chat.messages))
            .slice(0, MAX_STORED_CHATS)
            .map((chat: ChatSession) => ({
                ...chat,
                title: chat.title || 'New Chat',
                model: chat.model === 'ollama' ? 'ollama' : 'gemini',
                createdAt: chat.createdAt || Date.now(),
                updatedAt: chat.updatedAt || Date.now(),
                messages: chat.messages.slice(-MAX_STORED_MESSAGES)
            }));

        if (chats.length === 0) return null;

        const activeChatId = chats.some((chat: ChatSession) => chat.id === parsed.activeChatId)
            ? parsed.activeChatId
            : chats[0].id;

        return { activeChatId, chats };
    } catch {
        return null;
    }
};

const Chat = () => {
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [message, setMessage] = useState("");
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [ollamaStatus, setOllamaStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoadedRemoteState, setHasLoadedRemoteState] = useState(false);
    const [dbSyncAvailable, setDbSyncAvailable] = useState(true);

    const { username, classLevel } = useUser();
    const chatStorageKey = makeChatStorageKey(username);

    const [chatState, setChatState] = useState<StoredChatState>(() => {
        const fallback = createChatSession('gemini');
        return { activeChatId: fallback.id, chats: [fallback] };
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        let cancelled = false;

        const loadChatState = async () => {
            setHasLoadedRemoteState(false);

            try {
                const res = await fetch(`${BACKEND_URL}/chat-state?user=${encodeURIComponent(username || 'anonymous')}`);
                if (!res.ok) throw new Error('remote chat state unavailable');
                const remote = await res.json();
                if (cancelled) return;

                if (remote && Array.isArray(remote.chats) && remote.activeChatId) {
                    const parsed = parseStoredChats(JSON.stringify(remote));
                    if (parsed) {
                        setChatState(parsed);
                        setDbSyncAvailable(true);
                        setHasLoadedRemoteState(true);
                        return;
                    }
                }
                setDbSyncAvailable(true);
            } catch {
                setDbSyncAvailable(false);
            }

            const saved = parseStoredChats(localStorage.getItem(chatStorageKey));
            if (cancelled) return;
            if (saved) {
                setChatState(saved);
            } else {
                const fallback = createChatSession('gemini');
                setChatState({ activeChatId: fallback.id, chats: [fallback] });
            }
            setHasLoadedRemoteState(true);
        };

        loadChatState();
        return () => { cancelled = true; };
    }, [chatStorageKey, username]);

    useEffect(() => {
        if (!hasLoadedRemoteState) return;

        const sanitized: StoredChatState = {
            activeChatId: chatState.activeChatId,
            chats: chatState.chats
                .slice(0, MAX_STORED_CHATS)
                .map(chat => ({
                    ...chat,
                    messages: chat.messages.slice(-MAX_STORED_MESSAGES)
                }))
        };

        try {
            localStorage.setItem(chatStorageKey, JSON.stringify(sanitized));
        } catch {
            // ignore quota errors
        }

        if (!dbSyncAvailable) return;

        const timeoutId = window.setTimeout(async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/chat-state`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user: username || 'anonymous',
                        activeChatId: sanitized.activeChatId,
                        chats: sanitized.chats
                    })
                });
                if (!res.ok) throw new Error('save failed');
            } catch {
                setDbSyncAvailable(false);
            }
        }, 600);

        return () => window.clearTimeout(timeoutId);
    }, [chatState, chatStorageKey, dbSyncAvailable, hasLoadedRemoteState, username]);

    const activeChat = chatState.chats.find(chat => chat.id === chatState.activeChatId) || chatState.chats[0];
    const history = activeChat?.messages || [];
    const model = activeChat?.model || 'gemini';

    const updateActiveChat = (updater: (chat: ChatSession) => ChatSession) => {
        setChatState(prev => ({
            ...prev,
            chats: prev.chats.map(chat => chat.id === prev.activeChatId ? updater(chat) : chat)
        }));
    };

    const createNewChat = (nextModel: ModelChoice = model) => {
        const newChat = createChatSession(nextModel);
        setChatState(prev => ({
            activeChatId: newChat.id,
            chats: [newChat, ...prev.chats].slice(0, MAX_STORED_CHATS)
        }));
        setMessage("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const switchChat = (chatId: string) => {
        setChatState(prev => ({ ...prev, activeChatId: chatId }));
        setMessage("");
    };

    const deleteChat = (chatId: string) => {
        setChatState(prev => {
            const remaining = prev.chats.filter(chat => chat.id !== chatId);
            if (remaining.length === 0) {
                const fallback = createChatSession('gemini');
                return { activeChatId: fallback.id, chats: [fallback] };
            }
            const activeChatId = prev.activeChatId === chatId ? remaining[0].id : prev.activeChatId;
            return { activeChatId, chats: remaining };
        });
    };

    const clearActiveHistory = () => {
        if (!activeChat) return;
        if (window.confirm('Clear this chat history?')) {
            updateActiveChat(chat => ({
                ...chat,
                title: 'New Chat',
                updatedAt: Date.now(),
                messages: [makeInitialMessage(chat.model)]
            }));
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history, isLoading, activeChat?.id]);

    const autoResize = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }, []);

    useEffect(() => {
        autoResize();
    }, [message, autoResize]);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/`);
                setBackendStatus(res.ok ? 'online' : 'offline');
            } catch {
                setBackendStatus('offline');
            }
        };
        checkStatus();
    }, []);

    useEffect(() => {
        if (model !== 'ollama') {
            setOllamaStatus('checking');
            return;
        }

        const checkOllama = async () => {
            setOllamaStatus('checking');
            try {
                const res = await fetch('http://localhost:11434/api/tags');
                setOllamaStatus(res.ok ? 'online' : 'offline');
            } catch {
                setOllamaStatus('offline');
            }
        };

        checkOllama();
    }, [model]);

    const switchModel = (nextModel: ModelChoice) => {
        if (!activeChat || nextModel === model) return;
        updateActiveChat(chat => ({
            ...chat,
            model: nextModel,
            updatedAt: Date.now(),
            messages: [
                ...chat.messages,
                makeAiMessage(`*[System: Switched model to ${nextModel === 'ollama' ? 'Ollama Offline' : 'Gemini Flash'}]*`)
            ]
        }));
    };

    const sendGemini = async (trimmed: string, targetChatId: string, nextHistory: Message[]) => {
        try {
            const res = await fetch(`${BACKEND_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: trimmed,
                    user: username,
                    classLevel,
                    history: nextHistory.slice(-10).map(({ role, content }) => ({ role, content }))
                })
            });
            const data = await res.json();
            const reply = data.reply || data.error || "No response received.";
            setChatState(prev => ({
                ...prev,
                chats: prev.chats
                    .map(chat => chat.id === targetChatId
                        ? {
                            ...chat,
                            updatedAt: Date.now(),
                            messages: [...nextHistory, makeAiMessage(reply)]
                        }
                        : chat)
                    .sort((a, b) => b.updatedAt - a.updatedAt)
            }));
            if (backendStatus !== 'online') setBackendStatus('online');
        } catch {
            setChatState(prev => ({
                ...prev,
                chats: prev.chats
                    .map(chat => chat.id === targetChatId
                        ? {
                            ...chat,
                            updatedAt: Date.now(),
                            messages: [...nextHistory, makeAiMessage("Backend is offline. Please run `npm run dev` in the backend folder.")]
                        }
                        : chat)
                    .sort((a, b) => b.updatedAt - a.updatedAt)
            }));
            setBackendStatus('offline');
        }
    };

    const sendOllama = async (trimmed: string, targetChatId: string, nextHistory: Message[]) => {
        const aiMsgTs = Date.now();
        setChatState(prev => ({
            ...prev,
            chats: prev.chats
                .map(chat => chat.id === targetChatId
                    ? {
                        ...chat,
                        updatedAt: aiMsgTs,
                        messages: [...nextHistory, makeAiMessage('', aiMsgTs)]
                    }
                    : chat)
                .sort((a, b) => b.updatedAt - a.updatedAt)
        }));

        try {
            const res = await fetch(`${BACKEND_URL}/api/ollama/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: trimmed,
                    user: username,
                    classLevel,
                    history: nextHistory.slice(-10).map(({ role, content }) => ({ role, content }))
                })
            });

            if (!res.ok || !res.body) {
                const errData = await res.json().catch(() => ({ error: "Ollama unavailable" }));
                setChatState(prev => ({
                    ...prev,
                    chats: prev.chats
                        .map(chat => chat.id === targetChatId
                            ? {
                                ...chat,
                                updatedAt: Date.now(),
                                messages: [...nextHistory, makeAiMessage(`${errData.error || "Ollama server not reachable. Run: ollama serve"}`, aiMsgTs)]
                            }
                            : chat)
                        .sort((a, b) => b.updatedAt - a.updatedAt)
                }));
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const raw = decoder.decode(value, { stream: true });
                for (const line of raw.split('\n')) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message?.content) {
                            accumulated += parsed.message.content;
                            setChatState(prev => ({
                                ...prev,
                                chats: prev.chats.map(chat => {
                                    if (chat.id !== targetChatId) return chat;
                                    const messages = [...chat.messages];
                                    messages[messages.length - 1] = makeAiMessage(accumulated, aiMsgTs);
                                    return {
                                        ...chat,
                                        updatedAt: Date.now(),
                                        messages
                                    };
                                })
                            }));
                        }
                    } catch {
                        // ignore partial lines
                    }
                }
            }
        } catch {
            setChatState(prev => ({
                ...prev,
                chats: prev.chats
                    .map(chat => chat.id === targetChatId
                        ? {
                            ...chat,
                            updatedAt: Date.now(),
                            messages: [...nextHistory, makeAiMessage("Could not reach Ollama. Make sure it is running: `ollama serve`", aiMsgTs)]
                        }
                        : chat)
                    .sort((a, b) => b.updatedAt - a.updatedAt)
            }));
        }
    };

    const sendMessage = async () => {
        const trimmed = message.trim();
        if (!trimmed || isLoading || !activeChat) return;

        const now = Date.now();
        const targetChatId = activeChat.id;
        const newUserMsg: Message = { role: 'user', content: trimmed, timestamp: now };
        const nextHistory = [...activeChat.messages, newUserMsg];

        setChatState(prev => ({
            ...prev,
            chats: prev.chats
                .map(chat => chat.id === targetChatId
                    ? {
                        ...chat,
                        title: chat.title === 'New Chat' ? buildChatTitle(trimmed) : chat.title,
                        updatedAt: now,
                        messages: nextHistory
                    }
                    : chat)
                .sort((a, b) => b.updatedAt - a.updatedAt)
        }));
        setMessage("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setIsLoading(true);

        try {
            if ((activeChat.model || 'gemini') === 'ollama') await sendOllama(trimmed, targetChatId, nextHistory);
            else await sendGemini(trimmed, targetChatId, nextHistory);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (ts?: number) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatChatDate = (ts: number) => {
        return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <React.Fragment>
            <nav className="nav-bar">
                <div style={{ padding: '0 25px 16px 25px', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: '16px' }}>
                    <h2 className="sidebar-header" style={{ padding: 0, marginBottom: '12px' }}>Chat History</h2>
                    <button
                        onClick={() => createNewChat()}
                        style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: '#fff',
                            color: '#000',
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            cursor: 'pointer'
                        }}
                    >
                        New Chat
                    </button>
                </div>

                <ul className="chat-list">
                    {chatState.chats.map(chat => (
                        <li
                            key={chat.id}
                            className={`chat-list-item ${chat.id === chatState.activeChatId ? 'active' : ''}`}
                            onClick={() => switchChat(chat.id)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ color: 'inherit', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {chat.title}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: chat.id === chatState.activeChatId ? '#8f8fa7' : '#5d5d73', marginTop: '3px' }}>
                                        {chat.model === 'ollama' ? 'Ollama' : 'Gemini'} • {Math.max(chat.messages.length - 1, 0)} msgs
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteChat(chat.id);
                                    }}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#777',
                                        cursor: 'pointer',
                                        padding: 0,
                                        lineHeight: 1
                                    }}
                                    title="Delete chat"
                                >
                                    ×
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>

                <div style={{ padding: '0 25px', marginTop: 'auto' }}>
                    <p style={{ fontSize: '0.75rem', color: '#333', lineHeight: '1.5' }}>
                        {chatState.chats.length} saved chat{chatState.chats.length !== 1 ? 's' : ''}<br />
                        Local history enabled
                    </p>
                </div>
            </nav>

            <main className="chat-main">
                <button className="toggle-details-btn" onClick={() => setShowRightPanel(!showRightPanel)}>
                    {showRightPanel ? 'Hide Panel' : 'Show Details'}
                </button>

                <div className="message-list">
                    {history.map((msg, index) => (
                        <div key={index} className={`msg-wrapper ${msg.role}`}>
                            {msg.role === 'ai' && (
                                <div className={`msg-avatar ai-avatar ${isLoading && index === history.length - 1 ? 'ai-loading-ring' : ''}`}>
                                    AI
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
                            {msg.role === 'user' && <div className="msg-avatar user-avatar">YOU</div>}
                        </div>
                    ))}

                    {isLoading && model === 'gemini' && (
                        <div className="msg-wrapper ai">
                            <div className="msg-avatar ai-avatar ai-loading-ring">AI</div>
                            <div className="msg ai typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="input-area-container">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', justifyContent: 'center' }}>
                        <button
                            onClick={() => switchModel('gemini')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '999px',
                                border: model === 'gemini' ? '1px solid rgba(255,255,255,0.28)' : '1px solid rgba(255,255,255,0.1)',
                                background: model === 'gemini' ? '#ffffff' : 'transparent',
                                color: model === 'gemini' ? '#000000' : '#8c8c93',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                        >
                            Gemini
                        </button>
                        <button
                            onClick={() => switchModel('ollama')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '999px',
                                border: model === 'ollama' ? '1px solid rgba(255,255,255,0.28)' : '1px solid rgba(255,255,255,0.1)',
                                background: model === 'ollama' ? '#ffffff' : 'transparent',
                                color: model === 'ollama' ? '#000000' : '#8c8c93',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                        >
                            Ollama
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

            {showRightPanel && activeChat && (
                <aside className="right-panel">
                    <h3 className="sidebar-header" style={{ padding: 0 }}>System Details</h3>

                    <div className="details-card">
                        <div className="details-card-title">Active Chat</div>
                        <div className="details-card-value" style={{ fontSize: '0.9rem' }}>{activeChat.title}</div>
                    </div>

                    <div className="details-card">
                        <div className="details-card-title">Active Model</div>
                        <div className="details-card-value" style={{ color: model === 'ollama' ? '#fff' : '#ccc' }}>
                            {model === 'ollama' ? 'qwen2.5:7b' : 'Gemini Flash'}
                        </div>
                    </div>

                    <div className="details-card">
                        <div className="details-card-title">Mode</div>
                        <div className="details-card-value" style={{ fontSize: '0.8rem', color: model === 'ollama' ? '#fff' : '#ccc' }}>
                            {model === 'ollama' ? 'Offline / Local' : 'Cloud / API'}
                        </div>
                    </div>

                    <div className="details-card">
                        <div className="details-card-title">Updated</div>
                        <div className="details-card-value" style={{ fontSize: '0.82rem' }}>
                            {formatChatDate(activeChat.updatedAt)}
                        </div>
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
                        <div className="details-card-value">{Math.max(history.length - 1, 0)}</div>
                    </div>

                    <div className="details-card">
                        <div className="details-card-title">Actions</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={clearActiveHistory}
                                style={{
                                    padding: '9px 12px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'transparent',
                                    color: '#c2c2d6',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear Current Chat
                            </button>
                            <button
                                type="button"
                                onClick={() => createNewChat(model)}
                                style={{
                                    padding: '9px 12px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: '#111',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                Start New Chat
                            </button>
                        </div>
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
