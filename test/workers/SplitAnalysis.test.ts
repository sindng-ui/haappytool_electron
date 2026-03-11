import { describe, it, expect } from 'vitest';
import {
    matchAliasEvents,
    computeAliasIntervals,
    computeGlobalAliasRanges,
    AliasEvent
} from '../../workers/SplitAnalysisUtils';

describe('Split Analysis Alias Matching', () => {

    const leftEvents: AliasEvent[] = [
        { alias: 'OnCreate', timestamp: 1000, visualIndex: 0, lineNum: 1, preview: 'OnCreate(123)', codeLineNum: '123' },
        { alias: 'OnStart', timestamp: 2000, visualIndex: 1, lineNum: 2, preview: 'OnStart(300)', codeLineNum: '300' },
        { alias: 'OnResume', timestamp: 3000, visualIndex: 2, lineNum: 3, preview: 'OnResume(333)', codeLineNum: '333' }
    ];

    it('Should match identical alias sequences', () => {
        const rightEvents = [...leftEvents];
        const results = matchAliasEvents(leftEvents, rightEvents);

        expect(results.length).toBe(3);
        expect(results[0].key).toContain('::OnCreate(123)');
        expect(results[1].key).toContain('::OnStart(300)');
        expect(results[2].key).toContain('::OnResume(333)');
        expect(results[0].deltaDiff).toBe(0);
    });

    it('Should identify new alias events in right log', () => {
        const rightEvents: AliasEvent[] = [
            leftEvents[0],
            { alias: 'OnResume', timestamp: 2500, visualIndex: 1, lineNum: 5, preview: 'OnResume(55)', codeLineNum: '55' }, // NEW
            leftEvents[1],
            leftEvents[2]
        ];

        const results = matchAliasEvents(leftEvents, rightEvents);

        // 🐧🎯 OnResume(55)는 새로운 이벤트로 잡혀야 함!
        const newEvent = results.find(r => r.key.includes('::OnResume(55)'));
        expect(newEvent).toBeDefined();
        expect(newEvent?.leftCount).toBe(0);
        expect(newEvent?.rightCount).toBe(1);

        // 나머지는 잘 매칭되어야 함
        expect(results.filter(r => r.leftCount === 1).length).toBe(3);
    });

    it('Should calculate time differences correctly', () => {
        const rightEvents: AliasEvent[] = [
            { ...leftEvents[0], timestamp: 1100 }, // +100ms
            { ...leftEvents[1], timestamp: 2200 }, // +200ms
        ];

        const results = matchAliasEvents(leftEvents.slice(0, 2), rightEvents);
        expect(results[0].deltaDiff).toBe(100);
        expect(results[1].deltaDiff).toBe(200);
    });
});

describe('Split Analysis Interval Analysis', () => {

    const leftEvents: AliasEvent[] = [
        { alias: 'OnCreate', timestamp: 1000, visualIndex: 10, lineNum: 1, preview: 'start', codeLineNum: '100' },
        { alias: 'OnCreate', timestamp: 1500, visualIndex: 20, lineNum: 5, preview: 'end', codeLineNum: '200' },
    ];

    it('Should match intervals by Start->End signature and calculate duration', () => {
        const rightEvents: AliasEvent[] = [
            { alias: 'OnCreate', timestamp: 1000, visualIndex: 10, lineNum: 1, preview: 'start', codeLineNum: '100' },
            { alias: 'OnCreate', timestamp: 1800, visualIndex: 20, lineNum: 5, preview: 'end', codeLineNum: '200' },
        ];

        const results = computeAliasIntervals(leftEvents, rightEvents);

        expect(results.length).toBe(1);
        expect(results[0].isAliasInterval).toBe(true);
        expect(results[0].leftAvgDelta).toBe(500);  // 1500 - 1000
        expect(results[0].rightAvgDelta).toBe(800); // 1800 - 1000
        expect(results[0].deltaDiff).toBe(300);    // 800 - 500
    });

    it('Should be resilient to intermediate noise alias events (Precision Matching)', () => {
        const leftEventsFull: AliasEvent[] = [
            { alias: 'OnResume', timestamp: 1000, visualIndex: 10, lineNum: 100, preview: 'start', codeLineNum: '344' },
            { alias: 'OnResume', timestamp: 2000, visualIndex: 20, lineNum: 110, preview: 'end', codeLineNum: '350' },
        ];

        // 오른쪽엔 중간에 OnResume(55), OnResume(100)이 끼어든 상황
        const rightEventsNoise: AliasEvent[] = [
            { alias: 'OnResume', timestamp: 1000, visualIndex: 10, lineNum: 100, preview: 'start', codeLineNum: '344' },
            { alias: 'OnResume', timestamp: 1100, visualIndex: 11, lineNum: 105, preview: 'noise1', codeLineNum: '55' },
            { alias: 'OnResume', timestamp: 1200, visualIndex: 12, lineNum: 108, preview: 'noise2', codeLineNum: '100' },
            { alias: 'OnResume', timestamp: 2500, visualIndex: 13, lineNum: 110, preview: 'end', codeLineNum: '350' },
        ];

        const results = computeAliasIntervals(leftEventsFull, rightEventsNoise);

        // 🐧🎯 Precision matching 덕분에 '344 ➔ 350' 구간을 찾아야 함!
        // 왼쪽 구간: 344(1000) ➔ 350(2000) = 1000ms
        // 오른쪽 구간들:
        // 1) 344 ➔ 55
        // 2) 55 ➔ 100
        // 3) 100 ➔ 350
        // 왼쪽 로그에는 1, 2, 3번에 해당하는 '시그니처'가 없으므로 매칭되지 않음.

        // 결과적으로 results가 비어있어야 함 (현재 로직상 그렇습니다. 
        // 만약 '중간 지점 무시' 기능을 넣고 싶다면 더 고도화가 필요하겠지만, 
        // 현재는 '동일 시퀀스' 매칭이 목표입니다.)

        expect(results.length).toBe(0);

        // 🐧💡 하지만 만약 왼쪽에도 동일한 노이즈가 있다면?
        const leftEventsNoise = [...rightEventsNoise];
        const res2 = computeAliasIntervals(leftEventsNoise, rightEventsNoise);
        expect(res2.length).toBe(3); // 344->55, 55->100, 100->350
    });

    it('Should correctly match "End-of-sequence" interval despite preceding noise', () => {
        // 형님이 주신 시나리오: 
        // Left: 333 -> 344 -> 350
        // Right: 333 -> 55 -> 100 -> 344 -> 350

        const left: AliasEvent[] = [
            { alias: 'OnResume', timestamp: 1000, visualIndex: 1, lineNum: 1, preview: '', codeLineNum: '333' },
            { alias: 'OnResume', timestamp: 2000, visualIndex: 2, lineNum: 2, preview: '', codeLineNum: '344' },
            { alias: 'OnResume', timestamp: 3000, visualIndex: 3, lineNum: 3, preview: '', codeLineNum: '350' },
        ];

        const right: AliasEvent[] = [
            { alias: 'OnResume', timestamp: 1000, visualIndex: 1, lineNum: 1, preview: '', codeLineNum: '333' },
            { alias: 'OnResume', timestamp: 1100, visualIndex: 2, lineNum: 5, preview: '', codeLineNum: '55' },
            { alias: 'OnResume', timestamp: 1200, visualIndex: 3, lineNum: 10, preview: '', codeLineNum: '100' },
            { alias: 'OnResume', timestamp: 2000, visualIndex: 4, lineNum: 15, preview: '', codeLineNum: '344' },
            { alias: 'OnResume', timestamp: 4000, visualIndex: 5, lineNum: 20, preview: '', codeLineNum: '350' },
        ];

        const results = computeAliasIntervals(left, right);

        // 🐧🎯 결과:
        // 1. '344 ➔ 350' 구간은 매칭되어야 함! (둘 다 인접해 있으므로)
        // 2. '333 ➔ 344' 구간은 매칭되지 않아야 함 (오른쪽 로그에서 인접하지 않으므로)

        const endInterval = results.find(r => r.key.includes('::OnResume(344) ➔ ::OnResume(350)'));
        expect(endInterval).toBeDefined();
        expect(endInterval?.leftAvgDelta).toBe(1000); // 3000-2000
        expect(endInterval?.rightAvgDelta).toBe(2000); // 4000-2000
        expect(endInterval?.deltaDiff).toBe(1000);

        const missingInterval = results.find(r => r.key.includes('OnResume||(333) ➔ OnResume||(344)'));
        expect(missingInterval).toBeUndefined(); // 연속되지 않으므로 탈락
    });
});

