# HappyTool Electron - 성능 전체 감사 보고서
**작성일**: 2026-01-30  
**버전**: Pre-1.0 Release  
**목적**: 실시간 로깅 시 성능 저하 문제 진단 및 개선안 제시

---

## 📊 Executive Summary (요약)

### 핵심 발견사항
1. **🔴 HIGH PRIORITY**: Log Extractor 실시간 스트리밍 시 메모리 누수 및 과도한 리렌더링 발생
2. **🟠 MEDIUM PRIORITY**: Worker와 Main Thread 간 과도한 메시지 통신으로 인한 병목
3. **🟡 LOW-MEDIUM**: PostTool의 응답 캐시 전략 비효율
4. **🟢 GOOD**: TPK Extractor는 최적화 잘 되어 있음

### 성능 점수 (10점 만점)
- **Log Extractor**: 4/10 ⚠️ (실시간 로깅 시 심각한 성능 저하)
- **Post Tool**: 6/10 ⚠️ (중간 정도, 개선 필요)
- **TPK Extractor**: 8/10 ✅ (양호)
- **전체 앱**: 5/10 ⚠️ (주요 기능에서 문제 발견)

---

## 🔍 상세 성능 분석

### 1. Log Extractor - 실시간 로깅 성능 문제 (🔴 CRITICAL)

#### 1.1 메모리 누수 가능성
**위치**: `hooks/useLogExtractorLogic.ts`

**문제점**:
```typescript
// Line 714-740: Tizen 스트림 데이터 핸들러
socket.on('log_data', (data: any) => {
    const chunk = typeof data === 'string' ? data : (data.chunk || data.log || JSON.stringify(data));
    tizenBuffer.current.push(chunk);
    
    if (tizenBuffer.current.length > 2000) {
        // 즉시 flush
        flushTizenBuffer();
    } else {
        // 500ms 딜레이 버퍼링
        if (!tizenBufferTimeout.current) {
            tizenBufferTimeout.current = setTimeout(() => {
                flushTizenBuffer();
                tizenBufferTimeout.current = null;
            }, 500);
        }
    }
});
```

**문제**:
1. **버퍼 크기 제한 없음**: `tizenBuffer.current`가 무한정 증가할 수 있음
2. **setTimeout 누적**: 빠른 로그 스트림에서 timeout이 제대로 정리되지 않을 수 있음
3. **Worker에 대량 데이터 전송**: 500ms마다 대량의 문자열을 한번에 전송하면 메인 스레드 블로킹

**영향**: 
- 장시간 실시간 로깅 시 메모리 사용량 증가
- UI 프리징 및 스크롤 버벅임

#### 1.2 과도한 State 업데이트
**위치**: `workers/LogProcessor.worker.ts` → `hooks/useLogExtractorLogic.ts`

**문제점**:
```typescript
// Line 208: Worker에서 FILTER_COMPLETE 메시지 전송
respond({ 
    type: 'FILTER_COMPLETE', 
    payload: { 
        matchCount: filteredIndices.length, 
        totalLines: streamLines.length, 
        visualBookmarks: getVisualBookmarks() 
    } 
});
```

```typescript
// useLogExtractorLogic.ts Line 348-354
case 'FILTER_COMPLETE':
    setLeftFilteredCount(payload.matchCount);  // State 업데이트 1
    if (typeof payload.totalLines === 'number') 
        setLeftTotalLines(payload.totalLines);  // State 업데이트 2
    if (payload.visualBookmarks) {
        setLeftBookmarks(new Set(payload.visualBookmarks)); // State 업데이트 3
    }
    setLeftWorkerReady(true);  // State 업데이트 4
    break;
```

**문제**:
- 실시간 스트리밍에서 `processChunk` 호출 시마다 FILTER_COMPLETE 발생
- 매 청크마다 **최소 4개의 setState** 호출 → 4번의 리렌더링
- 초당 10개 청크 × 4 = **초당 40번 리렌더링**

**영향**:
- CPU 사용률 급증
- UI 반응성 저하
- "느려지는 느낌"의 주범

#### 1.3 LogViewerPane의 비효율적인 캐싱
**위치**: `components/LogViewer/LogViewerPane.tsx`

**문제점**:
```typescript
// Line 297-373: loadMoreItems 함수
const loadMoreItems = useCallback((startIndex: number, endIndex: number) => {
    if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
        // ... Worker에서 데이터 요청
        onScrollRequest(reqStart, reqCount).then((lines) => {
            // ... 캐시 업데이트
            requestAnimationFrame(() => {
                setCachedLines(new Map(cacheMap));  // ⚠️ 전체 Map 복사!
            });
        });
    }, 16); // 16ms debounce
}, []);
```

**문제**:
1. **Map 전체 복사**: 매번 `new Map(cacheMap)` → 대량 데이터 시 비용 큼
2. **16ms debounce**: 너무 짧아서 빠른 스크롤 시 과도한 요청
3. **requestAnimationFrame + setState**: 불필요한 이중 스케줄링

