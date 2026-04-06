import React, { createContext, useContext } from 'react';
import { ToolId, LogRule, AppSettings, SavedRequest, RequestGroup, PostGlobalVariable, RequestHistoryItem, PostGlobalAuth, EnvironmentProfile } from '../types';

export interface BigBrainContextType {
    // Log Extractor State
    logRules: LogRule[];
    setLogRules: React.Dispatch<React.SetStateAction<LogRule[]>>;

    // Post Tool State
    savedRequests: SavedRequest[];
    setSavedRequests: React.Dispatch<React.SetStateAction<SavedRequest[]>>;
    savedRequestGroups: RequestGroup[];
    setSavedRequestGroups: React.Dispatch<React.SetStateAction<RequestGroup[]>>;
    requestHistory: RequestHistoryItem[];
    setRequestHistory: React.Dispatch<React.SetStateAction<RequestHistoryItem[]>>;
    postGlobalVariables: PostGlobalVariable[];
    setPostGlobalVariables: React.Dispatch<React.SetStateAction<PostGlobalVariable[]>>;

    envProfiles: EnvironmentProfile[];
    setEnvProfiles: React.Dispatch<React.SetStateAction<EnvironmentProfile[]>>;
    activeEnvId: string;
    setActiveEnvId: React.Dispatch<React.SetStateAction<string>>;

    postGlobalAuth: PostGlobalAuth;
    setPostGlobalAuth: React.Dispatch<React.SetStateAction<PostGlobalAuth>>;

    // Global Actions
    handleExportSettings: () => void;
    handleImportSettings: (settings: AppSettings) => void;

    // Default Output Folder for CLI
    defaultOutputFolder: string;
    setDefaultOutputFolder: React.Dispatch<React.SetStateAction<string>>;

    // Focus Mode (F11)
    isFocusMode: boolean;
    toggleFocusMode: () => void;

    // Reactive Ambient Mood
    ambientMood: 'idle' | 'working' | 'error' | 'success';
    setAmbientMood: React.Dispatch<React.SetStateAction<'idle' | 'working' | 'error' | 'success'>>;
}

const BigBrainContext = createContext<BigBrainContextType | undefined>(undefined);

export const BigBrainProvider: React.FC<{
    value: BigBrainContextType;
    children: React.ReactNode;
}> = ({ value, children }) => {
    return <BigBrainContext.Provider value={value}>{children}</BigBrainContext.Provider>;
};

export const useBigBrain = () => {
    const context = useContext(BigBrainContext);
    if (!context) {
        throw new Error('useBigBrain must be used within a BigBrainProvider');
    }
    return context;
};
