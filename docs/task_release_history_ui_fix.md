# Task: Release History Plugin UI Fix (Modal Clipping & Scrolling)

Release History 플러그인의 상세 정보 모달(`ReleaseDetailModal`)에서 발생하는 UI 레이아웃 이슈를 해결합니다.

## 📋 완료 조건
1. [ ] 상세 정보 모달이 화면 크기에 상관없이 상하가 잘리지 않고 중앙에 적절히 배치되어야 함.
2. [ ] 모달 하단의 'Delete', 'Edit', 'Close' 버튼이 항상 노출되어야 함.
3. [ ] 'Internal Documentation' 영역의 내용이 길어질 경우, 해당 영역 내에서 스크롤이 발생해야 함.
4. [ ] 모달 전체 레이아웃이 90vh 이내로 유지되며, 내부 섹션들이 유연하게 크기를 조절해야 함.
5. [ ] `APP_MAP.md` 업데이트.

## 🛠️ 작업 파일
- `plugins/ReleaseHistory/components/ReleaseDetailModal.tsx`
- `APP_MAP.md`
