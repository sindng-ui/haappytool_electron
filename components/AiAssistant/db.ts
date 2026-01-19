import Dexie, { Table } from 'dexie';

export interface ChatSession {
    id: string;
    title: string;
    messages: {
        role: 'user' | 'assistant' | 'system';
        content: string;
    }[];
    activePromptId: string;
    lastUpdated: number;
}

export class AiAssistantDB extends Dexie {
    sessions!: Table<ChatSession, string>;

    constructor() {
        super('AiAssistantDB');
        this.version(1).stores({
            sessions: 'id, lastUpdated' // Primary key and index for sorting
        });
    }
}

export const db = new AiAssistantDB();
