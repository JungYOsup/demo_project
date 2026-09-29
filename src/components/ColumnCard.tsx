import { formatDate, formatNumber, type ColumnProfile } from '../lib/analyze'
import { HorizontalBars, VerticalBars } from './charts'

const TYPE_LABELS: Record<ColumnProfile['type'], string> = {
  number: '숫자',
  date: '날짜',
  text: '텍스트',
  boolean: '예/아니오',
  empty: '비어 있음',
}

function Stats({ items }: { items: [string, string][] }) {
  return (
    <dl className="stats">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ColumnCard({ column: c }: { column: ColumnProfile }) {
  const present = c.total - c.missing
  const missingPct = c.total === 0 ? 0 : Math.round((c.missing / c.total) * 100)

  return (
    <section className="card column-card">
      <header className="card-header">
        <h3 title={c.name}>{c.name}</h3>
        <span className="badge">{TYPE_LABELS[c.type]}</span>
      </header>
      <p className="muted small">
        값 {present.toLocaleString()}개 · 빈 칸 {c.missing.toLocaleString()}개 ({missingPct}%) · 고유값 {c.unique.toLocaleString()}개
      </p>

      {c.type === 'number' && (
        <>
          <Stats
            items={[
              ['합계', formatNumber(c.sum)],
              ['평균', formatNumber(c.mean)],
              ['중앙값', formatNumber(c.median)],
              ['표준편차', formatNumber(c.std)],
              ['최소', formatNumber(c.min)],
              ['최대', formatNumber(c.max)],
            ]}
          />
          <VerticalBars data={c.histogram} />
          {c.outliers > 0 && <p className="muted small">IQR 기준 이상치 {c.outliers}개</p>}
        </>
      )}

      {c.type === 'date' && (
        <>
          <Stats
            items={[
              ['시작', formatDate(c.min)],
              ['끝', formatDate(c.max)],
            ]}
          />
          {c.byMonth.length > 1 && <VerticalBars data={c.byMonth} />}
        </>
      )}

      {(c.type === 'text' || c.type === 'boolean') &&
        (c.isIdentifier ? (
          <p className="muted small">모든 값이 서로 다릅니다 (이름·연락처·ID·자유기입처럼 값마다 고유한 열).</p>
        ) : (
          <HorizontalBars data={c.top.map((t) => ({ label: t.value, value: t.count }))} />
        ))}
    </section>
  )
}
