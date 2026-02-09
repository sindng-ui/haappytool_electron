import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag as TagIcon, Save, Loader2, Folder, Palette } from 'lucide-react';
import { useLogArchive } from './hooks/useLogArchive';
import { useLogArchiveContext } from './LogArchiveProvider';
import { extractFirstLine, suggestTags } from './utils';
import { db } from './db/LogArchiveDB';

interface SaveArchiveDialogProps {
    /**
     * 모달 열림 상태
     */
    isOpen: boolean;

    /**
     * 닫기 핸들러
     */
    onClose: () => void;

    /**
     * 저장할 텍스트 정보
     */
    selectedText: {
        content: string;
        startLine?: number;
        endLine?: number;
        sourceFile?: string;
    } | null;
}

/**
 * Save Archive Dialog
 * 
 * 선택한 로그를 아카이브에 저장하는 모달 다이얼로그
 */
export function SaveArchiveDialog({ isOpen, onClose, selectedText }: SaveArchiveDialogProps) {
    const { saveArchive, getAllTags, getFolderStatistics } = useLogArchive();

    const [title, setTitle] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
    const [folder, setFolder] = useState<string>('');
    const [folderInput, setFolderInput] = useState<string>('');
    const [folderStats, setFolderStats] = useState<Record<string, number>>({});
    const [selectedColor, setSelectedColor] = useState<string>('#3b82f6'); // 기본 파란색
    const [isSaving, setIsSaving] = useState(false);

    // 컬러 팔레트
    const colorPalette = [
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Purple', value: '#8b5cf6' },
        { name: 'Pink', value: '#ec4899' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Yellow', value: '#eab308' },
        { name: 'Green', value: '#10b981' },
        { name: 'Teal', value: '#14b8a6' },
        { name: 'Cyan', value: '#06b6d4' },
        { name: 'Indigo', value: '#6366f1' },
    ];

    const titleInputRef = useRef<HTMLInputElement>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);

    /**
     * 폴더 목록을 개수 많은 순으로 정렬
     */
    const sortedFolders = React.useMemo(() => {
        return Object.entries(folderStats)
            .filter(([folder]) => folder !== 'Uncategorized') // 'Uncategorized'는 선택지에서 제외
            .sort((a, b) => b[1] - a[1]) // 개수 많은 순 (내림차순)
            .map(([folder]) => folder);
    }, [folderStats]);

    /**
     * 기존 태그 로드 및 스마트 태그 추천
     */
    useEffect(() => {
        if (isOpen && selectedText) {
            // 제목 자동 입력
            const autoTitle = extractFirstLine(selectedText.content);
            setTitle(autoTitle);

            // 스마트 태그 추천
            const suggested = suggestTags(selectedText.content);
            setSuggestedTags(suggested);

            // 기존 태그 로드
            getAllTags().then(setAvailableTags);

            // 기존 폴더 통계 로드
            getFolderStatistics().then(setFolderStats);

            // 제목 입력창에 포커스
            setTimeout(() => titleInputRef.current?.focus(), 100);
        }
    }, [isOpen, selectedText, getAllTags, getFolderStatistics]);

    /**
     * 모달 닫기 시 상태 초기화
     */
    useEffect(() => {
        if (!isOpen) {
            setTitle('');
            setTags([]);
            setTagInput('');
            setSuggestedTags([]);
            setFolder('');
            setFolderInput('');
            setSelectedColor('#3b82f6');
            setIsSaving(false);
        }
    }, [isOpen]);

    /**
     * 태그 추가
     */
    const addTag = (tag: string) => {
        const trimmedTag = tag.trim().toUpperCase();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            setTags([...tags, trimmedTag]);
            setTagInput('');
        }
    };

    /**
     * 태그 제거
     */
    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    /**
     * 태그 입력 핸들러
     */
    const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(tagInput);
        } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
            // Backspace로 마지막 태그 제거
            removeTag(tags[tags.length - 1]);
        }
    };

    /**
     * 저장 핸들러
     */
    const handleSave = async () => {
        if (!selectedText || !title.trim()) {
            return;
        }

        setIsSaving(true);

        try {
            await saveArchive({
                title: title.trim(),
                content: selectedText.content,
                tags,
                sourceFile: selectedText.sourceFile,
                sourceLineStart: selectedText.startLine,
                sourceLineEnd: selectedText.endLine,
                metadata: {
                    folder: folder || undefined,
                    color: selectedColor,
                },
            });

            // 성공 시 모달 닫기
            onClose();
        } catch (err) {
            console.error('[SaveArchiveDialog] Failed to save:', err);
            alert('아카이브 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * 키보드 단축키
     */
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleSave();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="save-archive-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="dialog-header">
                            <h2>
                                <Save size={20} />
                                <span>Save to Archive</span>
                            </h2>
                            <button
                                className="icon-button"
                                onClick={onClose}
                                aria-label="Close"
                                disabled={isSaving}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="dialog-content">
                            {/* Title Input */}
                            <div className="form-group">
                                <label htmlFor="archive-title">Title</label>
                                <input
                                    id="archive-title"
                                    ref={titleInputRef}
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter archive title..."
                                    disabled={isSaving}
                                    maxLength={200}
                                />
                            </div>

                            {/* Tags Input */}
                            <div className="form-group">
                                <label htmlFor="archive-tags">
                                    <TagIcon size={16} />
                                    <span>Tags</span>
                                </label>

                                {/* Tag Chips */}
                                <div className="tag-container">
                                    {tags.map(tag => (
                                        <div key={tag} className="tag-chip">
                                            <span>{tag}</span>
                                            <button
                                                onClick={() => removeTag(tag)}
                                                disabled={isSaving}
                                                aria-label={`Remove ${tag}`}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Tag Input */}
                                    <input
                                        id="archive-tags"
                                        ref={tagInputRef}
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleTagInputKeyDown}
                                        placeholder="Add tags..."
                                        disabled={isSaving}
                                        className="tag-input"
                                    />
                                </div>

                                {/* Suggested Tags */}
                                {suggestedTags.length > 0 && (
                                    <div className="suggested-tags">
                                        <span className="suggested-tags-label">Suggested:</span>
                                        {suggestedTags.map(tag => (
                                            <button
                                                key={tag}
                                                className="suggested-tag"
                                                onClick={() => addTag(tag)}
                                                disabled={isSaving || tags.includes(tag)}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Folder Input */}
                            <div className="form-group">
                                <label htmlFor="archive-folder">
                                    <Folder size={16} />
                                    <span>Folder (Optional)</span>
                                </label>
                                <input
                                    id="archive-folder"
                                    type="text"
                                    value={folderInput}
                                    onChange={(e) => {
                                        setFolderInput(e.target.value);
                                        setFolder(e.target.value);
                                    }}
                                    placeholder="Enter folder name..."
                                    disabled={isSaving}
                                    list="folder-suggestions"
                                    className="folder-input"
                                />
                                <datalist id="folder-suggestions">
                                    {sortedFolders.map(f => (
                                        <option key={f} value={`${f} (${folderStats[f]})`} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Color Label */}
                            <div className="form-group">
                                <label>
                                    <Palette size={16} />
                                    <span>Color Label</span>
                                </label>
                                <div className="color-palette">
                                    {colorPalette.map(color => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            className={`color-swatch ${selectedColor === color.value ? 'selected' : ''}`}
                                            style={{ backgroundColor: color.value }}
                                            onClick={() => setSelectedColor(color.value)}
                                            disabled={isSaving}
                                            title={color.name}
                                            aria-label={`Select ${color.name}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="form-group">
                                <label>Preview</label>
                                <div className="content-preview">
                                    {selectedText?.content.substring(0, 500)}
                                    {selectedText && selectedText.content.length > 500 && '...'}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="dialog-footer">
                            <button
                                className="button-secondary"
                                onClick={onClose}
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                className="button-primary"
                                onClick={handleSave}
                                disabled={isSaving || !title.trim()}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={16} className="spinning" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        <span>Save</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Keyboard Hints */}
                        <div className="keyboard-hints">
                            <span><kbd>Enter</kbd> 태그 추가</span>
                            <span><kbd>Ctrl+Enter</kbd> 저장</span>
                            <span><kbd>Esc</kbd> 닫기</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
