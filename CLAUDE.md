# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

"엑셀 분석기" — 브라우저에서 엑셀/CSV 파일을 읽어(SheetJS) 모든 열을 프로파일링하고, 요약·인사이트·차트(Recharts)를 보여주는 React 18 + Vite + TypeScript 클라이언트 앱. 백엔드는 없으며 파싱과 분석은 모두 브라우저에서 이루어진다. UI 문구, 생성되는 인사이트, 코드 주석이 모두 한국어이므로 새로 추가하는 사용자 노출 문구도 한국어로 작성한다.

## 명령어

```bash
npm run dev      # Vite 개발 서버
npm run build    # tsc -b (타입 체크) 후 vite build → dist/
npm run lint     # ESLint (flat config, eslint.config.js)
npm run preview  # 빌드된 dist/ 미리보기
```

테스트 러너는 설정되어 있지 않다. `npm run build`가 타입 체크 역할을 한다 (strict 모드이며 `noUnusedLocals`/`noUnusedParameters`가 켜져 있어 사용하지 않는 심볼이 있으면 빌드가 실패한다).

`xlsx`는 npm 레지스트리가 아니라 SheetJS CDN tarball(`https://cdn.sheetjs.com/...`)에서 설치한다. npm의 `xlsx` 패키지는 오래된 버전이므로 이 의존성을 "고치지" 말 것.

## 아키텍처

@ARCHITECTURE.md
