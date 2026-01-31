import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';

const { Copy, XCircle, X, Trash2 } = Lucide;

interface ContextMenuItem {
    label: string;
    icon: React.ReactNode;
    action: () => void;
    variant?: 'default' | 'danger';
    disabled?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // ✅ Performance: Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        // Small delay to prevent immediate close from the triggering click
        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust position if menu would overflow
    const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let newX = x;
            let newY = y;

            if (x + rect.width > viewportWidth) {
                newX = viewportWidth - rect.width - 10;
            }

            if (y + rect.height > viewportHeight) {
                newY = viewportHeight - rect.height - 10;
            }

            setAdjustedPosition({ x: newX, y: newY });
        }
    }, [x, y]);

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] bg-slate-900/95 backdrop-blur-md border border-indigo-500/30 rounded-lg shadow-2xl shadow-black/50 min-w-[200px] py-1 animate-in fade-in zoom-in-95 duration-150"
            style={{
                left: `${adjustedPosition.x}px`,
                top: `${adjustedPosition.y}px`,
            }}
        >
            {items.map((item, idx) => (
                <button
                    key={idx}
                    onClick={() => {
                        if (!item.disabled) {
                            item.action();
                            onClose();
                        }
                    }}
                    disabled={item.disabled}
                    className={`
                        w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150
                        ${item.disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : item.variant === 'danger'
                                ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300'
                                : 'hover:bg-indigo-500/10 text-slate-300 hover:text-slate-100'
                        }
                    `}
                >
                    <span className="w-4 h-4 flex items-center justify-center">
                        {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                </button>
            ))}
        </div>
    );
};

// ✅ Hook for managing context menu state
export const useContextMenu = () => {
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        items: ContextMenuItem[];
    } | null>(null);

    const showContextMenu = (e: React.MouseEvent, items: ContextMenuItem[]) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items,
        });
    };

    const hideContextMenu = () => {
        setContextMenu(null);
    };

    const ContextMenuComponent = contextMenu ? (
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={hideContextMenu}
        />
    ) : null;

    return {
        showContextMenu,
        hideContextMenu,
        ContextMenuComponent,
    };
};
