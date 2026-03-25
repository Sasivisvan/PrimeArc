import React from 'react';
import type { ReactNode } from 'react';

// Lightweight syntax highlighter that doesn't require any external dependencies
export const highlightCode = (code: string, lang: string): ReactNode => {
    if (!code) return null;
    
    // We split by lines to preserve exact structure, but we process tokens per line.
    const lines = code.split('\n');
    
    return (
        <>
            {lines.map((line, i) => (
                <React.Fragment key={i}>
                    {tokenizeLine(line, lang)}
                    {i < lines.length - 1 && '\n'}
                </React.Fragment>
            ))}
        </>
    );
};

// Basic tokenizer for common programming languages
function tokenizeLine(line: string, lang: string): ReactNode[] {
    if (!line) return [];
    
    // Very simple regex-based tokenizer
    // Match order matters: Strings -> Comments -> Keywords -> Functions -> Numbers -> Rest
    
    const tokens: ReactNode[] = [];
    let remaining = line;
    let keyIdx = 0;
    
    // JS/TS/Python keywords
    const keywords = /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|super|new|this|async|await|try|catch|def|class|print|True|False|None|import|from|as|with)\b/;
    
    while (remaining.length > 0) {
        // Find the earliest match of any pattern
        
        // 1. Strings (single, double, or backtick)
        const stringMatch = remaining.match(/^(["'`])(?:(?=(\\?))\2.)*?\1/);
        if (stringMatch) {
            tokens.push(<span key={keyIdx++} style={{ color: '#a5d6ff' }}>{stringMatch[0]}</span>);
            remaining = remaining.substring(stringMatch[0].length);
            continue;
        }
        
        // 2. Comments (// or /* or #)
        const commentMatch = remaining.match(/^(\/\/|#).*$/) || remaining.match(/^\/\*[\s\S]*?\*\//);
        if (commentMatch) {
            tokens.push(<span key={keyIdx++} style={{ color: '#8b949e', fontStyle: 'italic' }}>{commentMatch[0]}</span>);
            remaining = remaining.substring(commentMatch[0].length);
            continue;
        }
        
        // 3. Keywords
        const keywordMatch = remaining.match(new RegExp('^' + keywords.source));
        if (keywordMatch) {
            tokens.push(<span key={keyIdx++} style={{ color: '#ff7b72', fontWeight: 600 }}>{keywordMatch[0]}</span>);
            remaining = remaining.substring(keywordMatch[0].length);
            continue;
        }
        
        // 4. Function calls
        const funcMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/);
        if (funcMatch) {
            tokens.push(<span key={keyIdx++} style={{ color: '#d2a8ff' }}>{funcMatch[0]}</span>);
            remaining = remaining.substring(funcMatch[0].length);
            continue;
        }
        
        // 5. Types / Capitalized words (often Classes/Types)
        const typeMatch = remaining.match(/^[A-Z][a-zA-Z0-9_]*/);
        if (typeMatch) {
            tokens.push(<span key={keyIdx++} style={{ color: '#79c0ff' }}>{typeMatch[0]}</span>);
            remaining = remaining.substring(typeMatch[0].length);
            continue;
        }
        
        // 6. Numbers
        const numberMatch = remaining.match(/^\b\d+(\.\d+)?\b/);
        if (numberMatch) {
            tokens.push(<span key={keyIdx++} style={{ color: '#79c0ff' }}>{numberMatch[0]}</span>);
            remaining = remaining.substring(numberMatch[0].length);
            continue;
        }
        
        // 7. Punctuation / Operators
        const puncMatch = remaining.match(/^[{}()\[\].,;:=+\-*/<>!&|?]+/);
        if (puncMatch) {
            tokens.push(<span key={keyIdx++} style={{ color: '#c9d1d9' }}>{puncMatch[0]}</span>);
            remaining = remaining.substring(puncMatch[0].length);
            continue;
        }
        
        // Fallback: just take the next word or character
        const wordMatch = remaining.match(/^\w+/) || remaining.match(/^./);
        if (wordMatch) {
            tokens.push(<span key={keyIdx++} style={{ color: '#e6edf3' }}>{wordMatch[0]}</span>);
            remaining = remaining.substring(wordMatch[0].length);
        } else {
            // Should never happen, but prevent infinite loop
            remaining = "";
        }
    }
    
    return tokens;
}
