# 북마크 로그 필터링 무시 및 상시 표시 구현 계획 🐧

형님! 북마크한 로그들이 소중한 정보인 만큼, 필터링을 해도 항상 눈에 보이도록 꼼꼼하게 작업하겠습니다.

## 1. 개요
필터링 조건(Include/Exclude/Quick Filter)과 상관없이, 북마크된 로그 라인은 항상 `Log Viewer`에 표시되도록 머지(Merge) 로직을 추가합니다.

## 2. 주요 변경 사항

### [[Worker Logic]]
- **대상 파일**: [LogProcessor.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/LogProcessor.worker.ts)
- **변경 내용**:
  - `applyFilter` 함수 수정:
    - 필터링된 결과(`finalMatches`)에 현재 북마크된 인덱스들을 병합.
    - 병합 시 **정렬 상태 유지** 및 **중복 제거** (성능 최적화를 위해 O(N) Merge 사용).
  - `TOGGLE_BOOKMARK` 핸들러 수정:
    - 북마크 해제 시, 해당 라인이 현재 필터 조건에 맞지 않는다면 `filteredIndices`에서 즉시 제거하여 실시간성 확보.

- **대상 파일**: [workerBookmarkHandlers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/workerBookmarkHandlers.ts)
- **변경 내용**:
  - `getOriginalBookmarksSorted()` 메서드 추가: 정렬된 북마크 인덱스 배열 반환.
  - `toggleBookmark` 반환값 수정: 삭제된 인덱스 정보를 반환하여 워커에서 후속 처리(가시성 업데이트) 가능하게 함.

### [[Utility]]
- **대상 파일**: [logFiltering.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/logFiltering.ts)
- **변경 내용**: (필요 시) 매칭 로직 재사용성 확인.

## 3. 검증 계획
1. 특정 로그 라인 북마크.
2. 해당 라인이 포함되지 않는 필터 입력: 북마크된 라인이 여전히 리스트에 남아있는지 확인.
3. 북마크 해제: 필터 조건에 맞지 않는 라인이라면 즉시 사라지는지 확인.
4. 대용량 파일(100만 라인+)에서 필터링 성능 저하 여부 체크 (정렬 병합 방식이므로 영향 미미 예상).

---

형님, 북마크가 필터의 파도를 뚫고 항상 살아남게 만들겠습니다! 진행할까요? 🚀
<button>proceed</button>