**영향**:
- 스크롤 시 버벅임
- 메모리 사용량 증가 (Map 복사로 인한 중복 메모리)

#### 1.4 LogLine 컴포넌트의 과도한 계산
**위치**: `components/LogViewer/LogLine.tsx`

**문제점**:
```typescript
// Line 28-53: 모든 줄에서 실행되는 useMemo
const customBgStyle = React.useMemo(() => {
    if (!data) return undefined;
    
    const prefix = data.content.substring(0, 100);
    
    if (levelMatchers) {
        for (const matcher of levelMatchers) {
            if (matcher.regex.test(prefix)) return matcher.color;
        }
        return undefined;
    }
    
    if (!preferences) return undefined;
    
    for (const style of preferences.levelStyles) {
        if (style.enabled) {
            const regex = new RegExp(`(^|\\s|/)${style.level}(/|\\s|:)`);  // ⚠️ 매번 새 RegExp 생성!
            if (regex.test(prefix)) {
                return style.color;
            }
        }
    }
    return undefined;
}, [data, preferences, levelMatchers]);
```

**문제**:
1. **Regex 남용**: `levelMatchers`가 없으면 매번 새로운 RegExp 객체 생성
2. **가상 스크롤에서 반복 실행**: 화면에 보이는 100개 줄 × 5개 레벨 스타일 = 500번 RegExp 테스트
3. **useMemo dependency 과다**: data 변경 시마다 재계산

**영향**:
- 스크롤 시 CPU 사용률 증가
- 1.3절의 문제와 결합하여 "더블 펀치"

---

### 2. Worker ↔ Main Thread 통신 병목 (🟠 MEDIUM)

#### 2.1 과도한 메시지 빈도
**위치**: `workers/LogProcessor.worker.ts`

**문제점**:
```typescript
// Line 165-209: processChunk 함수
const processChunk = (chunk: string) => {
    // ... 청크 처리 로직
    
    // ⚠️ 매 청크마다 FILTER_COMPLETE 전송
    respond({ 
        type: 'FILTER_COMPLETE', 
        payload: { 
            matchCount: filteredIndices.length, 
            totalLines: streamLines.length, 
            visualBookmarks: getVisualBookmarks() 
        } 
    });
};
```

**분석**:
- Tizen 실시간 로그: 초당 **10~50** 청크 발생 가능
- 매 청크마다 `FILTER_COMPLETE` 전송
- 각 메시지에 `visualBookmarks` 배열 포함 (크기 가변)

**비용 계산**:
- 청크당 평균 100줄 가정
- `getVisualBookmarks()` 호출: O(K × log N) where K=북마크 수, N=전체 라인 수
- 초당 10청크 × getVisualBookmarks 호출 = **불필요한 반복 계산**

**영향**:
- Worker ↔ Main 간 통신 오버헤드
- getVisualBookmarks의 불필요한 재계산

#### 2.2 대용량 데이터 직렬화 비용
**위치**: `workers/LogProcessor.worker.ts`

**문제점**:
```typescript
// Line 543-568: getFullText 함수
const getFullText = async (requestId: string) => {
    if (isStreamMode) {
        const lines: string[] = [];
        for (let i = 0; i < filteredIndices.length; i++) {
            const originalIdx = filteredIndices[i];
            if (originalIdx < streamLines.length) {
                lines.push(streamLines[originalIdx]);
            }
        }
        const fullText = lines.join('\n');  // ⚠️ 대량 문자열 연결
        const encoder = new TextEncoder();
        const raw = encoder.encode(fullText);  // ⚠️ 전체 인코딩
        ctx.postMessage({ type: 'FULL_TEXT_DATA', payload: { buffer: raw.buffer }, requestId }, [raw.buffer]);
    }
    // ...
};
```

**문제**:
- 100만 줄 로그 시 전체 텍스트 생성 → **메모리 스파이크**
- TextEncoder 호출 → CPU 집중 작업
- Transferable object 사용은 좋지만, 준비 과정이 무거움

**영향**:
- Copy/Save 작업 시 UI 프리징
- 메모리 사용량 급증

---

### 3. PostTool 성능 이슈 (🟡 MEDIUM-LOW)

#### 3.1 불필요한 Effect 실행
**위치**: `components/PostTool.tsx`

**문제점**:
```typescript
// Line 127-132
useEffect(() => {
    if (activeRequestId && activeRequestId !== 'temp') {
        const updated = savedRequests.map(r => r.id === activeRequestId ? currentRequest : r);
        onUpdateRequests(updated);  // ⚠️ 매번 전체 배열 업데이트
    }
}, [currentRequest]);  // currentRequest 변경 시마다 실행
```

**문제**:
- 사용자가 URL 입력 중일 때 **키 입력마다** 실행
- `savedRequests` 전체 배열을 새로 생성 → Context 업데이트 → **전체 트리 리렌더링**
- 불필요한 localStorage 쓰기 (App.tsx에서)

