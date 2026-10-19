// The Deno runtime's globals, for the TypeScript check of the Edge code (T5a, XC-ARC-09).
// Typed loosely on purpose: the real check of Deno's own APIs is `deno check` in CI.
declare const Deno: any;
declare const EdgeRuntime: any;
declare module 'https://deno.land/x/denomailer@1.6.0/mod.ts' { export const SMTPClient: any; }
