// Run one child with inherited stdio, pass Ctrl-C on, and leave with the child's
// own exit status. The env wrapper runs every
// profile's command through it.
import { spawn } from 'node:child_process'

const FORWARDED = ['SIGINT', 'SIGTERM']

/**
 * Spawn `command args` and exit as it exits: with its code, or by the same
 * signal. `name` and `hint` shape the one line printed when it cannot start.
 */
export function runChild({ command, args, cwd, env, name, hint = '' }) {
  const cannotStart = (error) => {
    console.error(
      `${name}: could not run ${command} (${error.code ?? error.message}).${hint ? ` ${hint}` : ''}`,
    )
    process.exit(1)
  }
  // Node emits ENOENT (and a few others) as an 'error' event, but throws any
  // other spawn error at once: ENOTDIR, for one, when a file sits on PATH.
  let child
  try {
    child = spawn(command, args, { cwd, env, stdio: 'inherit' })
  } catch (error) {
    cannotStart(error)
  }
  child.on('error', cannotStart)
  // Ctrl-C has to reach the child, so pnpm and the command under it stop their own children.
  const forward = (signal) => child.kill(signal)
  for (const signal of FORWARDED) process.on(signal, forward)
  child.on('exit', (code, signal) => {
    if (signal) {
      // Remove the forwarder first: while it listens, the re-raise below is
      // caught by it and this process exits 0, reporting an interrupted run as a pass.
      for (const s of FORWARDED) process.off(s, forward)
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
  return child
}
