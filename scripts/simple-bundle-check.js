#!/usr/bin/env node

/**
 * Simple Bundle Size Checker for Internal Insurance Apps
 * 
 * Focuses on what matters for Cloudflare Workers and broker productivity.
 * Checks server bundles (Worker-relevant) and alerts on genuinely problematic sizes.
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BUILD_DIR = join(__dirname, '../build');

// Focus on Worker-relevant files (server bundles)
const WORKER_SIZE_LIMIT = 2_500_000; // 2.5MB Cloudflare limit
const WORKER_WARNING_LIMIT = 2_000_000; // 2MB warning threshold

// Reasonable limits for browser bundles (affect broker experience)
const BROWSER_JS_LIMIT = 1_000_000; // 1MB per JS file reasonable
const BROWSER_WASM_LIMIT = 5_000_000; // 5MB for WASM files (PDFium)

function checkBundleSizes() {
  console.log('📦 Checking bundle sizes for internal insurance app...');
  console.log('   Focus: Worker reliability & broker productivity\n');
  
  if (!existsSync(BUILD_DIR)) {
    console.error('❌ No build directory found. For full check: npm run build');
    console.log('   For quick check: npm run check:bundle:quick (requires existing build)');
    return;
  }
  
  const workerFiles = [];
  const browserFiles = [];
  let totalWorkerSize = 0;
  
  // Scan server directory (Cloudflare Worker bundles)
  const serverDir = join(BUILD_DIR, 'server');
  if (existsSync(serverDir)) {
    console.log('🔍 Checking Cloudflare Worker bundles (server/):');
    
    const serverFiles = scanForJsFiles(serverDir, 'server/');
    serverFiles.forEach(file => {
      workerFiles.push(file);
      totalWorkerSize += file.size;
    });
    
    // Check main server bundle (likely the Worker entry point)
    const mainServerBundle = serverFiles.find(f => 
      f.path.includes('server-build') || 
      f.path.includes('index.js') ||
      f.path.includes('entry.')
    );
    
    if (mainServerBundle) {
      console.log(`   • Main Worker bundle: ${mainServerBundle.path} - ${formatBytes(mainServerBundle.size)}`);
      
      if (mainServerBundle.size > WORKER_SIZE_LIMIT) {
        console.error(`❌ CRITICAL: Main Worker bundle exceeds Cloudflare limit!`);
        console.error(`   Limit: ${formatBytes(WORKER_SIZE_LIMIT)}`);
        console.error(`   Actual: ${formatBytes(mainServerBundle.size)}`);
        console.error(`   This may cause Error 1102 (Worker exceeded resource limits)`);
        console.error('\n💡 Immediate actions:');
        console.error('   1. Use dynamic imports for heavy libraries (@pdfme, TipTap)');
        console.error('   2. Split helpers into separate server-only modules');
        console.error('   3. Review docs/performance.md for Worker optimization');
        process.exit(1);
      } else if (mainServerBundle.size > WORKER_WARNING_LIMIT) {
        console.warn(`⚠️  Warning: Main Worker bundle approaching Cloudflare limit`);
        console.warn(`   Warning threshold: ${formatBytes(WORKER_WARNING_LIMIT)}`);
        console.warn(`   Current: ${formatBytes(mainServerBundle.size)}`);
        console.warn(`   🎯 Target: Keep under ${formatBytes(WORKER_SIZE_LIMIT)}`);
      } else {
        console.log(`✅ Main Worker bundle within safe limits`);
      }
    }
  } else {
    console.log('   ℹ️  No server directory found (Worker bundles)');
  }
  
  // Check browser bundles (affect broker experience)
  const clientDir = join(BUILD_DIR, 'client');
  if (existsSync(clientDir)) {
    console.log('\n🔍 Checking browser bundles (client/):');
    
    const clientFiles = scanForJsFiles(clientDir, 'client/');
    clientFiles.forEach(file => browserFiles.push(file));
    
    // Check for problematic browser files
    const largeBrowserFiles = browserFiles.filter(f => f.size > BROWSER_JS_LIMIT);
    const wasmFiles = browserFiles.filter(f => f.path.includes('.wasm'));
    
    if (wasmFiles.length > 0) {
      console.log(`   • WASM files: ${wasmFiles.length} found`);
      wasmFiles.forEach(file => {
        console.log(`     ${file.path} - ${formatBytes(file.size)}`);
        if (file.size > BROWSER_WASM_LIMIT) {
          console.warn(`     ⚠️  Large WASM file may affect broker experience`);
        }
      });
    }
    
    if (largeBrowserFiles.length > 0) {
      console.warn(`\n⚠️  ${largeBrowserFiles.length} browser JS files exceed ${formatBytes(BROWSER_JS_LIMIT)}:`);
      largeBrowserFiles.slice(0, 5).forEach(file => {
        console.warn(`   • ${file.path} - ${formatBytes(file.size)}`);
      });
      
      if (largeBrowserFiles.length > 5) {
        console.warn(`   • ...and ${largeBrowserFiles.length - 5} more`);
      }
      
      console.log('\n💡 Consider for broker productivity:');
      console.log('   1. Code splitting for large features');
      console.log('   2. Lazy load PDF/Excel generation');
      console.log('   3. Optimize third-party library usage');
    } else {
      console.log('✅ Browser bundles within reasonable limits');
    }
  }
  
  // Summary
  console.log('\n📊 Bundle Health Summary:');
  console.log(`   • Worker bundles: ${workerFiles.length} files, ${formatBytes(totalWorkerSize)} total`);
  
  const mainWorkerFile = workerFiles.find(f => f.size > 1000000); // Find largest worker file
  if (mainWorkerFile) {
    console.log(`   • Largest Worker file: ${mainWorkerFile.path} - ${formatBytes(mainWorkerFile.size)}`);
    const percentage = (mainWorkerFile.size / WORKER_SIZE_LIMIT) * 100;
    console.log(`   • Cloudflare limit usage: ${percentage.toFixed(1)}%`);
  }
  
  console.log(`   • Browser bundles: ${browserFiles.length} JS files`);
  
  // Final recommendation
  console.log('\n🎯 Recommendation:');
  if (totalWorkerSize > WORKER_WARNING_LIMIT) {
    console.log('   ⚠️  Focus on Worker bundle optimization');
    console.log('      Critical for Cloudflare deployment success');
  } else {
    console.log('   ✅ Bundle sizes acceptable for internal app');
    console.log('      Monitor for regressions before deployment');
  }
}

function scanForJsFiles(dir, prefix = '') {
  const files = [];
  
  function scan(currentDir, currentPrefix) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relativePath = currentPrefix + entry.name;
      
      if (entry.isDirectory()) {
        scan(fullPath, relativePath + '/');
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const stats = statSync(fullPath);
        files.push({ path: relativePath, size: stats.size });
      }
    }
  }
  
  scan(dir, prefix);
  return files.sort((a, b) => b.size - a.size);
}

function existsSync(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run check
checkBundleSizes();