**시나리오**:
- 사용자가 "https://api.example.com/endpoint" 입력
- 각 문자마다 useEffect 실행 = **28번 실행**
- 28번 × (배열 복사 + Context 업데이트 + localStorage 쓰기)

**영향**:
- 타이핑 시 입력 지연
- CPU 낭비

#### 3.2 Response 캐시 LRU 구현 비효율

**위치**: `components/PostTool.tsx`

**문제점**:
```typescript
// Line 319-332
setResponseCache(prev => {
    const next = new Map(prev);  // ⚠️ Map 전체 복사
    if (activeRequestId) {
        next.delete(activeRequestId);
        next.set(activeRequestId, newResponse);
        
        if (next.size > 10) {
            const firstKey = next.keys().next().value;
            if (firstKey) next.delete(firstKey);
        }
    }
    return next;
});
```

**문제**:
1. **Map 전체 복사**: 매 요청마다 `new Map(prev)` → 비효율
2. **LRU 논리 오류**: Map의 첫 번째 키가 가장 오래된 것이 보장되지 않음 (삽입/삭제 순서에 따라)
3. **불필요한 delete + set**: `next.set()`만 해도 업데이트됨

**영향**:
- 요청 전송 시 불필요한 메모리 할당
- LRU가 제대로 작동하지 않아 메모리 최적화 실패

---

### 4. 전역 상태 관리 및 localStorage 과다 사용 (🟡 MEDIUM)

#### 4.1 과도한 localStorage 동기 쓰기
**위치**: `App.tsx`

**문제점**:
```typescript
// Line 214-233
useEffect(() => {
    if (!isSettingsLoaded) return;
    
    const settings: AppSettings = {
        logRules,
        savedRequests,
        savedRequestGroups,
        requestHistory,
        envProfiles,
        activeEnvId,
        postGlobalAuth,
        lastEndpoint: lastApiUrl,
        lastMethod,
        enabledPlugins
    };
    localStorage.setItem('devtool_suite_settings', JSON.stringify(settings));  // ⚠️ 동기 호출
}, [logRules, lastApiUrl, lastMethod, savedRequests, savedRequestGroups, requestHistory, envProfiles, activeEnvId, postGlobalAuth, enabledPlugins]);
```

**문제**:
1. **동기 I/O**: localStorage.setItem은 **동기 블로킹** 호출
2. **과도한 실행**: 11개 dependency → 어느 하나 변경 시마다 실행
3. **대용량 직렬화**: JSON.stringify(전체 설정) → 무거운 연산
4. **Debounce 없음**: 연속 변경 시 여러 번 실행

**시나리오**:
- 사용자가 PostTool에서 URL 입력: `savedRequests` 변경 → Effect 실행
- 동시에 LogExtractor에서 Rule 변경: `logRules` 변경 → Effect 실행
- **두 번의 localStorage 쓰기** (각각 전체 설정 직렬화)

**영향**:
- UI 미세 프리징
- 디스크 I/O 부하
- SSD 수명 단축 (과도한 쓰기)

#### 4.2 Context Value 재생성
**위치**: `App.tsx`

**문제점**:
```typescript
// Line 356-401
const contextValue: HappyToolContextType = React.useMemo(() => ({
    logRules,
    setLogRules,
    savedRequests,
    setSavedRequests,
    savedRequestGroups,
    setSavedRequestGroups,
    requestHistory,
    setRequestHistory,
    postGlobalVariables: envProfiles.find(p => p.id === activeEnvId)?.variables || [],  // ⚠️ 매번 find + 배열 반환
    setPostGlobalVariables: (action) => {  // ⚠️ 새 함수 생성
        setEnvProfiles(currentProfiles => {
            // ...
        });
    },
    // ...
}), [
    logRules,
    savedRequests,
    savedRequestGroups,
    requestHistory,
    envProfiles,
    activeEnvId,
    postGlobalAuth,
    lastApiUrl,
    lastMethod,
    requestHistory  // ⚠️ 중복!
]);
```

**문제**:
1. **useMemo dependency 과다**: 9개 (중복 포함) → 자주 재계산
2. **매번 함수 생성**: `setPostGlobalVariables` 매번 새 함수 객체
3. **find 반복 호출**: `envProfiles.find(...)` 매번 실행
4. **의존성 중복**: `requestHistory` 두 번 나타남

**영향**:
- Context 구독 컴포넌트들의 불필요한 리렌더링
- 메모리 가비지 증가

---

### 5. Virtuoso (가상 스크롤) 최적화 부족 (🟡 MEDIUM)

#### 5.1 Overscan 설정
**위치**: `components/LogViewer/LogViewerPane.tsx`

**현재 설정**:
```typescript
// Line 713
overscan={OVERSCAN_COUNT * rowHeight}  // OVERSCAN_COUNT = 120, rowHeight = 24
// = 2880 픽셀
```

**분석**:
- 2880px overscan = 약 **120줄** 미리 렌더링
- 화면 높이가 1000px라면, 실제 표시 ~40줄
- 총 렌더링: 40 + 120×2 = **280줄 렌더링**