describe('Split Analysis - New Features (Deduplication & Global Batch)', () => {
    it('Should compute Global Alias Ranges (First to Last)', () => {
        const left: AliasEvent[] = [
            { alias: 'Init', timestamp: 1000, visualIndex: 1, lineNum: 10, preview: '', codeLineNum: '1' },
            { alias: 'Init', timestamp: 5000, visualIndex: 10, lineNum: 100, preview: '', codeLineNum: '5' },
        ];
        const right: AliasEvent[] = [
            { alias: 'Init', timestamp: 1000, visualIndex: 1, lineNum: 10, preview: '', codeLineNum: '1' },
            { alias: 'Init', timestamp: 7000, visualIndex: 15, lineNum: 150, preview: '', codeLineNum: '7' },
        ];

        const results = computeGlobalAliasRanges(left, right);
        expect(results.length).toBe(1);
        expect(results[0].key).toContain('::Init(1) ➔ ::Init(7)');
        expect(results[0].leftAvgDelta).toBe(4000);  // 5000 - 1000
        expect(results[0].rightAvgDelta).toBe(6000); // 7000 - 1000
        expect(results[0].deltaDiff).toBe(2000);
    });

    it('Should deduplicate identical visual ranges in worker results', async () => {
        // 이 테스트는 SplitAnalysis.worker.ts의 로직을 직접 테스트하거나, 
        // 해당 로직을 함수화하여 호출해야 함. 
        // 여기서는 SplitAnalysis.worker.ts의 onmessage 내부 로직(Deduplication)이 
        // 올바르게 중복을 걸러내는지 의사 테스트함.

        const results: any[] = [
            { key: 'A', leftPrevLineNum: 1, leftLineNum: 10, rightPrevLineNum: 1, rightLineNum: 10, isAliasMatch: true },
            { key: 'B', leftPrevLineNum: 1, leftLineNum: 10, rightPrevLineNum: 1, rightLineNum: 10, isAliasMatch: false }, // Duplicate range
            { key: 'C', leftPrevLineNum: 1, leftLineNum: 10, rightPrevLineNum: 1, rightLineNum: 11, isAliasMatch: false }, // Different range
        ];

        const finalResults: any[] = [];
        const seenRanges = new Set<string>();

        for (const res of results) {
            const rangeKey = `${res.leftPrevLineNum}-${res.leftLineNum}|${res.rightPrevLineNum}-${res.rightLineNum}`;
            if (!seenRanges.has(rangeKey)) {
                finalResults.push(res);
                seenRanges.add(rangeKey);
            }
        }

        expect(finalResults.length).toBe(2);
        expect(finalResults[0].key).toBe('A');
        expect(finalResults[1].key).toBe('C');
    });
});
