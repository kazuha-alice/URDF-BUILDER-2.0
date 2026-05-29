const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const targetUrl = process.argv.find((arg) => /^https?:\/\//.test(arg)) || 'http://127.0.0.1:5173/'
const resultPath = path.join(__dirname, '..', '.agents', 'panel-lifecycle-verification.json')
const errorPath = path.join(__dirname, '..', '.agents', 'panel-lifecycle-verification-error.log')

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
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const clickMenuItem = (label) => {
        const button = Array.from(document.querySelectorAll('.ribbon-menu-item'))
          .find((item) => item.textContent?.includes(label))
        button?.click()
        return Boolean(button)
      }
      const clickRightDockTab = (label) => {
        const button = Array.from(document.querySelectorAll('.right-dock .dock-tab'))
          .find((item) => item.textContent?.includes(label))
        button?.click()
        return Boolean(button)
      }
      const initialFile = document.querySelector('.app-brand span')?.textContent?.trim() ?? ''
      const tfRestoredFromViewMenu = clickMenuItem('TF View')
      await nextFrame()
      const tfTabClicked = clickRightDockTab('TF View')
      await nextFrame()
      const afterTfFile = document.querySelector('.app-brand span')?.textContent?.trim() ?? ''
      const tfVisible = Boolean(document.querySelector('.tf-graph-panel'))
      const inspectorRestoredFromViewMenu = clickMenuItem('Inspector')
      await nextFrame()
      const inspectorTabClicked = clickRightDockTab('Inspector')
      await nextFrame()
      const closeButton = document.querySelector('.right-dock .dock-actions [aria-label^="Close"]')
      closeButton?.click()
      await nextFrame()
      const inspectorHidden = !Array.from(document.querySelectorAll('.right-dock .dock-tab'))
        .some((button) => button.textContent?.includes('Inspector'))
      const afterCloseFile = document.querySelector('.app-brand span')?.textContent?.trim() ?? ''
      const inspectorRecoveredFromViewMenu = clickMenuItem('Inspector')
      await nextFrame()
      const inspectorRecovered = Array.from(document.querySelectorAll('.right-dock .dock-tab'))
        .some((button) => button.textContent?.includes('Inspector'))
      const afterRestoreFile = document.querySelector('.app-brand span')?.textContent?.trim() ?? ''

      return {
        initialFile,
        afterTfFile,
        afterCloseFile,
        afterRestoreFile,
        tfRestoredFromViewMenu,
        tfTabClicked,
        tfVisible,
        inspectorRestoredFromViewMenu,
        inspectorTabClicked,
        inspectorHidden,
        inspectorRecoveredFromViewMenu,
        inspectorRecovered,
        documentStableAfterTf: initialFile === afterTfFile,
        documentStableAfterClose: initialFile === afterCloseFile,
        documentStableAfterRestore: initialFile === afterRestoreFile,
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
