import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, ExternalLink, Edit, Trash2, Calendar, FileText, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { ArchivedLog } from './db/LogArchiveDB';
import { useLogArchiveContext } from './LogArchiveProvider';
import { useLogArchive } from './hooks/useLogArchive';
import { formatDateFull, copyToClipboard, countLines, getTagColor, decodeHtmlEntities } from './utils';

interface ArchiveViewerPaneProps {
    /**
     * 표시할 아카이브
     */
    archive: ArchivedLog | null;

    /**
     * 닫기 핸들러
     */
    onClose: () => void;

    /**
     * 원본 로그로 이동 핸들러 (선택)
     */
    onGoToSource?: (sourceFile: string, lineStart: number) => void;
}

/**
 * Archive Viewer Pane
 * 
 * 선택한 아카이브의 상세 내용을 표시하는 하단 패널
 */
export function ArchiveViewerPane({
    archive,
    onClose,
    onGoToSource,
}: ArchiveViewerPaneProps) {
    const { deleteArchive } = useLogArchive();

    // Always visible search state
    const [searchTerm, setSearchTerm] = useState('');
    const [submittedTerm, setSubmittedTerm] = useState(''); // Only execute search on Enter
    const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reset search state when archive changes
    useEffect(() => {
        setSearchTerm('');
        setSubmittedTerm('');
        setCurrentMatchIdx(0);
    }, [archive?.id]);

    /**
     * 매칭 계산 (Uses submittedTerm, not searchTerm directly)
     */
    const matches = useMemo(() => {
        if (!submittedTerm || !archive) return [];
        try {
            const escaped = submittedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'gi');
            const results = [];
            const decodedContent = decodeHtmlEntities(archive.content);
            let match;
            while ((match = regex.exec(decodedContent)) !== null) {
                results.push({ index: match.index, length: match[0].length });
            }
            return results;
        } catch (e) {
            return [];
        }
    }, [submittedTerm, archive]);

    /**
     * 라인 수 계산
     */
    const lineCount = useMemo(() => {
        return archive ? countLines(archive.content) : 0;
    }, [archive]);

    /**
     * 매칭 위치로 스크롤
     */
    useEffect(() => {
        if (matches.length > 0) {
            // Wait for render
            requestAnimationFrame(() => {
                const el = document.getElementById(`search-match-${currentMatchIdx}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    }, [currentMatchIdx, matches.length, submittedTerm]);

    /**
     * ESC Handler & Shortcut
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!archive) return;

            // Search Focus (Ctrl+F)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                e.stopPropagation();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
                return;
            }

            // ESC Handler
            if (e.key === 'Escape') {
                // Priority:
                // 1. If searching (has text), clear search ONLY. Do NOT close window.
                if (searchTerm || submittedTerm) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSearchTerm('');
                    setSubmittedTerm(''); // Clear highlights too
                    return;
                }

                // 2. If no search text, Close Window
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }

            // Global Enter Handler (if input is not focused, maybe?)
            // But we handle Enter in Input directly usually.
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [archive, matches.length, onClose, searchTerm, submittedTerm]);

    /**
     * Input Key Handler (Enter to Search & Nav)
     */
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            // 1. If term changed, execute search
            if (searchTerm !== submittedTerm) {
                setSubmittedTerm(searchTerm);
                setCurrentMatchIdx(0);
            }
            // 2. If term same (already searched), navigate results
            else if (matches.length > 0) {
                if (e.shiftKey) {
                    setCurrentMatchIdx(prev => (prev - 1 + matches.length) % matches.length);
                } else {
                    setCurrentMatchIdx(prev => (prev + 1) % matches.length);
                }
            }
        }
    };

    /**
     * 클립보드 복사
     */
    const handleCopy = async () => {
        if (!archive) return;

        // Copy decoded content
        const success = await copyToClipboard(decodeHtmlEntities(archive.content));
        if (success) {
            alert('Copied to clipboard!');
        }
    };

    /**
     * 원본 로그로 이동
     */
    const handleGoToSource = () => {
        if (!archive?.sourceFile || archive.sourceLineStart === undefined) {
            return;
        }

        onGoToSource?.(archive.sourceFile, archive.sourceLineStart);
    };

    /**
     * 삭제
     */
    const handleDelete = async () => {
        if (!archive?.id) return;

        if (!confirm(`Delete "${archive.title}"?`)) {
            return;
        }

        try {
            await deleteArchive(archive.id);
            onClose();
        } catch (err) {
            console.error('[ArchiveViewerPane] Delete failed:', err);
            alert('삭제에 실패했습니다.');
        }
    };

    /**
     * Render Content with Highlights
     */
    const contentElements = useMemo(() => {
        if (!archive) return null;
        const decodedContent = decodeHtmlEntities(archive.content);

        if (!submittedTerm || matches.length === 0) return decodedContent;

        const result = [];
        let lastIndex = 0;

        matches.forEach((match, i) => {
            // Text before match
            if (match.index > lastIndex) {
                result.push(decodedContent.substring(lastIndex, match.index));
            }

            const isCurrent = i === currentMatchIdx;
            result.push(
                <mark
                    key={`m-${i}`}
                    id={`search-match-${i}`}
                    className={`search-highlight ${isCurrent ? 'current' : ''}`}
                >
                    {decodedContent.substring(match.index, match.index + match.length)}
                </mark>
            );
            lastIndex = match.index + match.length;
        });

        // Remaining text
        if (lastIndex < decodedContent.length) {
            result.push(decodedContent.substring(lastIndex));
        }

        return result;
    }, [archive, submittedTerm, matches, currentMatchIdx]);

    return (
        <AnimatePresence>
            {archive && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="archive-viewer-pane"
                >
                    {/* Header */}
                    <div className="viewer-header">
                        <div className="viewer-title">
                            <FileText size={18} />
                            <h3>{decodeHtmlEntities(archive.title)}</h3>
                        </div>

                        <div className="viewer-actions">
                            {/* Search Bar - Always Visible */}
                            <div className="viewer-search-bar">
                                <Search size={14} className="text-slate-400" />
                                <input
                                    ref={searchInputRef}
                                    className="viewer-search-input"
                                    placeholder="Find..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={handleInputKeyDown}
                                />
                                <span className="viewer-match-count">
                                    {matches.length > 0 ? `${currentMatchIdx + 1}/${matches.length}` : (submittedTerm ? '0/0' : '')}
                                </span>
                                <div className="viewer-search-actions">
                                    <button
                                        className="viewer-search-btn"
                                        onClick={() => setCurrentMatchIdx(prev => (prev - 1 + matches.length) % matches.length)}
                                        disabled={matches.length === 0}
                                        title="Previous Match (Shift+Enter)"
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        className="viewer-search-btn"
                                        onClick={() => setCurrentMatchIdx(prev => (prev + 1) % matches.length)}
                                        disabled={matches.length === 0}
                                        title="Next Match (Enter)"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-4 w-px bg-slate-700 mx-1"></div>

                            <button
                                className="icon-button"
                                onClick={handleCopy}
                                title="Copy to clipboard"
                            >
                                <Copy size={16} />
                            </button>

                            {archive.sourceFile && archive.sourceLineStart !== undefined && onGoToSource && (
                                <button
                                    className="icon-button"
                                    onClick={handleGoToSource}
                                    title="Go to source"
                                >
                                    <ExternalLink size={16} />
                                </button>
                            )}

                            <button
                                className="icon-button danger"
                                onClick={handleDelete}
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>

                            <button
                                className="icon-button"
                                onClick={onClose}
                                title="Close (ESC)"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="viewer-metadata">
                        {/* Tags */}
                        {archive.tags.length > 0 && (
                            <div className="viewer-meta-item">
                                <span className="viewer-meta-label">Tags:</span>
                                <div className="viewer-tags">
                                    {archive.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="viewer-tag"
                                            style={{ backgroundColor: getTagColor(tag) }}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="viewer-stats">
                            <span className="viewer-stat">
                                <Calendar size={14} />
                                <span>{formatDateFull(archive.createdAt)}</span>
                            </span>

                            <span className="viewer-stat">
                                <FileText size={14} />
                                <span>{lineCount} lines</span>
                            </span>

                            {archive.sourceFile && (
                                <span className="viewer-stat" title={archive.sourceFile}>
                                    <ExternalLink size={14} />
                                    <span className="viewer-source-file">
                                        {archive.sourceFile}
                                        {archive.sourceLineStart !== undefined && archive.sourceLineEnd !== undefined && (
                                            <> (L{archive.sourceLineStart}-{archive.sourceLineEnd})</>
                                        )}
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="viewer-content">
                        <pre className="viewer-code">
                            {contentElements}
                        </pre>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
