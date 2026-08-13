#!/usr/bin/env node

/**
 * Development script to start all Workers simultaneously
 * 
 * Starts:
 * 1. Documents Worker (port 8787)
 * 2. Excel Worker (port 8788)
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const WORKERS = [
  {
    name: 'Documents Worker',
    config: 'wrangler.documents.jsonc',
    port: 8787,
    inspectorPort: 9230,
    envFile: 'workers/documents-local.env'
  },
  {
    name: 'Excel Worker',
    config: 'wrangler.excel.jsonc',
    port: 8788,
    inspectorPort: 9231,
    envFile: null
  }
];

// Keep track of processes
const processes = [];

// Cleanup function
function cleanup() {
  console.log('\n🛑 Stopping all Workers...');
  
  processes.forEach(proc => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
  });
  
  setTimeout(() => {
    console.log('✅ All Workers stopped');
    process.exit(0);
  }, 1000);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Start Worker
function startWorker(worker) {
  console.log(`🚀 Starting ${worker.name} on port ${worker.port}...`);
  
  const args = [
    'wrangler',
    'dev',
    '--config', worker.config,
    '--port', worker.port.toString(),
    '--inspector-port', worker.inspectorPort.toString()
  ];
  
  // Add environment file if specified
  if (worker.envFile) {
    args.push('--env-file', worker.envFile);
  }
  
  const proc = spawn('npx', args, {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '1'
    }
  });
  
  processes.push(proc);
  
  proc.on('error', (error) => {
    console.error(`❌ Failed to start ${worker.name}:`, error.message);
  });
  
  proc.on('exit', (code) => {
    console.log(`⚠️ ${worker.name} exited with code ${code}`);
  });
  
  return proc;
}

// Main function
async function main() {
  console.log('🎯 Starting all Workers for local development...\n');
  
  console.log('📋 Worker Configuration:');
  console.log('------------------------');
  WORKERS.forEach(worker => {
    console.log(`• ${worker.name}:`);
    console.log(`  - Config: ${worker.config}`);
    console.log(`  - Port: ${worker.port}`);
    console.log(`  - Inspector Port: ${worker.inspectorPort}`);
    console.log(`  - URL: http://localhost:${worker.port}`);
    if (worker.envFile) {
      console.log(`  - Env: ${worker.envFile}`);
    }
    console.log('');
  });
  
  console.log('🔗 Main App Configuration:');
  console.log('-------------------------');
  console.log('• Set in .env file:');
  console.log('  DOCUMENT_SERVICE_URL=http://localhost:8787');
  console.log('  EXCEL_WORKER_URL=http://localhost:8788');
  console.log('');
  
  console.log('🚦 Starting Workers...\n');
  
  // Start all workers
  WORKERS.forEach(startWorker);
  
  console.log('\n✅ All Workers started!');
  console.log('\n📊 Status:');
  console.log('---------');
  console.log('• Documents Worker: http://localhost:8787');
  console.log('• Excel Worker: http://localhost:8788');
  console.log('• Main App: npm run dev (in another terminal)');
  
  console.log('\n🩺 Health Check URLs:');
  console.log('-------------------');
  console.log('• Documents Worker: curl http://localhost:8787');
  console.log('• Excel Worker: curl http://localhost:8788/health');
  console.log('• Excel Worker Info: curl http://localhost:8788/info');
  
  console.log('\n🛑 To stop all Workers: Press Ctrl+C\n');
  
  // Keep process alive
  await new Promise(() => {});
}

// Run
main().catch(error => {
  console.error('❌ Failed to start Workers:', error);
  cleanup();
  process.exit(1);
});