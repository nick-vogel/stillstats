import { type BuildExtraConfigColumns, sql } from 'drizzle-orm'
import {
  index,
  type PgColumnBuilderBase,
  type PgTableExtraConfigValue,
  pgTable,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { userChannelIds, webPolicy, workerPolicy } from './access.ts'
import { channelIdColumn } from './channels.ts'

type ChannelOwnedColumns<TColumns> = TColumns & { channelId: ReturnType<typeof channelIdColumn> }

export interface ChannelOwnedOptions<TName extends string, TColumns> {
  /** Makes the channel id the primary key, for a table that holds at most one row per channel. */
  onePerChannel?: boolean
  /** The table's own indexes and constraints, next to the ones every channel-owned table has. */
  extraConfig?: (
    table: BuildExtraConfigColumns<TName, ChannelOwnedColumns<TColumns>, 'pg'>,
  ) => PgTableExtraConfigValue[]
}

/**
 * The only way to declare a table that holds a channel's rows. Deleting the channel row deletes
 * them, and the policies admit them to `app_web` through the user's memberships and to
 * `app_worker` for the scope's one channel. The migrate step forces row-level security on it.
 */
export function channelOwned<
  TName extends string,
  TColumns extends Record<string, PgColumnBuilderBase>,
>(
  name: TName,
  columns: TColumns,
  { onePerChannel = false, extraConfig }: ChannelOwnedOptions<TName, TColumns> = {},
) {
  return pgTable(name, { ...columns, channelId: channelIdColumn() }, (t) => [
    onePerChannel
      ? primaryKey({ name: `${name}_pkey`, columns: [t.channelId] })
      : index(`${name}_channel_id_idx`).on(t.channelId),
    webPolicy(name, 'all', sql`${t.channelId} in ${userChannelIds}`),
    workerPolicy(name, t.channelId),
    ...(extraConfig?.(t) ?? []),
  ])
}
