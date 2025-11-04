#!/bin/bash

# VINC Storefront Deployment Script
# Usage: ./deploy.sh [version]

set -e

VERSION=${1:-"0.1.0"}
IMAGE_NAME="crowdechain/vinc-storefront"
STACK_NAME="vinc-stack"
COMPOSE_FILE="docker-compose.stack.yml"

echo "🚀 Starting deployment of VINC Storefront v${VERSION}"
echo "================================================"

# Check if .env.runtime exists
if [ ! -f ".env.runtime" ]; then
    echo "❌ Error: .env.runtime file not found!"
    echo "Please create .env.runtime with production environment variables."
    exit 1
fi

# Check if docker-compose.stack.yml exists
if [ ! -f "${COMPOSE_FILE}" ]; then
    echo "❌ Error: ${COMPOSE_FILE} not found!"
    exit 1
fi

echo "📦 Step 1/5: Building Docker image..."
docker build -t ${IMAGE_NAME}:${VERSION} .

echo "🏷️  Step 2/5: Tagging image as latest..."
docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest

echo "📤 Step 3/5: Pushing to registry..."
read -p "Push to Docker registry? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker push ${IMAGE_NAME}:${VERSION}
    docker push ${IMAGE_NAME}:latest
    echo "✅ Images pushed successfully"
else
    echo "⏭️  Skipping push to registry (using local image)"
fi

echo "🔄 Step 4/5: Deploying to Docker Swarm..."
if docker stack ps ${STACK_NAME} >/dev/null 2>&1; then
    echo "Stack ${STACK_NAME} already exists, updating..."
    docker stack deploy -c ${COMPOSE_FILE} ${STACK_NAME}
else
    echo "Creating new stack ${STACK_NAME}..."
    docker stack deploy -c ${COMPOSE_FILE} ${STACK_NAME}
fi

echo "⏳ Step 5/5: Waiting for services to start..."
sleep 5

echo ""
echo "📊 Service Status:"
docker stack services ${STACK_NAME}

echo ""
echo "🔍 Recent logs from vinc-storefront:"
docker service logs ${STACK_NAME}_vinc-storefront --tail 20

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Access your applications:"
echo "  - Hidros B2B:       http://149.81.163.109:3000"
echo "  - VINC Storefront:  http://149.81.163.109:3001"
echo ""
echo "Monitor deployment:"
echo "  docker service ps ${STACK_NAME}_vinc-storefront"
echo "  docker service logs ${STACK_NAME}_vinc-storefront -f"
echo ""
