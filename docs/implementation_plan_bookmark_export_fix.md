# [구현 계획서] 북마크 Confluence 테이블 복사 시 누적 시간(Acc. Time) 포함 및 최적화

형님! PC 재부팅으로 끊겼던 작업을 이어서 진행하겠습니다. 현재 `utils/confluenceUtils.ts`에 관련 로직이 일부 들어가 있는 것으로 보이지만, UI(BookmarksModal)에서 계산된 값을 재사용하지 않고 다시 계산하는 비효율과 마크업 누락 가능성을 완전히 박살 내버리겠습니다.

## 유저 리뷰 필요 사항

> [!IMPORTANT]
> - 현재 `convertToConfluenceTable`은 데이터를 다시 계산하고 있습니다. 이를 UI에서 보이는 값과 100% 일치시키기 위해, UI에서 이미 계산된 `timeDiff`와 `accTime`을 직접 전달받도록 인터페이스를 개선할 예정입니다.
> - 이 변경으로 인해 혹시 해당 함수를 사용하는 다른 곳이 있다면 수정이 필요하지만, 현재는 북마크 모달에서만 사용되는 것으로 파악됩니다.

## 제안된 변경 사항

---

### [Log Extractor]

#### [MODIFY] [confluenceUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/confluenceUtils.ts)
- `convertToConfluenceTable` 함수의 인자 타입을 수정하여 `timeDiff`, `accTime` 필드를 선택적으로 받을 수 있게 합니다.
- 값이 전달되면 다시 계산하지 않고 해당 값을 우선 사용하도록 로직을 개선합니다.
- 테이블 헤더와 로직이 누락 없이 'Acc. Time'을 포함하고 있는지 최종 점검합니다.

#### [MODIFY] [BookmarksModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BookmarksModal.tsx)
- `handleExport` ('confluence' 포맷) 호출 시, `lines` 상태에 이미 들어있는 `timeDiffStr`와 `accumulatedTimeStr`을 `convertToConfluenceTable`에 전달하도록 수정합니다.
- 이로써 UI와 내보내기 결과 간의 데이터 일관성을 보장합니다.

---

## 작업 리스트
- [ ] `utils/confluenceUtils.ts` 인터페이스 및 로직 개선
- [ ] `components/BookmarksModal.tsx` 데이터 바인딩 수정
- [ ] `APP_MAP.md` 업데이트 및 최종 확인

## 검증 계획

### 수동 검증
1. 로그 북마크 후 모달 진입
2. 'Copy as Confluence Table' 클릭
3. 메모장 등에 붙여넣어 아래 형식이 나오는지 확인:
   `| Line | Time Diff | Acc. Time | Content |`
   `| 100 | - | 0.000s | [Log Content] |`
   `| 105 | +0.050s | 0.050s | [Log Content] |`

---

형님, 위 계획대로 진행할까요? 아래 **Proceed** 버튼(혹은 '진행해줘'라고 말씀해주시면)을 눌러주시면 바로 bash로 작업 시작하겠습니다! 🐧⚡

<button id="proceed_button">Proceed</button>