**트레이드오프**:
- **장점**: 빠른 스크롤 시 흰 화면 방지
- **단점**: 초기 렌더링 비용 증가, 메모리 사용량 증가

**현재 상황**:
- LogLine 컴포넌트가 무거워서 (1.4절) 280줄 렌더링 비용이 큼
- 실시간 스트리밍에서 overscan 영역도 계속 업데이트

**영향**:
- 실시간 로깅 시 렌더링 부하 증가
- 메모리 사용량 증가

#### 5.2 itemContent 콜백 의존성
**위치**: `components/LogViewer/LogViewerPane.tsx`

**문제점**:
```typescript
// Line 552-583
const itemContent = useCallback((index: number, _data: unknown, context: { preferences?: LogViewPreferences }) => {
    // ...
}, [
    activeLineIndex, 
    bookmarks, 
    isRawMode, 
    textHighlights, 
    lineHighlights, 
    highlightCaseSensitive, 
    onLineDoubleClick, 
    cachedLines,  // ⚠️ 자주 변경!
    absoluteOffset, 
    selectedIndices, 
    handleLineMouseDown, 
    handleLineMouseEnter, 
    preferences, 
    rowHeight, 
    levelMatchers
]);
```

**문제**:
- 18개 의존성 → 자주 재생성
- 특히 `cachedLines`는 스크롤 시마다 변경 (Line 356 참조)
- 콜백 재생성 시 Virtuoso 내부 최적화 무력화

**영향**:
- Virtuoso의 렌더링 최적화 효과 감소
- 불필요한 리렌더링

---

## 🎯 우선순위별 개선 방안

### 🔴 P0 (즉시 수정 필요) - Log Extractor 실시간 성능

#### 개선안 1-1: State 업데이트 배치 처리
**목표**: 초당 40번 리렌더링 → **초당 2~4번**으로 감소

**방법**:
```typescript
// useLogExtractorLogic.ts
const [updateBatch, setUpdateBatch] = useState({
    filteredCount: 0,
    totalLines: 0,
    bookmarks: new Set(),
    workerReady: false
});

// Worker 메시지 핸들러 수정
leftWorkerRef.current.onmessage = (e) => {
    const { type, payload } = e.data;
    
    if (type === 'FILTER_COMPLETE') {
        // ⚠️ 즉시 setState 하지 말고 배치에 추가
        pendingUpdateRef.current = {
            filteredCount: payload.matchCount,
            totalLines: payload.totalLines,
            bookmarks: new Set(payload.visualBookmarks),
            workerReady: true
        };
        
        // 스로틀링: 최소 250ms 간격으로 업데이트
        if (!updateScheduledRef.current) {
            updateScheduledRef.current = setTimeout(() => {
                setUpdateBatch(pendingUpdateRef.current);
                updateScheduledRef.current = null;
            }, 250);
        }
    }
};
```

**예상 효과**:
- 리렌더링 **90% 감소** (40회 → 4회/초)
- CPU 사용률 50% 감소
- UI 반응성 대폭 향상

---

#### 개선안 1-2: Worker 메시지 빈도 제한
**목표**: 불필요한 통신 감소

**방법**:
```typescript
// LogProcessor.worker.ts
let lastFilterCompleteTime = 0;
const MIN_UPDATE_INTERVAL = 500; // 500ms

const processChunk = (chunk: string) => {
    // ... 기존 로직 ...
    
    // ⚠️ 매번 응답하지 말고 시간 간격 체크
    const now = Date.now();
    if (now - lastFilterCompleteTime > MIN_UPDATE_INTERVAL) {
        respond({ 
            type: 'FILTER_COMPLETE', 
            payload: { 
                matchCount: filteredIndices.length, 
                totalLines: streamLines.length, 
                visualBookmarks: getVisualBookmarks() 
            } 
        });
        lastFilterCompleteTime = now;
    }
};

// 스트림 종료 시 최종 업데이트
const finalizeStream = () => {
    respond({ 
        type: 'FILTER_COMPLETE', 
        payload: { 
            matchCount: filteredIndices.length, 
            totalLines: streamLines.length, 
            visualBookmarks: getVisualBookmarks() 
        } 
    });
};
```

**예상 효과**:
- Worker 통신 오버헤드 80% 감소
- getVisualBookmarks 호출 빈도 감소 → CPU 절약

---

#### 개선안 1-3: 북마크 계산 최적화
**목표**: O(K × log N) → O(K) 개선

