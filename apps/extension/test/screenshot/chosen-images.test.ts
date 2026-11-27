// Which store images a retake writes (creator-analytics#487): all of them, or only the ones named
// on the command line, so a retake of one image leaves the others as they were approved.
import { expect, test } from 'vitest'
import { chosenImagesOf } from './chosen-images.ts'

const files = ['1-latest-video-card.png', '4-popup.png', '5-first-run.png', 'small-promo-tile.png']

test('with no name given, every image is written', () => {
  expect(chosenImagesOf([], files)).toEqual(files)
})

test('with names given, only the named images are written', () => {
  expect(chosenImagesOf(['4-popup.png'], files)).toEqual(['4-popup.png'])
  expect(chosenImagesOf(['small-promo-tile.png', '4-popup.png'], files)).toEqual([
    '4-popup.png',
    'small-promo-tile.png',
  ])
})

test('a name that is not one of the images fails, so a typo never writes nothing', () => {
  expect(() => chosenImagesOf(['4-popup.pgn'], files)).toThrow(/4-popup\.pgn/)
  expect(() => chosenImagesOf(['4-popup.png', 'popup'], files)).toThrow(/popup/)
})
