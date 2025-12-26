# 플러그인 개발 가이드

이 가이드는 해피툴(HappyTool)의 새로운 플러그인을 개발하려는 개발자(와 AI 에이전트)를 위해 작성되었습니다.

## 아키텍처 개요

해피툴은 동적 플러그인 시스템을 사용합니다. 플러그인은 다음과 같은 특징을 가진 React 컴포넌트입니다:
1.  `plugins/registry.ts`에 **등록**됩니다.
2.  표준화된 렌더링을 위해 `PluginContainer`에 의해 **래핑**됩니다.
3.  `App.tsx`와의 하드 종속성을 피하기 위해 **캡슐화**됩니다.
4.  `useHappyTool()`을 사용하여 전역 상태(로그 규칙, 저장된 요청 등)에 **Context 기반으로 접근**합니다.

> [!NOTE]
> 이 가이드의 모든 경로는 **프로젝트 루트**를 기준으로 합니다. `src` 디렉토리는 존재하지 않습니다.


## 단계별 플러그인 생성

### 1. 플러그인 컴포넌트 생성
`components/[PluginName]` 디렉토리를 생성합니다.
메인 컴포넌트 파일 `components/[PluginName]/index.tsx`를 생성합니다.

> [!IMPORTANT]
> 전역 상태를 위해 props를 받지 마십시오. 대신 `useHappyTool` 훅을 사용하세요.

**템플릿:**
```tsx
import React from 'react';
import { useHappyTool } from '@/contexts/HappyToolContext';

const MyPlugin: React.FC = () => {
    // 필요한 경우 전역 상태에 접근
    const { logRules, setLogRules } = useHappyTool();

    return (
        <div className="flex flex-col h-full p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
            <h1 className="text-xl font-bold mb-4">나의 새 플러그인</h1>
            {/* 이곳에 콘텐츠 작성 */}
        </div>
    );
};

export default MyPlugin;
```

### 2. 플러그인 래퍼(Wrapper) 정의
`plugins/core/wrappers.ts`를 수정하여 플러그인 메타데이터를 정의합니다.

**템플릿:**
```typescript
import MyPluginComponent from '@/components/MyPlugin';
import * as Lucide from 'lucide-react';
import { ToolId } from '@/types'; // 먼저 types.ts에 ID를 추가하세요!

export const MyPluginWrapper: HappyPlugin = {
    id: 'my-plugin-id', // 고유한 문자열 ID
    name: '나의 플러그인',
    icon: Lucide.Box, // Lucide 아이콘 선택
    component: MyPluginComponent,
    order: 10, // 사이드바 순서
};
```

### 3. 플러그인 등록
`plugins/registry.ts`를 수정하여 래퍼를 `ALL_PLUGINS` 배열에 추가합니다.

```typescript
import { MyPluginWrapper } from './core/wrappers';

export const ALL_PLUGINS: HappyPlugin[] = [
    // ... 기존 플러그인들
    MyPluginWrapper
];
```

### 4. 타입 추가 (선택 사항이지만 권장됨)
플러그인이 새로운 ID를 필요로 한다면 `types.ts`의 `ToolId` 열거형(enum)을 업데이트하세요.

## 전역 상태 접근
`HappyToolContext`는 다음을 제공합니다:
- **`logRules`**: 로그 분석 규칙 배열.
- **`savedRequests`**: 저장된 API 요청 (PostTool).
- **`postGlobalVariables`**: 환경 변수.

**사용법:**
```typescript
const { savedRequests } = useHappyTool();
```

## 토스트 알림 (Toast Notifications)
`useToast` 훅을 사용하여 알림을 표시할 수 있습니다.

```typescript
import { useToast } from '../../contexts/ToastContext';

const MyComponent = () => {
    const { addToast } = useToast();

    const handleSave = () => {
        // ... 저장 로직
        addToast("성공적으로 저장되었습니다!", "success");
    };
};
```

## 스타일 가이드라인
- 모든 스타일링에 **Tailwind CSS**를 사용하세요.
- **다크 모드**를 지원하세요 (`dark:` 수정자 사용).
- 배경에는 `slate-50`/`slate-950`, 텍스트에는 `slate-900`/`slate-200`을 사용하세요.
- 주요 동작/강조 색상으로 `indigo-500`을 사용하세요.
