import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Trash2, FileText, Calendar, Folder } from 'lucide-react';
import { ArchivedLog } from './db/LogArchiveDB';
import { formatDate, getTagColor, countLines, decodeHtmlEntities } from './utils';

interface ArchiveCardProps {
    /**
     * 아카이브 데이터
     */
    archive: ArchivedLog;

    /**
     * 보기 핸들러
     */
    onView: (archive: ArchivedLog) => void;

    /**
     * 편집 핸들러
     */
    onEdit?: (archive: ArchivedLog) => void;

    /**
     * 삭제 핸들러
     */
    onDelete: (archive: ArchivedLog) => void;

    /**
     * 선택 여부
     */
    isSelected?: boolean;

    /**
     * 미리보기 표시 여부
     * @default true
     */
    showPreview?: boolean;
}

/**
 * Archive Card
 * 
 * 개별 아카이브 항목을 표시하는 카드 컴포넌트
 * Compact Layout: Actions moved to header
 */
export const ArchiveCard = memo(function ArchiveCard({
    archive,
    onView,
    onEdit,
    onDelete,
    isSelected = false,
    showPreview = true,
}: ArchiveCardProps) {
    const lineCount = countLines(archive.content);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.15 }}
            className={`archive-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onView(archive)}
            style={{ position: 'relative' }}
        >
            {/* Color Indicator */}
            {archive.metadata?.color && (
                <div
                    className="archive-color-indicator"
                    style={{ backgroundColor: archive.metadata.color }}
                    title="Color label"
                />
            )}

            {/* Header: Title + Actions */}
            <div className="archive-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="archive-card-title cursor-pointer truncate" title={decodeHtmlEntities(archive.title)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={16} className="text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-200 truncate">{decodeHtmlEntities(archive.title)}</span>
                    </h3>

                    {/* Folder Badge in Header (Optional: or below title) */}
                    {archive.metadata?.folder && (
                        <div className="archive-folder-badge mt-1 inline-flex items-center" title={`Folder: ${archive.metadata.folder}`}>
                            <Folder size={10} className="mr-1" />
                            <span>{archive.metadata.folder}</span>
                        </div>
                    )}
                </div>

                {/* Actions (Top Right) */}
                <div className="archive-card-actions-inline flex gap-1 ml-2 flex-shrink-0" style={{ position: 'relative', zIndex: 2 }}>
                    <button
                        className="p-1.5 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`"${archive.title}" 아카이브를 삭제하시겠습니까?`)) {
                                onDelete(archive);
                            }
                        }}
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Metadata Row */}
            <div className="archive-card-meta flex items-center text-xs text-slate-500 gap-3 mb-2">
                <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{formatDate(archive.createdAt)}</span>
                </span>
                <span className="flex items-center gap-1">
                    <FileText size={12} />
                    <span>{lineCount} lines</span>
                </span>
            </div>

            {/* Tags (if any) */}
            {archive.tags.length > 0 && (
                <div className="archive-card-tags flex flex-wrap gap-1 mb-2">
                    {archive.tags.map(tag => (
                        <span
                            key={tag}
                            className="archive-tag text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                                backgroundColor: getTagColor(tag),
                                color: '#fff',
                                opacity: 0.8
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Memo Preview (1 line) */}
            {archive.memo && (
                <div className="text-[11px] text-slate-400/80 mb-2 truncate italic flex items-center gap-1" title={archive.memo}>
                    <span style={{ opacity: 0.6 }}>📝</span>
                    <span className="truncate">{archive.memo}</span>
                </div>
            )}


            {/* Preview Content (Smaller) */
                showPreview && (
                    <div className="archive-card-preview text-xs text-slate-400 font-mono bg-slate-900/50 p-2 rounded overflow-hidden h-16 relative">
                        {decodeHtmlEntities(archive.content).slice(0, 200)}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none" />
                    </div>
                )}


            {/* No Bottom Actions Bar anymore */}
        </motion.div>
    );
});
