import windowStateKeeper from "electron-window-state"
import Electron, { app, BrowserWindow } from "electron"
import { Emitter, Disposable } from "event-kit"
import * as path from "path"

import ipcMain = Electron.ipcMain
import nativeTheme = Electron.nativeTheme
import autoUpdater = Electron.autoUpdater

export class AppWindow {
  private window: Electron.BrowserWindow
  private emitter = new Emitter()

  private _loadTime: number | null = null
  private _rendererReadyTime: number | null = null
  private isDownloadingUpdate = false

  private shouldMaximizeOnShow = false

  private minWidth = 960
  private minHeight = 660

  constructor() {
    const savedWindowState = windowStateKeeper({
      defaultWidth: this.minWidth,
      defaultHeight: this.minHeight,
      maximize: false
    })

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      x: savedWindowState.x,
      y: savedWindowState.y,
      width: savedWindowState.width,
      height: savedWindowState.height,
      minWidth: this.minWidth,
      minHeight: this.minHeight,
      backgroundColor: "#fff",
      webPreferences: {
        // Disable auxclick event
        // See https://developers.google.com/web/updates/2016/10/auxclick
        disableBlinkFeatures: "Auxclick",
        nodeIntegration: true,
        spellcheck: true,
        contextIsolation: false,
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
      },
      acceptFirstMouse: true
    }

    if (__DARWIN__) {
      windowOptions.titleBarStyle = "hidden"
    } else if (__WIN32__) {
      windowOptions.frame = false
    } else if (__LINUX__) {
      windowOptions.icon = path.join(__dirname, "static", "icon-logo.png")
    }

    this.window = new BrowserWindow(windowOptions)

    if (__DEV__) {
      // Open the DevTools.
      this.window.webContents.openDevTools({
        mode: "undocked"
      })
    }

    savedWindowState.manage(this.window)

    this.shouldMaximizeOnShow = savedWindowState.isMaximized

    this.registerListeners()
  }

  private registerListeners() {
    let quitting = false
    let quittingEvenIfUpdating = false

    app.on("window-all-closed", () => {
      if (!__DARWIN__) {
        app.quit()
      }
    })

    app.on("before-quit", () => {
      quitting = true
    })

    ipcMain.on("will-quit", event => {
      quitting = true
      event.returnValue = true
    })

    ipcMain.on("will-quit-even-if-updating", event => {
      quitting = true
      quittingEvenIfUpdating = true
      event.returnValue = true
    })

    ipcMain.on("cancel-quitting", event => {
      quitting = false
      quittingEvenIfUpdating = false
      event.returnValue = true
    })

    this.window.on("close", e => {
      if ((!__DARWIN__ || quitting) && !quittingEvenIfUpdating && this.isDownloadingUpdate) {
        e.preventDefault()
        this.window.webContents.send("show-installing-update")

        return
      }

      if (__DARWIN__ && !quitting) {
        e.preventDefault()

        if (this.window.isFullScreen()) {
          this.window.setFullScreen(false)
          this.window.once("leave-full-screen", () => this.window.hide())
        } else {
          this.window.hide()
        }

        return
      }

      nativeTheme.removeAllListeners()
      autoUpdater.removeAllListeners()
    })

    if (__WIN32__) {
      this.window.once("ready-to-show", () => {
        this.window.on("unmaximize", () => {
          setTimeout(() => {
            const bounds = this.window.getBounds()
            bounds.width += 1
            this.window.setBounds(bounds)
            bounds.width -= 1
            this.window.setBounds(bounds)
          }, 5)
        })
      })
    }
  }

  public load() {
    this.window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

    this.show()
  }

  public show() {
    this.window.show()
    if (this.shouldMaximizeOnShow) {
      this.shouldMaximizeOnShow = false
      this.window.maximize()
    }
  }
}
