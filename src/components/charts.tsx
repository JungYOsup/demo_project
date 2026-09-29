import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '../lib/analyze'

const axisTick = { fill: 'var(--text-muted)', fontSize: 11 }

interface TooltipProps {
  active?: boolean
  payload?: readonly { value?: unknown; payload?: unknown }[]
  label?: unknown
  valueLabel: string
  suffix?: string
}

function ChartTooltip({ active, payload, label, valueLabel, suffix = '' }: TooltipProps) {
  if (!active || !payload?.length) return null
  const datum = payload[0].payload as { tooltipLabel?: string }
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{datum.tooltipLabel ?? String(label)}</div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-swatch" />
        {valueLabel}
        <strong>
          {formatNumber(Number(payload[0].value))}
          {suffix}
        </strong>
      </div>
    </div>
  )
}

interface VerticalBarsProps {
  data: { label: string; count: number; tooltipLabel?: string }[]
  valueLabel?: string
  height?: number
}

/** 히스토그램·월별 추이처럼 x축에 순서가 있는 막대 */
export function VerticalBars({ data, valueLabel = '건수', height = 160 }: VerticalBarsProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--baseline)' }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
        <Tooltip cursor={{ fill: 'var(--hover)' }} content={(p) => <ChartTooltip {...p} valueLabel={valueLabel} />} />
        <Bar dataKey="count" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface HorizontalBarsProps {
  data: { label: string; value: number }[]
  valueLabel?: string
  suffix?: string
  max?: number
}

/** 범주별 비교용 가로 막대. 막대 끝에 값을 직접 표기한다. */
export function HorizontalBars({ data, valueLabel = '건수', suffix = '', max }: HorizontalBarsProps) {
  const height = Math.max(80, data.length * 30 + 16)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide domain={[0, max ?? 'auto']} />
        <YAxis
          type="category"
          dataKey="label"
          width={132}
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--baseline)' }}
          tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + '…' : v)}
        />
        <Tooltip
          cursor={{ fill: 'var(--hover)' }}
          content={(p) => <ChartTooltip {...p} valueLabel={valueLabel} suffix={suffix} />}
        />
        <Bar
          dataKey="value"
          fill="var(--series-1)"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          label={{
            position: 'right',
            fill: 'var(--text-secondary)',
            fontSize: 11,
            formatter: (v: unknown) => formatNumber(Number(v)) + suffix,
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
