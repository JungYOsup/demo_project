import { describe, expect, it } from 'vitest'
import { analyze, formatCell, formatDate, formatNumber, groupBy, isMissing, toNumber } from './analyze'
import type { Cell, Row } from './parse'

/** 한 열짜리 시트를 분석해 그 열의 프로파일을 돌려준다 */
const profile = (values: Cell[]) => analyze({ columns: ['a'], rows: values.map((a) => ({ a })) }).columns[0]

/** x = 1..n, y = f(x) 인 두 숫자 열 */
const pairs = (n: number, f: (x: number) => number): Row[] => Array.from({ length: n }, (_, i) => ({ x: i + 1, y: f(i + 1) }))

describe('toNumber', () => {
  it('쉼표·통화 기호·퍼센트가 붙은 문자열을 숫자로 인식한다', () => {
    expect(toNumber('1,234')).toBe(1234)
    expect(toNumber('₩5,000')).toBe(5000)
    expect(toNumber('$1,000')).toBe(1000)
    expect(toNumber('12%')).toBe(0.12)
    expect(toNumber(' 12 % ')).toBe(0.12)
    expect(toNumber('0')).toBe(0)
    expect(toNumber('0.5')).toBe(0.5)
    expect(toNumber('-3')).toBe(-3)
    expect(toNumber(42)).toBe(42)
  })

  it('0으로 시작하거나 숫자-숫자 하이픈이 있는 값(전화번호·사번)은 숫자가 아니다', () => {
    expect(toNumber('010-1234-5678')).toBeNull()
    expect(toNumber('0123')).toBeNull()
    expect(toNumber('2024-01')).toBeNull()
  })

  it('빈 문자열·유한하지 않은 값·숫자가 아닌 타입은 null', () => {
    expect(toNumber('')).toBeNull()
    expect(toNumber('abc')).toBeNull()
    expect(toNumber(NaN)).toBeNull()
    expect(toNumber(Infinity)).toBeNull()
    expect(toNumber(true)).toBeNull()
    expect(toNumber(new Date())).toBeNull()
    expect(toNumber(null)).toBeNull()
  })
})

describe('isMissing', () => {
  it('null과 공백 문자열만 빈 값이다', () => {
    expect(isMissing(null)).toBe(true)
    expect(isMissing('   ')).toBe(true)
    expect(isMissing(0)).toBe(false)
    expect(isMissing(false)).toBe(false)
    expect(isMissing('x')).toBe(false)
  })
})

describe('타입 감지', () => {
  it('비어 있지 않은 값의 90% 이상이 숫자면 number', () => {
    expect(profile([1, 2, 3, 4, 5, 6, 7, 8, 9, 'abc']).type).toBe('number')
    expect(profile([1, 2, 3, 4, 5, 6, 7, 8, 'abc', 'def']).type).toBe('text')
  })

  it('빈 값은 비율 계산에서 제외한다', () => {
    expect(profile([1, 2, null, '  ', 3]).type).toBe('number')
  })

  it('한/영 예·아니오 표현을 boolean으로 인식한다', () => {
    expect(profile(['O', 'X', 'o']).type).toBe('boolean')
    expect(profile(['예', '아니오', '네', '아니요']).type).toBe('boolean')
    expect(profile(['y', 'N', 'Yes', 'no', true, false]).type).toBe('boolean')
    expect(profile(['ㅇ', '○', '×']).type).toBe('boolean')
  })

  it('Date 값은 date', () => {
    expect(profile([new Date(2024, 0, 1), new Date(2024, 1, 1)]).type).toBe('date')
  })

  it('모든 값이 비어 있으면 empty', () => {
    expect(profile([null, '', ' ']).type).toBe('empty')
  })
})

