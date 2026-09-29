import type { Cell, Row, Sheet } from './parse'

export type ColumnType = 'number' | 'date' | 'text' | 'boolean' | 'empty'

interface BaseProfile {
  name: string
  type: ColumnType
  total: number
  missing: number
  unique: number
}

export interface NumberProfile extends BaseProfile {
  type: 'number'
  sum: number
  mean: number
  median: number
  std: number
  min: number
  max: number
  outliers: number
  histogram: { label: string; tooltipLabel: string; count: number }[]
}

export interface DateProfile extends BaseProfile {
  type: 'date'
  min: Date
  max: Date
  byMonth: { label: string; count: number }[]
}

export interface CategoryProfile extends BaseProfile {
  type: 'text' | 'boolean'
  top: { value: string; count: number }[]
  /** 모든 값이 서로 다른 열 (이름, 연락처, ID 등) */
  isIdentifier: boolean
  /** boolean 열에서 O / 예 / true 쪽 값의 개수 */
  positive: number
}

export interface EmptyProfile extends BaseProfile {
  type: 'empty'
}

export type ColumnProfile = NumberProfile | DateProfile | CategoryProfile | EmptyProfile

export interface Correlation {
  a: string
  b: string
  r: number
}

export interface Analysis {
  rowCount: number
  columnCount: number
  missingCells: number
  duplicateRows: number
  columns: ColumnProfile[]
  correlations: Correlation[]
  insights: string[]
}

export const isMissing = (v: Cell) => v === null || (typeof v === 'string' && v.trim() === '')

const TRUE_WORDS = ['o', 'ㅇ', '○', 'y', 'yes', '예', '네', 'true']
const FALSE_WORDS = ['x', '×', 'n', 'no', '아니오', '아니요', 'false']

function toBoolean(v: Cell): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  if (TRUE_WORDS.includes(s)) return true
  if (FALSE_WORDS.includes(s)) return false
  return null
}

/** "1,234", "₩5,000", "12%" 같은 문자열도 숫자로 인식. 0으로 시작하는 전화번호·하이픈 값은 제외 */
export function toNumber(v: Cell): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim().replace(/[,₩$€¥\s]/g, '')
  if (s === '' || /^0\d/.test(s) || /\d-\d/.test(s)) return null
  const pct = s.endsWith('%')
  const n = Number(pct ? s.slice(0, -1) : s)
  if (!Number.isFinite(n)) return null
  return pct ? n / 100 : n
}

function detectType(values: Cell[]): ColumnType {
  if (values.length === 0) return 'empty'
  let num = 0
  let date = 0
  let bool = 0
  for (const v of values) {
    if (v instanceof Date) date++
    else if (toBoolean(v) !== null) bool++
    else if (toNumber(v) !== null) num++
  }
  const threshold = values.length * 0.9
  if (date >= threshold) return 'date'
  if (bool >= threshold) return 'boolean'
  if (num >= threshold) return 'number'
  return 'text'
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs !== 0 && (abs >= 1e12 || abs < 0.001)) return n.toExponential(2)
  return n.toLocaleString('ko-KR', { maximumFractionDigits: abs >= 100 ? 0 : 2 })
}

function compactNumber(n: number): string {
  return n.toLocaleString('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })
}

const pad = (n: number) => String(n).padStart(2, '0')

/** toISOString은 UTC 기준이라 한국 시간 자정이 전날로 밀리므로 로컬 날짜를 쓴다 */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatCell(v: Cell): string {
  if (v === null) return ''
  if (v instanceof Date) return formatDate(v)
  if (typeof v === 'number') return formatNumber(v)
  return String(v)
}

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))

function histogram(sorted: number[]) {
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  if (min === max) return [{ label: compactNumber(min), tooltipLabel: formatNumber(min), count: sorted.length }]
  const binCount = Math.min(20, Math.max(5, Math.ceil(Math.log2(sorted.length) + 1)))
  const width = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, i) => {
    const from = min + i * width
    return { label: compactNumber(from), tooltipLabel: `${formatNumber(from)} ~ ${formatNumber(from + width)}`, count: 0 }
  })
  for (const v of sorted) bins[Math.min(binCount - 1, Math.floor((v - min) / width))].count++
  return bins
}

