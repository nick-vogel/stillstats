import type { AdminFeedbackMessage } from '@creator-analytics/api-types'
import { useEffect, useId, useState } from 'react'
import { AdminTabs } from './AdminTabs.tsx'
import {
  type AdminFeedbackView,
  adminFeedbackHeading,
  doneDescriptionOf,
  doneText,
  listFailedText,
  messageLabel,
  newerText,
  noMessagesText,
  olderText,
  openOnlyText,
  readAdminFeedback,
  replyAddressLabel,
  replyAddressTextOf,
  saveDone,
  screenLabel,
  screenTextOf,
  sentLabel,
  sentTextOf,
  typeLabel,
  typeTextOf,
  versionLabel,
  versionTextOf,
} from './admin-feedback.ts'
import { latestOnly } from './api.ts'
import { NotFound } from './NotFound.tsx'
import type { Navigate, Route } from './route.ts'

/**
 * One message: its fields as a description list, every value a plain text node, never HTML,
 * markdown or a link, and its "Done" box, described by its type and time sent so a screen reader
 * tells one box from the next.
 */
function MessageItem({
  message,
  saving,
  onDone,
}: {
  message: AdminFeedbackMessage
  saving: boolean
  onDone: (done: boolean) => void
}) {
  const ids = useId()
  const doneId = `${ids}-done`
  const descriptionId = `${ids}-description`
  const fields: [string, string][] = [
    [typeLabel, typeTextOf(message.type)],
    [sentLabel, sentTextOf(message.createdAt)],
    [screenLabel, screenTextOf(message.screen)],
    [versionLabel, versionTextOf(message.appVersion)],
    [replyAddressLabel, replyAddressTextOf(message.replyTo)],
  ]
  return (
    <article className="admin-feedback-message">
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div className="admin-feedback-text">
          <dt>{messageLabel}</dt>
          <dd>{message.text}</dd>
        </div>
      </dl>
      <div className="admin-feedback-done">
        <input
          id={doneId}
          type="checkbox"
          checked={message.doneAt !== null}
          disabled={saving}
          aria-describedby={descriptionId}
          onChange={(event) => onDone(event.target.checked)}
        />
        <label htmlFor={doneId}>{doneText}</label>
        <span id={descriptionId} hidden>
          {doneDescriptionOf(message)}
        </span>
      </div>
    </article>
  )
}

/**
 * Nick's admin screen of the feedback messages, newest first, 50 to a page, with the open filter
 * and a "Done" box on each, under the tab strip it shares with the Grants tab. Nothing of it shows
 * before the first read lands, and anyone the API answers 404, as it answers anyone not on the
 * allowlist, sees the not-found screen in its place. The page and the filter live here, not in the
 * address.
 */
export function AdminFeedback({ route, navigate }: { route: Route; navigate: Navigate }) {
  const [page, setPage] = useState(1)
  const [openOnly, setOpenOnly] = useState(false)
  const [view, setView] = useState<AdminFeedbackView | null>(null)
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set())
  const [alert, setAlert] = useState<string | null>(null)
  const filterId = useId()

  useEffect(
    () =>
      latestOnly(readAdminFeedback(page, openOnly), setView, () =>
        setView({ kind: 'failed', alert: listFailedText }),
      ),
    [page, openOnly],
  )

  async function changeDone(message: AdminFeedbackMessage, done: boolean) {
    setSaving((before) => new Set(before).add(message.id))
    const saved = await saveDone(message.id, done)
    setSaving((before) => {
      const after = new Set(before)
      after.delete(message.id)
      return after
    })
    if (!saved.ok) {
      setAlert(saved.alert)
      return
    }
    setAlert(null)
    setView((before) =>
      before?.kind === 'list'
        ? {
            ...before,
            messages: before.messages.map((each) =>
              each.id === message.id ? saved.message : each,
            ),
          }
        : before,
    )
  }

  if (view === null) return <div className="admin-feedback" aria-busy="true" />
  if (view.kind === 'not-found') return <NotFound route={route} navigate={navigate} />
  return (
    <div className="admin-feedback">
      <AdminTabs route={route} navigate={navigate} />
      <h1>{adminFeedbackHeading}</h1>
      <div className="admin-feedback-filter">
        <input
          id={filterId}
          type="checkbox"
          checked={openOnly}
          onChange={(event) => {
            setOpenOnly(event.target.checked)
            setPage(1)
          }}
        />
        <label htmlFor={filterId}>{openOnlyText}</label>
      </div>
      {alert !== null && <p role="alert">{alert}</p>}
      {view.kind === 'failed' ? (
        <p role="alert">{view.alert}</p>
      ) : view.messages.length === 0 ? (
        <p>{noMessagesText}</p>
      ) : (
        <ol className="admin-feedback-list">
          {view.messages.map((message) => (
            <li key={message.id}>
              <MessageItem
                message={message}
                saving={saving.has(message.id)}
                onDone={(done) => changeDone(message, done)}
              />
            </li>
          ))}
        </ol>
      )}
      {view.kind === 'list' && view.pageCount > 1 && (
        <div className="admin-feedback-pages">
          <button
            className="button"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {newerText}
          </button>
          <button
            className="button"
            type="button"
            disabled={page >= view.pageCount}
            onClick={() => setPage(page + 1)}
          >
            {olderText}
          </button>
        </div>
      )}
    </div>
  )
}
