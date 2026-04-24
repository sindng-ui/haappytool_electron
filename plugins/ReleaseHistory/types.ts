export interface ReleaseItem {
    id: string;
    releaseName: string;
    years: number[]; // Changed from productName: string to support multiple years
    version: string;
    releaseDate: number; // Unix timestamp for easy sorting and timeline placement
    note: string; // Markdown supported
    tags?: string[];
}

export interface YearConfig {
    year: number;
    latestVersion?: string;
    latestReleaseId?: string;
}

export interface ReleaseHistoryData {
    items: ReleaseItem[];
    yearConfigs: Record<number, YearConfig>;
}

export type ViewMode = 'list' | 'timeline';

export const PRESET_TAGS = ['Release', 'Hotfix', 'OTN', 'OSU'];

export const TAG_COLORS: Record<string, string> = {
    'Release': '#6366f1', // indigo-500
    'Hotfix': '#f43f5e',  // rose-500
    'OTN': '#10b981',     // emerald-500
    'OSU': '#f59e0b',     // amber-500
};

export const getTagColor = (tag: string): string => {
    return TAG_COLORS[tag] || `hsl(${Math.abs(tag.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)) % 360}, 60%, 50%)`;
};
