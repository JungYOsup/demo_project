import { describe, expect, it } from 'vitest'
import { FILE_COLUMN, completionRates, formInsights, freeTextColumns, looksLikeForm, mergeForms, toFormEntries } from './form'
import type { FormEntry } from './form'
import type { Cell, Sheet } from './parse'

const sheetOf = (fileName: string): Sheet => ({ name: fileName, fileName, columns: [], rows: [], grid: [] })

/** 항목 n개짜리 세로형 양식 */
const formGrid = (n: number): Cell[][] => Array.from({ length: n }, (_, i) => [`항목${i + 1}`, `v${i + 1}`])

describe('toFormEntries', () => {
  it('헤더 행(항목 | 내용)은 건너뛴다', () => {
    expect(
      toFormEntries([
        ['항목', '내용'],
        ['이름', '홍길동'],
        ['나이', 30],
      ]),
    ).toEqual([
      { label: '이름', value: '홍길동' },
      { label: '나이', value: 30 },
    ])
  })

  it('비어 있는 앞 열은 무시하고 값이 있는 첫 두 열을 쓴다', () => {
    expect(
      toFormEntries([
        [null, '이름', null, '홍길동'],
        [null, '나이', null, 30],
      ]),
    ).toEqual([
      { label: '이름', value: '홍길동' },
      { label: '나이', value: 30 },
    ])
  })

  it('라벨은 trim하고, 라벨이 빈 행은 건너뛴다', () => {
    expect(
      toFormEntries([
        ['  이름 ', '홍길동'],
        [null, '고아 값'],
        ['나이', null],
      ]),
    ).toEqual([
      { label: '이름', value: '홍길동' },
      { label: '나이', value: null },
    ])
  })

  it('값 열이 없으면 value는 null', () => {
    expect(toFormEntries([['이름'], ['나이']])).toEqual([
      { label: '이름', value: null },
      { label: '나이', value: null },
    ])
  })

  it('값 칸 전체가 헤더 문구인 첫 행은 헤더로 본다', () => {
    for (const header of ['내용', '작성 내용', '답변란', '입력값', 'Answer']) {
      expect(toFormEntries([['질문', header], ['이름', '홍길동']])).toEqual([{ label: '이름', value: '홍길동' }])
      expect(toFormEntries([['신청 사유', header], ['이름', '홍길동']])).toEqual([{ label: '이름', value: '홍길동' }])
    }
  })

  it('빈 grid는 빈 배열', () => {
    expect(toFormEntries([])).toEqual([])
  })

  it('값에 헤더 단어가 포함된 첫 항목을 헤더로 오인하지 않는다', () => {
    expect(
      toFormEntries([
        ['진행 상태', '답변 대기 중'],
        ['이름', '홍길동'],
      ]),
    ).toHaveLength(2)
  })
})

describe('looksLikeForm', () => {
  it('항목 2~50개의 2열 grid는 양식이다', () => {
    expect(looksLikeForm(formGrid(1))).toBe(false)
    expect(looksLikeForm(formGrid(2))).toBe(true)
    expect(looksLikeForm(formGrid(50))).toBe(true)
    expect(looksLikeForm(formGrid(51))).toBe(false)
  })

  it('헤더 행은 항목 수에 넣지 않는다', () => {
    expect(looksLikeForm([['항목', '내용'], ...formGrid(2)])).toBe(true)
    expect(looksLikeForm([['항목', '내용'], ...formGrid(1)])).toBe(false)
  })

  it('값이 있는 열이 정확히 2개가 아니면 양식이 아니다', () => {
    expect(
      looksLikeForm([
        ['이름', '나이', '주소'],
        ['홍길동', 30, '서울'],
      ]),
    ).toBe(false)
  })

  it('라벨이 중복되거나 숫자면 양식이 아니다', () => {
    expect(
      looksLikeForm([
        ['이름', 'a'],
        ['이름', 'b'],
      ]),
    ).toBe(false)
    expect(
      looksLikeForm([
        [1, 'a'],
        [2, 'b'],
      ]),
    ).toBe(false)
  })
})