function profileColumn(name: string, rows: Row[]): ColumnProfile {
  const present = rows.map((r) => r[name]).filter((v) => !isMissing(v))
  const base = {
    name,
    total: rows.length,
    missing: rows.length - present.length,
    unique: new Set(present.map((v) => (v instanceof Date ? v.getTime() : typeof v === 'string' ? v.trim() : v))).size,
  }
  const type = detectType(present)

  if (type === 'number') {
    const values = present.map(toNumber).filter((n): n is number => n !== null)
    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)
    const mean = sum / values.length
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
    const q1 = quantile(sorted, 0.25)
    const q3 = quantile(sorted, 0.75)
    const iqr = q3 - q1
    return {
      ...base,
      type,
      sum,
      mean,
      median: quantile(sorted, 0.5),
      std,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      outliers: values.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length,
      histogram: histogram(sorted),
    }
  }

  if (type === 'date') {
    const dates = present.filter((v): v is Date => v instanceof Date)
    const times = dates.map((d) => d.getTime())
    const months = new Map<string, number>()
    for (const d of dates) {
      const key = formatDate(d).slice(0, 7)
      months.set(key, (months.get(key) ?? 0) + 1)
    }
    return {
      ...base,
      type,
      min: new Date(times.reduce((a, b) => Math.min(a, b))),
      max: new Date(times.reduce((a, b) => Math.max(a, b))),
      byMonth: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label, count })),
    }
  }

  if (type === 'text' || type === 'boolean') {
    const counts = new Map<string, number>()
    for (const v of present) {
      const key = formatCell(v).trim()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const top = [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }))
    return {
      ...base,
      type,
      top,
      isIdentifier: type === 'text' && present.length >= 3 && base.unique === present.length,
      positive: present.filter((v) => toBoolean(v) === true).length,
    }
  }

  return { ...base, type: 'empty' }
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy)
}

function correlations(rows: Row[], numeric: NumberProfile[]): Correlation[] {
  const result: Correlation[] = []
  for (let i = 0; i < numeric.length; i++) {
    for (let j = i + 1; j < numeric.length; j++) {
      const xs: number[] = []
      const ys: number[] = []
      for (const r of rows) {
        const x = toNumber(r[numeric[i].name])
        const y = toNumber(r[numeric[j].name])
        if (x !== null && y !== null) {
          xs.push(x)
          ys.push(y)
        }
      }
      if (xs.length >= 5) result.push({ a: numeric[i].name, b: numeric[j].name, r: pearson(xs, ys) })
    }
  }
  return result.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
}

