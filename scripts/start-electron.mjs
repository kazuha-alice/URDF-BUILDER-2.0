import { spawn } from 'node:child_process'
import electronPath from 'electron'

const electronEnv = { ...process.env }

delete electronEnv.ELECTRON_RUN_AS_NODE
delete electronEnv.ELECTRON_NO_ATTACH_CONSOLE

const electronProcess = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: electronEnv,
})

electronProcess.on('close', (code) => {
  process.exit(code ?? 0)
})
