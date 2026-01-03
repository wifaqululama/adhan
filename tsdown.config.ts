import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    Adhan: 'src/Adhan.ts', // change if your entry differs
  },

  outDir: 'lib',

  // This produces:
  //   lib/esm/Adhan.js
  //   lib/cjs/Adhan.js
  format: ['esm', 'cjs'],

  // Emit types to lib/types
  dts: {
    enabled: true,
  },

  // // Match your current behavior: separate folders per format
  // outExtension({ format }: {format: any}) {
  //   return { js: ".js" };
  // },

  // Most libs should externalize deps; if you have none, it’s still fine.
  // If you *do* have deps later, add them here or let tsdown infer.
  external: [],

  sourcemap: true,
  clean: true,

  // If you want Node12-ish output, set a target.
  // (If you support browsers / RN bundlers, "es2018" is usually fine.)
  target: 'es2018',
});
