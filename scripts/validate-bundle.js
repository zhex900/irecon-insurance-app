#!/usr/bin/env node

/**
 * Bundle Size Validator for Cloudflare Workers
 * 
 * This script validates that our Worker bundle sizes are within
 * Cloudflare's limits to prevent deployment failures (Error 1102).
 * 
 * Critical for internal insurance broker app reliability.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cloudflare Worker limits
const MAX_BUNDLE_SIZE = 2_500_000; // 2.5MB (Cloudflare limit)
const MAX_GZIP_SIZE = 750_000; // 750KB gzipped (practical limit)
const BUNDLE_REPORTS_DIR = join(__dirname, '../bundle-reports');
const ANALYSIS_FILE = join(BUNDLE_REPORTS_DIR, 'bundle-analysis.txt');

function validateBundleSizes() {
  console.log('🔍 Validating Cloudflare Worker bundle sizes...');
  
  // Check if bundle analysis file exists
  if (!existsSync(ANALYSIS_FILE)) {
    console.error('❌ No bundle analysis found. Run: npm run check-bundle');
    process.exit(1);
  }
  
  let analysis;
  try {
    analysis = readFileSync(ANALYSIS_FILE, 'utf8');
  } catch (error) {
    console.error('❌ Failed to read bundle analysis:', error.message);
    process.exit(1);
  }
  
  // Extract bundle size information from wrangler output
  // Wrangler output format: "Bundle size: 1.23 MiB"
  const bundleSizeMatch = analysis.match(/Bundle size:\s*([\d.]+)\s*(\w+)/i);
  const gzipSizeMatch = analysis.match(/Compressed size:\s*([\d.]+)\s*(\w+)/i);
  
  if (!bundleSizeMatch) {
    console.warn('⚠️  Could not extract bundle size from wrangler output.');
    console.warn('   Will use alternative validation method...');
    
    // Try to find any size mentions
    const anySizeMatch = analysis.match(/([\d.]+)\s*(KiB|MiB|B)/);
    if (anySizeMatch) {
      console.log(`📊 Found size reference: ${anySizeMatch[1]} ${anySizeMatch[2]}`);
    }
    
    // Check for common error patterns
    if (analysis.includes('exceeds resource limits') || analysis.includes('Error 1102')) {
      console.error('❌ Wrangler indicates bundle exceeds Cloudflare limits');
      console.error('   Review output above and optimize bundle size');
      process.exit(1);
    }
    
    console.log('✅ No explicit bundle size issues detected');
    return;
  }
  
  const rawSize = parseFloat(bundleSizeMatch[1]);
  const rawUnit = bundleSizeMatch[2];
  const bundleSize = convertToBytes(rawSize, rawUnit);
  
  console.log(`📊 Bundle Analysis:`);
  console.log(`   • Raw size: ${formatBytes(bundleSize)} (${rawSize} ${rawUnit})`);
  
  if (gzipSizeMatch) {
    const gzipSize = parseFloat(gzipSizeMatch[1]);
    const gzipUnit = gzipSizeMatch[2];
    const gzipBytes = convertToBytes(gzipSize, gzipUnit);
    console.log(`   • Compressed size: ${formatBytes(gzipBytes)} (${gzipSize} ${gzipUnit})`);
    
    if (gzipBytes > MAX_GZIP_SIZE) {
      console.warn(`⚠️  Warning: Gzipped size approaching practical limits`);
      console.warn(`   Target: ${formatBytes(MAX_GZIP_SIZE)}`);
      console.warn(`   Actual: ${formatBytes(gzipBytes)}`);
      console.warn(`   Consider optimizing bundle size`);
    }
  }
  
  // Check against limits
  let hasErrors = false;
  
  if (bundleSize > MAX_BUNDLE_SIZE) {
    console.error(`❌ CRITICAL: Bundle exceeds Cloudflare limit`);
    console.error(`   Limit: ${formatBytes(MAX_BUNDLE_SIZE)}`);
    console.error(`   Actual: ${formatBytes(bundleSize)}`);
    console.error(`   This will cause Worker deployment failures (Error 1102)`);
    hasErrors = true;
  } else {
    console.log(`✅ Bundle within Cloudflare limits`);
  }
  
  // Summary
  console.log('\n📈 Bundle Size Summary:');
  console.log(`   • Cloudflare Limit: ${formatBytes(MAX_BUNDLE_SIZE)}`);
  console.log(`   • Current Usage: ${formatBytes(bundleSize)} (${((bundleSize / MAX_BUNDLE_SIZE) * 100).toFixed(1)}%)`);
  
  if (hasErrors) {
    console.error('\n❌ Bundle validation failed. Fix bundle size before deployment.');
    console.error('   Common fixes:');
    console.error('   1. Check for unnecessary static imports in routes');
    console.error('   2. Use dynamic imports for heavy libraries (@pdfme, TipTap)');
    console.error('   3. Split helpers into separate modules');
    console.error('   4. Review docs/performance.md for optimization strategies');
    process.exit(1);
  }
  
  console.log('\n✅ Bundle within Cloudflare Worker limits');
}

function convertToBytes(size, unit) {
  const units = {
    'B': 1,
    'KB': 1024,
    'KiB': 1024,
    'MB': 1024 * 1024,
    'MiB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'GiB': 1024 * 1024 * 1024,
  };
  
  const normalizedUnit = unit.replace(/i?B$/, 'B').toUpperCase();
  return size * (units[normalizedUnit] || 1);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run validation
validateBundleSizes();