import { formatCell } from '../lib/analyze'
import type { Row } from '../lib/parse'

const LIMIT = 100

export function DataPreview({ columns, rows, title = '데이터 미리보기' }: { columns: string[]; rows: Row[]; title?: string }) {
  return (
    <section className="card">
      <header className="card-header">
        <h2>{title}</h2>
        <span className="muted small">
          {rows.length > LIMIT ? `상위 ${LIMIT}행 / 전체 ${rows.length.toLocaleString()}행` : `${rows.length}행`}
        </span>
      </header>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th className="num">#</th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, LIMIT).map((r, i) => (
              <tr key={i}>
                <td className="num muted">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c} className={typeof r[c] === 'number' ? 'num' : undefined}>
                    {formatCell(r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
