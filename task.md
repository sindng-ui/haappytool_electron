# Tizen Lab 앱 목록 표시 오류 수정

## 작업 개요
Tizen Lab 플러그인의 App Manager에서 앱 목록을 조회할 때, 실제 앱 대신 잘못된 헤더 정보(`system`, `vpkg_type`, `[WGT]`)가 반복적으로 카드로 표시되는 문제를 수정합니다.

## 배경
사용자가 `app_launcher -l` 명령을 통해 앱 목록을 가져올 때, 일부 Tizen 기기 또는 버전에서 다음과 같은 형식의 출력을 제공하는 것으로 추정됩니다:
```
system vpkg_type [WGT]
org.app.id AppName [WGT]
...
```
기존 파싱 로직은 `(Status)` 괄호 형식만 지원하고, `system` 헤더를 필터링하지 않아 잘못된 파싱 결과가 발생하고 있었습니다.

## 목표
1. `server/index.cjs`의 `list_tizen_apps` 핸들러 수정
2. `[Status]` 대괄호 형식 지원을 위한 정규식 개선
3. `system vpkg_type` 등의 헤더 라인 필터링 추가
