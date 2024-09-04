import React from "react"
import { createRoot } from "react-dom/client"
import App from "./app"

const startTime = performance.now()

const root = createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <App startTime={startTime} />
  </React.StrictMode>
)
