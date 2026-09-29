import { useMemo, useState } from 'react'
import { analyze } from './lib/analyze'
import { formInsights, looksLikeForm, mergeForms, toFormEntries, type FormEntry } from './lib/form'
import { downloadSheet, parseFile, type Sheet } from './lib/parse'
import { Dropzone } from './components/Dropzone'
import { Overview } from './components/Overview'
import { Insights } from './components/Insights'
import { GroupByPanel } from './components/GroupByPanel'
import { ColumnCard } from './components/ColumnCard'
import { DataPreview } from './components/DataPreview'
import { FormSummary, SingleForm } from './components/FormViews'

interface Entry {
  id: string
  sheet: Sheet
  entries: FormEntry[]
  mode: 'form' | 'table'
}

const FORMS_TAB = '__forms'

function TableAnalysis({ sheet, onAsForm }: { sheet: Sheet; onAsForm: () => void }) {
  const analysis = useMemo(() => analyze(sheet), [sheet])
  if (sheet.rows.length === 0)
    return (
      <p className="empty">
        이 시트에는 분석할 데이터가 없습니다.{' '}
        <button className="link" onClick={onAsForm}>
          양식으로 보기
        </button>
      </p>
    )
  return (
    <>
      <div className="toolbar">
        <button className="link" onClick={onAsForm}>
          '항목 | 내용' 양식으로 보기
        </button>
      </div>
      <Overview analysis={analysis} />
      <Insights lines={analysis.insights} />
      <GroupByPanel rows={sheet.rows} analysis={analysis} />
      <div className="column-grid">
        {analysis.columns.map((c) => (
          <ColumnCard key={c.name} column={c} />
        ))}
      </div>
      <DataPreview columns={sheet.columns} rows={sheet.rows} />
    </>
  )
}

function FormsAnalysis({ forms, onAsTable }: { forms: Entry[]; onAsTable: (id: string) => void }) {
  const merged = useMemo(() => mergeForms(forms), [forms])
  const analysis = useMemo(() => analyze(merged), [merged])

  const sources = (
    <details className="card sources">
      <summary>포함된 양식 {forms.length}개</summary>
      <ul>
        {forms.map((f) => (
          <li key={f.id}>
            <span>{f.sheet.name}</span>
            <button className="link" onClick={() => onAsTable(f.id)}>
              표로 보기
            </button>
          </li>
        ))}
      </ul>
    </details>
  )

  if (forms.length === 1)
    return (
      <>
        <SingleForm sheet={forms[0].sheet} entries={forms[0].entries} />
        {sources}
      </>
    )

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={() => downloadSheet(merged, '신청서_모음.xlsx')}>
          합친 표 엑셀로 다운로드
        </button>
      </div>
      <Overview analysis={analysis} rowLabel="신청서" />
      <Insights lines={[...formInsights(merged), ...analysis.insights.slice(1)]} />
      <FormSummary merged={merged} />
      <GroupByPanel rows={merged.rows} analysis={analysis} />
      <div className="column-grid">
        {analysis.columns.slice(1).map((c) => (
          <ColumnCard key={c.name} column={c} />
        ))}
      </div>
      <DataPreview columns={merged.columns} rows={merged.rows} title="합친 표" />
      {sources}
    </>
  )
}

export default function App() {
  const [items, setItems] = useState<Entry[]>([])
  const [active, setActive] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (files: File[]) => {
    setLoading(true)
    setError(null)
    const failed: string[] = []
    const loaded: Entry[] = []
    for (const file of files) {
      try {
        const sheets = await parseFile(file, files.length > 1)
        sheets.forEach((sheet, i) =>
          loaded.push({
            id: `${file.name}#${i}`,
            sheet,
            entries: toFormEntries(sheet.grid),
            mode: looksLikeForm(sheet.grid) ? 'form' : 'table',
          }),
        )
      } catch {
        failed.push(file.name)
      }
    }
    setItems(loaded)
    setActive(loaded.some((e) => e.mode === 'form') ? FORMS_TAB : (loaded[0]?.id ?? ''))
    if (failed.length) setError(`읽을 수 없는 파일: ${failed.join(', ')}`)
    setLoading(false)
  }

  const setMode = (id: string, mode: Entry['mode']) => {
    const next = items.map((e) => (e.id === id ? { ...e, mode } : e))
    setItems(next)
    setActive(mode === 'form' ? FORMS_TAB : id)
  }

  const forms = useMemo(() => items.filter((e) => e.mode === 'form'), [items])
  const tables = items.filter((e) => e.mode === 'table')
  const tabs = [...(forms.length ? [{ id: FORMS_TAB, label: `신청서 모음 (${forms.length})` }] : []), ...tables.map((e) => ({ id: e.id, label: e.sheet.name }))]
  const current = tabs.some((t) => t.id === active) ? active : (tabs[0]?.id ?? '')
  const currentTable = tables.find((e) => e.id === current)

  return (
    <div className="app">
      <header className="app-header">
        <h1>엑셀 분석기</h1>
        {items.length > 0 && <Dropzone onFiles={load} compact />}
      </header>

      {items.length === 0 && !loading && <Dropzone onFiles={load} />}
      {loading && <p className="empty">파일을 읽는 중…</p>}
      {error && <p className="error">{error}</p>}

      {items.length > 0 && !loading && (
        <>
          {tabs.length > 1 && (
            <nav className="tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} role="tab" aria-selected={t.id === current} className="tab" onClick={() => setActive(t.id)}>
                  {t.label}
                </button>
              ))}
            </nav>
          )}
          <main className="content">
            {current === FORMS_TAB && <FormsAnalysis forms={forms} onAsTable={(id) => setMode(id, 'table')} />}
            {currentTable && <TableAnalysis key={currentTable.id} sheet={currentTable.sheet} onAsForm={() => setMode(currentTable.id, 'form')} />}
          </main>
        </>
      )}
    </div>
  )
}
