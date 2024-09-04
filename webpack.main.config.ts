import type { Configuration } from "webpack"
import * as path from "path"
import { rules } from "./webpack.rules"
import { plugins } from "./webpack.plugins"

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/main/main.ts",
  // Put your normal webpack config below here
  module: {
    rules
  },
  plugins,
  resolve: {
    alias: {
      "~lib": path.resolve(__dirname, "src/lib"),
      "~main": path.resolve(__dirname, "src/main"),
      "~renderer": path.resolve(__dirname, "src/renderer"),
    },
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"]
  }
}
