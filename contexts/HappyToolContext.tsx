import React, { createContext, useContext } from 'react';
import { ToolId, LogRule, AppSettings, SavedRequest, RequestGroup, PostGlobalVariable, RequestHistoryItem, PostGlobalAuth, EnvironmentProfile } from '../types';

export interface HappyToolContextType {
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
}

const HappyToolContext = createContext<HappyToolContextType | undefined>(undefined);

export const HappyToolProvider: React.FC<{
    value: HappyToolContextType;
    children: React.ReactNode;
}> = ({ value, children }) => {
    return <HappyToolContext.Provider value={value}>{children}</HappyToolContext.Provider>;
};

export const useHappyTool = () => {
    const context = useContext(HappyToolContext);
    if (!context) {
        throw new Error('useHappyTool must be used within a HappyToolProvider');
    }
    return context;
};
