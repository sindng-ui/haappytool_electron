# HAPPY Tool - Application Map

> **문서 분리 기준 (Split Rule)**: 특정 줄기(섹션)의 라인 수가 **100줄을 초과**하거나, 내부에 상세히 기술해야 할 하위 컴포넌트/기능이 **5개 이상** 쌓여 가독성을 해치는 경우, `docs/maps/` 하위의 개별 마크다운 파일로 가지치기(분리)하여 굴비 엮듯 연결합니다.

---

## 🧩 [Plugins](./docs/maps/PLUGINS.md)
로그 분석 자동화 AI, nupkg 서명, 릴리즈 히스토리 등 다양한 부가 기능들을 담당하는 플러그인 모음입니다.
- **주요 항목**: Log Analysis Agent, RAG Analyzer Test, Nupkg Signer, Release History 등
- 👉 **[상세 보기](./docs/maps/PLUGINS.md)**

## 🏗️ [UI Components](./docs/maps/UI_COMPONENTS.md)
Happy Tool의 뼈대를 이루는 핵심 사용자 인터페이스(UI) 및 공통 다이얼로그 시스템입니다.
- **주요 항목**: Log Extractor, SpeedScope Analyzer, NetTraffic Analyzer, AppHub, Common Dialog System 등
- 👉 **[상세 보기](./docs/maps/UI_COMPONENTS.md)**

## 🤖 [Backend Services & RAG](./docs/maps/BACKEND_SERVICES.md)
Node 기반 IPC/Socket 통신 및 파이썬 기반 RAG(검색 증강 생성) 백엔드 엔진 구조도입니다.
- **주요 항목**: Backend Core Refactoring (Serial 통신), SW Issue Analyst RAG 엔진 등
- 👉 **[상세 보기](./docs/maps/BACKEND_SERVICES.md)**

## 📜 [Standard Guides](./docs/maps/STANDARD_GUIDES.md)
프로젝트의 무결성과 코드 품질을 유지하기 위한 전역 표준 지침서 및 환경 세팅 가이드라인 모음입니다.
- **주요 항목**: Code Review Guide, Dependency Issues Guide (JSZip ESM 병합 등)
- 👉 **[상세 보기](./docs/maps/STANDARD_GUIDES.md)**

---
*Last Updated: 2026-07-23 (BlockTest UI Restoration & High-Performance SDB Spawn Engine)*
