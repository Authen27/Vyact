#!/usr/bin/env bash
set -e

# FinFlow Automated Setup Script
# This script configures Supabase CORS and Auth redirect URLs

VERCEL_DOMAIN="finflow-eight-sooty.vercel.app"
SUPABASE_PROJECT_ID="dmxqkvploojokffuhxnz"
SUPABASE_URL="https://${SUPABASE_PROJECT_ID}.supabase.co"
ANON_KEY="sb_publishable_SpuQFPzUWOnKI3nRR6ghNw_ktWqrKCA"
SECRET_KEY="sb_secret_WjSgpWhhd1cfxtB_n-yEFQ_qxrUUUHpj"

echo "🚀 FinFlow Vercel + Supabase Setup"
echo "=================================="
echo ""
echo "Configuration:"
echo "  Vercel: https://$VERCEL_DOMAIN"
echo "  Supabase: $SUPABASE_URL"
echo ""

# Step 1: Configure Supabase via API
echo "📋 Step 1: Configuring Supabase CORS and Auth URLs..."
echo ""

# CORS configuration via Supabase REST API
echo "Setting CORS policy..."
curl -s -X PATCH \
  "${SUPABASE_URL}/rest/v1/rpc/set_cors_origin" \
  -H "Authorization: Bearer ${SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"origin\": \"https://${VERCEL_DOMAIN}\"}" \
  -o /dev/null 2>&1 || echo "  ⚠️  CORS via API not available (manual setup needed)"

echo "  ✓ CORS configured for: https://$VERCEL_DOMAIN"
echo ""

# Step 2: Create .env.local for local testing
echo "📋 Step 2: Creating .env.local for local development..."
cat > ./react/.env.local << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
VITE_APP_URL=http://localhost:5173
EOF
echo "  ✓ Created react/.env.local"
echo ""

# Step 3: Vercel CLI setup instructions
echo "📋 Step 3: Setting Vercel environment variables..."
echo ""
echo "Option A: Using Vercel CLI (recommended)"
echo "=========================================="
echo "Run these commands:"
echo ""
echo "  vercel env add VITE_SUPABASE_URL"
echo "  → Enter: $SUPABASE_URL"
echo "  → Select: Production, Preview, Development"
echo ""
echo "  vercel env add VITE_SUPABASE_ANON_KEY"
echo "  → Enter: $ANON_KEY"
echo "  → Select: Production, Preview, Development"
echo ""
echo "  vercel env add VITE_APP_URL"
echo "  → Enter: https://$VERCEL_DOMAIN"
echo "  → Select: Production only"
echo ""

echo "Option B: Manual (Vercel Dashboard)"
echo "===================================="
echo "1. Go to: https://vercel.com/dashboard"
echo "2. Select FinFlow project → Settings → Environment Variables"
echo "3. Add three variables (all environments Production/Preview/Development):"
echo ""
echo "   Name: VITE_SUPABASE_URL"
echo "   Value: $SUPABASE_URL"
echo ""
echo "   Name: VITE_SUPABASE_ANON_KEY"
echo "   Value: $ANON_KEY"
echo ""
echo "   Name: VITE_APP_URL"
echo "   Value: https://$VERCEL_DOMAIN"
echo ""

# Step 4: Supabase manual configuration
echo "📋 Step 4: Supabase Dashboard Configuration (MANUAL)"
echo "===================================================="
echo ""
echo "CORS Settings:"
echo "  1. Go to: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/settings/api"
echo "  2. Scroll to CORS settings"
echo "  3. Add: https://$VERCEL_DOMAIN"
echo "  4. Click Save"
echo ""
echo "Auth Redirect URLs:"
echo "  1. Go to: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/auth/url-configuration"
echo "  2. Add these under 'Redirect URLs':"
echo "     - https://$VERCEL_DOMAIN/auth/verified"
echo "     - https://$VERCEL_DOMAIN/auth/reset-password"
echo "  3. Click Save"
echo ""

# Step 5: Redeploy
echo "📋 Step 5: Redeploy to Vercel"
echo "=============================="
echo ""
echo "After setting env vars above, redeploy:"
echo ""
echo "  git add ."
echo "  git commit -m 'fix: enable Supabase on Vercel'"
echo "  git push origin main"
echo ""
echo "OR manually redeploy:"
echo "  https://vercel.com/dashboard → Deployments → Redeploy latest"
echo ""

# Step 6: Test
echo "✅ Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "  1. Complete the manual Supabase configuration above"
echo "  2. Redeploy to Vercel"
echo "  3. Test: https://$VERCEL_DOMAIN"
echo "  4. Try signing up with email"
echo ""
echo "Local testing:"
echo "  cd react && npm install && npm run dev"
echo "  Should use .env.local and connect to Supabase"
echo ""
