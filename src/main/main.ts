import { AppWindow } from "./app-window"
import { app, ipcMain, shell } from "electron"
import { now } from "~lib/now"
import log from "electron-log/main"
import { UNSAFE_openDirectory } from "~lib/shell"
import { getMainGUID, saveGUIDFile } from "~lib/get-main-guid"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit()
}

app.setAppLogsPath()

let mainWindow: AppWindow | null = null

const launchTime = now()

let preventQuit = false
let readyTime: number | null = null

type OnDidLoadFn = (window: AppWindow) => void
/** See the `onDidLoad` function. */
let onDidLoadFns: Array<OnDidLoadFn> | null = []

/**
 * Calculates the number of seconds the app has been running
 */
function getUptimeInSeconds() {
  return (now() - launchTime) / 1000
}

function getExtraErrorContext(): Record<string, string> {
  return {
    uptime: getUptimeInSeconds().toFixed(3),
    time: new Date().toString()
  }
}

app.on("activate", () => {
  onDidLoad(window => {
    window.show()
  })
})

app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
  callback(false)

  onDidLoad(window => {
    window.sendCertificateError(certificate, error, url)
  })
})

app.on("ready", () => {
  readyTime = now() - launchTime

  createWindow()

  ipcMain.handle("check-for-updates", async (_, url) => mainWindow?.checkForUpdates(url))

  ipcMain.on("quit-and-install-updates", () => mainWindow?.quitAndInstallUpdate())

  ipcMain.on("quit-app", () => app.quit())

  ipcMain.on("minimize-window", () => mainWindow?.minimizeWindow())

  ipcMain.on("maximize-window", () => mainWindow?.maximizeWindow())

  ipcMain.on("unmaximize-window", () => mainWindow?.unmaximizeWindow())

  ipcMain.on("close-window", () => mainWindow?.closeWindow())

  ipcMain.handle("is-window-maximized", async () => mainWindow?.isMaximized() ?? false)

  ipcMain.handle("get-current-window-state", async () => mainWindow?.getCurrentWindowState())

  ipcMain.handle("get-current-window-zoom-factor", async () => mainWindow?.getCurrentWindowZoomFactor())

  ipcMain.on("set-window-zoom-factor", (_, zoomFactor: number) => mainWindow?.setWindowZoomFactor(zoomFactor))

  ipcMain.handle("open-external", async (_, path: string) => {
    const pathLowerCase = path.toLowerCase()
    if (pathLowerCase.startsWith("http://") || pathLowerCase.startsWith("https://")) {
      log.info(`opening in browser: ${path}`)
    }

    try {
      await shell.openExternal(path)
      return true
    } catch (e) {
      log.error(`Call to openExternal failed: '${e}'`)
      return false
    }
  })

  /**
   * An event sent by the renderer asking for the app's architecture
   */
  ipcMain.handle("get-path", async (_, path) => app.getPath(path))

  /**
   * An event sent by the renderer asking for the app's path
   */
  ipcMain.handle("get-app-path", async () => app.getAppPath())

  /**
   * An event sent by the renderer asking to move the app to the application
   * folder
   */
  ipcMain.handle("move-to-applications-folder", async () => {
    app.moveToApplicationsFolder?.()
  })

  ipcMain.handle("move-to-trash", (_, path) => shell.trashItem(path))
  ipcMain.handle("show-item-in-folder", async (_, path) => shell.showItemInFolder(path))

  ipcMain.on("unsafe-open-directory", async (_, path) => UNSAFE_openDirectory(path))

  /**
   * An event sent by the renderer asking whether the Desktop is in the
   * applications folder
   *
   * Note: This will return null when not running on Darwin
   */
  ipcMain.handle("is-in-application-folder", async () => {
    // Contrary to what the types tell you the `isInApplicationsFolder` will be undefined
    // when not on macOS
    return app.isInApplicationsFolder?.() ?? null
  })

  /**
   * An event sent by the renderer asking obtain whether the window is focused
   */
  ipcMain.handle("is-window-focused", async () => mainWindow?.isFocused() ?? false)

  /** An event sent by the renderer asking to focus the main window. */
  ipcMain.on("focus-window", () => {
    mainWindow?.focus()
  })

  ipcMain.handle("get-guid", () => getMainGUID())

  ipcMain.handle("save-guid", (_, guid) => saveGUIDFile(guid))
})

function createWindow() {
  const window = new AppWindow()

  window.onClosed(() => {
    mainWindow = null
    if (!__DARWIN__ && !preventQuit) {
      app.quit()
    }
  })

  window.onDidLoad(() => {
    window.show()
    window.sendLaunchTimingStats({
      mainReadyTime: readyTime!,
      loadTime: window.loadTime!,
      rendererReadyTime: window.rendererReadyTime!
    })

    const fns = onDidLoadFns!
    onDidLoadFns = null
    for (const fn of fns) {
      fn(window)
    }
  })

  window.load()

  mainWindow = window
}

/**
 * Register a function to be called once the window has been loaded. If the
 * window has already been loaded, the function will be called immediately.
 */
function onDidLoad(fn: OnDidLoadFn) {
  if (onDidLoadFns) {
    onDidLoadFns.push(fn)
  } else {
    if (mainWindow) {
      fn(mainWindow)
    }
  }
}
