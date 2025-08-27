#!/bin/bash

echo "===================================="
echo "   AirHost AI - Auto Deploy Script"
echo "===================================="
echo

# Check if commit message was provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide a commit message"
    echo "Usage: ./deploy.sh \"Your commit message here\""
    exit 1
fi

COMMIT_MSG="$1"

echo "📝 Commit message: $COMMIT_MSG"
echo

# Add all changes
echo "🔄 Adding changes to git..."
git add .
if [ $? -ne 0 ]; then
    echo "❌ Error adding files to git"
    exit 1
fi

# Commit with timestamp
echo "📦 Committing changes..."
git commit -m "$COMMIT_MSG

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
if [ $? -ne 0 ]; then
    echo "⚠️ Nothing to commit or commit failed"
    echo "Continuing with deployment..."
fi

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push origin main
if [ $? -ne 0 ]; then
    echo "❌ Error pushing to GitHub"
    exit 1
fi

# Deploy to Railway
echo "🚂 Deploying to Railway..."
railway up
if [ $? -ne 0 ]; then
    echo "❌ Error deploying to Railway"
    exit 1
fi

echo
echo "✅ Deployment completed successfully!"
echo "🌐 Backend URL: https://airhost-backend-production.up.railway.app"
echo "📊 Health Check: https://airhost-backend-production.up.railway.app/api/health"
echo