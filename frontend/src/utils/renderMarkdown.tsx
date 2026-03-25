import React from 'react';
import { highlightCode } from './syntaxHighlighter';

// ─── Inline Formatter ────────────────────────────────────────────────────────
// Handles: **bold**, *italic*, `inline code`, ~~strikethrough~~, [link](url)
const inlineFormat = (str: string, key: string | number): React.ReactNode => {
    // Split on all supported inline patterns
    const parts = str.split(
        /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g
    );
    return (
        <React.Fragment key={key}>
            {parts.map((part, pi) => {
                if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
                    return <code key={pi} className="md-inline-code">{part.slice(1, -1)}</code>;
                if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
                    return <strong key={pi} className="md-bold">{part.slice(2, -2)}</strong>;
                if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
                    return <em key={pi} className="md-italic">{part.slice(1, -1)}</em>;
                if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4)
                    return <s key={pi} className="md-strike">{part.slice(2, -2)}</s>;
                // [text](url)
                const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                if (linkMatch)
                    return <a key={pi} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="md-link">{linkMatch[1]}</a>;
                return part;
            })}
        </React.Fragment>
    );
};

// ─── Table Parser ─────────────────────────────────────────────────────────────
const parseTable = (tableLines: string[], key: number): React.ReactNode => {
    const rows = tableLines.map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    const [header, , ...body] = rows; // skip separator row
    return (
        <div key={key} className="md-table-wrap">
            <table className="md-table">
                <thead>
                    <tr>{header.map((cell, ci) => <th key={ci}>{inlineFormat(cell, ci)}</th>)}</tr>
                </thead>
                <tbody>
                    {body.map((row, ri) => (
                        <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{inlineFormat(cell, ci)}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ─── Main Renderer ────────────────────────────────────────────────────────────
export const renderMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // ── Fenced code block ─────────────────────────────────────────────────
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
                    <pre className="md-pre"><code>{highlightCode(codeText, lang) || codeText}</code></pre>
                </div>
            );
            i++;
            continue;
        }

        // ── Headings ──────────────────────────────────────────────────────────
        const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const Tag = `h${level + 2}` as 'h3' | 'h4' | 'h5';
            nodes.push(<Tag key={i} className={`md-h${level}`}>{inlineFormat(headingMatch[2], `ih-${i}`)}</Tag>);
            i++;
            continue;
        }

        // ── Blockquote ────────────────────────────────────────────────────────
        if (/^>\s?/.test(line)) {
            const quoteLines: string[] = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                quoteLines.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            nodes.push(
                <blockquote key={i} className="md-blockquote">
                    {quoteLines.map((ql, qi) => <p key={qi}>{inlineFormat(ql, qi)}</p>)}
                </blockquote>
            );
            continue;
        }

        // ── Table ─────────────────────────────────────────────────────────────
        if (/^\|.+\|/.test(line)) {
            const tableLines: string[] = [];
            while (i < lines.length && /^\|/.test(lines[i])) {
                tableLines.push(lines[i]);
                i++;
            }
            if (tableLines.length >= 2) {
                nodes.push(parseTable(tableLines, i));
                continue;
            }
            // Fallback: treat as paragraph if not a real table
            nodes.push(<p key={i} className="md-p">{inlineFormat(tableLines[0], `ip-${i}`)}</p>);
            continue;
        }

        // ── Unordered list ────────────────────────────────────────────────────
        if (/^[\s]*[-*+]\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^[\s]*[-*+]\s/.test(lines[i])) {
                items.push(lines[i].replace(/^[\s]*[-*+]\s/, ''));
                i++;
            }
            nodes.push(
                <ul key={i} className="md-ul">
                    {items.map((item, li) => <li key={li}>{inlineFormat(item, li)}</li>)}
                </ul>
            );
            continue;
        }

        // ── Ordered list ──────────────────────────────────────────────────────
        if (/^\d+\.\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                items.push(lines[i].replace(/^\d+\.\s/, ''));
                i++;
            }
            nodes.push(
                <ol key={i} className="md-ol">
                    {items.map((item, li) => <li key={li}>{inlineFormat(item, li)}</li>)}
                </ol>
            );
            continue;
        }

        // ── Horizontal rule ───────────────────────────────────────────────────
        if (/^---+$/.test(line.trim())) {
            nodes.push(<hr key={i} className="md-hr" />);
            i++;
            continue;
        }

        // ── Empty line spacer ─────────────────────────────────────────────────
        if (line.trim() === '') {
            nodes.push(<div key={i} className="md-spacer" />);
            i++;
            continue;
        }

        // ── Paragraph ─────────────────────────────────────────────────────────
        nodes.push(<p key={i} className="md-p">{inlineFormat(line, `ip-${i}`)}</p>);
        i++;
    }

    return nodes;
};
