# Block Test 기본 뷰 전환 계획 (List ➔ Graph) 🐧📊⚡

Block Test 실행 시 시각적 직관성을 높이기 위해 기본 뷰 모드를 리스트(`list`)에서 그래프(`graph`)로 변경합니다.

## 제안된 변경 사항

### [Block Test] (file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/components/PipelineRunner.tsx)

#### [MODIFY] [PipelineRunner.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/components/PipelineRunner.tsx)

- `useState`를 통한 `viewMode` 초기화 시 `localStorage`에 저장된 값이 없을 경우의 기본값을 `'graph'`로 변경합니다.
- 기존 사용자의 경우 `localStorage`에 이미 `'list'`가 저장되어 있을 수 있으므로, 이번 업데이트와 함께 한 번 강제로 그래프 뷰로 전환되도록 할지 여부는 사용자의 선택에 맡기거나 기본 fallback만 수정합니다. (요청 사항이 "기본으로 동작하도록" 이므로 fallback 수정이 우선입니다.)

### [지도 업데이트] (file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)

- `APP_MAP.md`의 `BlockTest` 섹션에 기본 뷰 정책 변경 사항을 기록합니다.

---

## 검증 계획

### 수동 검증
1. **신규 환경 시뮬레이션**: 브라우저 개발자 도구에서 `localStorage.removeItem('blockTestViewMode')` 실행 후 시나리오나 파이프라인을 실행하여 그래프 뷰가 먼저 나오는지 확인합니다.
2. **뷰 전환 확인**: 그래프 뷰에서 리스트 뷰로 전환이 잘 되는지, 전환 후 다시 실행했을 때 설정이 유지되는지 확인합니다.
3. **영속성 확인**: `localStorage`에 저장된 값이 있을 때는 해당 설정이 우선되는지 확인합니다.
