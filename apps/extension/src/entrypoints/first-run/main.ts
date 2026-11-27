import { browser } from 'wxt/browser'
import { renderFirstRun } from '../../first-run.ts'
import './style.css'

const root = document.getElementById('first-run')
if (root) {
  renderFirstRun({
    document,
    root,
    // Closing the page's own tab needs no `tabs` permission in Chrome or Firefox.
    tabs: browser.tabs,
  })
}
