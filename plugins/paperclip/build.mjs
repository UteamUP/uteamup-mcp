import { build } from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";

const presets = createPluginBundlerPresets({
  workerEntry: "src/worker.js",
  manifestEntry: "src/manifest.js",
  outdir: "dist",
});
await build(presets.esbuild.manifest);
await build(presets.esbuild.worker);
