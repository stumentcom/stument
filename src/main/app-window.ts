import windowStateKeeper from "electron-window-state"
import Electron, { app, BrowserWindow } from "electron"
import { Emitter, Disposable } from "event-kit"
import * as path from "path"

import ipcMain = Electron.ipcMain
import nativeTheme = Electron.nativeTheme
import autoUpdater = Electron.autoUpdater
import { now } from './now';
import { registerWindowStateChangedEvents } from '../lib/window-state';
import { getUpdaterGUID } from '~lib/get-updater-guid';
import { ILaunchStats } from '~lib/stats';

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
        // disableBlinkFeatures: "Auxclick",
        // nodeIntegration: true,
        // spellcheck: true,
        contextIsolation: true,
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
    let startLoad = 0
    // We only listen for the first of the loading events to avoid a bug in
    // Electron/Chromium where they can sometimes fire more than once. See
    // See
    // https://github.com/desktop/desktop/pull/513#issuecomment-253028277. This
    // shouldn't really matter as in production builds loading _should_ only
    // happen once.
    this.window.webContents.once('did-start-loading', () => {
      this._rendererReadyTime = null
      this._loadTime = null

      startLoad = now()
    })

    this.window.webContents.once('did-finish-load', () => {
      if (__DEV__) {
        this.window.webContents.openDevTools()
      }

      this._loadTime = now() - startLoad

      this.maybeEmitDidLoad()
    })

    this.window.webContents.on('did-finish-load', () => {
      this.window.webContents.setVisualZoomLevelLimits(1, 1)
    })

    this.window.webContents.on('did-fail-load', () => {
      this.window.webContents.openDevTools()
      this.window.show()
    })

    // TODO: This should be scoped by the window.
    ipcMain.once('renderer-ready', (_, readyTime) => {
      this._rendererReadyTime = readyTime
      this.maybeEmitDidLoad()
    })

    this.window.on('focus', () =>
      this.window.webContents.send('focus')
    )
    this.window.on('blur', () =>
      this.window.webContents.send('blur')
    )

    registerWindowStateChangedEvents(this.window)

    this.window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

    nativeTheme.addListener('updated', () => {
      this.window.webContents.send('native-theme-updated')
    })

    this.setupAutoUpdater()
  }

  private maybeEmitDidLoad() {
    if (!this.rendererLoaded) {
      return
    }

    this.emitter.emit('did-load', null)
  }

  public onClosed(fn: () => void) {
    this.window.on('closed', fn)
  }

  /**
   * Register a function to call when the window is done loading. At that point
   * the page has loaded and the renderer has signalled that it is ready.
   */
  public onDidLoad(fn: () => void): Disposable {
    return this.emitter.on('did-load', fn)
  }

  /** Send a certificate error to the renderer. */
  public sendCertificateError(
    certificate: Electron.Certificate,
    error: string,
    url: string
  ) {
    this.window.webContents.send(
      'certificate-error',
      certificate,
      error,
      url
    )
  }

  /** Is the page loaded and has the renderer signalled it's ready? */
  private get rendererLoaded(): boolean {
    return !!this.loadTime && !!this.rendererReadyTime
  }

  public sendLaunchTimingStats(stats: ILaunchStats) {
    this.window.webContents.send('launch-timing-stats', stats)
  }

  /**
   * Get the time (in milliseconds) spent loading the page.
   *
   * This will be `null` until `onDidLoad` is called.
   */
  public get loadTime(): number | null {
    return this._loadTime
  }

  /**
   * Get the time (in milliseconds) elapsed from the renderer being loaded to it
   * signaling it was ready.
   *
   * This will be `null` until `onDidLoad` is called.
   */
  public get rendererReadyTime(): number | null {
    return this._rendererReadyTime
  }

  public destroy() {
    this.window.destroy()
  }

  public show() {
    this.window.show()
    if (this.shouldMaximizeOnShow) {
      this.shouldMaximizeOnShow = false
      this.window.maximize()
    }
  }

  public setupAutoUpdater() {
    autoUpdater.on('error', (error: Error) => {
      this.isDownloadingUpdate = false
      this.window.webContents.send('auto-updater-error', error)
    })

    autoUpdater.on('checking-for-update', () => {
      this.isDownloadingUpdate = false
      this.window.webContents.send(
        'auto-updater-checking-for-update'
      )
    })

    autoUpdater.on('update-available', () => {
      this.isDownloadingUpdate = true
      this.window.webContents.send(
        'auto-updater-update-available'
      )
    })

    autoUpdater.on('update-not-available', () => {
      this.isDownloadingUpdate = false
      this.window.webContents.send(
        'auto-updater-update-not-available'
      )
    })

    autoUpdater.on('update-downloaded', () => {
      this.isDownloadingUpdate = false
      this.window.webContents.send(
        'auto-updater-update-downloaded'
      )
    })
  }

  public async checkForUpdates(url: string) {
    try {
      autoUpdater.setFeedURL({ url: await trySetUpdaterGuid(url) })
      autoUpdater.checkForUpdates()
    } catch (e) {
      return e
    }
    return undefined
  }

  public quitAndInstallUpdate() {
    autoUpdater.quitAndInstall()
  }

  public minimizeWindow() {
    this.window.minimize()
  }

  public maximizeWindow() {
    this.window.maximize()
  }

  public unmaximizeWindow() {
    this.window.unmaximize()
  }

  public closeWindow() {
    this.window.close()
  }

  public isMaximized() {
    return this.window.isMaximized()
  }

  public getCurrentWindowZoomFactor() {
    return this.window.webContents.zoomFactor
  }

  public setWindowZoomFactor(zoomFactor: number) {
    this.window.webContents.zoomFactor = zoomFactor
  }
}


const trySetUpdaterGuid = async (url: string) => {
  try {
    const id = await getUpdaterGUID()
    if (!id) {
      return url
    }

    const parsed = new URL(url)
    parsed.searchParams.set('guid', id)
    return parsed.toString()
  } catch (e) {
    return url
  }
}
