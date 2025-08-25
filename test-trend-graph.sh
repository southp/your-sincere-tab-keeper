#!/bin/bash
# Trend Graph Component Test Server
# Serves the isolated integration test page directly at root

echo "🧪 Starting Trend Graph Component Test Server..."
echo "📊 This will serve the trend-graph integration test at the root"
echo "🌐 Test page: http://localhost:8080"
echo "⏹️  Press Ctrl+C to stop the server"
echo ""

# Start Node.js server
if command -v node &> /dev/null; then
    echo "✅ Starting custom Node.js server with proper CSP headers"
    node test-server.cjs
else
    echo "❌ Node.js not found"
    echo "💡 Please install Node.js: https://nodejs.org"
    exit 1
fi