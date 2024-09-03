import { AppWindow } from "./app-window"
import { app } from "electron"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit()
}

app.setAppLogsPath()

function createWindow() {
  const window = new AppWindow()
  console.log("will load window")
  window.load()
}

app.on("ready", () => {
  console.log("will create window")
  createWindow()
})
