export interface ReleaseItem {
    id: string;
    releaseName: string;
    productName: string;
    version: string;
    releaseDate: number; // Unix timestamp for easy sorting and timeline placement
    note: string; // Markdown supported
}

export type ViewMode = 'list' | 'timeline';