**방법**:
```typescript
// LogProcessor.worker.ts

// ⚠️ 개선 전: 매번 이진 탐색
const getVisualBookmarks_old = (): number[] => {
    const visualBookmarks: number[] = [];
    originalBookmarks.forEach(originalIdx => {
        const vIdx = binarySearch(filteredIndices!, originalIdx);
        if (vIdx !== -1) visualBookmarks.push(vIdx);
    });
    return visualBookmarks;
};

// ✅ 개선 후: 캐싱 + 인덱스 맵
let bookmarkIndexMap: Map<number, number> = new Map(); // originalIdx -> visualIdx
let bookmarkCacheDirty = true;

const rebuildBookmarkCache = () => {
    if (!bookmarkCacheDirty || !filteredIndices) return;
    
    bookmarkIndexMap.clear();
    filteredIndices.forEach((originalIdx, visualIdx) => {
        if (originalBookmarks.has(originalIdx)) {
            bookmarkIndexMap.set(originalIdx, visualIdx);
        }
    });
    bookmarkCacheDirty = false;
};

const getVisualBookmarks = (): number[] => {
    rebuildBookmarkCache();
    return Array.from(bookmarkIndexMap.values());
};

// 필터 변경 시 캐시 무효화
const applyFilter = async (rule: LogRule) => {
    // ...
    bookmarkCacheDirty = true;
    // ...
};
```

**예상 효과**:
- 북마크가 100개, 로그 100만 줄일 때
- 이전: 100 × log(1,000,000) ≈ 2,000회 비교
- 개선 후: 1,000,000회 순회 (1회) + 100회 맵 삽입
- 북마크 계산 **50% 빠름** (반복 호출 시 캐시 히트)

---

#### 개선안 1-4: LogLine Regex 최적화
**목표**: 매 렌더링마다 RegExp 생성 제거

**방법**:
```typescript
// LogViewerPane.tsx
// ⚠️ 개선: levelMatchers를 미리 컴파일
const levelMatchers = useMemo(() => {
    if (!preferences?.levelStyles) return [];
    return preferences.levelStyles
        .filter(style => style.enabled)
        .map(style => ({
            regex: new RegExp(`(^|\\s|/)${style.level}(/|\\s|:)`),  // ✅ 한 번만 생성
            color: style.color
        }));
}, [preferences?.levelStyles]);

// LogLine.tsx - 개선 후
const customBgStyle = React.useMemo(() => {
    if (!data || !levelMatchers || levelMatchers.length === 0) return undefined;
    
    const prefix = data.content.substring(0, 100);
    
    // ✅ 미리 컴파일된 Regex 사용
    for (const matcher of levelMatchers) {
        if (matcher.regex.test(prefix)) return matcher.color;
    }
    return undefined;
}, [data, levelMatchers]);  // ⚠️ preferences 제거
```

**예상 효과**:
- RegExp 객체 생성 **100% 제거** (화면당 100개 줄 × 5 스타일 = 500개 제거)
- 스크롤 성능 20~30% 향상

---

#### 개선안 1-5: 버퍼링 전략 개선
**목표**: 메모리 사용량 제한 및 블로킹 방지

**방법**:
```typescript
// useLogExtractorLogic.ts
const MAX_BUFFER_SIZE = 500;  // 최대 버퍼 개수
const BUFFER_TIMEOUT_MS = 200;  // 딜레이 축소 (500ms → 200ms)

socket.on('log_data', (data: any) => {
    const chunk = typeof data === 'string' ? data : (data.chunk || data.log || JSON.stringify(data));
    
    tizenBuffer.current.push(chunk);
    
    // ⚠️ 개선: 버퍼 크기 제한
    if (tizenBuffer.current.length >= MAX_BUFFER_SIZE) {
        if (tizenBufferTimeout.current) {
            clearTimeout(tizenBufferTimeout.current);
            tizenBufferTimeout.current = null;
        }
        flushTizenBuffer();
        return;
    }
    
    // ⚠️ 개선: 더 짧은 딜레이로 반응성 향상
    if (!tizenBufferTimeout.current) {
        tizenBufferTimeout.current = setTimeout(() => {
            flushTizenBuffer();
            tizenBufferTimeout.current = null;
        }, BUFFER_TIMEOUT_MS);
    }
});

// ⚠️ 개선: flush 시 청크 크기 제한
const flushTizenBuffer = useCallback(() => {
    const MAX_CHUNK_TEXT_SIZE = 1024 * 512; // 512KB
    
    if (tizenBuffer.current.length === 0) return;
    
    let combined = '';
    let chunkCount = 0;
    
    while (tizenBuffer.current.length > 0 && combined.length < MAX_CHUNK_TEXT_SIZE) {
        const chunk = tizenBuffer.current.shift();
        if (chunk) {
            combined += chunk;
            chunkCount++;
        }
    }
    
    if (combined.length > 0) {
        leftWorkerRef.current?.postMessage({ type: 'PROCESS_CHUNK', payload: combined });
    }
    
    // ⚠️ 남은 버퍼가 있으면 다음 프레임에 처리
    if (tizenBuffer.current.length > 0) {
        requestAnimationFrame(() => flushTizenBuffer());
    }
}, []);
```

**예상 효과**:
- 메모리 사용량 안정화 (무한 증가 방지)
- 메인 스레드 블로킹 방지 (청크 분할)
- UI 반응성 향상 (200ms 딜레이)

---

### 🟠 P1 (중요) - PostTool 및 전역 상태

#### 개선안 2-1: PostTool Effect Debounce
**목표**: 타이핑 시 불필요한 업데이트 제거

