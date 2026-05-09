#!/usr/bin/env node
/**
 * Pre-build check for Supabase env vars
 * Warns if cloud vars are missing (app will work in localStorage-only mode)
 */

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;

const hasCloud = URL && KEY;

if (!hasCloud) {
  console.warn('\n⚠️  [FinFlow Build Warning]');
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set.');
  console.warn('App will run in localStorage-only mode (no cloud features).\n');

  if (process.env.VERCEL) {
    console.warn('🔴 ON VERCEL: Your deployment will NOT have cloud features.');
    console.warn('   1. Go to Vercel → Settings → Environment Variables');
    console.warn('   2. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    console.warn('   3. Redeploy this commit\n');
  } else {
    console.warn('ℹ️  LOCAL DEV: Copy .env.example to .env.local and fill in your Supabase credentials.\n');
  }
}

console.log('ℹ️  Build environment:');
console.log(`    VITE_SUPABASE_URL: ${URL ? '✓ set' : '✗ missing'}`);
console.log(`    VITE_SUPABASE_ANON_KEY: ${KEY ? '✓ set' : '✗ missing'}`);
console.log(`    App URL: ${process.env.VITE_APP_URL || '(auto - will be ' + process.env.VERCEL_URL + ')'}\n`);
