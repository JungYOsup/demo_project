import type { Analysis } from '../lib/analyze'

export function Overview({ analysis, rowLabel = '행' }: { analysis: Analysis; rowLabel?: string }) {
  const cells = analysis.rowCount * analysis.columnCount
  const tiles = [
    { label: rowLabel, value: analysis.rowCount.toLocaleString() },
    { label: '열', value: analysis.columnCount.toLocaleString() },
    { label: '빈 셀 비율', value: cells === 0 ? '-' : `${((analysis.missingCells / cells) * 100).toFixed(1)}%` },
    { label: '중복 행', value: analysis.duplicateRows.toLocaleString() },
  ]
  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div key={t.label} className="tile">
          <div className="tile-label">{t.label}</div>
          <div className="tile-value">{t.value}</div>
        </div>
      ))}
    </div>
  )
}
