// No test runs this file: `pnpm typecheck` checks it, and each unused @ts-expect-error fails the
// check. It proves the cards need the consent handler whenever a card can carry a consent button.
import type { ComponentProps } from 'react'
import type { Cards } from './Cards.tsx'
import type { Card, NoConsentCard } from './cards.ts'

type CardsProps = ComponentProps<typeof Cards>

export const consentCardsWithHandler = {
  cards: [] as Card[],
  onGiveRevenueConsent: () => {},
} satisfies CardsProps

export const consentCardsWithoutHandler = {
  cards: [] as Card[],
  // @ts-expect-error A card that can carry a consent button needs the handler that gives consent.
} satisfies CardsProps

export const noConsentCardsWithoutHandler = {
  cards: [] as NoConsentCard[],
} satisfies CardsProps
