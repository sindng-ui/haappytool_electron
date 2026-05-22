import React, { useState, useMemo } from 'react';
import { LogRule } from '../../types';

interface SearchMatch {
    lineNum: number;
    content: string;
}

export interface TabSearchResult {
    tabId: string;
    tabName: string;
    fileName: string;
    filePath: string;
    pane: 'left' | 'right';
    matches: SearchMatch[];
}

interface GlobalSearchResultViewProps {
    results: TabSearchResult[];
    rule: LogRule | null;
    onJumpToTabLine: (tabId: string, pane: 'left' | 'right', lineNum: number) => void;
    isSearching: boolean;
    onClear?: () => void;
}

/**
 * Notepad++의 "Find in Open Files" 결과를 완벽하게 오마주한 프리미엄 다크 글래스모피즘 검색 결과 뷰어입니다. 🐧⚡
 * 성능 향상을 위해 CPU 부하가 큰 CSS 'blur' 속성을 100% 배제하고, HSL 컬러 팔레트와 60fps 아코디언 모션을 적용했습니다.
 */
export const GlobalSearchResultView: React.FC<GlobalSearchResultViewProps> = ({
    results,
    rule,
    onJumpToTabLine,
    isSearching,
    onClear
}) => {
    const [collapsedTabs, setCollapsedTabs] = useState<Record<string, boolean>>({});

    const totalFiles = results.length;
    const filesWithMatches = useMemo(() => results.filter(r => r.matches.length > 0).length, [results]);
    const totalMatches = useMemo(() => results.reduce((sum, r) => sum + r.matches.length, 0), [results]);

    const toggleTabCollapse = (key: string) => {
        setCollapsedTabs(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // 글로벌 미션에 등록된 해피콤보 키워드들을 평탄화하여 수집
    const keywords = useMemo(() => {
        if (!rule) return [];
        return rule.includeGroups.flat().map(k => k.trim()).filter(k => k !== '');
    }, [rule]);

    const caseSensitive = rule?.happyCombosCaseSensitive ?? false;

    /**
     * 텍스트 내에서 매칭 키워드를 노란색 HSL 하이라이트로 감싸서 React Node로 반환합니다.
     */
    const renderHighlightedContent = (content: string) => {
        if (keywords.length === 0) return <span>{content}</span>;

        // 에스크케이프 처리
        const escapedKeywords = keywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const regexStr = `(${escapedKeywords.join('|')})`;
        const regex = new RegExp(regexStr, caseSensitive ? 'g' : 'gi');

        const parts = content.split(regex);
        return (
            <>
                {parts.map((part, index) => {
                    const isMatch = keywords.some(k => {
                        const w1 = caseSensitive ? k : k.toLowerCase();
                        const w2 = caseSensitive ? part : part.toLowerCase();
                        return w1 === w2;
                    });

                    if (isMatch) {
                        return (
                            <mark
                                key={index}
                                className="bg-yellow-500/30 text-yellow-200 border border-yellow-500/50 rounded px-0.5 font-semibold"
                                style={{ textShadow: '0 0 4px rgba(234, 179, 8, 0.4)' }}
                            >
                                {part}
                            </mark>
                        );
                    }
                    return <span key={index}>{part}</span>;
                })}
            </>
        );
    };

    if (isSearching) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <div className="flex items-center space-x-3 mb-2">
                    <svg className="animate-spin h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-emerald-400 font-medium">열려있는 모든 파일 스캔 중...</span>
                </div>
                <p className="text-xs text-slate-500 font-mono">워커 병렬 파이프라인 가동 및 필터 연산 수행 중</p>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
                <p className="text-sm font-medium">검색 결과가 존재하지 않습니다.</p>
                <p className="text-xs mt-1">열린 파일 탭에 검색할 로그 파일이 로드되었는지 확인해주십시오.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950/40 border border-slate-800/80 rounded-xl overflow-hidden font-mono text-sm shadow-2xl">
            {/* Notepad++ 스타일 최상위 헤더 요약 정보 */}
            <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between text-slate-300">
                <div className="flex items-center space-x-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-slate-200">찾기 결과들</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="text-xs text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800/60">
                        <strong className="text-emerald-400">{totalFiles}</strong>개 파일을 검색하여
                        <strong className="text-emerald-400 ml-1.5">{filesWithMatches}</strong>개 파일에서
                        <strong className="text-yellow-400 ml-1.5">{totalMatches}</strong>개 일치
                    </div>
                    {onClear && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-transparent hover:border-slate-700/80 transition-all duration-200"
                            title="결과 초기화"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* 결과 트리 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {results.map((tabRes) => {
                    const uniqueKey = `${tabRes.tabId}-${tabRes.pane}`;
                    const isCollapsed = collapsedTabs[uniqueKey] ?? false;
                    const matchesCount = tabRes.matches.length;

                    if (matchesCount === 0) return null;

                    return (
                        <div key={uniqueKey} className="border border-slate-800/40 rounded-lg overflow-hidden bg-slate-900/20">
                            {/* 파일 노드 헤더 (Notepad++ 스타일의 연한 초록색 계열 배경 오마주) */}
                            <div
                                onClick={() => toggleTabCollapse(uniqueKey)}
                                className="flex items-center justify-between px-3 py-2 bg-emerald-950/20 hover:bg-emerald-950/40 border-b border-emerald-900/30 cursor-pointer transition-colors duration-150 group"
                            >
                                <div className="flex items-center space-x-2.5 overflow-hidden">
                                    {/* 접기/펴기 아이콘 */}
                                    <svg
                                        className={`w-3.5 h-3.5 text-emerald-500 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                    
                                    {/* 파일 아이콘 */}
                                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    
                                    {/* 파일 경로 및 이름 */}
                                    <span className="text-emerald-300 font-medium truncate text-xs" title={tabRes.filePath}>
                                        {tabRes.filePath || tabRes.fileName}
                                    </span>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {/* 매치 개수 뱃지 */}
                                    <span className="bg-emerald-900/60 text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-800/40 font-bold group-hover:border-emerald-700/60 transition-colors">
                                        {matchesCount}개 일치
                                    </span>
                                    <span className="text-[10px] text-slate-500 bg-slate-950/60 border border-slate-800/60 px-1.5 py-0.5 rounded">
                                        {tabRes.tabName} ({tabRes.pane === 'left' ? 'L' : 'R'})
                                    </span>
                                </div>
                            </div>

                            {/* 매치 라인 리스트 */}
                            {!isCollapsed && (
                                <div className="divide-y divide-slate-900/50 font-mono text-xs max-h-[400px] overflow-y-auto bg-slate-950/10">
                                    {tabRes.matches.map((match) => (
                                        <div
                                            key={match.lineNum}
                                            onClick={() => onJumpToTabLine(tabRes.tabId, tabRes.pane, match.lineNum)}
                                            className="flex items-start py-1.5 px-4 hover:bg-slate-800/35 cursor-pointer group transition-colors duration-100"
                                        >
                                            {/* 라인 번호 (빨간색 톤의 강조) */}
                                            <span className="w-16 text-right text-rose-400 font-semibold pr-3 border-r border-slate-800/60 select-none flex-shrink-0">
                                                {match.lineNum + 1}
                                            </span>
                                            
                                            {/* 라인 본문 */}
                                            <span className="pl-4 text-slate-300 whitespace-pre-wrap break-all flex-1 group-hover:text-slate-100 transition-colors">
                                                {renderHighlightedContent(match.content)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
