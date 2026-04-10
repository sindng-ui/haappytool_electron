# 실험실(LAB) 플러그인 가시성 관리 기능 구현 계획

형님! 실험실 플러그인들을 코드 한 줄로 껐다 켰다 할 수 있게 만들어 드리겠습니다. `plugins/config.ts` 파일에서 `SHOW_LAB_PLUGINS` 값을 바꾸기만 하면 즉시 반영되도록 설계했습니다. 🐧🚀

## User Review Required

> [!IMPORTANT]
> - `plugins/config.ts` 파일이 새로 생성됩니다. 여기서 `SHOW_LAB_PLUGINS` 값을 `false`로 바꾸면 'ST Lab'과 'Tizen Lab' 진입점이 사라집니다.
> - `HappyPlugin` 인터페이스에 `isLab` 속성이 추가됩니다.

## Proposed Changes

---

### [Plugin System]

#### [MODIFY] [plugins/types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/types.ts)
- `HappyPlugin` 인터페이스에 `isLab?: boolean` 속성을 추가합니다. 이는 해당 플러그인이 실험실용인지 구분하는 기준이 됩니다.

#### [NEW] [plugins/config.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/config.ts)
- 플러그인 시스템의 설정을 관리하는 파일을 생성합니다.
- `SHOW_LAB_PLUGINS` 상수를 정의합니다 (기본값: `true`).

#### [MODIFY] [plugins/core/wrappers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/core/wrappers.ts)
- `SmartThingsLabPluginWrapper`와 `TizenLabPluginWrapper`에 `isLab: true` 속성을 부여합니다.

#### [MODIFY] [plugins/registry.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/registry.ts)
- `ALL_PLUGINS` 배열을 정의할 때 `plugins/config.ts`의 `SHOW_LAB_PLUGINS` 값을 확인하여, `false`인 경우 `isLab: true`인 플러그인들을 필터링하여 제외하도록 로직을 수정합니다.

---

### [Documentation]

#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md)
- 플러그인 레지스트리 섹션에 실험실 플러그인 제어 로직에 대한 설명을 추가합니다.

## Open Questions

- 형님, 혹시 실험실 플러그인 외에 다른 플러그인들도 이런 식으로 제어하고 싶은 게 있으신가요? 현재는 'ST Lab', 'Tizen Lab' 두 가지만 대상으로 생각하고 있습니다.

## Verification Plan

### Automated Tests
- `plugins/config.ts`의 `SHOW_LAB_PLUGINS`를 `false`로 설정하고 앱을 실행했을 때, 사이드바에서 해당 플러그인들이 보이지 않는지 확인합니다.
- 다시 `true`로 설정했을 때 정상적으로 나타나는지 확인합니다.

### Manual Verification
- Electron 앱을 실행하여 사이드바의 "Lab" 섹션 혹은 해당 아이콘들이 설정값에 따라 동적으로 변하는지 육안으로 확인합니다.
