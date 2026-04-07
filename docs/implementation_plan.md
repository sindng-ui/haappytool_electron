# 앱 브랜딩 변경 계획 (HappyTool -> BigBrain)

형님, 요청하신 대로 앱 이름과 로고를 **HappyTool**에서 **BigBrain**으로 변경하는 작업을 시작하겠습니다. 유저에게 노출되는 부분만 깔끔하게 바꿔서 새 옷을 입혀드릴게요!

## 유저 리뷰 필요 사항

- **로고 디자인**: `generate_image`를 통해 'BigBrain' 테마에 맞는 화려하고 지적인 로고를 생성할 예정입니다. 생성된 로고가 마음에 드시는지 확인 부탁드립니다.
- **노출 범위**: 형님의 요청에 따라 **설치 파일명은 유지**합니다. 이를 위해 `package.json`의 `productName`은 `HappyTool`로 남겨두고, 앱 내부의 UI 텍스트와 창 타이틀만 `BigBrain`으로 교체하는 정밀한 작업을 수행합니다.

## 주요 변경 사항

### 1. 앱 이름 변경 (내부 UI 한정)

유저에게 보이는 모든 텍스트를 `BigBrain`으로 교체하지만, 시스템 설정은 유지합니다.

- **[KEEP] [package.json](file:///k:/Antigravity_Projects/gitbase/happytool_electron/package.json)**: `productName`은 `HappyTool`로 유지하여 설치 파일명 보존.
- **[MODIFY] [index.html](file:///k:/Antigravity_Projects/gitbase/happytool_electron/index.html)**: `<title>` 태그를 `BigBrain`으로 수정.
- **[MODIFY] UI 컴포넌트**: 사이드바, 스플래시 화면, 설정 모달 등에서 "HappyTool" / "Happy Tool" 텍스트를 "BigBrain"으로 수정.
    - 대상: `Sidebar.tsx` (브랜드명 및 로고 'H' -> 'B'), `LoadingSplash.tsx` (메인 타이틀) 등

### 2. 로고 및 아이콘 변경

현재의 `icon.png` 등을 새로운 'BigBrain' 로고로 교체합니다.

- **[NEW] BigBrain 로고 생성**: `generate_image` 툴을 사용해 고해상도 로고 생성.
- **[MODIFY] [public/icon.png](file:///k:/Antigravity_Projects/gitbase/happytool_electron/public/icon.png)**: 새 로고로 교체.
- **[MODIFY] [build/icon.png](file:///k:/Antigravity_Projects/gitbase/happytool_electron/build/icon.png)**: 새 로고로 교체. (필요 시)

### 3. 문서 및 맵 업데이트

- **[MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)**: 변경된 앱 이름과 로고 정보를 인터페이스에 맞춰 업데이트.

---

## 오픈 질문

1. **로고 스타일**: 어떤 느낌의 로고를 선호하시나요? (예: 뇌 모양의 테크니컬한 느낌, 미니멀한 텍스트 중심 등)
2. **파일명 관련**: 형님 말씀하신 대로 설치 파일명(`HappyTool-Setup.exe`)을 유지하기 위해 `productName`은 건드리지 않기로 했습니다. 앱 내부에서만 완벽하게 `BigBrain`으로 보이게 처리할게요!

## 검증 계획

### 수동 확인
- Electron 앱을 실행하여 타이틀 바, 헤더, 사이드바, 정보창 등에 "BigBrain"이 올바르게 표시되는지 확인.
- 로고가 깨지지 않고 선명하게 노출되는지 확인.
- `npm run dev`를 통해 실시간 UI 변경 사항 최종 점검.
