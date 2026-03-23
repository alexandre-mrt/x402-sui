import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  external: ["@mysten/sui", "@x402/core", "@modelcontextprotocol/sdk"],
  splitting: false,
  treeshake: true,
});
