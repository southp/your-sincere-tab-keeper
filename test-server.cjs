#!/usr/bin/env node
/**
 * Simple HTTP server for trend-graph testing
 * Serves files with proper headers to avoid CSP issues
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;

// MIME type mapping
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // Default to trend-graph-test.html for root requests
    if (pathname === '/') {
        pathname = '/trend-graph-test.html';
    }
    
    // Map paths appropriately
    let filePath;
    if (pathname.startsWith('/src/')) {
        // Serve src files from project src directory
        filePath = path.join(__dirname, pathname);
    } else if (pathname === '/trend-graph-test.html') {
        // Serve test file from test directory
        filePath = path.join(__dirname, 'test', 'trend-graph-test.html');
    } else {
        // Default to project root
        filePath = path.join(__dirname, pathname);
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('404 Not Found');
            console.log(`❌ 404: ${pathname}`);
            return;
        }
        
        const mimeType = getMimeType(filePath);
        
        // Set headers to avoid CSP issues
        const headers = {
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache',
            // Permissive CSP for testing
            'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        };
        
        res.writeHead(200, headers);
        res.end(data);
        
        console.log(`✅ Served: ${pathname} (${mimeType})`);
    });
});

server.listen(PORT, () => {
    console.log('🧪 Trend Graph Component Test Server Started');
    console.log(`📊 Server running at http://localhost:${PORT}`);
    console.log('🌐 Test page served directly at root URL');
    console.log('⏹️  Press Ctrl+C to stop');
    console.log('');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try stopping other servers or use a different port');
    } else {
        console.error('❌ Server error:', err);
    }
});