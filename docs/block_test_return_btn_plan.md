# BlockTest 실행화면 복귀 버튼 배치 개선 계획서

형님! `BlockTest` 플러그인의 테스트 실행 화면(`PipelineRunner`, `ScenarioRunner`)에서 뒤로 가기(복귀) 버튼이 왼쪽 상단의 `AppHub` 버튼에 가려지는 버그를 깔끔하게 해결하기 위한 계획서입니다. 🐧⚡

## 1. 문제 분석
- **현상**: `PipelineRunner.tsx`와 `ScenarioRunner.tsx`는 실행 화면으로 넘어갈 때 전체 영역을 차지하게 됩니다. 이 두 컴포넌트의 헤더 영역 패딩이 `pl-4`로 설정되어 있어 뒤로 가기 화살표 버튼이 `top-left` 가장자리에 바짝 붙어 렌더링됩니다.
- **원인**: 전역 플로팅 내비게이션인 `AppHub.tsx`가 `absolute top-0 left-3 h-16 z-[110]`으로 화면 좌상단에 상시 떠 있어, `pl-4` 영역의 복귀 버튼을 완벽하게 덮어버립니다.
- **영향**: 사용자는 테스트 실행 후 원래 파이프라인 편집 화면으로 돌아가기 위해 뒤로 가기 버튼을 누를 수 없는 불편함이 발생합니다.

---

## 2. 해결 방안 (Aesthetics & UX 고려)
- **헤더 패딩(Left Padding) 조정**:
  - `BlockTest` 플러그인의 메인 화면 헤더는 이미 `pl-16` 패딩을 주어 `AppHub`를 우회하고 있습니다.
  - 이에 맞춰 `PipelineRunner.tsx` 및 `ScenarioRunner.tsx` 헤더의 왼쪽 패딩도 `pl-20` (80px)으로 넉넉하게 확장합니다.
  - 이렇게 하면 복귀 버튼(`Lucide.ArrowLeft`)이 `AppHub` 우측의 빈 공간에 안전하게 안착하며, 두 버튼 사이의 여유로운 간격을 통해 고유의 Premium UX를 해치지 않게 됩니다.

---

## 3. 세부 변경 사항

### [MODIFY] [PipelineRunner.tsx](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/components/PipelineRunner.tsx)
- 헤더 컨테이너의 패딩 스타일을 변경합니다.
  - **기존**: `className={`p-4 pr-36 flex justify-between items-center shadow-sm z-10 ...`}` (즉, `pl-4`)
  - **변경**: `className={`p-4 pl-20 pr-36 flex justify-between items-center shadow-sm z-10 ...`}`

### [MODIFY] [ScenarioRunner.tsx](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/components/ScenarioRunner.tsx)
- 시나리오 헤더 컨테이너의 패딩 스타일을 변경합니다.
  - **기존**: `className={`shrink-0 h-14 pl-4 pr-36 title-drag flex items-center justify-between ...`}`
  - **변경**: `className={`shrink-0 h-14 pl-20 pr-36 title-drag flex items-center justify-between ...`}`

---

## 4. 검증 계획
1. **정적 검증**:
   - `npx tsc --noEmit`을 통해 코드 수정 후 타입 오류가 없는지 완벽하게 확인합니다.
2. **동작 검증 (형님 확인 요망)**:
   - 개발 서버 구동 후 `BlockTest` 플러그인 실행.
   - `Run Pipeline` 혹은 `Run Scenario`를 눌러 실행 화면 진입.
   - 좌상단 `AppHub` 아이콘의 오른쪽에 안전하게 뒤로 가기 버튼(`<-`)이 노출되는지 확인.
   - 뒤로 가기 버튼을 클릭하여 파이프라인 구성 화면으로 완벽하게 복귀되는지 확인.

---

## 5. APP_MAP.md 반영 계획
- 변경 및 수정이 완벽히 완료되면 `important/APP_MAP.md`의 `[[BlockTest Plugin]]` 항목에 복귀 버튼 UI 개선 이력을 성실하게 업데이트하겠습니다!

---

**형님! 위 계획서대로 작업을 신나게 진행해도 되겠습니까?**
승인해 주시면 WSL Bash 환경에서 멋지게 고쳐보겠습니다! 🐧🚀
