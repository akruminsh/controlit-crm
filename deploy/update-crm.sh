#!/bin/bash
# Controlit CRM Update Script
# Run this on the VPS to pull the latest image and restart

set -e

REGISTRY="ghcr.io"
IMAGE="akruminsh/controlit-crm"
DEPLOY_DIR="/opt/controlit-crm"

echo "🔄 Pulling latest Controlit CRM image..."
docker pull ${REGISTRY}/${IMAGE}:latest

echo "🔄 Stopping current containers..."
cd ${DEPLOY_DIR}
docker compose -f docker-compose.prod.yml down

echo "🚀 Starting updated containers..."
docker compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for health check..."
sleep 30

echo "✅ Checking container status..."
docker compose -f docker-compose.prod.yml ps

echo ""
echo "🎉 Update complete!"
echo "Visit: https://crm.controlitfactory.eu"
