import { useState, useEffect, useRef } from 'react';

export const usePostToolResize = () => {
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('postToolSidebarWidth');
        return saved ? parseInt(saved, 10) : 256;
    });
    const isResizing = useRef(false);

    const [responseHeight, setResponseHeight] = useState(() => {
        const saved = localStorage.getItem('postToolResponseHeight');
        return saved ? parseInt(saved, 10) : 300;
    });
    const responseHeightRef = useRef(responseHeight);
    const [isResizingResponse, setIsResizingResponse] = useState(false);

    const sidebarWidthRef = useRef(sidebarWidth);
    useEffect(() => {
        sidebarWidthRef.current = sidebarWidth;
        responseHeightRef.current = responseHeight;
    }, [sidebarWidth, responseHeight]);

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isResizing.current) {
                const newWidth = Math.max(200, Math.min(600, e.clientX - 80));
                setSidebarWidth(newWidth);
                return;
            }
            if (isResizingResponse) {
                const newHeight = Math.max(100, Math.min(window.innerHeight - 200, window.innerHeight - e.clientY));
                setResponseHeight(newHeight);
            }
        };

        const handleGlobalMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                localStorage.setItem('postToolSidebarWidth', sidebarWidthRef.current.toString());
                document.body.style.cursor = 'default';
            }
            if (isResizingResponse) {
                setIsResizingResponse(false);
                localStorage.setItem('postToolResponseHeight', responseHeightRef.current.toString());
                document.body.style.cursor = 'default';
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isResizingResponse]);

    const handleResizeStart = () => {
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
    };

    const handleResponseResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingResponse(true);
        document.body.style.cursor = 'row-resize';
    };

    return {
        sidebarWidth,
        responseHeight,
        isResizingResponse,
        handleResizeStart,
        handleResponseResizeStart
    };
};

export default usePostToolResize;
