import React, { useMemo } from 'react';
import { LogHighlight } from '../../types';

interface HighlightRendererProps {
    text: string;
    highlights?: LogHighlight[];
    caseSensitive?: boolean;
}

export const HighlightRenderer = React.memo(({ text, highlights, caseSensitive = false }: HighlightRendererProps) => {
    const parts = useMemo(() => {
        if (!highlights || highlights.length === 0) return null;
        const validHighlights = highlights.filter(h => h.keyword.trim() !== '');
        if (validHighlights.length === 0) return null;

        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Sort by length descending to match longest keywords first
        const sortedHighlights = [...validHighlights].sort((a, b) => b.keyword.length - a.keyword.length);
        const pattern = new RegExp(`(${sortedHighlights.map(h => escapeRegExp(h.keyword)).join('|')})`, caseSensitive ? 'g' : 'gi');
        return text.split(pattern);
    }, [text, highlights, caseSensitive]);

    if (!parts) return <>{text}</>;

    return (
        <>
            {parts.map((part, i) => {
                if (!part) return null; // Handle empty parts from split
                const highlight = highlights?.find(h => caseSensitive ? h.keyword === part : h.keyword.toLowerCase() === part.toLowerCase());
                if (highlight) {
                    // Check if it's a valid CSS color (Hex, RGB, HSL, or named color) 
                    // Robust check: Starts with #, rgb, hsl OR is a named color (letters only)
                    const isCssColor = /^(#|rgb|hsl)/i.test(highlight.color.trim()) || (/^[a-z]+$/i.test(highlight.color.trim()) && !highlight.color.startsWith('bg-') && !highlight.color.startsWith('text-'));

                    const style = isCssColor ? { backgroundColor: highlight.color, color: '#0f172a', textShadow: '0 0 1px rgba(255,255,255,0.5)' } : undefined;
                    const className = `rounded-sm px-0.5 font-bold ${!isCssColor ? highlight.color + ' text-slate-900' : ''}`;
                    return <span key={i} className={className} style={style}>{part}</span>;
                }
                return part;
            })}
        </>
    );
});