describe('mergeForms', () => {
  const forms: { sheet: Sheet; entries: FormEntry[] }[] = [
    {
      sheet: sheetOf('a.xlsx'),
      entries: [
        { label: '이름', value: '홍길동' },
        { label: '나이', value: 30 },
      ],
    },
    {
      sheet: sheetOf('b.xlsx'),
      entries: [
        { label: '이름', value: ' 김철수 ' },
        { label: '메모', value: '   ' },
      ],
    },
  ]

  it('1양식 = 1행, 첫 열은 파일명, 이후 열은 라벨이 처음 나온 순서', () => {
    const merged = mergeForms(forms)
    expect(merged.columns).toEqual([FILE_COLUMN, '이름', '나이', '메모'])
    expect(merged.rows).toEqual([
      { [FILE_COLUMN]: 'a.xlsx', 이름: '홍길동', 나이: 30, 메모: null },
      { [FILE_COLUMN]: 'b.xlsx', 이름: '김철수', 나이: null, 메모: null },
    ])
  })

  it('모든 행이 모든 열 키를 같은 순서로 가진다', () => {
    const merged = mergeForms(forms)
    for (const r of merged.rows) expect(Object.keys(r)).toEqual(merged.columns)
  })

  it("양식에 '파일명' 항목이 있어도 실제 파일명 열을 덮어쓰지 않는다", () => {
    const merged = mergeForms([{ sheet: sheetOf('a.xlsx'), entries: [{ label: FILE_COLUMN, value: '다른 이름' }] }])
    expect(new Set(merged.columns).size).toBe(merged.columns.length)
    expect(merged.rows[0][FILE_COLUMN]).toBe('a.xlsx')
    expect(merged.rows[0][`${FILE_COLUMN} (항목)`]).toBe('다른 이름')
  })
})

describe('freeTextColumns', () => {
  it('라벨에 기타/의견 등이 있거나 평균 15자 이상인 열을 자유기입으로 본다 (파일명 제외)', () => {
    const long = '가'.repeat(15)
    const sheet = {
      columns: [FILE_COLUMN, '이름', '기타 의견', '설명', '짧은 설명'],
      rows: [
        { [FILE_COLUMN]: long, 이름: '홍길동', '기타 의견': null, 설명: long, '짧은 설명': '가'.repeat(14) },
        { [FILE_COLUMN]: long, 이름: '김철수', '기타 의견': null, 설명: '  ', '짧은 설명': null },
      ],
    }
    expect(freeTextColumns(sheet)).toEqual(['기타 의견', '설명'])
  })
})

describe('completionRates / formInsights', () => {
  const sheet = {
    columns: [FILE_COLUMN, 'a', 'b'],
    rows: [
      { [FILE_COLUMN]: 'x.xlsx', a: '1', b: null },
      { [FILE_COLUMN]: 'y.xlsx', a: '2', b: '3' },
    ],
  }

  it('항목별 작성률(%)을 계산한다 (파일명 제외)', () => {
    expect(completionRates(sheet)).toEqual([
      { label: 'a', value: 100 },
      { label: 'b', value: 50 },
    ])
    expect(completionRates({ columns: ['a'], rows: [] })).toEqual([{ label: 'a', value: 0 }])
  })

  it('전체 건수, 완전 작성 건수, 가장 많이 빈 항목을 알려준다', () => {
    expect(formInsights(sheet)).toEqual([
      '신청서 2건을 하나의 표로 합쳤습니다. 모든 항목을 채운 신청서는 1건입니다.',
      "가장 많이 비어 있는 항목은 'b'입니다 (작성률 50%).",
    ])
  })

  it('모든 항목이 채워졌으면 빈 항목 문장은 없다', () => {
    const full = { columns: [FILE_COLUMN, 'a'], rows: [{ [FILE_COLUMN]: 'x.xlsx', a: '1' }] }
    expect(formInsights(full)).toEqual(['신청서 1건을 하나의 표로 합쳤습니다. 모든 항목을 채운 신청서는 1건입니다.'])
  })
})