describe('숫자 열 프로파일', () => {
  it('합계·평균·중앙값·최소·최대와 IQR 1.5배 이상치를 계산한다', () => {
    const p = profile([1, 2, 3, 4, 100])
    if (p.type !== 'number') throw new Error('number 타입이어야 함')
    expect(p).toMatchObject({ sum: 110, mean: 22, median: 3, min: 1, max: 100, outliers: 1 })
  })

  it('표준편차는 모표준편차다', () => {
    const p = profile([2, 4, 4, 4, 5, 5, 7, 9])
    if (p.type !== 'number') throw new Error('number 타입이어야 함')
    expect(p.std).toBe(2)
  })

  it('문자열 숫자도 값으로 집계한다', () => {
    const p = profile(['1,000', '₩2,000', 3000])
    if (p.type !== 'number') throw new Error('number 타입이어야 함')
    expect(p.sum).toBe(6000)
  })

  it('모든 값이 같으면 히스토그램 구간은 하나', () => {
    const p = profile([5, 5, 5])
    if (p.type !== 'number') throw new Error('number 타입이어야 함')
    expect(p.histogram).toHaveLength(1)
    expect(p.histogram[0].count).toBe(3)
  })

  it('히스토그램은 5~20개 구간이며 모든 값을 담는다', () => {
    const small = profile([1, 2, 3, 4, 5])
    const large = profile(Array.from({ length: 300_000 }, (_, i) => i))
    if (small.type !== 'number' || large.type !== 'number') throw new Error('number 타입이어야 함')
    expect(small.histogram).toHaveLength(5)
    expect(large.histogram).toHaveLength(20)
    expect(large.histogram.reduce((s, b) => s + b.count, 0)).toBe(300_000)
    expect(small.histogram[small.histogram.length - 1].count).toBeGreaterThan(0)
  })
})

describe('날짜 열 프로파일', () => {
  it('최소·최대와 월별 개수(오름차순)를 계산한다', () => {
    const p = profile([new Date(2024, 1, 10), new Date(2024, 0, 31), new Date(2024, 0, 1)])
    if (p.type !== 'date') throw new Error('date 타입이어야 함')
    expect(formatDate(p.min)).toBe('2024-01-01')
    expect(formatDate(p.max)).toBe('2024-02-10')
    expect(p.byMonth).toEqual([
      { label: '2024-01', count: 2 },
      { label: '2024-02', count: 1 },
    ])
  })
})

describe('텍스트·예아니오 열 프로파일', () => {
  it('값이 3개 이상이고 모두 다르면 식별자 열이다', () => {
    const at = (values: Cell[]) => {
      const p = profile(values)
      if (p.type !== 'text') throw new Error('text 타입이어야 함')
      return p.isIdentifier
    }
    expect(at(['김철수', '이영희', '박민수'])).toBe(true)
    expect(at(['김철수', '이영희'])).toBe(false)
    expect(at(['서울', '서울', '부산'])).toBe(false)
  })

  it('상위 값은 개수 내림차순 최대 10개', () => {
    const values = Array.from({ length: 12 }, (_, i) => [`v${i}`, `v${i}`]).flat()
    const p = profile(['top', 'top', 'top', ...values])
    if (p.type !== 'text') throw new Error('text 타입이어야 함')
    expect(p.top).toHaveLength(10)
    expect(p.top[0]).toEqual({ value: 'top', count: 3 })
  })

  it('boolean 열은 예/O 쪽 개수를 센다', () => {
    const p = profile(['O', 'X', '예', '아니오', true])
    if (p.type !== 'boolean') throw new Error('boolean 타입이어야 함')
    expect(p.positive).toBe(3)
  })
})

describe('analyze', () => {
  it('완전히 동일한 중복 행 수를 센다', () => {
    const a = analyze({
      columns: ['a', 'b'],
      rows: [
        { a: 1, b: 2 },
        { a: 1, b: 2 },
        { a: 1, b: 3 },
      ],
    })
    expect(a.duplicateRows).toBe(1)
    expect(a.insights).toContain('완전히 동일한 중복 행이 1개 있습니다.')
  })

  it('두 열 모두 숫자인 행이 5개 이상일 때만 상관계수를 계산한다', () => {
    expect(analyze({ columns: ['x', 'y'], rows: pairs(4, (x) => x * 2) }).correlations).toEqual([])
    const [c] = analyze({ columns: ['x', 'y'], rows: pairs(5, (x) => x * 2) }).correlations
    expect(c.r).toBeCloseTo(1)
  })

  it('한쪽 분산이 0이면 상관계수는 0', () => {
    expect(analyze({ columns: ['x', 'y'], rows: pairs(5, () => 7) }).correlations[0].r).toBe(0)
  })
})

