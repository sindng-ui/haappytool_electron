# 실험실(LAB) 플러그인 개별 가시성 관리 계획

형님! 죄송합니다. 제가 의도를 살짝 오해했네요. 실험실 섹션 전체가 아니라, 그 안의 **개별 플러그인들을 각각** 껐다 켰다 하시고 싶다는 말씀이시죠? 🐧💡 

플러그인별로 스위치를 만들어 바로 수정해 드리겠습니다.

## User Review Required

> [!IMPORTANT]
> - `plugins/config.ts`의 설정 구조가 개별 플러그인 플래그 방식으로 변경됩니다.
> - 예를 들어 `SHOW_SMARTTHINGS_LAB: false`로 설정하면 'ST Lab'만 사라지고 다른 실험실 플러그인은 유지됩니다.

## Proposed Changes

---

### [Plugin System Configuration]

#### [MODIFY] [plugins/config.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/config.ts)
- `SHOW_LAB_PLUGINS` 단일 플래그를 제거하고, 하위 플러그인별 플래그로 분리합니다.
  - `SHOW_SMARTTHINGS_LAB: true`
  - `SHOW_TIZEN_LAB: true`

#### [MODIFY] [plugins/registry.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/registry.ts)
- 필터링 로직을 개별 플래그를 확인하도록 변경합니다.
  - `SMARTTHINGS_LAB` 인 경우 `SHOW_SMARTTHINGS_LAB` 확인
  - `TIZEN_LAB` 인 경우 `SHOW_TIZEN_LAB` 확인

---

### [Documentation]

#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)
- 세분화된 개별 플러그인 제어 로직에 대해 내용을 업데이트합니다.

## Open Questions

- 형님, 나중에 실험실 플러그인이 더 늘어날 것을 대비해서 `LAB_ENABLED: { [key: string]: boolean }` 같은 맵 구조가 편하실까요, 아니면 지금처럼 직관적인 변수명이 편하실까요? 일단은 직관적으로 변수명을 분리해 두겠습니다!

## Verification Plan

### Automated Tests
- `plugins/config.ts`에서 하나는 `true`, 하나는 `false`로 설정했을 때 각각의 진입점이 의도대로 보이고 사라지는지 확인합니다.

### Manual Verification
- Electron 앱의 사이드바 'Lab' 섹션에서 특정 항목만 사라지는지 육안으로 확인합니다.
