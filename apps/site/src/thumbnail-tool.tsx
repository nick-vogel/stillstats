import '@creator-analytics/thumbnail-preview/styles.css'
import { ThumbnailTool } from '@creator-analytics/thumbnail-preview'
import { createRoot } from 'react-dom/client'
import { sendToolEvent } from './analytics.ts'

// Rendered on the client only, with no hydration, so each `style` prop the tool sets goes through
// the CSSOM, which the policy's `style-src 'self'` allows, and the built page holds no style
// attribute. A missing mount throws, so a renamed id fails the browser walk instead of an empty
// page passing it.
const mount = document.getElementById('thumbnail-tool')
if (!mount) throw new Error('The tool page has no #thumbnail-tool to mount the tool in')
createRoot(mount).render(<ThumbnailTool onEvent={sendToolEvent} />)