describe('인사이트', () => {
  it('첫 줄은 항상 전체 크기 요약이다 (양식 모드가 slice(1)로 대체함)', () => {
    const cases = [
      analyze({ columns: [], rows: [] }),
      analyze({ columns: ['a', 'b'], rows: [{ a: 1, b: null }] }),
      analyze({ columns: ['x', 'y'], rows: pairs(5, (x) => -x) }),
    ]
    for (const a of cases) expect(a.insights[0]).toMatch(/^총 [\d,]+행 × \d+열 데이터입니다/)
    expect(cases[1].insights[0]).toBe('총 1행 × 2열 데이터입니다 (숫자 1, 텍스트 0, 예/아니오 0, 날짜 0열).')
  })

  it('빈 셀 비율과 가장 많이 빈 열을 알려준다', () => {
    const a = analyze({
      columns: ['a', 'b'],
      rows: [
        { a: 1, b: 1 },
        { a: null, b: 2 },
        { a: 3, b: 3 },
        { a: 4, b: 4 },
      ],
    })
    expect(a.insights[1]).toBe("전체 셀의 12.5%가 비어 있으며, 'a' 열이 가장 많이 비어 있습니다 (1개, 25%).")
  })

  it('빈 셀이 없으면 깔끔한 데이터라고 말한다', () => {
    expect(analyze({ columns: ['a'], rows: [{ a: 1 }] }).insights[1]).toBe('빈 셀이 없는 깔끔한 데이터입니다.')
  })

  it('평균과 중앙값 차이가 ±0.2σ를 넘으면 치우침을 설명한다', () => {
    const line = (values: number[]) => analyze({ columns: ['a'], rows: values.map((a) => ({ a })) }).insights.find((l) => l.startsWith("'a'"))!
    expect(line([1, 2, 3, 4, 100])).toContain('평균을 끌어올리고')
    expect(line([-100, 1, 2, 3, 4])).toContain('평균을 끌어내리고')
    expect(line([1, 2, 3, 4, 5])).not.toContain('평균을 끌어')
  })

  it('예/아니오 열은 예 비율을 알려준다', () => {
    const a = analyze({ columns: ['동의'], rows: ['O', 'X', 'O', 'X'].map((v) => ({ 동의: v })) })
    expect(a.insights).toContain("'동의': 응답 4건 중 2건(50%)이 '예/O'입니다.")
  })

  it('텍스트 열은 우세한 값이나 범주 수를 알려준다', () => {
    const texts = (values: string[]) => analyze({ columns: ['a'], rows: values.map((a) => ({ a })) }).insights
    expect(texts(['A', 'A', 'A', 'B'])).toContain("'a'은(는) 'A' 값이 75%로 대부분을 차지합니다.")
    expect(texts(['A', 'A', 'B', 'B', 'C'])).toContain("'a'에는 3개 범주가 있으며, 가장 많은 값은 'A' (2건)입니다.")
    expect(texts(['김', '이', '박']).some((l) => l.startsWith("'a'"))).toBe(false)
  })

  it('날짜 열은 기간을 알려준다', () => {
    const a = analyze({ columns: ['d'], rows: [{ d: new Date(2024, 0, 1) }, { d: new Date(2024, 1, 10) }] })
    expect(a.insights).toContain("'d'은(는) 2024-01-01부터 2024-02-10까지 40일 기간을 다룹니다.")
  })

  it('완전히 빈 열을 알려준다', () => {
    expect(analyze({ columns: ['a'], rows: [{ a: null }] }).insights).toContain("'a' 열은 완전히 비어 있습니다.")
  })

  it('|r| ≥ 0.7인 상관관계를 방향과 함께 최대 5개 알려준다', () => {
    expect(analyze({ columns: ['x', 'y'], rows: pairs(5, (x) => x * 2) }).insights).toContain(
      "'x'와(과) 'y'는 함께 증가하는 강한 상관관계가 있습니다 (r = 1.00).",
    )
    expect(analyze({ columns: ['x', 'y'], rows: pairs(5, (x) => -x) }).insights).toContain(
      "'x'와(과) 'y'는 반대로 움직이는 강한 상관관계가 있습니다 (r = -1.00).",
    )
    const columns = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']
    const rows = Array.from({ length: 5 }, (_, i) => Object.fromEntries(columns.map((c, j) => [c, (i + 1) * (j + 1)])))
    expect(analyze({ columns, rows }).insights.filter((l) => l.includes('상관관계'))).toHaveLength(5)
  })
})