function buildInsights(a: Omit<Analysis, 'insights'>): string[] {
  const out: string[] = []
  const cells = a.rowCount * a.columnCount
  const byType = (t: ColumnType) => a.columns.filter((c) => c.type === t).length

  out.push(
    `총 ${a.rowCount.toLocaleString()}행 × ${a.columnCount}열 데이터입니다 ` +
      `(숫자 ${byType('number')}, 텍스트 ${byType('text')}, 예/아니오 ${byType('boolean')}, 날짜 ${byType('date')}열).`,
  )

  if (a.missingCells === 0) out.push('빈 셀이 없는 깔끔한 데이터입니다.')
  else {
    const worst = [...a.columns].sort((x, y) => y.missing - x.missing)[0]
    out.push(
      `전체 셀의 ${((a.missingCells / cells) * 100).toFixed(1)}%가 비어 있으며, ` +
        `'${worst.name}' 열이 가장 많이 비어 있습니다 (${worst.missing.toLocaleString()}개, ${percent(worst.missing, worst.total)}%).`,
    )
  }

  if (a.duplicateRows > 0) out.push(`완전히 동일한 중복 행이 ${a.duplicateRows.toLocaleString()}개 있습니다.`)

  for (const c of a.columns) {
    const present = c.total - c.missing
    if (c.type === 'number') {
      const skew = c.std === 0 ? 0 : (c.mean - c.median) / c.std
      let line = `'${c.name}': 합계 ${formatNumber(c.sum)}, 평균 ${formatNumber(c.mean)}, 범위 ${formatNumber(c.min)} ~ ${formatNumber(c.max)}.`
      if (skew > 0.2) line += ' 소수의 큰 값이 평균을 끌어올리고 있습니다 (평균 > 중앙값).'
      else if (skew < -0.2) line += ' 소수의 작은 값이 평균을 끌어내리고 있습니다 (평균 < 중앙값).'
      if (c.outliers > 0) line += ` 이상치 ${c.outliers}개.`
      out.push(line)
    } else if (c.type === 'boolean') {
      out.push(`'${c.name}': 응답 ${present}건 중 ${c.positive}건(${percent(c.positive, present)}%)이 '예/O'입니다.`)
    } else if (c.type === 'text' && !c.isIdentifier && c.top.length > 0 && c.unique < present) {
      const share = c.top[0].count / present
      if (share >= 0.5 && c.unique > 1)
        out.push(`'${c.name}'은(는) '${c.top[0].value}' 값이 ${percent(c.top[0].count, present)}%로 대부분을 차지합니다.`)
      else if (c.unique <= 30)
        out.push(`'${c.name}'에는 ${c.unique}개 범주가 있으며, 가장 많은 값은 '${c.top[0].value}' (${c.top[0].count}건)입니다.`)
    } else if (c.type === 'date') {
      const days = Math.round((c.max.getTime() - c.min.getTime()) / 86_400_000)
      out.push(`'${c.name}'은(는) ${formatDate(c.min)}부터 ${formatDate(c.max)}까지 ${days.toLocaleString()}일 기간을 다룹니다.`)
    } else if (c.type === 'empty' && a.rowCount > 0) {
      out.push(`'${c.name}' 열은 완전히 비어 있습니다.`)
    }
  }

  for (const cor of a.correlations.filter((c) => Math.abs(c.r) >= 0.7).slice(0, 5)) {
    const dir = cor.r > 0 ? '함께 증가하는' : '반대로 움직이는'
    out.push(`'${cor.a}'와(과) '${cor.b}'는 ${dir} 강한 상관관계가 있습니다 (r = ${cor.r.toFixed(2)}).`)
  }

  return out
}

export function analyze(sheet: Pick<Sheet, 'columns' | 'rows'>): Analysis {
  const { rows, columns } = sheet
  const profiles = columns.map((name) => profileColumn(name, rows))
  const seen = new Set<string>()
  let duplicateRows = 0
  for (const r of rows) {
    const key = JSON.stringify(columns.map((c) => r[c]))
    if (seen.has(key)) duplicateRows++
    else seen.add(key)
  }
  const base = {
    rowCount: rows.length,
    columnCount: columns.length,
    missingCells: profiles.reduce((s, p) => s + p.missing, 0),
    duplicateRows,
    columns: profiles,
    correlations: correlations(rows, profiles.filter((p): p is NumberProfile => p.type === 'number')),
  }
  return { ...base, insights: buildInsights(base) }
}

export type Aggregation = 'count' | 'sum' | 'mean' | 'max' | 'min'

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  count: '개수',
  sum: '합계',
  mean: '평균',
  max: '최대',
  min: '최소',
}

export function groupBy(rows: Row[], key: string, value: string | null, agg: Aggregation) {
  const groups = new Map<string, number[]>()
  for (const r of rows) {
    const k = isMissing(r[key]) ? '(비어 있음)' : formatCell(r[key]).trim()
    if (!groups.has(k)) groups.set(k, [])
    if (value === null) groups.get(k)!.push(1)
    else {
      const n = toNumber(r[value])
      if (n !== null) groups.get(k)!.push(n)
    }
  }
  const reduce = (xs: number[]) => {
    if (agg === 'count') return xs.length
    if (xs.length === 0) return 0
    if (agg === 'sum') return xs.reduce((a, b) => a + b, 0)
    if (agg === 'mean') return xs.reduce((a, b) => a + b, 0) / xs.length
    if (agg === 'max') return xs.reduce((a, b) => Math.max(a, b))
    return xs.reduce((a, b) => Math.min(a, b))
  }
  return [...groups].map(([group, xs]) => ({ group, value: reduce(xs) })).sort((a, b) => b.value - a.value)
}
