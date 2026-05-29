const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const targetUrl = process.argv.find((arg) => /^https?:\/\//.test(arg)) || 'http://127.0.0.1:5173/'
const resultPath = path.join(__dirname, '..', '.agents', 'context-menu-verification.json')
const errorPath = path.join(__dirname, '..', '.agents', 'context-menu-verification-error.log')

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  await window.loadURL(targetUrl)
  await delay(4500)

  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const viewport = document.querySelector('.viewport-panel')
      if (!viewport) {
        return { ok: false, error: 'Viewport panel not found.' }
      }

      const rect = viewport.getBoundingClientRect()
      const target = {
        x: Math.round(rect.left + Math.min(140, rect.width / 2)),
        y: Math.round(rect.top + Math.min(110, rect.height / 2))
      }

      viewport.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        buttons: 2,
        clientX: target.x,
        clientY: target.y,
        pageX: target.x + window.scrollX,
        pageY: target.y + window.scrollY,
        screenX: target.x,
        screenY: target.y
      }))

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      const menu = document.querySelector('.context-menu')
      if (!menu) {
        return { ok: false, error: 'Context menu did not render.', target }
      }

      const menuRect = menu.getBoundingClientRect()

      return {
        ok: true,
        target,
        menu: {
          left: Math.round(menuRect.left),
          top: Math.round(menuRect.top),
          right: Math.round(menuRect.right),
          bottom: Math.round(menuRect.bottom),
          width: Math.round(menuRect.width),
          height: Math.round(menuRect.height)
        },
        window: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        closeToCursor: Math.abs(menuRect.left - target.x) <= 12 && Math.abs(menuRect.top - target.y) <= 12,
        insideWindow:
          menuRect.left >= 0 &&
          menuRect.top >= 0 &&
          menuRect.right <= window.innerWidth &&
          menuRect.bottom <= window.innerHeight
      }
    })()
  `)

  console.log(JSON.stringify(result, null, 2))
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`)
  app.quit()
}).catch((error) => {
  fs.writeFileSync(errorPath, error instanceof Error ? error.stack || error.message : String(error))
  app.quit()
})
