/* eslint-disable @typescript-eslint/naming-convention */
/** Is the app running in dev mode? */
declare const __DEV__: boolean

/** Is the app being built to run on Darwin? */
declare const __DARWIN__: boolean

/** Is the app being built to run on Win32? */
declare const __WIN32__: boolean

/** Is the app being built to run on Linux? */
declare const __LINUX__: boolean

/**
 * The product name of the app, this is intended to be a compile-time
 * replacement for app.getName
 * (https://www.electronjs.org/docs/latest/api/app#appgetname)
 */
declare const __APP_NAME__: string

/**
 * The current version of the app, this is intended to be a compile-time
 * replacement for app.getVersion
 * (https://www.electronjs.org/docs/latest/api/app#appgetname)
 */
declare const __APP_VERSION__: string

/** The channel for which the release was created. */
declare const __RELEASE_CHANNEL__: "production" | "beta" | "test" | "development"

declare global {
  interface Window {
    stument: {
      rendererReady: (readyTime: number) => void
    }
  }
}
