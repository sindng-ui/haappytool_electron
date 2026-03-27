# 로그 익스트랙터 '새로운 탭에서 보기' 기능 구현 계획

형님! 선택한 로그를 바로 새 탭에서 볼 수 있게 만들어 드릴게요. 🐧⚡
기존의 아카이브 저장 로직을 활용해서 깔끔하게 구현하겠습니다.

## Proposed Changes

### [Log Extractor Core & UI]

#### [MODIFY] [useLogExtractorLogic.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.ts)
- `LogExtractorLogicProps` 인터페이스에 `onAddTab` 콜백 추가.
- `useLogExtractorLogic` 훅의 반환값에 `onAddTab` 포함.

#### [MODIFY] [LogExtractor.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogExtractor.tsx)
- `LogProvider`에 `handleArchiveToTab` 함수를 `onAddTab` 프롭으로 전달.

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- `useLogContext`에서 `onAddTab`을 가져옴.
- `handleOpenInNewTab` 비동기 함수 구현:
  - 현재 선택된 텍스트(브라우저 네이티브 선택 또는 라인 단위 선택)를 추출.
  - 선택 영역이 있으면 `onAddTab(title, content)` 호출.
- `handleContextMenu` 함수 내 `menuItems` 배열에 'Open in New Tab' 항목 추가.
  - 아이콘은 `Lucide.PlusSquare` 또는 `Lucide.ExternalLink` 사용 예정.

---

## Verification Plan

### Automated Tests
- 현재 UI 인터랙션에 대한 단위 테스트는 제한적이므로, 로직 위주의 검증을 수행합니다.
- `LogProcessor.worker.ts` 등에 영향이 없는 UI/Hook 레벨의 변경이므로 별도의 워커 테스트는 불필요할 것으로 판단됩니다.

### Manual Verification
1. 로그 파일 하나를 엽니다.
2. 특정 영역을 드래그하여 선택합니다.
3. 우클릭을 하여 'Open in New Tab' 메뉴가 나타나는지 확인합니다.
4. 해당 메뉴를 클릭했을 때:
   - 새로운 탭이 생성되는지 확인.
   - 새 탭의 제목이 선택된 영역 정보를 포함하는지 확인 (예: `Lines 10-20`).
   - 새 탭의 내용이 선택한 로그와 일치하는지 확인.
5. 탭을 닫았을 때 정상적으로 제거되는지 확인.

형님, 이 계획대로 진행해도 될까요? 승인해 주시면 바로 코딩 시작하겠습니다! 🐧🚀
