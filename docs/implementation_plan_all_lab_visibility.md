# 실험실(LAB) 플러그인 전체 개별 관리 계획

형님! 제가 'Lab'이라는 이름이 붙은 것만 챙겼었군요. 실수했습니다! 🐧💦 
HappyTool에서 실질적으로 '실험실' 섹션에 들어가는 모든 플러그인 목록을 `config.ts`에 싹 다 때려 넣어 드리겠습니다.

이제 어떤 도구든 형님 입맛대로 껐다 켰다 하실 수 있습니다!

## User Review Required

> [!IMPORTANT]
> - `plugins/config.ts`에 코어 기능을 제외한 모든 실험실용 플러그인 플래그가 추가됩니다.
> - **대상 목록**: SmartThings Devices, SmartThings Lab, Tizen Lab, Reverse Engineer, Easy UML, CPU Analyzer, Smart Home, Screen Matcher, AI Assistant, Easy Post, Perf Tool, Log Agent, Gauss Chat, Everything Search 등.

## Proposed Changes

---

### [Plugin System Configuration]

#### [MODIFY] [plugins/config.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/config.ts)
- 현재 2개뿐인 플래그를 확장하여 모든 실험실 플러그인을 포함합니다.
```typescript
export const PLUGIN_CONFIG = {
    SHOW_SMARTTHINGS_DEVICES: true,
    SHOW_SMARTTHINGS_LAB: true,
    SHOW_TIZEN_LAB: true,
    SHOW_REVERSE_ENGINEER: true,
    SHOW_EASY_UML: true,
    SHOW_CPU_ANALYZER: true,
    SHOW_SMART_HOME_DASHBOARD: true,
    SHOW_SCREEN_MATCHER: true,
    SHOW_AI_ASSISTANT: false, // 기본적으로 꺼져 있음
    SHOW_EASY_POST: true,
    SHOW_PERF_TOOL: true,
    SHOW_LOG_ANALYSIS_AGENT: true,
    SHOW_GAUSS_CHAT_AGENT: true,
    SHOW_EVERYTHING_SEARCH: true,
};
```

#### [MODIFY] [plugins/registry.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/registry.ts)
- `ALL_PLUGINS` 필터링 로직에 추가된 모든 플러그인에 대한 체크 로직을 반영합니다. (매핑 테이블을 사용하여 코드를 깔끔하게 유지하겠습니다.)

---

### [Documentation]

#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)
- 확장된 플러그인 관리 목록에 대해 내용을 업데이트합니다.

## Open Questions

- 형님, 혹시 실험실 섹션뿐만 아니라 'Log Extractor' 같은 핵심 도구들도 끄고 싶으실 때가 있나요? 원하신다면 모든 플러그인을 설정 대상으로 넣어드릴 수 있습니다! 일단은 요청하신 대로 실험실 플러그인 전체를 대상으로 작업하겠습니다.

## Verification Plan

### Automated Tests
- `plugins/config.ts`에서 무작위로 몇 개의 플러그인을 `false`로 설정하고, 해당 항목들이 사이드바에서 정확히 사라지는지 확인합니다.

### Manual Verification
- Electron 앱 실행 후 사이드바의 'Lab' 메뉴를 열어 설정한 대로 목록이 구성되는지 확인합니다.
