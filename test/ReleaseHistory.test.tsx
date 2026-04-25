import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import React from 'react';
import ReleaseHistoryPlugin from '../plugins/ReleaseHistory/ReleaseHistoryPlugin';

// Mock icons dynamically
vi.mock('lucide-react', async (importOriginal) => {
    const actual = await importOriginal<any>();
    const mocks: any = {};
    Object.keys(actual).forEach((key) => {
        mocks[key] = (props: any) => <div data-testid={`icon-${key}`} {...props} />;
    });
    return mocks;
});

// Mock react-dom to render portals inline
vi.mock('react-dom', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        createPortal: (node: any) => node,
    };
});

// Mock html-to-image
vi.mock('html-to-image', () => ({
    toPng: vi.fn().mockResolvedValue('data:image/png;base64,fake')
}));

// Mock electronAPI
const mockElectronAPI = {
    copyToClipboard: vi.fn().mockResolvedValue(true)
};
(window as any).electronAPI = mockElectronAPI;

const mockContext = {
    // Add any necessary context props if used
} as any;

const STORAGE_KEY = 'happytool_release_history';

describe('ReleaseHistoryPlugin Hardcore Test Suite', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    const switchToListView = async () => {
        const listBtn = await screen.findByText(/LIST/i);
        fireEvent.click(listBtn);
    };

    it('should migrate legacy data formats correctly on load', async () => {
        const legacyData = {
            items: [
                {
                    id: 'old_1',
                    appName: 'Legacy App',
                    productName: '2023',
                    version: '1.0.0',
                    releaseDate: new Date('2023-01-01').getTime(),
                    note: 'Legacy note',
                    tags: ['Release']
                }
            ],
            yearConfigs: {}
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyData));

        render(<ReleaseHistoryPlugin context={mockContext} />);
        await switchToListView();

        expect(await screen.findByText(/Legacy App/i)).toBeDefined();
        expect(await screen.findByText(/v1.0.0/)).toBeDefined();
    });

    it('should handle complex search queries', async () => {
        const testData = {
            items: [
                { id: '1', releaseName: 'Alpha', years: [2024], version: '1.0.0', releaseDate: Date.now(), note: 'Special feature', tags: ['Major'] },
                { id: '2', releaseName: 'Beta', years: [2025], version: '2.0.0', releaseDate: Date.now(), note: 'Bug fixes', tags: ['Hotfix'] }
            ],
            yearConfigs: {}
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(testData));

        render(<ReleaseHistoryPlugin context={mockContext} />);
        await switchToListView();

        const searchInput = screen.getByPlaceholderText(/Search/i);

        // Search by name
        fireEvent.change(searchInput, { target: { value: 'Alpha' } });
        expect(await screen.findByText(/Alpha/i)).toBeDefined();
        expect(screen.queryByText(/Beta/i)).toBeNull();

        // Clear search
        fireEvent.change(searchInput, { target: { value: '' } });
        expect(await screen.findByText(/Beta/i)).toBeDefined();
    });

    it('should perform full CRUD operations', async () => {
        render(<ReleaseHistoryPlugin context={mockContext} />);
        await switchToListView();

        // 1. CREATE
        fireEvent.click(await screen.findByText(/ADD RELEASE/i));
        
        const nameInput = await screen.findByPlaceholderText(/e.g. 25R1/i);
        fireEvent.change(nameInput, { target: { value: 'CRUD Release' } });
        fireEvent.change(screen.getByPlaceholderText(/e.g. 5.0.328/i), { target: { value: '1.1.1' } });
        
        const publishBtns = await screen.findAllByText(/Publish Node/i);
        fireEvent.click(publishBtns[0]);

        // Wait for list update and check item exists
        expect(await screen.findByText(/CRUD Release/i)).toBeDefined();

        // 2. READ
        const versionCards = await screen.findAllByText(/v1.1.1/);
        fireEvent.click(versionCards[0]);
        
        expect(await screen.findByText(/Release Information/i)).toBeDefined();

        // 3. UPDATE
        const editBtn = await screen.findByText(/EDIT RELEASE/i);
        await act(async () => {
            fireEvent.click(editBtn);
        });

        const editNameInput = await screen.findByDisplayValue(/CRUD Release/i);
        await act(async () => {
            fireEvent.change(editNameInput, { target: { value: 'Updated CRUD' } });
        });

        const updateBtn = screen.getByRole('button', { name: /Update Release/i });
        await act(async () => {
            fireEvent.click(updateBtn);
        });

        // Wait for Add/Edit modal to close
        await waitFor(() => {
            expect(screen.queryByText(/Update Release/i)).toBeNull();
        }, { timeout: 5000 });

        // Wait for update to reflect in list (searching for the card title)
        await waitFor(() => {
            expect(screen.getByText(/Updated CRUD/i)).toBeInTheDocument();
        });

        // 4. DELETE
        // Ensure detail modal is open with the right item
        const updatedCard = screen.getByText(/Updated CRUD/i).closest('div[onClick]');
        await act(async () => {
            fireEvent.click(screen.getByText(/v1.1.1/));
        });

        const deleteBtn = await screen.findByRole('button', { name: /Delete/i });
        
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        await act(async () => {
            fireEvent.click(deleteBtn);
        });

        // Wait for detail modal to close
        await waitFor(() => {
            expect(screen.queryByText(/Release Information/i)).toBeNull();
        }, { timeout: 5000 });
        
        // Wait for item removal from list
        await waitFor(() => {
            const items = screen.queryAllByText(/Updated CRUD/i);
            expect(items.length).toBe(0);
        }, { timeout: 10000 });
        
        confirmSpy.mockRestore();
    }, 40000);

    it('should handle Copy Text functionality', async () => {
        const item = { id: '1', releaseName: 'CopyTest', years: [2024], version: '2.2.2', releaseDate: Date.now(), note: 'Copy Me', tags: [] };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: [item], yearConfigs: {} }));

        render(<ReleaseHistoryPlugin context={mockContext} />);
        await switchToListView();
        
        const cards = await screen.findAllByText(/v2.2.2/);
        fireEvent.click(cards[0]);

        const copyBtn = await screen.findByText(/Copy Text/i);
        fireEvent.click(copyBtn);

        expect(mockElectronAPI.copyToClipboard).toHaveBeenCalledWith('Copy Me');
        expect(await screen.findByText(/Documentation copied to clipboard/i)).toBeDefined();
    });
});
