#!/bin/bash

# VINC Storefront Docker Build Script
# Image: crowdechain/storefront-builder
# Usage: ./build-docker.sh [version] [--push]

set -e

VERSION=${1:-"1.0.0"}
IMAGE_NAME="crowdechain/storefront-builder"
PUSH=${2:-""}

echo "🏗️  Building VINC Storefront Docker Image"
echo "=========================================="
echo "Image: ${IMAGE_NAME}:${VERSION}"
echo ""

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Error: Dockerfile not found!"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    exit 1
fi

# Extract version from package.json for reference
PKG_VERSION=$(grep '"version"' package.json | head -1 | awk -F'"' '{print $4}')
echo "📦 package.json version: ${PKG_VERSION}"
echo "🐋 Docker image version: ${VERSION}"
echo ""

echo "🔨 Step 1/4: Building Docker image..."
docker build \
  -t ${IMAGE_NAME}:${VERSION} \
  -t ${IMAGE_NAME}:latest \
  --label "version=${VERSION}" \
  --label "build-date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --label "vcs-ref=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
  .

echo ""
echo "✅ Build complete!"
echo ""

echo "🏷️  Step 2/4: Image tags created:"
docker images ${IMAGE_NAME} | head -n 2

echo ""

# Test the image
echo "🧪 Step 3/4: Testing image..."
docker run --rm ${IMAGE_NAME}:${VERSION} node --version
docker run --rm ${IMAGE_NAME}:${VERSION} sh -c "ls -la /app/.next > /dev/null && echo '✅ Next.js build verified'"

echo ""

# Push if requested
if [[ "$PUSH" == "--push" ]]; then
    echo "📤 Step 4/4: Pushing to registry..."

    read -p "Push ${IMAGE_NAME}:${VERSION} to Docker registry? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker push ${IMAGE_NAME}:${VERSION}
        docker push ${IMAGE_NAME}:latest
        echo "✅ Images pushed successfully!"
    else
        echo "⏭️  Push cancelled"
    fi
else
    echo "⏭️  Step 4/4: Skipping push (use --push to push to registry)"
fi

echo ""
echo "=========================================="
echo "✅ Build Complete!"
echo ""
echo "Images created:"
echo "  ${IMAGE_NAME}:${VERSION}"
echo "  ${IMAGE_NAME}:latest"
echo ""
echo "Local test:"
echo "  docker run -p 3001:3000 --env-file .env.runtime \\"
echo "    ${IMAGE_NAME}:${VERSION}"
echo ""
if [[ "$PUSH" != "--push" ]]; then
    echo "To push to registry:"
    echo "  ./build-docker.sh ${VERSION} --push"
    echo ""
fi

# Show image size
echo "Image size:"
docker images ${IMAGE_NAME}:${VERSION} --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
echo ""
