const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const children = [];

function log(prefix, color, message) {
  const reset = '\x1b[0m';
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${prefix} ${timestamp}]${reset} ${message}`);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true); // Port is open / active
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

function runProcess(name, color, cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd: cwd || process.cwd(),
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (signal !== 'SIGINT' && signal !== 'SIGTERM' && code !== 0 && code !== null) {
      log(name, color, `Process exited with code ${code}`);
    }
  });

  return child;
}

async function start() {
  console.log('\x1b[1m\x1b[35m=== Starting Dough & Co. Pizza Delivery (Full-Stack) ===\x1b[0m\n');

  // 1. Check if MongoDB is already active on 27017
  const mongoActive = await checkPort(27017);
  if (!mongoActive) {
    log('MONGO', '\x1b[33m', 'Starting local MongoDB replica set on port 27017...');
    runProcess('MONGO', '\x1b[33m', 'node', ['server/src/scripts/startLocalMongo.js']);

    // Wait until Mongo responds on 27017
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkPort(27017)) {
        ready = true;
        break;
      }
    }
    if (ready) {
      log('MONGO', '\x1b[33m', 'Local MongoDB is ready on port 27017 (rs0).');
    }
  } else {
    log('MONGO', '\x1b[33m', 'MongoDB already running on port 27017.');
  }

  // 2. Start Express Server
  log('SERVER', '\x1b[36m', 'Starting Express server on http://localhost:5001...');
  runProcess('SERVER', '\x1b[36m', 'node', ['server/server.js']);

  // Wait a moment for server to bind
  await new Promise((r) => setTimeout(r, 1500));

  // 3. Start Vite Client
  log('CLIENT', '\x1b[32m', 'Starting Vite frontend on http://localhost:5173...');
  runProcess('CLIENT', '\x1b[32m', npmCmd, ['run', 'dev', '--prefix', 'client']);

  console.log('\n\x1b[1m\x1b[32m✔ Both Server and Client are running!\x1b[0m');
  console.log('  ➜ \x1b[1mFrontend:\x1b[0m \x1b[34mhttp://localhost:5173\x1b[0m');
  console.log('  ➜ \x1b[1mBackend:\x1b[0m  \x1b[34mhttp://localhost:5001\x1b[0m');
  console.log('  ➜ Press \x1b[1mCtrl+C\x1b[0m to stop all services.\n');
}

function cleanup() {
  console.log('\n\x1b[33mShutting down all Pizza Delivery services...\x1b[0m');
  for (const child of children) {
    try {
      if (isWindows) {
        spawn('taskkill', ['/pid', child.pid, '/f', '/t'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch (e) {
      // ignore
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

start().catch((err) => {
  console.error('Failed to start application:', err);
  cleanup();
});
