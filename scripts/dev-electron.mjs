import { spawn } from 'node:child_process'
import electronPath from 'electron'
import { createServer } from 'vite'

const host = '127.0.0.1'
const port = 5173

process.env.NODE_ENV = 'development'

const server = await createServer({
  configFile: 'vite.config.ts',
  forceOptimizeDeps: true,
  server: {
    host,
    port,
    strictPort: false,
  },
})

await server.listen()

const devServerUrl =
  server.resolvedUrls?.local?.[0] ?? `http://${host}:${server.config.server.port}/`

server.printUrls()

const electronEnv = {
  ...process.env,
  VITE_DEV_SERVER_URL: devServerUrl,
}

delete electronEnv.ELECTRON_RUN_AS_NODE
delete electronEnv.ELECTRON_NO_ATTACH_CONSOLE

const electronProcess = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: electronEnv,
})

let stopping = false

async function stop(exitCode = 0) {
  if (stopping) {
    return
  }

  stopping = true

  if (!electronProcess.killed) {
    electronProcess.kill()
  }

  await server.close()
  process.exit(exitCode)
}

electronProcess.on('close', (code) => {
  void stop(code ?? 0)
})

process.on('SIGINT', () => {
  void stop(0)
})

process.on('SIGTERM', () => {
  void stop(0)
})
