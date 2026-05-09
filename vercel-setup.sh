#!/usr/bin/env bash
# Automated Vercel environment variable setup
# Run this if you have Vercel CLI installed: npm install -g vercel

set -e

SUPABASE_URL="https://dmxqkvploojokffuhxnz.supabase.co"
ANON_KEY="sb_publishable_SpuQFPzUWOnKI3nRR6ghNw_ktWqrKCA"
VERCEL_DOMAIN="finflow-eight-sooty.vercel.app"

echo "🔧 Setting Vercel Environment Variables"
echo "========================================"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install with: npm install -g vercel"
    echo "   Then run this script again."
    exit 1
fi

echo "Adding environment variables to Vercel..."
echo ""

# Set VITE_SUPABASE_URL
echo "1️⃣  Setting VITE_SUPABASE_URL..."
echo "$SUPABASE_URL" | vercel env add VITE_SUPABASE_URL --yes || true

# Set VITE_SUPABASE_ANON_KEY
echo "2️⃣  Setting VITE_SUPABASE_ANON_KEY..."
echo "$ANON_KEY" | vercel env add VITE_SUPABASE_ANON_KEY --yes || true

# Set VITE_APP_URL
echo "3️⃣  Setting VITE_APP_URL..."
echo "https://$VERCEL_DOMAIN" | vercel env add VITE_APP_URL --yes || true

echo ""
echo "✅ Vercel env vars set!"
echo ""
echo "Next: Redeploy to Vercel"
echo "  vercel --prod"
echo ""
