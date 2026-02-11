import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, ExternalLink, Edit, Trash2, Calendar, FileText, Search, ChevronUp, ChevronDown, StickyNote, ArrowUpRight } from 'lucide-react';
import { ArchivedLog } from './db/LogArchiveDB';
import { useLogArchiveContext } from './LogArchiveProvider';
import { useLogArchive } from './hooks/useLogArchive';
import { useToast } from '../../contexts/ToastContext';
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
    const { deleteArchive, updateArchive } = useLogArchive();
    const { loadArchiveToTab, closeViewer } = useLogArchiveContext();

    // Always visible search state
    const [searchTerm, setSearchTerm] = useState('');
    const [submittedTerm, setSubmittedTerm] = useState(''); // Only execute search on Enter
    const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Memo editing state
    const [isEditingMemo, setIsEditingMemo] = useState(false);
    const [editMemo, setEditMemo] = useState('');

    // Reset search state when archive changes
    useEffect(() => {
        setSearchTerm('');
        setSubmittedTerm('');
        setCurrentMatchIdx(0);
        setIsEditingMemo(false);
        setEditMemo(archive?.memo || '');
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

            // Search Focus (Ctrl+F) - Handle this FIRST
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Stop other handlers

                // Focus and select text
                setTimeout(() => {
                    searchInputRef.current?.focus();
                    searchInputRef.current?.select();
                }, 0);
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

        // Use capture phase to catch event before browser default
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
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
    const { addToast } = useToast();

    const handleCopy = async () => {
        if (!archive) return;

        // Copy decoded content
        const success = await copyToClipboard(decodeHtmlEntities(archive.content));
        if (success) {
            addToast('Copied to clipboard!', 'success');
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
            alert('Failed to delete.');
        }
    };

    const { setSelectedArchive, refreshArchives } = useLogArchiveContext();

    // ... (lines 218-220)

    /**
     * 메모 저장
     */
    const handleMemoSave = async () => {
        if (!archive?.id) return;
        const trimmed = editMemo.trim();
        if (trimmed === (archive.memo || '')) {
            setIsEditingMemo(false);
            return;
        }
        try {
            await updateArchive(archive.id, { memo: trimmed || undefined });
            // ✅ Update local state immediately to reflect changes in UI
            setSelectedArchive({ ...archive, memo: trimmed || undefined });
            setIsEditingMemo(false);

            // ✅ Refresh the sidebar list to show updated memo
            refreshArchives();

            addToast('Memo saved', 'success');
        } catch (err) {
            console.error('[ArchiveViewerPane] Memo save failed:', err);
            addToast('Failed to save memo', 'error');
        }
    };

    /**
     * Log Extractor 탭으로 열기
     */
    const handleOpenInTab = () => {
        if (!archive || !loadArchiveToTab) return;
        loadArchiveToTab(archive.title, decodeHtmlEntities(archive.content));
        closeViewer();
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
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="viewer-modal"
                    >
                        {/* Header */}
                        <div className="viewer-header">
                            <div className="viewer-title-group">
                                <div className={`viewer-icon-badge ${archive.tags.some(t => t.toLowerCase().includes('error')) ? 'error' :
                                    archive.tags.some(t => t.toLowerCase().includes('success')) ? 'success' :
                                        archive.title.toLowerCase().includes('db') ? 'db' : 'default'
                                    }`}>
                                    {archive.tags.some(t => t.toLowerCase().includes('error') || t.toLowerCase().includes('fail')) ? <Search size={22} color="#ef4444" /> :
                                        archive.title.toLowerCase().includes('db') ? <FileText size={22} color="#f59e0b" /> :
                                            <FileText size={22} color="#3b82f6" />}
                                </div>
                                <div className="viewer-title-text">
                                    <span className="viewer-category-label">LOG ARCHIVE</span>
                                    <h3 className="viewer-main-title">{decodeHtmlEntities(archive.title)}</h3>
                                </div>
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
                                    {matches.length > 0 && (
                                        <span className="viewer-match-count">
                                            {currentMatchIdx + 1}/{matches.length}
                                        </span>
                                    )}
                                    <div className="viewer-search-actions">
                                        <button
                                            className="viewer-search-btn"
                                            onClick={() => setCurrentMatchIdx(prev => (prev - 1 + matches.length) % matches.length)}
                                            disabled={matches.length === 0}
                                        >
                                            <ChevronUp size={14} />
                                        </button>
                                        <button
                                            className="viewer-search-btn"
                                            onClick={() => setCurrentMatchIdx(prev => (prev + 1) % matches.length)}
                                            disabled={matches.length === 0}
                                        >
                                            <ChevronDown size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="viewer-divider"></div>

                                {loadArchiveToTab && (
                                    <button className="icon-button" onClick={handleOpenInTab} title="Open in Log Extractor Tab">
                                        <ArrowUpRight size={16} />
                                    </button>
                                )}

                                <button className="icon-button" onClick={handleCopy} title="Copy Content">
                                    <Copy size={16} />
                                </button>

                                {archive.sourceFile && archive.sourceLineStart !== undefined && onGoToSource && (
                                    <button className="icon-button" onClick={handleGoToSource} title="Open Source">
                                        <ExternalLink size={16} />
                                    </button>
                                )}

                                <button className="icon-button danger" onClick={handleDelete} title="Delete Archive">
                                    <Trash2 size={16} />
                                </button>

                                <button className="icon-button close" onClick={onClose} title="Close (ESC)">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Metadata Row */}
                        <div className="viewer-metadata">
                            <div className="viewer-meta-left">
                                <span className="viewer-meta-item">
                                    <Calendar size={14} />
                                    <span>{formatDateFull(archive.createdAt)}</span>
                                </span>
                                <span className="viewer-meta-item">
                                    <FileText size={14} />
                                    <span>{lineCount} lines</span>
                                </span>
                                {archive.sourceFile && (
                                    <span className="viewer-meta-item source" title={archive.sourceFile}>
                                        <ExternalLink size={14} />
                                        <span>{archive.sourceFile.split(/[\\/]/).pop()}</span>
                                    </span>
                                )}
                            </div>

                            {archive.tags.length > 0 && (
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
                            )}
                        </div>

                        {/* Memo Section */}
                        <div style={{
                            padding: '8px 16px',
                            borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
                            minHeight: '32px',
                        }}>
                            {isEditingMemo ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <StickyNote size={14} style={{ marginTop: '6px', opacity: 0.5, flexShrink: 0 }} />
                                    <textarea
                                        value={editMemo}
                                        onChange={(e) => setEditMemo(e.target.value)}
                                        onBlur={handleMemoSave}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleMemoSave();
                                            }
                                            if (e.key === 'Escape') {
                                                e.stopPropagation();
                                                setEditMemo(archive?.memo || '');
                                                setIsEditingMemo(false);
                                            }
                                        }}
                                        autoFocus
                                        maxLength={500}
                                        placeholder="메모를 입력하세요..."
                                        style={{
                                            flex: 1,
                                            background: 'rgba(15, 23, 42, 0.4)',
                                            border: '1px solid rgba(99, 102, 241, 0.3)',
                                            borderRadius: '6px',
                                            padding: '6px 10px',
                                            color: '#e2e8f0',
                                            fontSize: '12px',
                                            resize: 'none',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                            minHeight: '36px',
                                            maxHeight: '80px',
                                        }}
                                    />
                                </div>
                            ) : (
                                <div
                                    onClick={() => { setEditMemo(archive?.memo || ''); setIsEditingMemo(true); }}
                                    style={{
                                        display: 'flex',
                                        gap: '8px',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        color: archive?.memo ? '#94a3b8' : '#475569',
                                        fontStyle: archive?.memo ? 'normal' : 'italic',
                                        padding: '4px 0',
                                        borderRadius: '4px',
                                        transition: 'color 0.2s',
                                    }}
                                    title="클릭하여 메모 편집"
                                >
                                    <StickyNote size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                                    <span>{archive?.memo || '메모 추가...'}</span>
                                    <Edit size={12} style={{ opacity: 0.3, marginLeft: 'auto' }} />
                                </div>
                            )}
                        </div>

                        {/* Content Area */}
                        <div className="viewer-content">
                            <div className="viewer-code-wrapper">
                                <pre className="viewer-code">
                                    {contentElements}
                                </pre>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
