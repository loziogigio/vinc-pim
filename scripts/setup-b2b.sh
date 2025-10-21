#!/bin/bash

# B2B Module Setup Script
# This script installs dependencies and sets up the B2B module

set -e

echo "=========================================="
echo "  B2B Module Setup"
echo "=========================================="
echo ""

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first."
    exit 1
fi

echo "📦 Installing dependencies..."
pnpm add bcryptjs @radix-ui/react-label
pnpm add -D @types/bcryptjs

echo ""
echo "✅ Dependencies installed successfully!"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found"
    echo "Creating .env.local with required variables..."

    # Generate a random session secret
    SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)

    cat > .env.local <<EOF
# MongoDB Connection
VINC_MONGO_URI=mongodb://localhost:27017/vinc-storefront

# Session Secret (auto-generated)
SESSION_SECRET=${SESSION_SECRET}

# Node Environment
NODE_ENV=development
EOF

    echo "✅ Created .env.local"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🗄️  Setting up database..."

# Check if MongoDB is running
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB CLI not found. Make sure MongoDB is running."
else
    # Try to connect to MongoDB
    if mongosh --eval "db.version()" > /dev/null 2>&1; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  Cannot connect to MongoDB. Please start MongoDB first."
    fi
fi

echo ""
echo "👤 Creating test B2B user and sample data..."
npx tsx scripts/seed-b2b-user.ts

echo ""
echo "=========================================="
echo "  ✅ B2B Module Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Start the development server:"
echo "     pnpm dev"
echo ""
echo "  2. Access the B2B portal at:"
echo "     http://localhost:3000/b2b/login"
echo ""
echo "  3. Login with:"
echo "     Username: b2b_admin"
echo "     Password: admin123"
echo ""
echo "For more information, see docs/B2B_MODULE_SETUP.md"
echo ""
