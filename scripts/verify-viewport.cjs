const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const rawArgs = process.argv.slice(1)
const normalizedArgs = rawArgs.map((arg) => arg.replace(/^\\+\s*/, '').replace(/\\+$/, ''))
const targetUrl = normalizedArgs.find((arg) => /^https?:\/\//.test(arg)) || 'http://127.0.0.1:5173/'
const numericArgs = normalizedArgs.map((arg) => Number(arg)).filter((arg) => Number.isFinite(arg))
const viewportWidth = numericArgs[0] || 1280
const viewportHeight = numericArgs[1] || 820
const screenshotPath = path.join(__dirname, '..', '.agents', 'viewport-verification.png')
const resultPath = path.join(__dirname, '..', '.agents', 'viewport-verification.json')
const errorPath = path.join(__dirname, '..', '.agents', 'viewport-verification-error.log')

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function countSampledColors(image) {
  const { width, height } = image.getSize()
  const bitmap = image.toBitmap()
  const colors = new Set()
  const stepX = Math.max(1, Math.floor(width / 80))
  const stepY = Math.max(1, Math.floor(height / 50))

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const offset = (y * width + x) * 4
      colors.add(`${bitmap[offset]}-${bitmap[offset + 1]}-${bitmap[offset + 2]}`)
    }
  }

  return colors.size
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: viewportWidth,
    height: viewportHeight,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  await window.loadURL(targetUrl)
  await delay(4500)

  const canvasInfo = await window.webContents.executeJavaScript(`
    (() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return { present: false, width: 0, height: 0 }
      const rect = canvas.getBoundingClientRect()
      return { present: true, width: Math.round(rect.width), height: Math.round(rect.height) }
    })()
  `)
  const image = await window.webContents.capturePage()
  fs.writeFileSync(screenshotPath, image.toPNG())

  const result = {
    url: targetUrl,
    argv: process.argv,
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
    canvas: canvasInfo,
    sampledColors: countSampledColors(image),
    screenshotPath,
  }

  console.log(JSON.stringify(result, null, 2))
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`)

  app.quit()
}).catch((error) => {
  fs.writeFileSync(errorPath, error instanceof Error ? error.stack || error.message : String(error))
  app.quit()
})
