// import React from 'react';
import { User, Bot, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface Citation {
    title: string;
    type: 'pdf' | 'ppt' | 'doc';
}

interface ChatMessageProps {
    role: 'user' | 'ai';
    content: string;
    citations?: Citation[];
}

export default function ChatMessage({ role, content, citations }: ChatMessageProps) {
    const isAi = role === 'ai';

    return (
        <div className={cn("flex w-full gap-4", isAi ? "" : "flex-row-reverse")}>
            <div className={cn(
                "h-10 w-10 shrink-0 rounded-full flex items-center justify-center border",
                isAi ? "bg-primary/20 border-primary text-primary" : "bg-secondary/20 border-secondary text-secondary"
            )}>
                {isAi ? <Bot size={20} /> : <User size={20} />}
            </div>

            <div className={cn(
                "max-w-[80%] rounded-2xl p-4 border",
                isAi
                    ? "rounded-tl-none bg-surface/50 border-white/5 text-gray-200"
                    : "rounded-tr-none bg-secondary/10 border-secondary/20 text-white shadow-[0_0_15px_-5px_rgba(99,102,241,0.3)]"
            )}>
                <p className="leading-relaxed whitespace-pre-wrap">{content}</p>

                {citations && citations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-white/5">
                        {citations.map((cite, idx) => (
                            <button key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 transition-all text-xs text-gray-400 hover:text-primary">
                                <FileText size={12} />
                                {cite.title}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
