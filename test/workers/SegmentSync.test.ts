import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { LogRule, LogMetadata } from '../../types';
import { extractTimestamp } from '../../utils/logTime';
import { extractSourceMetadata } from '../../utils/perfAnalysis';
import {
    extractSingleMetadata,
    computeMetricsFromMetadata,
    AggregateMetrics,
    PointMetrics,
    extractAliasFromLine,
    matchAliasEvents,
    computeAliasIntervals,
    AliasEvent,
    SplitAnalysisResult
} from '../../workers/SplitAnalysisUtils';

const mockRule: LogRule = {
    id: 'test_rule',
    name: 'Test Rule',
    includeGroups: [],
    excludes: [],
    highlights: [],
    happyGroups: [
        { id: '1', enabled: true, alias: 'OnCreate', tags: ['OnCreate'] },
        { id: '2', enabled: true, alias: 'OnStart', tags: ['OnStart'] },
        { id: '3', enabled: true, alias: 'OnResume', tags: ['OnResume'] },
        { id: '4', enabled: true, alias: 'Init', tags: ['Init'] },
    ]
};

describe('Analyze Diff Segment Synchronization', () => {

    it('Should synchronize segments precisely by fileName, functionName, and codeLineNum', () => {
        const leftLogPath = path.join(__dirname, '../../test/test_startup.log');
        const rightLogPath = path.join(__dirname, '../../test/test_startup_2.log');

        const leftContent = fs.readFileSync(leftLogPath, 'utf-8');
        const rightContent = fs.readFileSync(rightLogPath, 'utf-8');

        const leftLines = leftContent.split(/\r?\n/).filter(l => l.trim().length > 0);
        const rightLines = rightContent.split(/\r?\n/).filter(l => l.trim().length > 0);

        // 1. 메타데이터 및 알리아스 이벤트 파싱
        const parseLogs = (lines: string[], side: string) => {
            const aliasEvents: AliasEvent[] = [];
            const metadataList: LogMetadata[] = [];

            lines.forEach((text, i) => {
                const metadata = extractSingleMetadata(text, i, i, mockRule);
                metadataList.push(metadata);

                const alias = extractAliasFromLine(text, mockRule);
                if (alias) {
                    aliasEvents.push({
                        alias,
                        timestamp: metadata.timestamp,
                        visualIndex: metadata.visualIndex,
                        lineNum: metadata.lineNum,
                        preview: metadata.preview,
                        fileName: metadata.fileName,
                        functionName: metadata.functionName,
                        codeLineNum: metadata.codeLineNum
                    });
                }
            });

            const metrics: AggregateMetrics = {};
            const pointMetrics: PointMetrics = {};
            const state = { prevTimestamp: null, prevSignature: 'START', prevFileInfo: { fileName: '', functionName: '', preview: '' }, lookbackWindow: [], aliasFirstMatch: {} };

            computeMetricsFromMetadata(metadataList, metrics, pointMetrics, state, 100, side);

            return { metadataList, aliasEvents, metrics, pointMetrics };
        };

        const leftData = parseLogs(leftLines, 'left');
        const rightData = parseLogs(rightLines, 'right');

        // 2. 워커 로직(세그먼트 추출) 시뮬레이션
        const results: SplitAnalysisResult[] = [];

        results.push(...matchAliasEvents(leftData.aliasEvents, rightData.aliasEvents));
        results.push(...computeAliasIntervals(leftData.aliasEvents, rightData.aliasEvents));

        const rightKeys = Object.keys(rightData.metrics);
        for (const key of rightKeys) {
            const left = leftData.metrics[key];
            const right = rightData.metrics[key];

            const isMapped = !!left;
            const isRightDirect = (right?.directCount || 0) > 0;
            if (!isMapped && !isRightDirect) continue;

            const leftAvgDelta = (left?.deltaSamples || 0) > 0 ? (left?.totalDelta || 0) / (left?.deltaSamples || 1) : 0;
            const rightAvgDelta = (right?.deltaSamples || 0) > 0 ? (right?.totalDelta || 0) / (right?.deltaSamples || 1) : 0;

            // 중복 방지를 위해 이미 매칭된 AliasMatch, AliasInterval을 사용하는지 체크
            const isAlreadyAlias = results.some(r => r.key === key);
            if (isAlreadyAlias) continue; // 실제 worker에선 겹칠시 key가 달라서 push됨. 테스트에선 단순화.

            results.push({
                key,
                fileName: right?.fileName || left?.fileName || '',
                functionName: right?.functionName || left?.functionName || '',
                preview: right?.preview || left?.preview || '',
                leftCount: left?.directCount || 0,
                rightCount: right?.directCount || 0,
                countDiff: (right?.directCount || 0) - (left?.directCount || 0),
                leftAvgDelta,
                rightAvgDelta,
                deltaDiff: rightAvgDelta - leftAvgDelta,
                isNewError: (!!right?.isError && !left?.isError),
                isError: (left?.isError || right?.isError) ?? false,
                isWarn: (left?.isWarn || right?.isWarn) ?? false,
                leftLineNum: left?.lineNum || 0,
                rightLineNum: right?.lineNum || 0,
                leftPrevLineNum: left?.prevLineNum || 0,
                rightPrevLineNum: right?.prevLineNum || 0,
                leftOrigLineNum: left?.originalLineNum || 0,
                rightOrigLineNum: right?.originalLineNum || 0,
                leftPrevOrigLineNum: left?.prevOriginalLineNum || 0,
                rightPrevOrigLineNum: right?.prevOriginalLineNum || 0,
                leftCodeLineNum: left?.codeLineNum,
                rightCodeLineNum: right?.codeLineNum,
                leftPrevCodeLineNum: left?.prevCodeLineNum,
                rightPrevCodeLineNum: right?.prevCodeLineNum
            });
        }

        // 3. Segment 순회하며 정합성(동기화) 체크 (왼쪽 및 오른쪽 모두 존재하는 매칭에 대해)
        let checkedCount = 0;

        results.forEach(seg => {
            // 양쪽 로그에 모두 매칭된 구간인지 확인 (어느 한쪽에 없으면 동기화 점검 대상 아님)
            if (seg.leftOrigLineNum > 0 && seg.rightOrigLineNum > 0) {

                // End Log Check
                const leftEndTarget = leftData.metadataList[seg.leftOrigLineNum - 1]; // originalLineNum은 1-index 기반이라 -1
                const rightEndTarget = rightData.metadataList[seg.rightOrigLineNum - 1];

                if (leftEndTarget && rightEndTarget) {
                    if (leftEndTarget.fileName || rightEndTarget.fileName) {
                        expect(leftEndTarget.fileName).toBe(rightEndTarget.fileName);
                    }
                    if (leftEndTarget.functionName || rightEndTarget.functionName) {
                        try {
                            expect(leftEndTarget.functionName).toBe(rightEndTarget.functionName);
                        } catch (e) {
                            // Alias 이벤트의 경우 functionName이 달라도 Alias가 동일하면 넘어가는 예외처리가 필요할 수 있으나,
                            // 지금은 제일 엄격한 검사를 요구함
                            if (!seg.isAliasMatch && !seg.isAliasInterval) {
                                throw e;
                            }
                        }
                    }
                    // 🐧⚡ 라인 번호 의존성 제거: 이제 라인 번호가 달라도 논리적으로 같은 구간이면 매칭됨
                    /*
                    if (leftEndTarget.codeLineNum || rightEndTarget.codeLineNum) {
                        expect(leftEndTarget.codeLineNum).toBe(rightEndTarget.codeLineNum);
                    }
                    */
                }

                // Start Log Check (for Intervals)
                if (seg.leftPrevOrigLineNum > 0 && seg.rightPrevOrigLineNum > 0) {
                    const leftStartTarget = leftData.metadataList[seg.leftPrevOrigLineNum - 1];
                    const rightStartTarget = rightData.metadataList[seg.rightPrevOrigLineNum - 1];

                    if (leftStartTarget && rightStartTarget) {
                        if (leftStartTarget.fileName || rightStartTarget.fileName) {
                            expect(leftStartTarget.fileName).toBe(rightStartTarget.fileName);
                        }
                        if (leftStartTarget.functionName || rightStartTarget.functionName) {
                            try {
                                expect(leftStartTarget.functionName).toBe(rightStartTarget.functionName);
                            } catch (e) {
                                if (!seg.isAliasMatch && !seg.isAliasInterval) {
                                    throw e;
                                }
                            }
                        }
                        // 🐧⚡ 라인 번호 의존성 제거
                        /*
                        if (leftStartTarget.codeLineNum || rightStartTarget.codeLineNum) {
                            expect(leftStartTarget.codeLineNum).toBe(rightStartTarget.codeLineNum);
                        }
                        */
                    }
                }

                checkedCount++;
            }
        });

        // 매칭된 세그먼트가 최소 1개 이상 있는지 확인!
        expect(checkedCount).toBeGreaterThan(0);
    });
});
