#!/bin/bash

# VINC Commerce Suite Docker Build Script
# Builds runner (Next.js app) and worker (BullMQ) images
#
# Secrets (VINC_MONGO_URL, VINC_ANTHROPIC_API_KEY, REDIS_*) are NOT baked
# into the image — pass them at runtime via docker-compose or docker run -e.
#
# Usage:
#   ./build-docker.sh [version] [--push] [--only runner|worker]
#
# Examples:
#   ./build-docker.sh              # build with version from .env.deploy
#   ./build-docker.sh 2.8.0        # override version
#   ./build-docker.sh 2.8.0 --push # build and push
#   ./build-docker.sh --only runner # build only the runner image
#   ./build-docker.sh --only worker # build only the worker image
#   ./build-docker.sh 2.8.0 --only runner --push

set -e

# ============================================================================
# Arguments
# ============================================================================
VERSION_ARG=""
PUSH=""
BUILD_ONLY=""  # "", "runner", or "worker"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --push)
            PUSH="--push"
            shift
            ;;
        --only)
            BUILD_ONLY="$2"
            if [[ "$BUILD_ONLY" != "runner" && "$BUILD_ONLY" != "worker" ]]; then
                echo "Error: --only accepts 'runner' or 'worker'"
                exit 1
            fi
            shift 2
            ;;
        *)
            VERSION_ARG="$1"
            shift
            ;;
    esac
done

# ============================================================================
# Load Configuration
# ============================================================================
ENV_FILE=".env.deploy"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Configuration file '$ENV_FILE' not found!"
    echo "Copy .env.deploy.example to .env.deploy and fill in values."
    exit 1
fi

echo "Loading configuration: $ENV_FILE"
set -a
source "$ENV_FILE"
set +a

# Use VERSION from argument, or config file, or default
VERSION=${VERSION_ARG:-${VERSION:-"1.0.0"}}

IMAGE_NAME=${DOCKER_IMAGE:-"crowdechain/vinc-commerce-suite"}

echo ""
echo "========================================"
echo "  VINC Commerce Suite Docker Build"
echo "========================================"
echo "Config:  ${ENV_FILE}"
if [[ -n "$BUILD_ONLY" ]]; then
    echo "Target:  ${BUILD_ONLY} only"
fi
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "runner" ]]; then
    echo "Runner:  ${IMAGE_NAME}:${VERSION}"
fi
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "worker" ]]; then
    echo "Worker:  ${IMAGE_NAME}:${VERSION}-worker"
fi
echo "========================================"
echo ""

# ============================================================================
# Display Build Arguments (only what's baked into the image)
# ============================================================================
echo "Build-time args (baked into image):"
echo "    SOLR_URL=${SOLR_URL}"
echo "    SOLR_ENABLED=${SOLR_ENABLED}"
echo "    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}"
echo "    NEXT_PUBLIC_CUSTOMER_WEB_URL=${NEXT_PUBLIC_CUSTOMER_WEB_URL}"
echo ""
echo "Runtime-only (pass via docker-compose):"
echo "    VINC_MONGO_URL, VINC_ANTHROPIC_API_KEY, REDIS_HOST, REDIS_PORT"
echo ""

# ============================================================================
# Build Runner Image (default target)
# ============================================================================
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "runner" ]]; then
    echo "Step 1/5: Building runner image..."

    docker build \
      --build-arg SOLR_URL="${SOLR_URL:-}" \
      --build-arg SOLR_ENABLED="${SOLR_ENABLED:-true}" \
      --build-arg NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL:-}" \
      --build-arg NEXT_PUBLIC_CUSTOMER_WEB_URL="${NEXT_PUBLIC_CUSTOMER_WEB_URL:-}" \
      --build-arg NEXT_PUBLIC_APP_VERSION="${VERSION}" \
      --label "version=${VERSION}" \
      --label "build-date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
      -t ${IMAGE_NAME}:${VERSION} \
      -t ${IMAGE_NAME}:latest \
      .

    echo ""
    echo "Runner build complete!"
    echo ""
else
    echo "Step 1/5: Skipping runner image (--only ${BUILD_ONLY})"
fi

# ============================================================================
# Build Worker Image
# ============================================================================
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "worker" ]]; then
    echo "Step 2/5: Building worker image..."

    docker build --target worker \
      --label "version=${VERSION}-worker" \
      --label "build-date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
      -t ${IMAGE_NAME}:${VERSION}-worker \
      -t ${IMAGE_NAME}:latest-worker \
      .

    echo ""
    echo "Worker build complete!"
    echo ""
else
    echo "Step 2/5: Skipping worker image (--only ${BUILD_ONLY})"
fi

# ============================================================================
# Show Image Tags
# ============================================================================
echo "Step 3/5: Image tags created:"
docker images ${IMAGE_NAME} | head -n 5
echo ""

# ============================================================================
# Test Images
# ============================================================================
echo "Step 4/5: Testing images..."
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "runner" ]]; then
    docker run --rm ${IMAGE_NAME}:${VERSION} node --version
    docker run --rm ${IMAGE_NAME}:${VERSION} sh -c "test -f /app/server.js && echo 'Next.js standalone build verified'"
fi
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "worker" ]]; then
    docker run --rm ${IMAGE_NAME}:${VERSION}-worker node --version
fi
echo ""

# ============================================================================
# Push to Registry
# ============================================================================
if [[ "$PUSH" == "--push" ]]; then
    echo "Step 5/5: Pushing to registry..."
    if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "runner" ]]; then
        docker push ${IMAGE_NAME}:${VERSION}
        docker push ${IMAGE_NAME}:latest
    fi
    if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "worker" ]]; then
        docker push ${IMAGE_NAME}:${VERSION}-worker
        docker push ${IMAGE_NAME}:latest-worker
    fi
    echo "Images pushed successfully!"
else
    echo "Step 5/5: Skipping push (use --push to push to registry)"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Images created:"
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "runner" ]]; then
    echo "  ${IMAGE_NAME}:${VERSION}          (runner)"
fi
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "worker" ]]; then
    echo "  ${IMAGE_NAME}:${VERSION}-worker   (worker)"
fi
echo ""
echo "Image sizes:"
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "runner" ]]; then
    docker images ${IMAGE_NAME}:${VERSION} --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}"
fi
if [[ -z "$BUILD_ONLY" || "$BUILD_ONLY" == "worker" ]]; then
    docker images ${IMAGE_NAME}:${VERSION}-worker --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}"
fi
echo ""
echo "Run with secrets at runtime:"
echo "  docker run -p 3000:3000 -e VINC_MONGO_URL=... -e VINC_ANTHROPIC_API_KEY=... ${IMAGE_NAME}:${VERSION}"
echo ""

if [[ "$PUSH" != "--push" ]]; then
    echo "To push to registry:"
    echo "  ./build-docker.sh ${VERSION} --push"
    echo ""
fi
