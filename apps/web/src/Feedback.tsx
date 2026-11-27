import type { FeedbackScreen, FeedbackType } from '@creator-analytics/api-types'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { track } from './analytics.ts'
import {
  charactersLeftOf,
  counterTextOf,
  emptyFeedbackFormOf,
  type FeedbackForm,
  feedbackAlertOf,
  feedbackOpenedEvent,
  feedbackProblemOf,
  feedbackRequestOf,
  feedbackSentEvent,
  feedbackTextLabel,
  feedbackThanksText,
  feedbackTypeLabel,
  feedbackTypeOptions,
  incompleteText,
  invalidAddressText,
  replyAddressLabel,
  replyCheckboxText,
  resetFormText,
  sendFeedback,
  sendFeedbackText,
  sendText,
  tooLongText,
} from './feedback.ts'

/**
 * The feedback form: the three types with none checked, the text with a counter near the limit,
 * the reply box, unticked, with the account's email in the address field, editable only while it
 * is ticked, and the send button. A send carries the screen and the app version the build has (or
 * none) without the form showing either. A send the API saved puts one thank-you line in the
 * form's place, with Reset form under it, which brings back the empty form on the same screen; any
 * other keeps the text and says why in an alert. It reads no channel, so it shows for a creator
 * with none.
 */
export function Feedback({
  email,
  screen,
  version,
}: {
  email: string
  screen: FeedbackScreen
  version: string | null
}) {
  const [form, setForm] = useState<FeedbackForm>(() => emptyFeedbackFormOf(email, screen, version))
  const [addressRefused, setAddressRefused] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const opened = useRef(false)
  const thanks = useRef<HTMLParagraphElement>(null)
  const formElement = useRef<HTMLFormElement>(null)
  // Raised by Reset form only, so the form's first open leaves focus where it was.
  const resetting = useRef(false)
  const ids = useId()
  const typeLabelId = `${ids}-type`
  const textId = `${ids}-text`
  const counterId = `${ids}-counter`
  const replyId = `${ids}-reply`
  const addressId = `${ids}-address`
  const addressErrorId = `${ids}-address-error`
  const left = charactersLeftOf(form.text)

  // Once each time the screen opens. The ref outlives StrictMode's second effect.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    track(feedbackOpenedEvent)
  }, [])

  // The send button that held focus is gone with the form, so focus moves to the line. Reset form
  // goes with the line in turn, so focus moves to the form's first control, the first type.
  useEffect(() => {
    if (sent) {
      thanks.current?.focus()
      return
    }
    if (!resetting.current) return
    resetting.current = false
    formElement.current?.querySelector<HTMLElement>('[role="radio"]')?.focus()
  }, [sent])

  function change(values: Partial<FeedbackForm>) {
    setForm((before) => ({ ...before, ...values }))
  }

  function reset() {
    setForm(emptyFeedbackFormOf(email, screen, version))
    setAddressRefused(false)
    setAlert(null)
    resetting.current = true
    setSent(false)
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = feedbackProblemOf(form)
    setAddressRefused(problem === 'invalid_address')
    if (problem === 'invalid_address') {
      setAlert(null)
      return
    }
    if (problem !== null || form.type === null) {
      setAlert(problem === 'too_long' ? tooLongText : incompleteText)
      return
    }
    setAlert(null)
    setSending(true)
    const outcome = await sendFeedback(feedbackRequestOf({ ...form, type: form.type }))
    setSending(false)
    if (outcome !== 'sent') {
      setAlert(feedbackAlertOf(outcome))
      return
    }
    track(feedbackSentEvent(form.type))
    setSent(true)
  }

  return (
    <div className="feedback">
      <h1>{sendFeedbackText}</h1>
      {sent ? (
        <div className="feedback-sent">
          <p className="feedback-thanks" ref={thanks} tabIndex={-1}>
            {feedbackThanksText}
          </p>
          <button className="feedback-reset" type="button" onClick={reset}>
            {resetFormText}
          </button>
        </div>
      ) : (
        <form className="feedback-form" noValidate onSubmit={send} ref={formElement}>
          <div className="feedback-types">
            <span id={typeLabelId}>{feedbackTypeLabel}</span>
            <RadioGroup
              aria-labelledby={typeLabelId}
              value={form.type}
              onValueChange={(chosen) => {
                const option = feedbackTypeOptions.find((each) => each.value === chosen)
                if (option) change({ type: option.value satisfies FeedbackType })
              }}
            >
              {feedbackTypeOptions.map((option) => (
                <RadioGroupItem key={option.value} value={option.value}>
                  {option.label}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </div>
          <div className="feedback-text">
            <label htmlFor={textId}>{feedbackTextLabel}</label>
            <textarea
              id={textId}
              rows={8}
              value={form.text}
              aria-describedby={counterId}
              onChange={(event) => change({ text: event.target.value })}
            />
            <p className="feedback-counter" id={counterId} aria-live="polite">
              {left !== null && counterTextOf(left)}
            </p>
          </div>
          <div className="feedback-reply">
            <input
              id={replyId}
              type="checkbox"
              checked={form.replyWanted}
              onChange={(event) => {
                change({ replyWanted: event.target.checked })
                setAddressRefused(false)
              }}
            />
            <label htmlFor={replyId}>{replyCheckboxText}</label>
            <label className="visually-hidden" htmlFor={addressId}>
              {replyAddressLabel}
            </label>
            <input
              id={addressId}
              type="email"
              autoComplete="email"
              value={form.replyTo}
              disabled={!form.replyWanted}
              aria-invalid={addressRefused ? true : undefined}
              aria-describedby={addressRefused ? addressErrorId : undefined}
              onChange={(event) => {
                change({ replyTo: event.target.value })
                setAddressRefused(false)
              }}
            />
          </div>
          {addressRefused && (
            <p className="feedback-error" id={addressErrorId} role="alert">
              {invalidAddressText}
            </p>
          )}
          {alert !== null && <p role="alert">{alert}</p>}
          <button className="button" type="submit" disabled={sending}>
            {sendText}
          </button>
        </form>
      )}
    </div>
  )
}
