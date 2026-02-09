# 아카이브 기능 타 플러그인 통합 Walkthrough

## 📋 개요
AI Assistant, Post Tool, JSON Tools 등 텍스트 중심의 플러그인에서 선택한 텍스트를 바로 아카이브로 저장할 수 있도록 컨텍스트 메뉴 기능을 통합했습니다.

## ✨ 주요 변경 사항

### 1. 공통 Hook 개발 (`useTextSelectionMenu`)
- **위치**: `components/LogArchive/hooks/useTextSelectionMenu.tsx`
- **기능**:
  - `window.getSelection()`을 사용하여 선택된 텍스트 감지
  - 선택 영역이 현재 컴포넌트 내부에 있는지 확인 (Cross-component 오동작 방지)
  - 우클릭 시 "Save Selection to Archive" 메뉴 표시
  - 선택된 텍스트와 원본 파일 정보를 `openSaveDialog`로 전달

### 2. 플러그인별 통합 적용

| 플러그인 | 파일 위치 | 적용 내용 |
|---|---|---|
| **Post Tool** | `components/PostTool/ResponseViewer.tsx` | API 응답 본문 선택 시 저장 가능 |
| **JSON Tools** | `components/JsonTools/JsonFormatter.tsx` | JSON 트리 및 Raw 뷰에서 선택 시 저장 가능 |
| **JSON Tools** | `components/JsonTools/JsonDiffViewer.tsx` | Diff 결과 비교 화면에서 선택 시 저장 가능 |
| **Easy Post** | `plugins/EasyPost/EasyPostPlugin.tsx` | 스마트싱스 데이터 탐색 중 선택 시 저장 가능 |
| **AI Assistant** | `components/AiAssistant/index.tsx` | 대화 로그 및 생성된 코드 블록 선택 시 저장 가능 |
| **TPK Extractor** | `components/TpkExtractor/TpkTerminalLog.tsx` | 터미널 로그 출력 선택 시 저장 가능 |
| **Reverse Engineer** | `components/ReverseEngineer.tsx` | 분석 결과 텍스트 선택 시 저장 가능 |

## 🔍 확인 방법

1. **텍스트 선택**: 위 플러그인 중 하나에서 텍스트를 드래그하여 선택합니다.
2. **우클릭**: 선택된 영역 위에서 마우스 오른쪽 버튼을 클릭합니다.
3. **메뉴 확인**: 컨텍스트 메뉴에 **"Save Selection to Archive"** 항목이 나타나는지 확인합니다.
4. **저장**: 메뉴를 클릭하면 저장 다이얼로그가 열리고, 선택한 텍스트가 자동으로 입력되어 있어야 합니다.
5. **검증**: 저장 후 아카이브 사이드바에서 해당 항목이 정상적으로 생성되었는지 확인합니다.
