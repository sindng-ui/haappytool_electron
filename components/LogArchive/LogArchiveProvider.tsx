import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ArchivedLog } from './db/LogArchiveDB';

/**
 * 선택된 텍스트 정보
 */
export interface SelectedText {
    content: string;
    startLine?: number;
    endLine?: number;
    sourceFile?: string;
}

/**
 * LogArchive Context 타입
 */
export interface LogArchiveContextType {
    // UI 상태
    isSidebarOpen: boolean;
    isViewerOpen: boolean;
    isSaveDialogOpen: boolean;

    // 선택된 아카이브
    selectedArchive: ArchivedLog | null;

    // 선택된 텍스트 (저장용)
    selectedText: SelectedText | null;

    // Actions
    openSidebar: () => void;
    closeSidebar: () => void;
    toggleSidebar: () => void;

    openViewer: (archive: ArchivedLog) => void;
    closeViewer: () => void;

    openSaveDialog: (text: SelectedText) => void;
    closeSaveDialog: () => void;

    setSelectedArchive: (archive: ArchivedLog | null) => void;
}

const LogArchiveContext = createContext<LogArchiveContextType | undefined>(undefined);

/**
 * LogArchive Context Provider
 */
export function LogArchiveProvider({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [selectedArchive, setSelectedArchive] = useState<ArchivedLog | null>(null);
    const [selectedText, setSelectedText] = useState<SelectedText | null>(null);

    const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
    const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

    const openViewer = useCallback((archive: ArchivedLog) => {
        setSelectedArchive(archive);
        setIsViewerOpen(true);
    }, []);

    const closeViewer = useCallback(() => {
        setIsViewerOpen(false);
        setSelectedArchive(null);
    }, []);

    const openSaveDialog = useCallback((text: SelectedText) => {
        setSelectedText(text);
        setIsSaveDialogOpen(true);
    }, []);

    const closeSaveDialog = useCallback(() => {
        setIsSaveDialogOpen(false);
        setSelectedText(null);
    }, []);

    const value: LogArchiveContextType = {
        isSidebarOpen,
        isViewerOpen,
        isSaveDialogOpen,
        selectedArchive,
        selectedText,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        openViewer,
        closeViewer,
        openSaveDialog,
        closeSaveDialog,
        setSelectedArchive,
    };

    return (
        <LogArchiveContext.Provider value={value}>
            {children}
        </LogArchiveContext.Provider>
    );
}

/**
 * LogArchive Context Hook
 */
export function useLogArchiveContext(): LogArchiveContextType {
    const context = useContext(LogArchiveContext);
    if (!context) {
        throw new Error('useLogArchiveContext must be used within LogArchiveProvider');
    }
    return context;
}