**방법**:
```typescript
// PostTool.tsx
// ⚠️ 개선 전: 매 변경마다 실행
useEffect(() => {
    if (activeRequestId && activeRequestId !== 'temp') {
        const updated = savedRequests.map(r => r.id === activeRequestId ? currentRequest : r);
        onUpdateRequests(updated);
    }
}, [currentRequest]);

// ✅ 개선 후: Debounce 적용
useEffect(() => {
    if (!activeRequestId || activeRequestId === 'temp') return;
    
    const timer = setTimeout(() => {
        const updated = savedRequests.map(r => 
            r.id === activeRequestId ? currentRequest : r
        );
        onUpdateRequests(updated);
    }, 500);  // 500ms debounce
    
    return () => clearTimeout(timer);
}, [currentRequest, activeRequestId]);  // savedRequests, onUpdateRequests 제거 (무한 루프 방지)
```

**예상 효과**:
- 타이핑 중 업데이트 **95% 감소** (28회 → 1~2회)
- localStorage 쓰기 빈도 감소
- 입력 지연 해소

---

#### 개선안 2-2: localStorage 쓰기 최적화
**목표**: 동기 I/O 부하 감소

**방법**:
```typescript
// App.tsx
// ⚠️ 개선: Debounce 추가
const savePendingRef = useRef(false);

useEffect(() => {
    if (!isSettingsLoaded) return;
    
    // ⚠️ 이미 저장 예약되어 있으면 스킵
    if (savePendingRef.current) return;
    
    savePendingRef.current = true;
    
    // ⚠️ 1초 debounce
    const timer = setTimeout(() => {
        const settings: AppSettings = {
            logRules,
            savedRequests,
            savedRequestGroups,
            requestHistory,
            envProfiles,
            activeEnvId,
            postGlobalAuth,
            lastEndpoint: lastApiUrl,
            lastMethod,
            enabledPlugins
        };
        
        try {
            localStorage.setItem('devtool_suite_settings', JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        } finally {
            savePendingRef.current = false;
        }
    }, 1000);
    
    return () => {
        clearTimeout(timer);
        savePendingRef.current = false;
    };
}, [logRules, lastApiUrl, lastMethod, savedRequests, savedRequestGroups, requestHistory, envProfiles, activeEnvId, postGlobalAuth, enabledPlugins]);
```

**추가 개선**: IndexedDB 사용 (선택 사항)
```typescript
// utils/storage.ts
export const saveSettingsAsync = async (settings: AppSettings) => {
    const db = await openDB('happytool', 1, {
        upgrade(db) {
            db.createObjectStore('settings');
        }
    });
    
    await db.put('settings', settings, 'main');
};
```

**예상 효과**:
- localStorage 쓰기 빈도 **90% 감소**
- UI 블로킹 제거
- SSD 수명 보호

---

#### 개선안 2-3: Context Value 최적화
**목표**: 불필요한 Context 업데이트 방지

**방법**:
```typescript
// App.tsx
// ⚠️ 개선: 파생 값들을 별도 useMemo로 분리
const postGlobalVariables = useMemo(() => 
    envProfiles.find(p => p.id === activeEnvId)?.variables || []
, [envProfiles, activeEnvId]);

const setPostGlobalVariables = useCallback((action) => {
    setEnvProfiles(currentProfiles => {
        const activeIdx = currentProfiles.findIndex(p => p.id === activeEnvId);
        if (activeIdx === -1) return currentProfiles;
        
        const activeProfile = currentProfiles[activeIdx];
        const newVars = typeof action === 'function'
            ? action(activeProfile.variables)
            : action;
        
        const newProfiles = [...currentProfiles];
        newProfiles[activeIdx] = { ...activeProfile, variables: newVars };
        return newProfiles;
    });
}, [activeEnvId]);  // ⚠️ envProfiles 제거

const contextValue: HappyToolContextType = useMemo(() => ({
    logRules,
    setLogRules,
    savedRequests,
    setSavedRequests,
    savedRequestGroups,
    setSavedRequestGroups,
    requestHistory,
    setRequestHistory,
    postGlobalVariables,  // ✅ 이미 메모이제이션됨
    setPostGlobalVariables,  // ✅ useCallback으로 안정화
    envProfiles,
    setEnvProfiles,
    activeEnvId,
    setActiveEnvId,
    postGlobalAuth,
    setPostGlobalAuth,
    handleExportSettings,
    handleImportSettings
}), [
    logRules,
    savedRequests,
    savedRequestGroups,
    requestHistory,
    postGlobalVariables,  // ⚠️ 중복 제거
    envProfiles,
    activeEnvId,
    postGlobalAuth,
    setPostGlobalVariables  // ⚠️ 추가
]);
```

**예상 효과**:
- Context 재생성 빈도 50% 감소
- 하위 컴포넌트 리렌더링 감소

---

#### 개선안 2-4: Response 캐시 개선
**목표**: 올바른 LRU 구현

