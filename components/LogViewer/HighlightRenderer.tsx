import React, { useMemo } from 'react';
import { LogHighlight } from '../../types';

interface HighlightRendererProps {
    text: string;
    highlights?: LogHighlight[];
}

export const HighlightRenderer = React.memo(({ text, highlights }: HighlightRendererProps) => {
    const parts = useMemo(() => {
        if (!highlights || highlights.length === 0) return null;
        const validHighlights = highlights.filter(h => h.keyword.trim() !== '');
        if (validHighlights.length === 0) return null;

        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(${validHighlights.map(h => escapeRegExp(h.keyword)).join('|')})`, 'g');
        return text.split(pattern);
    }, [text, highlights]);

    if (!parts) return <>{text}</>;

    return (
        <>
            {parts.map((part, i) => {
                const highlight = highlights?.find(h => h.keyword === part);
                if (highlight) {
                    const isHex = highlight.color.startsWith('#');
                    const style = isHex ? { backgroundColor: highlight.color } : undefined;
                    const className = `text-slate-900 rounded-sm px-0.5 font-bold ${!isHex ? highlight.color : ''}`;
                    return <span key={i} className={className} style={style}>{part}</span>;
                }
                return part;
            })}
        </>
    );
});
