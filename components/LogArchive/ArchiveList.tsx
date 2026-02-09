import React, { useCallback, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Loader2, PackageX } from 'lucide-react';
import { ArchivedLog } from './db/LogArchiveDB';
import { ArchiveCard } from './ArchiveCard';
import { useLogArchive } from './hooks/useLogArchive';

interface ArchiveListProps {
    /**
     * 아카이브 목록
     */
    archives: ArchivedLog[];

    /**
     * 선택된 아카이브 ID
     */
    selectedId?: number;

    /**
     * 보기 핸들러
     */
    onView: (archive: ArchivedLog) => void;

    /**
     * 편집 핸들러
     */
    onEdit?: (archive: ArchivedLog) => void;

    /**
     * 삭제 핸들러 (선택)
     */
    onDelete?: (id: number) => void;

    /**
     * 더 로드하기 (무한 스크롤)
     */
    onLoadMore?: () => void;

    /**
     * 더 로드 가능 여부
     */
    hasMore?: boolean;

    /**
     * 로딩 상태
     */
    isLoading?: boolean;
}

/**
 * Archive List
 * 
 * 아카이브 목록을 가상 스크롤로 표시하는 컴포넌트
 */
export function ArchiveList({
    archives,
    selectedId,
    onView,
    onEdit,
    onDelete: onDeleteProp,
    onLoadMore,
    hasMore = false,
    isLoading = false,
}: ArchiveListProps) {
    const { deleteArchive } = useLogArchive();

    /**
     * 삭제 핸들러
     */
    const handleDelete = useCallback(
        async (archive: ArchivedLog) => {
            if (!archive.id) return;

            try {
                await deleteArchive(archive.id);
                onDeleteProp?.(archive.id);
            } catch (err) {
                console.error('[ArchiveList] Failed to delete:', err);
                alert('아카이브 삭제에 실패했습니다.');
            }
        },
        [deleteArchive, onDeleteProp]
    );

    /**
     * End Reached 핸들러 (무한 스크롤)
     */
    const handleEndReached = useCallback(() => {
        if (hasMore && !isLoading && onLoadMore) {
            onLoadMore();
        }
    }, [hasMore, isLoading, onLoadMore]);

    /**
     * Empty State
     */
    if (!isLoading && archives.length === 0) {
        return (
            <div className="archive-list-empty">
                <PackageX size={48} />
                <h3>No Archives Found</h3>
                <p>Start saving logs to build your archive.</p>
            </div>
        );
    }

    /**
     * Footer (Loading Indicator)
     */
    const Footer = () => {
        if (!hasMore) return null;

        return (
            <div className="archive-list-footer">
                {isLoading ? (
                    <>
                        <Loader2 size={20} className="spinning" />
                        <span>Loading more...</span>
                    </>
                ) : (
                    <span>Scroll for more</span>
                )}
            </div>
        );
    };

    return (
        <div className="archive-list">
            <Virtuoso
                data={archives}
                endReached={handleEndReached}
                overscan={10}
                itemContent={(index, archive) => (
                    <div className="archive-list-item" key={archive.id}>
                        <ArchiveCard
                            archive={archive}
                            onView={onView}
                            onEdit={onEdit}
                            onDelete={handleDelete}
                            isSelected={archive.id === selectedId}
                        />
                    </div>
                )}
                components={{
                    Footer,
                }}
            />
        </div>
    );
}
