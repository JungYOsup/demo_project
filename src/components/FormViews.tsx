import { formatCell, isMissing } from '../lib/analyze'
import { completionRates, freeTextColumns, FILE_COLUMN, type FormEntry } from '../lib/form'
import type { Row, Sheet } from '../lib/parse'
import { HorizontalBars } from './charts'

/** 양식이 하나뿐일 때: 항목과 작성 내용을 그대로 보여준다 */
export function SingleForm({ sheet, entries }: { sheet: Sheet; entries: FormEntry[] }) {
  const blank = entries.filter((e) => isMissing(e.value)).length
  return (
    <section className="card">
      <header className="card-header">
        <h2>{sheet.fileName}</h2>
        <span className="muted small">
          {entries.length}개 항목 중 {entries.length - blank}개 작성
        </span>
      </header>
      <dl className="form-entries">
        {entries.map((e) => (
          <div key={e.label}>
            <dt>{e.label}</dt>
            <dd>{isMissing(e.value) ? <span className="pill">미작성</span> : formatCell(e.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">여러 신청서 파일을 함께 올리면 한 표로 합쳐서 항목별 작성률, O/X 비율, 분포를 요약해 드립니다.</p>
    </section>
  )
}

/** 여러 양식을 합친 뒤의 양식 전용 요약: 항목별 작성률 + 자유기입 응답 모음 */
export function FormSummary({ merged }: { merged: Pick<Sheet, 'columns' | 'rows'> }) {
  const rates = completionRates(merged)
  const freeText = freeTextColumns(merged)
  return (
    <>
      <section className="card">
        <header className="card-header">
          <h2>항목별 작성률</h2>
        </header>
        <HorizontalBars data={rates} valueLabel="작성률" suffix="%" max={100} />
      </section>
      {freeText.map((col) => {
        const answers = merged.rows.filter((r: Row) => !isMissing(r[col]))
        return (
          <section key={col} className="card">
            <header className="card-header">
              <h2>{col}</h2>
              <span className="muted small">
                {answers.length}건 / {merged.rows.length}건
              </span>
            </header>
            {answers.length === 0 ? (
              <p className="muted">작성된 내용이 없습니다.</p>
            ) : (
              <ul className="responses">
                {answers.map((r, i) => (
                  <li key={i}>
                    <span className="muted small">{formatCell(r[FILE_COLUMN])}</span>
                    <p>{formatCell(r[col])}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </>
  )
}
