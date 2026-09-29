import { useState } from 'react'

export function Insights({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.map((l) => `• ${l}`).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시
    }
  }

  return (
    <section className="card">
      <header className="card-header">
        <h2>요약</h2>
        <button className="btn" onClick={copy}>
          {copied ? '복사됨' : '요약 복사'}
        </button>
      </header>
      <ul className="insights">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </section>
  )
}
