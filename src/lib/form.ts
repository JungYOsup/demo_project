import { isMissing, toNumber } from './analyze'
import type { Cell, Row, Sheet } from './parse'

/** "항목 | 작성 내용" 형태의 세로형 양식에서 뽑은 한 칸 */
export interface FormEntry {
  label: string
  value: Cell
}

const HEADER_LABEL = /^(항목|구분|질문|문항|item|field|question)$/i
/** "작성 내용", "답변란"처럼 값 칸 전체가 헤더 문구일 때만 헤더로 본다. 부분 일치면 "답변 대기 중" 같은 실제 값도 걸린다. */
const HEADER_VALUE = /^(작성\s*|입력\s*)?(내용|값|답변|응답)(\s*란)?$|^(value|answer)$/i

function usedColumns(grid: Cell[][]): number[] {
  const width = grid.reduce((w, r) => Math.max(w, r.length), 0)
  return Array.from({ length: width }, (_, i) => i).filter((i) => grid.some((r) => !isMissing(r[i] ?? null)))
}

function isHeaderRow(label: Cell, value: Cell): boolean {
  return (typeof label === 'string' && HEADER_LABEL.test(label.trim())) || (typeof value === 'string' && HEADER_VALUE.test(value))
}

/** 사용 중인 앞의 두 열을 항목/값으로 해석한다. 양식이 아닌 시트에도 강제로 적용할 수 있다. */
export function toFormEntries(grid: Cell[][]): FormEntry[] {
  const [li, vi] = usedColumns(grid)
  if (li === undefined) return []
  const rows = grid.filter((r) => !isMissing(r[li] ?? null))
  const start = rows.length > 0 && isHeaderRow(rows[0][li], vi === undefined ? null : (rows[0][vi] ?? null)) ? 1 : 0
  return rows.slice(start).map((r) => ({
    label: String(r[li]).trim(),
    value: vi === undefined ? null : (r[vi] ?? null),
  }))
}

/** 값이 있는 열이 정확히 2개이고, 첫 열이 서로 다른 문자열 라벨이며, 50행 이하일 때 양식으로 본다 */
export function looksLikeForm(grid: Cell[][]): boolean {
  if (usedColumns(grid).length !== 2) return false
  const entries = toFormEntries(grid)
  if (entries.length < 2 || entries.length > 50) return false
  const labels = entries.map((e) => e.label)
  return new Set(labels).size === labels.length && labels.every((l) => toNumber(l) === null)
}

export const FILE_COLUMN = '파일명'

/** 양식 항목 이름이 FILE_COLUMN과 같으면 실제 파일명 열을 덮어쓰지 않도록 이름을 바꾼다 */
const columnOf = (label: string) => (label === FILE_COLUMN ? `${FILE_COLUMN} (항목)` : label)

/** 여러 양식을 1양식 = 1행인 표로 합친다. 열 순서는 라벨이 처음 나온 순서. */
export function mergeForms(forms: { sheet: Sheet; entries: FormEntry[] }[]): Pick<Sheet, 'columns' | 'rows'> {
  const labels: string[] = []
  for (const f of forms) for (const e of f.entries) if (!labels.includes(columnOf(e.label))) labels.push(columnOf(e.label))
  const rows = forms.map((f) => {
    const row: Row = { [FILE_COLUMN]: f.sheet.fileName }
    for (const l of labels) row[l] = null
    for (const e of f.entries) row[columnOf(e.label)] = typeof e.value === 'string' ? e.value.trim() || null : e.value
    return row
  })
  return { columns: [FILE_COLUMN, ...labels], rows }
}

const FREE_TEXT_LABEL = /기타|참고|말씀|의견|비고|메모|요청/

/** 자유기입으로 볼 열: 라벨에 "기타/참고/의견" 등이 있거나 평균 글자 수가 15자 이상 */
export function freeTextColumns(sheet: Pick<Sheet, 'columns' | 'rows'>): string[] {
  return sheet.columns.filter((c) => {
    if (c === FILE_COLUMN) return false
    const texts = sheet.rows.map((r) => r[c]).filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    if (FREE_TEXT_LABEL.test(c)) return true
    return texts.length > 0 && texts.reduce((s, t) => s + t.length, 0) / texts.length >= 15
  })
}

/** 항목별 작성률 (%) */
export function completionRates(sheet: Pick<Sheet, 'columns' | 'rows'>) {
  const n = sheet.rows.length
  return sheet.columns
    .filter((c) => c !== FILE_COLUMN)
    .map((c) => ({ label: c, value: n === 0 ? 0 : Math.round((sheet.rows.filter((r) => !isMissing(r[c])).length / n) * 100) }))
}

export function formInsights(sheet: Pick<Sheet, 'columns' | 'rows'>): string[] {
  const rates = completionRates(sheet)
  const n = sheet.rows.length
  const complete = sheet.rows.filter((r) => rates.every(({ label }) => !isMissing(r[label]))).length
  const out = [`신청서 ${n}건을 하나의 표로 합쳤습니다. 모든 항목을 채운 신청서는 ${complete}건입니다.`]
  const worst = [...rates].sort((a, b) => a.value - b.value)[0]
  if (worst && worst.value < 100) out.push(`가장 많이 비어 있는 항목은 '${worst.label}'입니다 (작성률 ${worst.value}%).`)
  return out
}
