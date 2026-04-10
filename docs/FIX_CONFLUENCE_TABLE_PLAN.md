# Confluence 테이블 복사 시 `}` 문자 처리 수정 계획

## 개요
Log Extractor에서 "Copy as Confluence Table" 기능을 사용할 때, 로그 내용에 `}` 문자가 포함되면 Confluence의 매크로 파서가 이를 오인식하여 테이블 렌더링이 실패하는 현상이 발생하고 있습니다. 이를 해결하기 위해 기존 `{`, `[` 문자와 동일하게 `}` 문자 뒤에도 제로 너비 공백을 삽입하여 파싱을 방해하지 않도록 수정합니다.

## 제안된 변경 사항

### [MODIFY] [confluenceUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/confluenceUtils.ts)

#### `cleanConfluenceContent` 함수 수정
- `}` 문자를 찾아 뒤에 `\u200B` (Zero Width Space)를 추가하는 로직을 삽입합니다.

```typescript
export const cleanConfluenceContent = (text: string): string => {
    let safe = text
        .replace(/\|/g, '｜')
        .replace(/\[/g, '[\u200B')
        .replace(/{/g, '{\u200B')
        .replace(/}/g, '}\u200B') // ✅ 추가: } 문자 뒤에 제로 너비 공백 추가
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
    // ... 생략
};
```

## 검증 계획
### 수동 테스트
1. 로그 내용에 `}`가 포함된 행을 포함하여 "Copy as Confluence Table"을 수행합니다.
2. 복사된 내용을 Confluence 페이지에 붙여넣었을 때 테이블이 정상적으로 생성되는지 확인합니다.
