import { type AdminGrant, adminGrantMaxBlocks } from '@creator-analytics/api-types'
import { type FormEvent, useEffect, useId, useState } from 'react'
import { AdminTabs } from './AdminTabs.tsx'
import {
  type AdminGrantForm,
  type AdminGrantsChange,
  type AdminGrantsView,
  adminGrantRequestOf,
  adminGrantsHeading,
  allBlocksLabel,
  allBlocksTextOf,
  blocksLabel,
  createAdminGrant,
  emailLabel,
  emptyAdminGrantForm,
  endDateLabel,
  endsLabel,
  endsTextOf,
  grantText,
  listFailedText,
  noGrantsText,
  readAdminGrants,
  removeAdminGrant,
  removeQuestionOf,
  removeText,
} from './admin-grants.ts'
import { latestOnly } from './api.ts'
import { NotFound } from './NotFound.tsx'
import type { Navigate, Route } from './route.ts'

/**
 * One grant: its fields as a description list, every value a plain text node, never HTML or a
 * link, and its "Remove", described by the grant's email so a screen reader tells one from the
 * next.
 */
function GrantItem({
  grant,
  removing,
  onRemove,
}: {
  grant: AdminGrant
  removing: boolean
  onRemove: () => void
}) {
  const emailId = useId()
  const fields: [string, string, string?][] = [
    [emailLabel, grant.email, emailId],
    [blocksLabel, String(grant.blocks)],
    [allBlocksLabel, allBlocksTextOf(grant)],
    [endsLabel, endsTextOf(grant.endsAt)],
  ]
  return (
    <article className="admin-grants-grant">
      <dl>
        {fields.map(([label, value, id]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd id={id}>{value}</dd>
          </div>
        ))}
      </dl>
      <button
        className="button"
        type="button"
        disabled={removing}
        aria-describedby={emailId}
        onClick={onRemove}
      >
        {removeText}
      </button>
    </article>
  )
}

/**
 * Nick's admin screen of the Pro grants (stillstats#24), under the tab strip it shares with the
 * feedback screen: the form that gives a user blocks by their email, then every grant, newest
 * first, each with "Remove", which asks first. Every change redraws the list from the API's answer.
 * Nothing of it shows before the first read lands, and anyone the API answers 404, as it answers
 * anyone not on the allowlist, sees the not-found screen in its place. No change sends an event.
 */
export function AdminGrants({ route, navigate }: { route: Route; navigate: Navigate }) {
  const [view, setView] = useState<AdminGrantsView | null>(null)
  const [form, setForm] = useState<AdminGrantForm>(emptyAdminGrantForm)
  const [granting, setGranting] = useState(false)
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set())
  const [alert, setAlert] = useState<string | null>(null)
  const ids = useId()

  useEffect(
    () =>
      latestOnly(readAdminGrants(), setView, () =>
        setView({ kind: 'failed', alert: listFailedText }),
      ),
    [],
  )

  /** Shows the list the change answered, or its alert. Answers whether the change landed. */
  function land(change: AdminGrantsChange): boolean {
    if (!change.ok) {
      setAlert(change.alert)
      return false
    }
    setAlert(null)
    setView({ kind: 'list', grants: change.grants })
    return true
  }

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGranting(true)
    const change = await createAdminGrant(adminGrantRequestOf(form))
    setGranting(false)
    if (land(change)) setForm(emptyAdminGrantForm)
  }

  async function remove(grant: AdminGrant) {
    if (!window.confirm(removeQuestionOf(grant))) return
    setRemoving((before) => new Set(before).add(grant.id))
    const change = await removeAdminGrant(grant.id)
    setRemoving((before) => {
      const after = new Set(before)
      after.delete(grant.id)
      return after
    })
    land(change)
  }

  if (view === null) return <div className="admin-grants" aria-busy="true" />
  if (view.kind === 'not-found') return <NotFound route={route} navigate={navigate} />
  const fields: [keyof AdminGrantForm, string, string][] = [
    ['email', emailLabel, 'email'],
    ['blocks', blocksLabel, 'number'],
    ['endsOn', endDateLabel, 'date'],
  ]
  return (
    <div className="admin-grants">
      <AdminTabs route={route} navigate={navigate} />
      <h1>{adminGrantsHeading}</h1>
      {/* The API checks every rule and answers what is wrong, so the browser blocks nothing. */}
      <form className="admin-grants-form" noValidate onSubmit={grant}>
        {fields.map(([name, label, type]) => (
          <div className="admin-grants-field" key={name}>
            <label htmlFor={`${ids}-${name}`}>{label}</label>
            <input
              id={`${ids}-${name}`}
              type={type}
              value={form[name]}
              autoComplete="off"
              {...(type === 'number' ? { min: 1, max: adminGrantMaxBlocks, step: 1 } : {})}
              onChange={(event) => {
                const { value } = event.target
                setForm((before) => ({ ...before, [name]: value }))
              }}
            />
          </div>
        ))}
        <button className="button" type="submit" disabled={granting}>
          {grantText}
        </button>
      </form>
      {alert !== null && <p role="alert">{alert}</p>}
      {view.kind === 'failed' ? (
        <p role="alert">{view.alert}</p>
      ) : view.grants.length === 0 ? (
        <p>{noGrantsText}</p>
      ) : (
        <ol className="admin-grants-list">
          {view.grants.map((each) => (
            <li key={each.id}>
              <GrantItem
                grant={each}
                removing={removing.has(each.id)}
                onRemove={() => remove(each)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