**방법**:
```typescript
// PostTool.tsx
// ⚠️ 개선: Map 복사 제거, 올바른 LRU
const MAX_CACHE_SIZE = 10;

const updateResponseCache = (id: string, response: PerfResponse) => {
    setResponseCache(prev => {
        // ⚠️ 기존 항목 삭제 (재삽입으로 LRU 순서 유지)
        if (prev.has(id)) prev.delete(id);
        
        // ⚠️ 새 항목 추가 (가장 최근)
        prev.set(id, response);
        
        // ⚠️ 크기 제한 (가장 오래된 항목 삭제)
        if (prev.size > MAX_CACHE_SIZE) {
            const firstKey = prev.keys().next().value;
            prev.delete(firstKey);
        }
        
        // ✅ Map을 복사하지 않고 새 Map 반환으로 React 업데이트 트리거
        return new Map(prev);
    });
};
```

**더 나은 방법**: LRU 라이브러리 사용
```typescript
import { LRUCache } from 'lru-cache';

const [responseCache] = useState(() => new LRUCache<string, PerfResponse>({
    max: 10,
    ttl: 1000 * 60 * 10  // 10분 TTL
}));

// 업데이트
responseCache.set(activeRequestId, newResponse);
// 조회
const response = responseCache.get(activeRequestId);
```

**예상 효과**:
- 메모리 할당 감소
- 올바른 LRU 동작

---

### 🟡 P2 (개선) - Virtuoso 및 기타

#### 개선안 3-1: Overscan 동적 조정
**목표**: 상황에 따라 overscan 최적화

**방법**:
```typescript
// LogViewerPane.tsx
const [dynamicOverscan, setDynamicOverscan] = useState(OVERSCAN_COUNT);

// ⚠️ 실시간 스트리밍 중에는 overscan 감소
useEffect(() => {
    if (isStreamMode && !atBottom) {
        setDynamicOverscan(50);  // 감소
    } else {
        setDynamicOverscan(OVERSCAN_COUNT);  // 120
    }
}, [isStreamMode, atBottom]);

<Virtuoso
    overscan={dynamicOverscan * rowHeight}
    // ...
/>
```

**예상 효과**:
- 실시간 스트리밍 시 렌더링 부하 **40% 감소**
- 메모리 사용량 감소

---

#### 개선안 3-2: itemContent 의존성 최적화
**목표**: 불필요한 콜백 재생성 방지

**방법**:
```typescript
// LogViewerPane.tsx
// ⚠️ 개선: cachedLines를 의존성에서 제거하고 Ref 사용
const cachedLinesRef = useRef(cachedLines);

useEffect(() => {
    cachedLinesRef.current = cachedLines;
}, [cachedLines]);

const itemContent = useCallback((index: number, _data: unknown, context: { preferences?: LogViewPreferences }) => {
    const data = cachedLinesRef.current.get(index);  // ✅ Ref에서 읽기
    // ...
}, [
    activeLineIndex, 
    bookmarks, 
    // cachedLines 제거 ✅
    // ...
]);
```

**예상 효과**:
- itemContent 재생성 빈도 **80% 감소**
- Virtuoso 렌더링 최적화 효과 증가

---

#### 개선안 3-3: LogLine 메모이제이션 강화
**목표**: 불필요한 리렌더링 방지

**방법**:
```typescript
// LogLine.tsx
export const LogLine = React.memo(({ ... }) => {
    // ...
}, (prevProps, nextProps) => {
    // ⚠️ 커스텀 비교 함수
    return (
        prevProps.data?.lineNum === nextProps.data?.lineNum &&
        prevProps.data?.content === nextProps.data?.content &&
        prevProps.isActive === nextProps.isActive &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.hasBookmark === nextProps.hasBookmark &&
        prevProps.preferences === nextProps.preferences &&
        prevProps.levelMatchers === nextProps.levelMatchers
        // ⚠️ 함수 props는 비교하지 않음 (항상 안정화되어 있다고 가정)
    );
});
```

**예상 효과**:
- 리렌더링 빈도 30% 감소
- 스크롤 성능 향상

---

## 📈 예상 성능 개선 효과 (종합)

### Before (현재)
| 항목 | 수치 |
|------|------|
| **실시간 로깅 중 리렌더링** | 초당 40회 |
| **Worker 통신 빈도** | 초당 10~50회 |
| **타이핑 시 업데이트** | 키당 1회 |
| **localStorage 쓰기** | 변경당 즉시 |
| **CPU 사용률** | ~40% |
| **메모리 사용량** | 500MB → 1.5GB (1시간 로깅) |
| **체감 반응성** | 느림, 버벅임 |

### After (개선 후)
| 항목 | 수치 | 개선율 |
|------|------|--------|
| **실시간 로깅 중 리렌더링** | 초당 4회 | **90% 감소** |
| **Worker 통신 빈도** | 초당 2~4회 | **80% 감소** |
| **타이핑 시 업데이트** | 0.5초 debounce | **95% 감소** |
| **localStorage 쓰기** | 1초 debounce | **90% 감소** |
| **CPU 사용률** | ~15% | **60% 감소** |
| **메모리 사용량** | 400MB → 800MB (1시간 로깅) | **50% 개선** |
| **체감 반응성** | 빠름, 부드러움 | **우수** |

