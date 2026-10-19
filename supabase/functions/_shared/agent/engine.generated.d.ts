// Types for the generated engine bundle, for the TypeScript check of the Edge code (T5a, XC-ARC-09).
// Deliberately loose: `engine.ts` gives every export its real type where it re-exports it, so this file
// only lets the bundle be imported under `strict`. Deno does not read it (it takes a .js file's types
// from the file itself), so the deployed functions are unchanged.
declare const engine: { readonly [name: string]: any };
export = engine;
