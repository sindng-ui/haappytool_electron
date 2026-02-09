import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export interface Command {
    id: string;
    title: string;
    action: () => void;
    section?: string;
    icon?: React.ReactNode;
    shortcut?: string;
    keywords?: string[]; // For fuzzy search
}

interface CommandContextType {
    isOpen: boolean;
    openPalette: () => void;
    closePalette: () => void;
    togglePalette: () => void;
    registerCommand: (command: Command) => void;
    unregisterCommand: (commandId: string) => void;
    commands: Command[];
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export const useCommand = () => {
    const context = useContext(CommandContext);
    if (!context) {
        throw new Error('useCommand must be used within a CommandProvider');
    }
    return context;
};

export const CommandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [commands, setCommands] = useState<Command[]>([]);

    const openPalette = useCallback(() => setIsOpen(true), []);
    const closePalette = useCallback(() => setIsOpen(false), []);
    const togglePalette = useCallback(() => setIsOpen(prev => !prev), []);

    const registerCommand = useCallback((command: Command) => {
        setCommands(prev => {
            if (prev.find(c => c.id === command.id)) return prev;
            return [...prev, command];
        });
    }, []);

    const unregisterCommand = useCallback((commandId: string) => {
        setCommands(prev => prev.filter(c => c.id !== commandId));
    }, []);

    // Global Shortcut Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+K or Cmd+K
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                togglePalette();
            }
            // Ctrl+P or Cmd+P (Alternative)
            // Ctrl+Shift+F (Log Archive)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                // We need to trigger the command, but we don't know the action here directly.
                // However, we can find it in the commands list.
                const cmd = commands.find(c => c.id === 'open-log-archive');
                if (cmd) {
                    cmd.action();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                togglePalette();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePalette, commands]);

    const value = React.useMemo(() => ({
        isOpen,
        openPalette,
        closePalette,
        togglePalette,
        registerCommand,
        unregisterCommand,
        commands
    }), [isOpen, commands, openPalette, closePalette, togglePalette, registerCommand, unregisterCommand]);

    return (
        <CommandContext.Provider value={value}>
            {children}
        </CommandContext.Provider>
    );
};
