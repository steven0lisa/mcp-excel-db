#!/bin/bash

# publish.sh - Automated publishing script
# Features: Build, version update, publish, push code and tags

set -e  # Exit immediately on error

echo "🚀 Starting automated publishing process..."

# 1. Run tests and update badges (mandatory step)
echo "🧪 Running tests and updating badges..."
./test.sh

if [ $? -ne 0 ]; then
    echo "❌ Tests failed, publishing process aborted"
    echo "🚫 All tests must pass before publishing"
    exit 1
fi

echo "✅ All tests passed, badges updated"

# 2. Build project
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed, exiting publishing process"
    exit 1
fi

echo "✅ Build completed"

# 3. Get current version and update patch version
echo "🔢 Updating version number..."

# Read current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Parse version number (major.minor.patch)
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Increment patch version
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

echo "New version: $NEW_VERSION"

# Update version in package.json
if command -v jq >/dev/null 2>&1; then
    # Use jq to update version (if jq is installed)
    jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
else
    # Use sed to update version (compatibility solution)
    sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
    rm -f package.json.bak
fi

echo "✅ Version updated to: $NEW_VERSION"

# 4. Publish to npm
echo "📤 Publishing to npm..."
npm publish --registry=https://registry.npmjs.com

if [ $? -ne 0 ]; then
    echo "❌ npm publish failed, exiting publishing process"
    exit 1
fi

echo "✅ npm publish successful"

# 5. Call gitpush.sh script
echo "📤 Pushing code..."
if [ -f ~/scripts/gitpush.sh ]; then
    ~/scripts/gitpush.sh
    if [ $? -ne 0 ]; then
        echo "⚠️  gitpush.sh execution failed, but continuing publishing process"
    else
        echo "✅ Code push successful"
    fi
else
    echo "⚠️  ~/scripts/gitpush.sh does not exist, skipping code push"
    # Manual commit and push
    git add .
    git commit -m "chore: bump version to $NEW_VERSION" || echo "No changes to commit"
    git push origin $(git branch --show-current) || echo "Push failed, please push manually"
fi


# 6. Create and push git tag
echo "🏷️  Creating and pushing tag..."
TAG_NAME="v$NEW_VERSION"

# Create tag
git tag "$TAG_NAME"

if [ $? -ne 0 ]; then
    echo "❌ Tag creation failed"
    exit 1
fi

# Push tag
git push --tags

if [ $? -ne 0 ]; then
    echo "❌ Tag push failed"
    exit 1
fi

echo "✅ Tag $TAG_NAME created and pushed successfully"
echo "🚀 GitHub Actions will automatically create a GitHub Release"

echo ""
echo "🎉 Publishing process completed!"
echo "📦 New version: $NEW_VERSION"
echo "🏷️  Tag: $TAG_NAME"
echo "📤 Published to: https://registry.npmjs.com"
echo "🔗 GitHub Release will be created automatically at: https://github.com/steven0lisa/mcp-excel-db/releases"
echo ""
echo "You can install the new version with:"
echo "npm install @zhangzichao2008/mcp-excel-db@$NEW_VERSION"