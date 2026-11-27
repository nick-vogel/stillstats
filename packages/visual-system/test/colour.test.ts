import { describe, expect, test } from 'vitest'
import {
  avoidedColoursNear,
  coloursIn,
  declarationsIn,
  hexToOklab,
  isPureWhite,
  isWarmTinted,
} from './colour.ts'

// The visual system's colour rules pass vacuously if these readings are wrong, so each is pinned to
// colours whose answer is known.
describe('the colour rules', () => {
  test('anthropic.com ivory, nlvogel paper, cream, beige and sepia read as warm-tinted', () => {
    for (const hex of ['#faf9f5', '#f0eee6', '#f2efe7', '#fffdd0', '#f5f5dc', '#704214']) {
      expect({ hex, warm: isWarmTinted(hexToOklab(hex)) }).toEqual({ hex, warm: true })
    }
  })

  test('a neutral gray and a cool purple-gray do not read as warm-tinted', () => {
    for (const hex of ['#ffffff', '#808080', '#f3f2f8', '#25232e']) {
      expect({ hex, warm: isWarmTinted(hexToOklab(hex)) }).toEqual({ hex, warm: false })
    }
  })

  test('only an untinted white reads as pure white', () => {
    const readings = ['#ffffff', '#fffffe', '#faf9f5', '#f8f8fc'].map((hex) => ({
      hex,
      pureWhite: isPureWhite(hexToOklab(hex)),
    }))

    expect(readings).toEqual([
      { hex: '#ffffff', pureWhite: true },
      { hex: '#fffffe', pureWhite: false },
      { hex: '#faf9f5', pureWhite: false },
      { hex: '#f8f8fc', pureWhite: false },
    ])
  })

  test('an avoided colour, or one a glance away, sits too close to it, and pure white to none', () => {
    const readings = ['#faf9f5', '#f8f7f3', '#5850ec', '#ffffff', '#3a7d2c'].map((hex) => ({
      hex,
      near: avoidedColoursNear(hexToOklab(hex)),
    }))

    expect(readings).toEqual([
      { hex: '#faf9f5', near: expect.arrayContaining(['#faf9f5']) },
      { hex: '#f8f7f3', near: expect.arrayContaining(['#faf9f5']) },
      { hex: '#5850ec', near: ['#5850ec'] },
      { hex: '#ffffff', near: [] },
      { hex: '#3a7d2c', near: [] },
    ])
  })

  test('hex and oklch() spellings of one colour read alike', () => {
    const [hex, ...oklchs] = coloursIn(
      '#827dbd oklch(0.6199 0.0956 286.83) oklch(61.99% 23.9% 286.83)',
    )

    for (const oklch of oklchs) {
      expect(oklch.oklab.l).toBeCloseTo(hex?.oklab.l ?? 0, 3)
      expect(oklch.oklab.a).toBeCloseTo(hex?.oklab.a ?? 0, 3)
      expect(oklch.oklab.b).toBeCloseTo(hex?.oklab.b ?? 0, 3)
    }
  })

  test('a colour function the rules cannot read throws instead of passing unseen', () => {
    for (const written of ['rgb(130 125 189)', 'hsl(250 20% 50%)']) {
      expect(() => coloursIn(`.a{color:${written}}`)).toThrow(/cannot read (rgb|hsl)\(/)
    }
  })

  test('a colour keyword in a declaration value or an SVG colour attribute throws', () => {
    for (const css of ['.a{background:ivory}', '.a{color:Canvas;}', '<path fill="beige"/>']) {
      expect(() => coloursIn(css)).toThrow(/cannot read (ivory|Canvas|beige)\./)
    }
  })

  test('a colour keyword outside a declaration value is not read as a colour', () => {
    const css = [
      '/* ivory */ .white:hover{--white:#123456;color:var(--white)}',
      '@font-face{font-family:Ivory Sans;src:url(/fonts/beige.woff2)}',
      `.a{font:400 1rem 'Snow';background-image:url("data:image/svg+xml,%3Csvg id='ivory'/%3E")}`,
      '@media (prefers-color-scheme:white){.b{color:transparent}}',
    ].join('')

    expect(coloursIn(css).map(({ written }) => written)).toEqual(['#123456'])
  })

  test('each declaration carries the colours its own value writes', () => {
    const declarations = declarationsIn(
      '.a{background:#fff;color:oklch(50% .1 200)}.b:hover{--bg:#000}',
    ).map(({ property, colours }) => ({ property, written: colours.map(({ written }) => written) }))

    expect(declarations).toEqual([
      { property: 'background', written: ['#fff'] },
      { property: 'color', written: ['oklch(50% .1 200)'] },
      { property: '--bg', written: ['#000'] },
    ])
  })
})
