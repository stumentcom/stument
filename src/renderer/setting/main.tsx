import React from "react"
import { createRoot } from "react-dom/client"
import Setting from "./setting"

const root = createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <Setting />
  </React.StrictMode>
)
