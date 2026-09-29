import * as XLSX from 'xlsx'

export type Cell = string | number | boolean | Date | null
export type Row = Record<string, Cell>

export interface Sheet {
  /** 화면에 표시할 이름 (여러 파일이면 "파일명 · 시트명") */
  name: string
  fileName: string
  columns: string[]
  rows: Row[]
  /** 헤더 해석 전의 원본 2차원 배열 (양식 감지용) */
  grid: Cell[][]
}

export async function parseFile(file: File, multiFile: boolean): Promise<Sheet[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })

  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName]
    // defval: null 이면 모든 행이 헤더의 모든 키를 같은 순서로 가진다
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null, raw: true })
    const grid = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null, raw: true, blankrows: false })
    return {
      name: multiFile ? `${file.name} · ${sheetName}` : sheetName,
      fileName: file.name,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows,
      grid,
    }
  })
}

export function downloadSheet(sheet: Pick<Sheet, 'columns' | 'rows'>, fileName: string) {
  const ws = XLSX.utils.json_to_sheet(sheet.rows, { header: sheet.columns })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, fileName)
}
