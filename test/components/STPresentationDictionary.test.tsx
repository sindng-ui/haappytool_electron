import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock socket.io-client to avoid external network calls in test
const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn()
};

vi.mock('socket.io-client', () => {
    return {
        default: vi.fn(() => mockSocket),
        io: vi.fn(() => mockSocket)
    };
});

// Import target components
import { CategoryFilter } from '../../plugins/STPresentationDictionary/components/CategoryFilter';
import { ImportDialog } from '../../plugins/STPresentationDictionary/components/ImportDialog';
import STPresentationDictionary from '../../plugins/STPresentationDictionary/index';

describe('STPresentationDictionary - CategoryFilter UT', () => {
    const mockCategories = ['Samsung Appliance', 'Samsung TV', 'SmartThings Camera'];
    const mockOnToggleCategory = vi.fn();
    const mockOnUpdateCategoriesList = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render categories with flat dark-chip theme successfully', () => {
        render(
            <CategoryFilter
                categories={mockCategories}
                selectedCategories={[]}
                onToggleCategory={mockOnToggleCategory}
                onUpdateCategoriesList={mockOnUpdateCategoriesList}
            />
        );

        // Header and general category actions verification
        expect(screen.getByText('Device Categories')).toBeDefined();
        expect(screen.getByText('Manage Categories')).toBeDefined();

        // Check All Devices active state button
        const allButton = screen.getByText('All Devices');
        expect(allButton).toBeDefined();

        // Check each custom category 칩 exists in flat rendering
        mockCategories.forEach(cat => {
            expect(screen.getByText(cat)).toBeDefined();
        });
    });

    it('should fire onToggleCategory when clicking custom category chips', () => {
        render(
            <CategoryFilter
                categories={mockCategories}
                selectedCategories={['Samsung TV']}
                onToggleCategory={mockOnToggleCategory}
                onUpdateCategoriesList={mockOnUpdateCategoriesList}
            />
        );

        const applianceChip = screen.getByText('Samsung Appliance');
        fireEvent.click(applianceChip);

        expect(mockOnToggleCategory).toHaveBeenCalledWith('Samsung Appliance');
    });
});

describe('STPresentationDictionary - ImportDialog UT', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();

    it('should not render anything when isOpen is false', () => {
        const { container } = render(
            <ImportDialog
                isOpen={false}
                onClose={mockOnClose}
                categories={[]}
                onSave={mockOnSave}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('should render dialog controls when isOpen is true', () => {
        render(
            <ImportDialog
                isOpen={true}
                onClose={mockOnClose}
                categories={['Samsung TV']}
                onSave={mockOnSave}
            />
        );

        expect(screen.getByText('Import Device Presentation')).toBeDefined();
        expect(screen.getByText('Device Custom Alias (Name)')).toBeDefined();
        expect(screen.getByText('Assign Categories')).toBeDefined();
        
        // Find cancel action and trigger close
        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toBeDefined();
        fireEvent.click(cancelButton);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
});

describe('STPresentationDictionary - Index Panel UT', () => {
    it('should mount main panel successfully and initialize socket connection indicator', () => {
        render(<STPresentationDictionary />);

        // Main Title Header Verification (Appears in both header and details placeholder)
        const titles = screen.getAllByText('SmartThings Presentation Dictionary');
        expect(titles.length).toBeGreaterThanOrEqual(1);
        
        // Offline or Online indicator check (Socket starts offline by default in unit test setup)
        expect(screen.getByText('SOCKET OFFLINE')).toBeDefined();

        // Search Input exists
        const searchInput = screen.getByPlaceholderText('Search by name, manufacturer, ID...');
        expect(searchInput).toBeDefined();
    });
});
