/**
 * The Stillstats mark, the favicon's (apps/site/public/favicon.svg) path and viewBox, which
 * components.test.ts holds equal to it. Inline, so it loads nothing the content security policy
 * has to allow, and filled from app.css in `--accent`, the token whose light and dark values are
 * the favicon's two fills. The link it sits in carries its name.
 */
export function StillstatsMark() {
  return (
    <svg className="stillstats-mark" viewBox="-39 -524.5 560 560" aria-hidden="true">
      <path
        transform="scale(1 -1)"
        d="M268 -10C382 -10 462 44 462 139C462 214 415 256 307 285L252 300C187 318 166 328 166 354C166 378 187 391 222 391C279 391 339 364 387 314L451 410C417 453 340 499 234 499C114 499 36 442 36 346C36 260 100 225 188 202L254 186C306 173 334 163 334 137C334 111 311 99 272 99C198 99 127 142 86 186L20 89C62 30 159 -10 268 -10Z"
      />
    </svg>
  )
}
