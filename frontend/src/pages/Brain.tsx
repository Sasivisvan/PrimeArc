// import React from 'react';
import { Send, Paperclip } from 'lucide-react';
import ChatMessage from '../components/brain/ChatMessage';

export default function Brain() {
    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            <header className="mb-4">
                <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                    The Brain <span className="text-primary text-sm font-normal py-1 px-2 rounded-full bg-primary/10 border border-primary/20">AI Beta</span>
                </h1>
            </header>

            <div className="flex-1 glass-card p-4 mb-4 overflow-y-auto space-y-6">
                <ChatMessage
                    role="ai"
                    content="Hello! I'm your AI study assistant. I can help you find resources, summarize lectures, or answer questions about your coursework."
                />
                <ChatMessage
                    role="user"
                    content="Can you explain the Second Law of Thermodynamics?"
                />
                <ChatMessage
                    role="ai"
                    content="The Second Law of Thermodynamics states that the total entropy of an isolated system can never decrease over time. It essentially governs the direction of heat transfer and energy transformation efficiencies."
                    citations={[
                        { title: "Thermodynamics_Lecture_2.pdf", type: 'pdf' },
                        { title: "Physics_Notes_Ch4.docx", type: 'doc' }
                    ]}
                />
            </div>

            <div className="relative">
                <button className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                    <Paperclip size={20} />
                </button>
                <input
                    type="text"
                    placeholder="Ask anything about your coursework..."
                    className="w-full bg-surface/50 border border-white/10 rounded-xl py-4 pl-12 pr-14 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                />
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-primary hover:text-white transition-colors p-2 rounded-lg hover:bg-primary/10">
                    <Send size={20} />
                </button>
            </div>
        </div>
    );
}
