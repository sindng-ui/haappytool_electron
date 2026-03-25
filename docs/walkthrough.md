# 로그 추출기 북마크 모달 표시 버그 수정 결과 보고 🐧✅

형님, 로그 필터링 상태에서 북마크 모달이 비어있던 문제를 해결했습니다!

## 작업 내용
- **`LogSession.tsx` 수정**: `requestLeftBookmarkedLines`와 `requestRightBookmarkedLines` 함수에서 워커에 라인 데이터를 요청할 때 사용하는 `isAbsolute` 플래그를 `true`에서 `false`로 수정했습니다.
  - UI에서 관리되는 북마크 인덱스는 필터링된 결과값 내에서의 위치(Visual Index)이므로, `isAbsolute=false`로 설정해야 워커가 `filteredIndices` 배열을 통해 올바른 원본 라인 번호를 찾을 수 있습니다.

## 검증 결과
- **로직 정합성 확인**:
  - `isAbsolute=false` 설정 시: 워커는 요청된 인덱스를 `filteredIndices[index]`로 해석하여 원본 로그의 위치를 정확히 찾아냅니다.
  - 필터링이 활성화된 상태에서도 북마크된 라인들이 `filteredIndices`에 항상 포함되도록 설계되어 있어(Merge logic), 시각적 인덱스를 통한 요청이 가장 안정적임을 확인했습니다.
- **Side Effect 검토**:
  - 다른 복사/내보내기 기능(`handleCopyLogs` 등)은 이미 `isAbsolute=false`(기본값)를 사용하고 있어 이번 수정으로 인한 악영향은 없습니다.
  - `APP_MAP.md`에서 잘못 기재되어 있던 조작법(더블 클릭 -> 스페이스)을 바로잡아 향후 유지보수 시 혼선을 방지했습니다.

## 관련 문서 업데이트
- [APP_MAP.md](../APP_MAP.md): 북마크 관련 설명 수정 및 버그 수정 내역 추가
- [implementation_plan.md](./implementation_plan.md): 수정 전 계획서

형님, 이제 필터링된 상태에서도 마음 놓고 북마크를 확인하실 수 있습니다! 고생하셨습니다! 🐧🚀
