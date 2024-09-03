import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin"
import webpack from "webpack"
import { version, productName } from "./package.json"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin")

const s = JSON.stringify

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: "webpack-infrastructure"
  }),
  new webpack.DefinePlugin({
    "__DEV__": process.env.NODE_ENV !== "production",
    "__DARWIN__": process.platform === "darwin",
    "__WIN32__": process.platform === "win32",
    "__LINUX__": process.platform === "linux",
    "__APP_NAME__": s(productName),
    "__APP_VERSION__": s(version),
    "process.platform": s(process.platform),
    "process.env.NODE_ENV": s(process.env.NODE_ENV || "development"),
    "process.env.TEST_ENV": s(process.env.TEST_ENV)
  })
]
