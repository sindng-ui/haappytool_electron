# Log Extractor View Settings 제목 스타일 개선

## 작업 내용
사용자 요청에 따라 "View Settings" 제목을 더 잘 보이도록 개선했습니다.
다른 Configuration 섹션(예: Happy Combo)과 동일한 스타일을 적용하여 일관성을 맞추었습니다.

## 변경 사항
- **`components/LogViewer/ConfigSections/ViewSettingsSection.tsx`** 수정:
  - 기존의 작고 흐릿한 제목 스타일(`text-xs font-bold text-slate-400 uppercase`)을 제거.
  - `HappyComboSection`과 동일한 스타일(`text-sm font-bold text-indigo-100`)을 적용.
  - 시각적 인지를 돕기 위해 **Eye 아이콘**(`lucide-react`)을 추가.

## 기능 확인
- Configuration 패널 하단의 View Settings 섹션 제목 확인.
- "Happy Combos" 등 다른 제목과 비슷한 크기와 밝기로 표시되는지 확인.
- Eye 아이콘이 정상적으로 표시되는지 확인.