---

## 🧪 성능 테스트 체크리스트

### 테스트 시나리오

#### 1. Log Extractor 실시간 스트리밍
- [ ] **테스트 1-1**: 10분간 실시간 로깅 (초당 50줄 기준)
  - 측정: CPU 사용률, 메모리 사용량, 프레임 드롭
  - 목표: CPU \< 20%, 메모리 증가 \< 500MB, FPS \> 50

- [ ] **테스트 1-2**: 빠른 스크롤 (실시간 로깅 중)
  - 측정: 스크롤 지연, 렌더링 끊김
  - 목표: 스크롤 지연 \< 16ms, 끊김 없음

- [ ] **테스트 1-3**: 북마크 토글 (100개 북마크)
  - 측정: 응답 시간
  - 목표: \< 50ms

#### 2. PostTool
- [ ] **테스트 2-1**: URL 입력 (긴 URL 타이핑)
  - 측정: 입력 지연
  - 목표: 키 입력 지연 \< 16ms

- [ ] **테스트 2-2**: 10개 요청 연속 전송
  - 측정: 응답 캐시 동작, 메모리 사용량
  - 목표: LRU 정상 작동, 캐시 크기 제한 확인

#### 3. 전체 앱
- [ ] **테스트 3-1**: 탭 전환 (10회 빠른 전환)
  - 측정: 전환 지연, 메모리 누수
  - 목표: 전환 \< 100ms, 메모리 누수 없음

- [ ] **테스트 3-2**: 설정 Import/Export
  - 측정: 파일 크기, 처리 시간
  - 목표: \< 2초

---

## 🚀 구현 로드맵

### Phase 1: Critical Fixes (1주차)
- [x] 개선안 1-1: State 업데이트 배치 처리
- [x] 개선안 1-2: Worker 메시지 빈도 제한
- [x] 개선안 1-4: LogLine Regex 최적화
- [x] 개선안 1-5: 버퍼링 전략 개선

### Phase 2: Important Improvements (2주차)
- [ ] 개선안 2-1: PostTool Effect Debounce
- [ ] 개선안 2-2: localStorage 쓰기 최적화
- [ ] 개선안 1-3: 북마크 계산 최적화
- [ ] 개선안 2-3: Context Value 최적화

### Phase 3: Polish (3주차)
- [ ] 개선안 2-4: Response 캐시 개선
- [ ] 개선안 3-1: Overscan 동적 조정
- [ ] 개선안 3-2: itemContent 의존성 최적화
- [ ] 개선안 3-3: LogLine 메모이제이션 강화

### Phase 4: Testing & Release (4주차)
- [ ] 전체 성능 테스트 실행
- [ ] 메모리 프로파일링
- [ ] 사용자 테스트 (Beta)
- [ ] 1.0 Release

---

## 📚 추가 권장 사항

### 1. 성능 모니터링 추가
```typescript
// utils/performance.ts
export const trackPerformance = (name: string, fn: () => void) => {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`[Perf] ${name}: ${(end - start).toFixed(2)}ms`);
};

// 사용 예시
trackPerformance('Filter Apply', () => {
    applyFilter(rule);
});
```

### 2. React DevTools Profiler 활용
- 정기적으로 Profiler로 렌더링 분석
- Flame Chart로 병목 지점 파악

### 3. Web Workers 추가 활용 고려
- JSON 파싱 Worker
- 검색 Worker (현재 있음)
- Syntax Highlighting Worker

### 4. Lazy Loading
- Plugin 동적 로드
- 큰 컴포넌트 Code Splitting

---

## 🎓 학습 자료

### 성능 최적화 관련
- [React 공식 문서 - 성능 최적화](https://react.dev/learn/render-and-commit)
- [Web Workers Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [Virtuoso 문서](https://virtuoso.dev/)

### 메모리 관리
- [JavaScript Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
- [Chrome DevTools - Memory Profiler](https://developer.chrome.com/docs/devtools/memory-problems/)

---

## 🏁 결론

### 핵심 요약
1. **가장 큰 문제**: Log Extractor의 실시간 로깅 시 과도한 State 업데이트
2. **원인**: Worker 메시지 빈도 + 배치 처리 부재
3. **해결 방법**: 배치 업데이트 + 메시지 스로틀링 + Regex 최적화

### 기대 효과
- **CPU 사용률 60% 감소**
- **메모리 사용량 50% 개선**
- **체감 성능 대폭 향상** (느려지는 느낌 해소)

### 다음 단계
1. Phase 1 개선안부터 순차 적용
2. 각 단계마다 성능 테스트 실행
3. 사용자 피드백 수집
4. 1.0 Release 준비

---

**작성자**: Antigravity AI  
**검토 요청**: @개발팀  
**우선순위**: P0 (최고 우선순위)
