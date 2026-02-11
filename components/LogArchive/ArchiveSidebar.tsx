import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Archive, Download, Upload, Trash2, Loader2, SlidersHorizontal, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { SearchOptions } from './db/LogArchiveDB';
import { useArchiveSearch } from './hooks/useArchiveSearch';
import { useLogArchive } from './hooks/useLogArchive';
import { useLogArchiveContext } from './LogArchiveProvider';
import { ArchiveSearchBar } from './ArchiveSearchBar';
import { ArchiveList } from './ArchiveList';
import { downloadJSON, openFileDialog, readFileAsText } from './utils';

interface ArchiveSidebarProps {
    /**
     * 사이드바 열림 상태
     */
    isOpen: boolean;

    /**
     * 닫기 핸들러
     */
    onClose: () => void;
}

/**
 * Archive Sidebar
 * 
 * 우측 슬라이딩 드로어로 아카이브 목록 표시
 */
export function ArchiveSidebar({ isOpen, onClose }: ArchiveSidebarProps) {
    const { openViewer, selectedArchive, isViewerOpen } = useLogArchiveContext();
    const { search, loadMore, results, total, hasMore, isSearching } = useArchiveSearch(1000);
    const { exportToJSON, importFromJSON, clearAll, getTotalCount } = useLogArchive();

    const [totalCount, setTotalCount] = useState(0);
    const [showActions, setShowActions] = useState(false);
    const [showPreview, setShowPreview] = useState(true);

    /**
     * 초기 로드 및 전체 개수 조회
     */
    useEffect(() => {
        if (isOpen) {
            // 초기 검색 (전체 목록)
            search({});

            // 전체 개수 조회
            getTotalCount().then(setTotalCount);
        }
    }, [isOpen, search, getTotalCount]);

    /**
     * ESC Key Handler
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only close if Viewer is NOT open (Viewer handles its own ESC)
            if (isOpen && !isViewerOpen && e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isViewerOpen, onClose]);

    /**
     * 검색 옵션 변경 핸들러
     */
    const handleSearchChange = useCallback(
        (options: SearchOptions, immediate?: boolean) => {
            search(options, immediate);
        },
        [search]
    );

    /**
     * 아카이브 보기
     */
    const handleView = useCallback(
        (archive: any) => {
            openViewer(archive);
        },
        [openViewer]
    );

    /**
     * Export
     */
    const handleExport = useCallback(async () => {
        try {
            const json = await exportToJSON();
            const filename = `archive_export_${new Date().toISOString().split('T')[0]}.json`;
            downloadJSON(json, filename);
        } catch (err) {
            console.error('[ArchiveSidebar] Export failed:', err);
            alert('내보내기에 실패했습니다.');
        }
    }, [exportToJSON]);

    /**
     * Import
     */
    const handleImport = useCallback(async () => {
        try {
            const file = await openFileDialog('.json');
            if (!file) return;

            const content = await readFileAsText(file);
            const count = await importFromJSON(content);

            alert(`${count}개의 아카이브를 가져왔습니다.`);

            // 목록 새로고침
            search({});
            getTotalCount().then(setTotalCount);
        } catch (err) {
            console.error('[ArchiveSidebar] Import failed:', err);
            alert('가져오기에 실패했습니다.');
        }
    }, [importFromJSON, search, getTotalCount]);

    /**
     * Clear All
     */
    const handleClearAll = useCallback(async () => {
        if (!confirm('정말 모든 아카이브를 삭제하시겠습니까?')) {
            return;
        }

        try {
            await clearAll();
            alert('모든 아카이브가 삭제되었습니다.');

            // 목록 새로고침
            search({});
            setTotalCount(0);
        } catch (err) {
            console.error('[ArchiveSidebar] Clear failed:', err);
            alert('삭제에 실패했습니다.');
        }
    }, [clearAll, search]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="sidebar-overlay"
                        onClick={onClose}
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="archive-sidebar"
                    >
                        {/* Header */}
                        <div className="sidebar-header">
                            <div className="sidebar-title">
                                <Archive size={20} />
                                <h2>Archive</h2>
                                <span className="archive-count">({totalCount})</span>
                            </div>

                            <div className="sidebar-header-actions">
                                {/* Preview Toggle */}
                                <button
                                    className={`icon-button ${showPreview ? 'text-blue-400' : 'text-slate-500'}`}
                                    onClick={() => setShowPreview(!showPreview)}
                                    title={showPreview ? "Hide Preview" : "Show Preview"}
                                >
                                    {showPreview ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>

                                {/* Actions Menu Toggle */}
                                <button
                                    className="icon-button"
                                    onClick={() => setShowActions(!showActions)}
                                    title="Actions"
                                >
                                    <MoreVertical size={18} />
                                </button>

                                {/* Close Button */}
                                <button
                                    className="icon-button"
                                    onClick={onClose}
                                    title="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Actions Menu */}
                        {showActions && (
                            <div className="sidebar-actions">
                                <button className="action-button" onClick={handleExport}>
                                    <Download size={16} />
                                    <span>Export JSON</span>
                                </button>

                                <button className="action-button" onClick={handleImport}>
                                    <Upload size={16} />
                                    <span>Import JSON</span>
                                </button>

                                <button className="action-button danger" onClick={handleClearAll}>
                                    <Trash2 size={16} />
                                    <span>Clear All</span>
                                </button>
                            </div>
                        )}

                        {/* Search Bar */}
                        <ArchiveSearchBar
                            onSearchChange={handleSearchChange}
                            isSearching={isSearching}
                        />

                        {/* Results Info */}
                        <div className="sidebar-results-info">
                            {isSearching ? (
                                <span>
                                    <Loader2 size={14} className="spinning" />
                                    Searching...
                                </span>
                            ) : (
                                <span>
                                    {results.length} of {total} results
                                </span>
                            )}
                        </div>

                        {/* Archive List */}
                        <div className="sidebar-content">
                            <ArchiveList
                                archives={results}
                                selectedId={selectedArchive?.id}
                                onView={handleView}
                                onDelete={() => {
                                    // 삭제 후 즉시 목록 새로고침 (debounce 없이)
                                    search({}, true);
                                    getTotalCount().then(setTotalCount);
                                }}
                                onLoadMore={loadMore}
                                hasMore={hasMore}
                                isLoading={isSearching}
                                showPreview={showPreview}
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}


