#!/bin/bash
# Version alignment checker - prevents npm/git divergence
# Runs before npm publish to ensure package.json version has a corresponding git tag

set -e

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

echo "📋 Checking version alignment..."
echo "   Package version: $VERSION"
echo "   Expected git tag: $TAG"

# Check if git tag exists
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    echo ""
    echo "❌ ERROR: Git tag $TAG does not exist"
    echo ""
    echo "Before publishing, you must:"
    echo "  1. Commit your changes (including package.json version bump)"
    echo "  2. Create annotated tag: git tag -a $TAG -m 'Version $VERSION'"
    echo "  3. Push tag: git push origin $TAG"
    echo ""
    echo "Or use: npm version [patch|minor|major] (creates tag automatically)"
    exit 1
fi

# Check if tag points to current commit or an ancestor
CURRENT_COMMIT=$(git rev-parse HEAD)
TAG_COMMIT=$(git rev-parse "$TAG^{commit}")

if [ "$CURRENT_COMMIT" != "$TAG_COMMIT" ]; then
    echo ""
    echo "⚠️  WARNING: Tag $TAG points to a different commit"
    echo "   Tag commit:     $TAG_COMMIT"
    echo "   Current commit: $CURRENT_COMMIT"
    echo ""
    echo "This usually means you:"
    echo "  - Made changes after tagging (need new version)"
    echo "  - Forgot to tag the current commit"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo ""
    echo "❌ ERROR: Working directory has uncommitted changes"
    echo ""
    echo "Commit all changes before publishing:"
    git status --short
    exit 1
fi

echo "✅ Version alignment verified"
echo "   Tag $TAG exists and points to $(git log -1 --oneline $TAG)"
