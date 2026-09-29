# src/components

화면 표시 전용 컴포넌트. 전체 데이터 흐름과 `lib/` 설명은 루트 `CLAUDE.md` 참고.

## 규칙

- 컴포넌트는 계산을 하지 않는다. `lib/analyze.ts`가 만든 `Analysis`/`ColumnProfile`이나 `lib/form.ts`의 결과를 props로 받아 그리기만 한다. 새 통계나 집계가 필요하면 `lib/`에 순수 함수로 추가하고 여기서는 호출만 한다.
- 모두 named export (`export function Foo`). default export는 `App.tsx`뿐이다.
- 값 표시는 반드시 `lib/analyze.ts`의 `formatNumber` / `formatDate` / `formatCell`을 쓴다 (`toLocaleString`·`toISOString`을 직접 쓰지 말 것 — 날짜가 UTC로 밀린다).
- 사용자 노출 문구는 모두 한국어.
- 스타일은 `src/index.css`의 공용 클래스를 재사용한다: 섹션은 `card` + `card-header`(안에 `h2`/`h3`), 보조 텍스트는 `muted` / `small`, 버튼은 `btn`(주요) 또는 `link`(텍스트형), 표는 `table` + 숫자 셀 `num`.

## 차트 (`charts.tsx`)

Recharts를 직접 쓰지 말고 `charts.tsx`의 두 래퍼만 사용한다.

- `VerticalBars` — x축에 순서가 있는 데이터(히스토그램, 월별 추이). 데이터 키는 `count`, 선택적으로 `tooltipLabel`(히스토그램 구간 전체 범위 표시용).
- `HorizontalBars` — 범주 비교. 데이터 키는 `value`, 막대 끝에 값 라벨이 붙는다. `suffix`(예: `'%'`)와 `max`로 축 고정 가능.

색상·축·그리드는 CSS 변수(`--series-1`, `--grid`, `--baseline`, `--text-muted`, `--hover` 등)로만 지정하며, 애니메이션은 꺼 둔다(`isAnimationActive={false}`). 툴팁은 공용 `ChartTooltip`을 쓴다.

## 상태가 있는 컴포넌트

대부분 stateless이고, 로컬 상태는 UI용으로만 쓴다 (`Dropzone`의 드래그 상태, `Insights`의 복사 표시, `GroupByPanel`의 선택값).

`GroupByPanel`은 시트가 바뀌어 선택한 열이 사라져도 `useEffect`로 상태를 리셋하지 않고, 렌더링 중에 `effectiveKey` / `effectiveValue` / `effectiveAgg`로 유효한 값을 계산해 쓴다. 비슷한 선택 UI를 만들 때 이 패턴을 따른다. 그룹 기준 열 후보는 text/boolean/date 중 고유값 2~200개이고 식별자 열(`isIdentifier`)이 아닌 것이다.

## 양식(신청서) 뷰 (`FormViews.tsx`)

- `SingleForm` — 양식이 1개일 때 항목/내용을 그대로 나열.
- `FormSummary` — 여러 양식을 합친 표(`mergeForms` 결과)에 대해 항목별 작성률과 자유기입 응답 모음을 보여준다. 첫 열 `FILE_COLUMN`(`'파일명'`)은 응답 출처 표시에만 쓴다.
