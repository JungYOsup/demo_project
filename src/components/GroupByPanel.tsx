import { useMemo, useState } from 'react'
import { AGGREGATION_LABELS, formatNumber, groupBy, type Aggregation, type Analysis } from '../lib/analyze'
import type { Row } from '../lib/parse'
import { HorizontalBars } from './charts'

const MAX_GROUPS = 15

export function GroupByPanel({ rows, analysis }: { rows: Row[]; analysis: Analysis }) {
  const categories = analysis.columns.filter(
    (c) => (c.type === 'text' || c.type === 'boolean' || c.type === 'date') && c.unique > 1 && c.unique <= 200 && !('isIdentifier' in c && c.isIdentifier),
  )
  const numbers = analysis.columns.filter((c) => c.type === 'number')

  const [key, setKey] = useState(categories[0]?.name ?? '')
  const [value, setValue] = useState<string>('')
  const [agg, setAgg] = useState<Aggregation>('count')

  const effectiveKey = categories.some((c) => c.name === key) ? key : (categories[0]?.name ?? '')
  const effectiveValue = numbers.some((c) => c.name === value) ? value : ''
  const effectiveAgg: Aggregation = effectiveValue === '' ? 'count' : agg

  const result = useMemo(
    () => (effectiveKey ? groupBy(rows, effectiveKey, effectiveValue || null, effectiveAgg) : []),
    [rows, effectiveKey, effectiveValue, effectiveAgg],
  )

  if (categories.length === 0) return null

  const shown = result.slice(0, MAX_GROUPS)
  const rest = result.slice(MAX_GROUPS)
  if (rest.length > 0) {
    const restValue =
      effectiveAgg === 'count' || effectiveAgg === 'sum' ? rest.reduce((s, r) => s + r.value, 0) : NaN
    if (!Number.isNaN(restValue)) shown.push({ group: `기타 ${rest.length}개`, value: restValue })
  }
  const valueLabel = effectiveValue ? `${effectiveValue} ${AGGREGATION_LABELS[effectiveAgg]}` : '건수'

  return (
    <section className="card">
      <header className="card-header">
        <h2>그룹별 집계</h2>
      </header>
      <div className="controls">
        <label>
          기준 열
          <select value={effectiveKey} onChange={(e) => setKey(e.target.value)}>
            {categories.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          값
          <select value={effectiveValue} onChange={(e) => setValue(e.target.value)}>
            <option value="">(행 개수)</option>
            {numbers.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          집계
          <select value={effectiveAgg} disabled={!effectiveValue} onChange={(e) => setAgg(e.target.value as Aggregation)}>
            {(Object.keys(AGGREGATION_LABELS) as Aggregation[])
              .filter((a) => effectiveValue || a === 'count')
              .map((a) => (
                <option key={a} value={a}>
                  {AGGREGATION_LABELS[a]}
                </option>
              ))}
          </select>
        </label>
      </div>
      <HorizontalBars data={shown.map((r) => ({ label: r.group, value: r.value }))} valueLabel={valueLabel} />
      {rest.length > 0 && effectiveAgg !== 'count' && effectiveAgg !== 'sum' && (
        <p className="muted small">상위 {MAX_GROUPS}개 그룹만 표시합니다 (전체 {result.length}개).</p>
      )}
      <details>
        <summary>표로 보기</summary>
        <table className="table">
          <thead>
            <tr>
              <th>{effectiveKey}</th>
              <th className="num">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {result.map((r) => (
              <tr key={r.group}>
                <td>{r.group}</td>
                <td className="num">{formatNumber(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
