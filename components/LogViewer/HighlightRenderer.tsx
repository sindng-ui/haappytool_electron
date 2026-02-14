import React, { useMemo } from 'react';
import { LogHighlight } from '../../types';

interface HighlightRendererProps {
    text: string;
    highlights?: LogHighlight[];
    caseSensitive?: boolean;
}

export const HighlightRenderer = React.memo(({ text, highlights, caseSensitive = false }: HighlightRendererProps) => {
    const { pattern, highlightMap } = useMemo(() => {
        if (!highlights || highlights.length === 0) return { pattern: null, highlightMap: new Map() };
        const validHighlights = highlights.filter(h => h.keyword.trim() !== '');
        if (validHighlights.length === 0) return { pattern: null, highlightMap: new Map() };

        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Sort by length descending to match longest keywords first
        const sorted = [...validHighlights].sort((a, b) => b.keyword.length - a.keyword.length);
        const regex = new RegExp(`(${sorted.map(h => escapeRegExp(h.keyword)).join('|')})`, caseSensitive ? 'g' : 'gi');

        // Create Map for O(1) lookup
        const map = new Map<string, LogHighlight>();
        sorted.forEach(h => {
            const key = caseSensitive ? h.keyword : h.keyword.toLowerCase();
            map.set(key, h);
        });

        return { pattern: regex, highlightMap: map };
    }, [highlights, caseSensitive]);

    const parts = useMemo(() => {
        if (!pattern) return null;
        return text.split(pattern); // Split by capturing group includes separators in result
    }, [text, pattern]);

    if (!parts) return <>{text}</>;

    return (
        <>
            {parts.map((part, i) => {
                if (!part) return null; // Handle empty parts from split

                // O(1) Lookup
                const lookupKey = caseSensitive ? part : part.toLowerCase();
                const highlight = highlightMap.get(lookupKey);

                if (highlight) {
                    // Check if it's a valid CSS color (Hex, RGB, HSL, or named color) 
                    // Robust check: Starts with #, rgb, hsl OR is a named color (letters only)
                    const isCssColor = /^(#|rgb|hsl)/i.test(highlight.color.trim()) || (/^[a-z]+$/i.test(highlight.color.trim()) && !highlight.color.startsWith('bg-') && !highlight.color.startsWith('text-'));

                    const style = isCssColor ? { backgroundColor: highlight.color, color: '#0f172a', textShadow: '0 0 1px rgba(255,255,255,0.5)' } : undefined;
                    const className = `rounded-sm px-0.5 font-bold ${!isCssColor ? highlight.color + ' text-slate-900' : ''}`;
                    // Use index as key is safe here since list is static per render
                    return <span key={i} className={className} style={style}>{part}</span>;
                }
                return part;
            })}
        </>
    );
});
