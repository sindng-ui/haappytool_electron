import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';

type Size = { width: number; height: number };

interface AutoSizerProps {
    children: (size: Size) => React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}

const AutoSizer: React.FC<AutoSizerProps> = ({ children, style, className }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<Size>({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!ref.current) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                // Use contentRect for precise content box size
                const { width, height } = entry.contentRect;
                setSize({ width, height });
            }
        });

        observer.observe(ref.current);

        // Initial measure
        const rect = ref.current.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div
            ref={ref}
            className={className}
            style={{ width: '100%', height: '100%', overflow: 'hidden', ...style }}
        >
            {size.width > 0 && size.height > 0 ? children(size) : null}
        </div>
    );
};

export default AutoSizer;
