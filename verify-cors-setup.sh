#!/bin/bash

# CORS Setup Verification Script
# Checks if all required CORS configurations are in place

set -e

CUSTOMER_WEB_PATH="/home/jire87/software/www-website/www-data/hidros-app/customer_web"
VINC_STOREFRONT_PATH="/home/jire87/software/www-website/www-data/vendereincloud-app/vinc-apps/vinc-storefront"

echo "🔍 CORS Configuration Verification"
echo "===================================="
echo ""

# Check 1: Customer Web Environment Variables
echo "✓ Checking Customer Web environment variables..."
if grep -q "NEXT_PUBLIC_B2B_BUILDER_URL" "${CUSTOMER_WEB_PATH}/.env"; then
    BUILDER_URL=$(grep "NEXT_PUBLIC_B2B_BUILDER_URL" "${CUSTOMER_WEB_PATH}/.env" | cut -d'=' -f2)
    echo "  ✅ NEXT_PUBLIC_B2B_BUILDER_URL = ${BUILDER_URL}"
else
    echo "  ❌ NEXT_PUBLIC_B2B_BUILDER_URL not found in ${CUSTOMER_WEB_PATH}/.env"
    echo "     Add: NEXT_PUBLIC_B2B_BUILDER_URL=http://149.81.163.109:3001"
fi

if grep -q "VINC_STOREFRONT_URL" "${CUSTOMER_WEB_PATH}/.env"; then
    STOREFRONT_URL=$(grep "VINC_STOREFRONT_URL" "${CUSTOMER_WEB_PATH}/.env" | cut -d'=' -f2)
    echo "  ✅ VINC_STOREFRONT_URL = ${STOREFRONT_URL}"
else
    echo "  ❌ VINC_STOREFRONT_URL not found in ${CUSTOMER_WEB_PATH}/.env"
    echo "     Add: VINC_STOREFRONT_URL=http://149.81.163.109:3001"
fi

echo ""

# Check 2: Customer Web Next.js Config
echo "✓ Checking Customer Web next.config.js..."
if grep -q "frame-ancestors" "${CUSTOMER_WEB_PATH}/next.config.js"; then
    echo "  ✅ frame-ancestors CSP header configured"
else
    echo "  ❌ frame-ancestors CSP header not found"
    echo "     Update ${CUSTOMER_WEB_PATH}/next.config.js"
fi

if grep -q "149.81.163.109:3001" "${CUSTOMER_WEB_PATH}/next.config.js"; then
    echo "  ✅ Production URL included in Permissions-Policy"
else
    echo "  ⚠️  Production URL not in Permissions-Policy"
    echo "     Update Permissions-Policy in ${CUSTOMER_WEB_PATH}/next.config.js"
fi

echo ""

# Check 3: VINC Storefront Environment
echo "✓ Checking VINC Storefront environment variables..."
if [ -f "${VINC_STOREFRONT_PATH}/.env.runtime" ]; then
    if grep -q "NEXT_PUBLIC_CUSTOMER_WEB_URL" "${VINC_STOREFRONT_PATH}/.env.runtime"; then
        CUSTOMER_URL=$(grep "NEXT_PUBLIC_CUSTOMER_WEB_URL" "${VINC_STOREFRONT_PATH}/.env.runtime" | cut -d'=' -f2)
        echo "  ✅ NEXT_PUBLIC_CUSTOMER_WEB_URL = ${CUSTOMER_URL}"
    else
        echo "  ❌ NEXT_PUBLIC_CUSTOMER_WEB_URL not found"
    fi
else
    echo "  ⚠️  .env.runtime not found (will be created during deployment)"
fi

echo ""

# Check 4: Docker Compose Files
echo "✓ Checking Docker configuration..."
if [ -f "${VINC_STOREFRONT_PATH}/docker-compose.stack.yml" ]; then
    echo "  ✅ docker-compose.stack.yml exists"
    if grep -q "vinc-storefront" "${VINC_STOREFRONT_PATH}/docker-compose.stack.yml"; then
        echo "  ✅ vinc-storefront service configured"
    fi
else
    echo "  ❌ docker-compose.stack.yml not found"
fi

echo ""

# Check 5: Dockerfile
echo "✓ Checking Dockerfile..."
if [ -f "${VINC_STOREFRONT_PATH}/Dockerfile" ]; then
    echo "  ✅ Dockerfile exists"
else
    echo "  ❌ Dockerfile not found"
fi

echo ""
echo "===================================="
echo "Verification complete!"
echo ""
echo "Next steps:"
echo "1. Review any ❌ items above"
echo "2. Rebuild customer_web if changes were made:"
echo "   cd ${CUSTOMER_WEB_PATH} && pnpm build"
echo "3. Deploy vinc-storefront:"
echo "   cd ${VINC_STOREFRONT_PATH} && ./deploy.sh"
echo ""

# Check if applications are running
echo "🌐 Checking running services..."
if curl -s -o /dev/null -w "%{http_code}" http://149.81.163.109:3000 | grep -q "200\|301\|302"; then
    echo "  ✅ Customer Web is responding on port 3000"
else
    echo "  ⚠️  Customer Web may not be running on port 3000"
fi

if curl -s -o /dev/null -w "%{http_code}" http://149.81.163.109:3001 | grep -q "200\|301\|302"; then
    echo "  ✅ VINC Storefront is responding on port 3001"
else
    echo "  ⚠️  VINC Storefront may not be running on port 3001 (expected if not yet deployed)"
fi

echo ""