describe('포맷터', () => {
  it('formatNumber: 100 이상은 소수점 없이, 아주 크거나 작으면 지수 표기', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1234.567)).toBe('1,235')
    expect(formatNumber(-1500)).toBe('-1,500')
    expect(formatNumber(12.3456)).toBe('12.35')
    expect(formatNumber(1e12)).toBe('1.00e+12')
    expect(formatNumber(0.0005)).toBe('5.00e-4')
    expect(formatNumber(NaN)).toBe('-')
    expect(formatNumber(Infinity)).toBe('-')
  })

  it('formatDate: 로컬 날짜 기준이라 자정이 전날로 밀리지 않는다', () => {
    expect(formatDate(new Date(2024, 0, 1, 0, 0, 0))).toBe('2024-01-01')
    expect(formatDate(new Date(2024, 11, 31, 23, 59))).toBe('2024-12-31')
  })

  it('formatCell: 타입별로 알맞은 포맷터를 쓴다', () => {
    expect(formatCell(null)).toBe('')
    expect(formatCell(1234)).toBe('1,234')
    expect(formatCell(new Date(2024, 4, 5))).toBe('2024-05-05')
    expect(formatCell(true)).toBe('true')
    expect(formatCell('abc')).toBe('abc')
  })
})

describe('groupBy', () => {
  const rows: Row[] = [
    { k: 'A', v: 10 },
    { k: 'A', v: 20 },
    { k: 'B', v: 5 },
    { k: null, v: 1 },
    { k: '  ', v: 'x' },
  ]

  it('값 열이 없으면 행 개수를 세고, 빈 값은 (비어 있음)으로 모은다', () => {
    expect(groupBy(rows, 'k', null, 'count')).toEqual([
      { group: 'A', value: 2 },
      { group: '(비어 있음)', value: 2 },
      { group: 'B', value: 1 },
    ])
  })

  it('숫자가 아닌 값은 집계에서 빠진다', () => {
    expect(groupBy(rows, 'k', 'v', 'count')).toEqual([
      { group: 'A', value: 2 },
      { group: 'B', value: 1 },
      { group: '(비어 있음)', value: 1 },
    ])
  })

  it('합계·평균·최대·최소를 계산하고 값 내림차순으로 정렬한다', () => {
    const toMap = (agg: Parameters<typeof groupBy>[3]) => Object.fromEntries(groupBy(rows, 'k', 'v', agg).map((g) => [g.group, g.value]))
    expect(toMap('sum')).toEqual({ A: 30, B: 5, '(비어 있음)': 1 })
    expect(toMap('mean')).toEqual({ A: 15, B: 5, '(비어 있음)': 1 })
    expect(toMap('max')).toEqual({ A: 20, B: 5, '(비어 있음)': 1 })
    expect(toMap('min')).toEqual({ A: 10, B: 5, '(비어 있음)': 1 })
    expect(groupBy(rows, 'k', 'v', 'sum').map((g) => g.value)).toEqual([30, 5, 1])
  })

  it('숫자가 하나도 없는 그룹은 0', () => {
    expect(groupBy([{ k: 'C', v: 'x' }], 'k', 'v', 'max')).toEqual([{ group: 'C', value: 0 }])
  })
})
