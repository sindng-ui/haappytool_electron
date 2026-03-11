#- [/] **Analyze Diff Summary 리팩토링**: 3컬럼 레이아웃 개편 🐧📊⚡
    - [x] `SplitAnalyzerPanel.tsx` 리팩토링 계획 수립
    - [x] `summaryData` 필터링 로직 수정 (±20ms 기준)
    - [ ] UI 3컬럼 레이아웃 적용 (Flow | Status | Metrics)
    - [ ] `APP_MAP.md` 업데이트
왼쪽은 선택한 카드에 따라 리스트가 변하고, 오른쪽은 New Logs가 고정되어 나타나는 전문가용 인터페이스를 지향합니다.

## Proposed Changes

### Split Performance Analyzer

Summary 탭의 리스트 아이템을 3컬럼 구조로 개편합니다. 🐧📊

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)

- **Summary List Item Refactoring**:
    - **Column 1 (Flow)**: `Prev Node` → `Current Node` 정보를 세로로 배치 (파일/함수명, 라인번호).
    - **Column 2 (Status)**: 중앙에 성능 변화 배지(Icon + Delta) 및 하단에 상태 텍스트(REGRESSION 등) 배치.
    - **Column 3 (Metrics)**: 우측 끝에 `LEFT AVG`, `RIGHT AVG` 등 절대 수치 상세 정보 배치.
    - **Visual Alignment**: Timeline 탭의 리스트 아이템과 시각적 정합성을 유지합니다. 🐧⚖️

## Verification Plan

### Automated Tests
- 없음 (UI 변경 중심)

### Manual Verification
- [ ] Summary 탭의 리스트 아이템이 3컬럼으로 예쁘게 나오는지 확인 🐧👀
- [ ] 각 컬럼의 정보가 겹치지 않고 정렬이 잘 맞는지 확인
- [ ] Timeline 탭의 디자인과 이질감이 없는지 최종 확인
- **데이터 처리 로직 고도화**:
    - **분류 기준 업데이트 (±20ms)**:
        - `regressions`: `deltaDiff > 20`
        - `improvements`: `deltaDiff < -20`
        - `stable`: `Math.abs(deltaDiff) <= 20`
    - **New Errors 제거**: 관련 데이터 집계 및 UI 요소 완전 삭제.
    - **상태 추가**: `summaryFilter` (`'regression' | 'improvement' | 'stable'`, 기본값: `'regression'`).

- **2컬럼 레이아웃 (Dual-Pane) 구현**:
    - **상단 카드**: [Total Mapped Nodes] [Regressions] [Improvements] [STABLE] [New Logs]
    - **왼쪽 영역 (Dynamic)**: 선택된 카드(`Regression`, `Improvement`, `Stable`)에 해당하는 세그먼트 리스트 노출. 클릭 시 리스트 내용이 즉시 교체됨.
    - **오른쪽 영역 (Static)**: 'New Logs' 리스트를 고정하여 항상 노출함 (상단 New Logs 카드는 정보 표시용이며 클릭 시 변화 없음).

---

## 검증 계획

### 수동 검증
1. **필터 교체 확인**: Regressions, Improvements, Stable 카드를 각각 눌렀을 때 왼쪽 리스트가 해당 항목들로 즉시 바뀌는지 확인합니다.
2. **고정 리스트 확인**: 왼쪽 리스트가 바뀔 때 오른쪽의 New Logs 리스트는 흔들림 없이 고정되어 있는지 확인합니다.
3. **20ms 문턱 확인**: 탭별로 성능 변화값이 조건(>20, <-20, <=20)에 맞게 정확히 들어갔는지 수치를 확인합니다.
4. **New Logs 카드 확인**: New Logs 카드는 정보를 보여주되, 클릭해도 다른 리스트를 방해하지 않는지 확인합니다.
