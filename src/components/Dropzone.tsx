import { useRef, useState } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  compact?: boolean
}

export function Dropzone({ onFiles, compact }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const open = () => input.current?.click()

  return (
    <div
      className={`dropzone${dragging ? ' dragging' : ''}${compact ? ' compact' : ''}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length > 0) onFiles([...e.dataTransfer.files])
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv,.ods"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files])
          e.target.value = ''
        }}
      />
      {compact ? (
        <span>다른 파일 열기</span>
      ) : (
        <>
          <strong>엑셀 파일을 끌어다 놓거나 클릭해서 선택하세요</strong>
          <span className="muted">여러 파일을 한 번에 올릴 수 있습니다 · .xlsx .xls .csv .ods</span>
          <span className="muted small">파일은 브라우저 안에서만 처리되며 어디로도 전송되지 않습니다.</span>
        </>
      )}
    </div>
  )
}
