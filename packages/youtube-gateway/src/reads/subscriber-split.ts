import { type EngagedViewsAndViews, oneVideoRead } from './one-video.ts'

/**
 * Engaged views and views keyed `SUBSCRIBED` and `UNSUBSCRIBED`. Google omits a status with no
 * views.
 */
export type SubscriberSplitNumbers = Record<string, EngagedViewsAndViews>

export const subscriberSplit = oneVideoRead<SubscriberSplitNumbers>({
  // Versioned since the value became engaged views and views: a value cached in the old shape,
  // views alone, is never read as the new one.
  cacheKeyPrefix: 'subscriberSplit:v2',
  dimensions: 'subscribedStatus',
  metrics: 'engagedViews,views',
  toValue: (records) =>
    Object.fromEntries(
      records.map((record) => [
        String(record.subscribedStatus),
        { engagedViews: Number(record.engagedViews ?? 0), views: Number(record.views ?? 0) },
      ]),
    ),
})
