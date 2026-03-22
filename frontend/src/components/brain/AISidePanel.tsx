import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import ChatMessage from './ChatMessage';

interface AISidePanelProps {
    onClose: () => void;
}

// Define the shape of a message
interface Message {
    role: 'user' | 'ai';
    content: string;
    citations?: { title: string; type: string }[];
}

export default function AISidePanel({ onClose }: AISidePanelProps) {
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    // 1. STATE: Store the list of messages here
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'ai',
            content: "Hello! I'm your AI study assistant. I can help you find resources, summarize lectures, or answer questions about your coursework."
        }
    ]);

    // Ref to auto-scroll to bottom
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const getResponse = async () => {
        if (!prompt.trim()) return;

        // 2. LOGIC: Add user's message to the list immediately
        const userMessage: Message = { role: 'user', content: prompt };
        setMessages(prev => [...prev, userMessage]);
        
        const currentPrompt = prompt; // Save prompt to send
        setPrompt(""); // Clear input
        setIsLoading(true);

        try {
            // Fix URL construction (removes trailing slash from env var if present)
            const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
            
            const response = await fetch(`${baseUrl}/airesponse`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: currentPrompt }),
            });

            const data = await response.json();

            if (response.ok) {
                // 3. LOGIC: Add AI's response to the list
                // Assuming backend returns { reply: "..." }
                const aiMessage: Message = { 
                    role: 'ai', 
                    content: data.reply || data.text || "I received your message but got an empty response." 
                };
                setMessages(prev => [...prev, aiMessage]);
            } else {
                console.error("Server Error:", data);
            }
        } catch (error) {
            console.error("Network Error:", error);
            // Optional: Add an error message to chat
             setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I'm having trouble connecting to the server." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0B1120] border-l border-white/10 w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    PrimeArc AI <span className="text-xs font-normal py-0.5 px-2 rounded-full bg-primary/10 text-primary border border-primary/20">BETA</span>
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 4. DISPLAY: Map through the messages state */}
                {messages.map((msg, index) => (
                    <ChatMessage
                        key={index}
                        role={msg.role}
                        content={msg.content}
                        // citations={msg.citations}
                    />
                ))}
                
                {/* Show loading indicator */}
                {isLoading && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm p-4">
                        <Loader2 className="animate-spin h-4 w-4" />
                        Thinking...
                    </div>
                )}
                
                {/* Invisible div to scroll to */}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-white/5 shrink-0">
                <div className="relative">
                    <button className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                        <Paperclip size={18} />
                    </button>
                    <input
                        type="text"
                        value={prompt} // Controlled input
                        placeholder="Ask anything..."
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && getResponse()}
                        disabled={isLoading}
                        className="w-full bg-surface border border-white/10 rounded-xl py-3 pl-10 pr-12 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all disabled:opacity-50"
                    />
                    <button 
                        onClick={getResponse} 
                        disabled={isLoading || !prompt.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-white transition-colors p-1.5 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}