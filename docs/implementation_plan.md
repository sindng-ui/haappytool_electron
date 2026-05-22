# 📋 글로벌 검색 Happy Combo 매칭 누락 버그 진압 계획서 🐧⚡

형님! 글로벌 검색 탭에서 `1234` 콤보를 활성화한 상태로 "Search All"을 실행했을 때, 원본 로그 파일에 해당 텍스트가 존재함에도 검색 결과가 비어 나오던 심각한 원인을 찾아내어 진압 계획을 작성했습니다!

---

## 🔍 버그 원인 분석 (Root Cause)

1. **Happy Combo 데이터 정제 단계의 누락**:
   - 일반 로그 탭에서 필터링(`FILTER_LOGS`)을 수행할 때는 메인 스레드에서 `assembleIncludeGroups(currentConfig)`를 실행하여, 콤보 그룹과 브랜치(태그) 정보가 조합된 `includeGroups` 배열을 채운 뒤 워커로 전달합니다.
   - 하지만 전역 검색(`SEARCH_GLOBAL_MISSION`)을 실행할 때는 `hooks/useGlobalSearch.ts`가 `global-mission` 원본 `LogRule` 객체를 정제하지 않고 **워커로 그대로 쏩니다.**
2. **워커 내부 파싱 구조의 한계**:
   - 워커(`workers/LogProcessor.worker.ts`)는 전달받은 룰에서 단지 `rule.includeGroups`만 분석합니다. 
   - 전역 검색 시에는 `includeGroups`가 비어있기 때문에, 워커는 매칭할 키워드가 `[]`로 비어있다고 간주하여 실시간 검색 루프를 돌지 않고 즉시 빈 결과를 뱉어내 버렸던 것입니다.

---

## 🛠️ 해결 방안 (Proposed Changes)

글로벌 검색 트리거 단계에서 `assembleIncludeGroups` 유틸리티를 임포트하여, `global-mission`에 있는 `happyGroups`(Happy Combo 콤보 데이터) 설정을 `includeGroups` 2차원 배열로 완벽하게 정제(Pre-normalize)한 후 각 워커에 정제된 룰을 꽂아 전달하도록 수정합니다.

### 1. [MODIFY] [useGlobalSearch.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useGlobalSearch.ts)
- `utils/filterGroupUtils` 로부터 `assembleIncludeGroups`를 임포트합니다.
- `searchAllOpenFiles` 함수에서 `globalRule`을 받자마자 정제된 `includeGroups`로 오버라이드한 `preparedRule` 객체를 생성하여, 각 워커에 포스트 메시지로 쏠 수 있도록 수정합니다.

---

## 📝 상세 코드 변경 계획 (Diff Preview)

### [hooks/useGlobalSearch.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useGlobalSearch.ts)

```typescript
// 1. 임포트 추가
import { assembleIncludeGroups } from '../utils/filterGroupUtils';

// 2. searchAllOpenFiles 내부 변경
    const searchAllOpenFiles = useCallback(async (globalRule: LogRule) => {
        if (isSearchingAll) return;
        setIsSearchingAll(true);
        setSearchResults([]);

        try {
            // 🐧🎯 형님! 글로벌 검색 시에도 Happy Combo(happyGroups)를 includeGroups로 채우는 전처리 단계를 수행합니다!
            const refinedIncludeGroups = assembleIncludeGroups(globalRule);
            const preparedRule: LogRule = {
                ...globalRule,
                includeGroups: refinedIncludeGroups
            };

            const allWorkersMap = workerRegistry.getAllWorkers();
            const promises: Promise<TabSearchResult | null>[] = [];

            for (const [tabId, workerPair] of allWorkersMap.entries()) {
                const tabInfo = tabs.find(t => t.id === tabId);
                const tabName = tabInfo ? tabInfo.title : `Tab ${tabId}`;

                // Left pane search
                if (workerPair.left && workerPair.left.ready && workerPair.left.path) {
                    promises.push(
                        performWorkerSearch(
                            tabId,
                            tabName,
                            'left',
                            workerPair.left.worker,
                            workerPair.left.path,
                            preparedRule // <-- 정제된 룰을 전달!
                        )
                    );
                }

                // Right pane search
                if (workerPair.right && workerPair.right.ready && workerPair.right.path) {
                    promises.push(
                        performWorkerSearch(
                            tabId,
                            tabName,
                            'right',
                            workerPair.right.worker,
                            workerPair.right.path,
                            preparedRule // <-- 정제된 룰을 전달!
                        )
                    );
                }
            }
```

---

## 🧪 검증 계획 (Verification Plan)

### 수동 검증 (Manual Verification)
1. 글로벌 미션의 Happy Combo에 임의의 콤보 그룹(예: `1234`)을 생성하고 체크합니다. (하위 브랜치가 비어있는 상태)
2. 열린 로그 파일 `2_right.txt`와 `1_left.txt`에 해당 텍스트(`1234`)가 존재하는지 확인합니다.
3. 글로벌 검색 결과 탭에서 "Search All"을 누르고, 두 파일에서 `1234`가 포함된 라인이 Notepad++ 트리 형태로 완벽히 검출되어 나타나는지 확인합니다.

### 자동 검증 (Automated tsc check)
- WSL Bash에서 `wsl npx tsc --noEmit`을 수행하여 타입 정밀 컴파일 통과 여부를 검증합니다.

---

## 🚦 형님의 승인 대기 (Proceed Request)

형님! 본 설계에 부합하다면 **Proceed** 버튼을 클릭하시거나 채팅으로 **"고고"** 또는 **"진행해라"**라고 명령을 내려주십시오! 승인하시는 대로 신속하고 완벽하게 코드를 수정하여 버그를 영구 소탕해 올리겠습니다! 🐧🚀🔥
