# 아키텍처

데이터는 한 방향으로 흐른다: `lib/parse.ts`(파일 → `Sheet`) → `lib/form.ts`(양식 감지·병합) / `lib/analyze.ts`(열 프로파일링·인사이트) → 컴포넌트. 모든 로직은 `src/lib/`의 순수 함수에 있고, `src/components/`의 컴포넌트는 미리 계산된 결과를 받아 표시만 한다.

폴더별 세부 규칙은 각 폴더의 CLAUDE.md에 있다. 해당 폴더를 수정할 때는 먼저 읽을 것.

- [`src/lib/CLAUDE.md`](src/lib/CLAUDE.md) — 파싱, 타입 감지·숫자/예아니오 인식 규칙, 인사이트 문장 생성, 양식 감지·병합
- [`src/components/CLAUDE.md`](src/components/CLAUDE.md) — 차트 래퍼, 공용 CSS 클래스, 포맷터 사용, 상태 관리 패턴

**`App.tsx`** — 상태를 소유한다. 불러온 각 시트는 `mode: 'form' | 'table'`을 가진 `Entry`가 된다(자동 감지, 사용자가 전환 가능). form 모드 항목은 모두 하나의 "신청서 모음" 탭(`FORMS_TAB`)으로 합쳐지고, table 모드 시트는 각자 탭을 가진다. `TableAnalysis`와 `FormsAnalysis`는 같은 컴포넌트들(Overview, Insights, GroupByPanel, ColumnCard, DataPreview)을 조합하며, `FormsAnalysis`는 `파일명` 열을 건너뛰고(`columns.slice(1)`) 첫 번째 일반 인사이트를 `formInsights`로 대체한다.

스타일은 `src/index.css`의 순수 CSS로 작성되어 있다 (CSS 프레임워크 없음).
