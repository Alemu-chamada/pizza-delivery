const { spawn, spawnSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const children = [];

function log(prefix, color, message) {
  const reset = '\x1b[0m';
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${prefix} ${timestamp}]${reset} ${message}`);
}

/**
 * Determine configured MongoDB URI from environment or server/.env
 * @returns {string} Configured URI
 */
function getMongoTarget() {
  const envPath = path.resolve(__dirname, '../server/.env');
  let uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri && fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('MONGO_URI=')) {
        uri = trimmed.slice('MONGO_URI='.length).trim();
        break;
      }
      if (trimmed.startsWith('MONGODB_URI=')) {
        uri = trimmed.slice('MONGODB_URI='.length).trim();
      }
    }
  }
  return uri || 'mongodb://127.0.0.1:27017/pizza-delivery';
}

/**
 * Identify PID and process name holding a specific local TCP port.
 * @param {number} port
 * @returns {{ pid: string, processName: string } | null}
 */
function findConflictingProcess(port) {
  try {
    if (isWindows) {
      const netstat = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
      if (netstat.stdout) {
        const lines = netstat.stdout.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length >= 5 && parts[1].endsWith(`:${port}`)) {
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              const task = spawnSync('tasklist', ['/fi', `pid eq ${pid}`, '/fo', 'csv', '/nh'], {
                encoding: 'utf8',
              });
              const match = task.stdout?.match(/^"([^"]+)"/);
              return { pid, processName: match ? match[1] : 'unknown' };
            }
          }
        }
      }
    } else {
      const lsof = spawnSync('lsof', ['-i', `:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
      const pid = lsof.stdout?.trim().split('\n')[0];
      if (pid) {
        return { pid, processName: 'unknown' };
      }
    }
  } catch {
    // Lookup failure is non-fatal
  }
  return null;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(600);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true); // Port is open / active
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      const v6 = new net.Socket();
      v6.setTimeout(600);
      v6.on('connect', () => {
        v6.destroy();
        resolve(true);
      });
      v6.on('timeout', () => {
        v6.destroy();
        resolve(false);
      });
      v6.on('error', () => {
        v6.destroy();
        resolve(false);
      });
      v6.connect(port, '::1');
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

function cleanup() {
  console.log('\n\x1b[33mShutting down all Pizza Delivery services...\x1b[0m');
  for (const child of children) {
    try {
      if (isWindows) {
        spawnSync('taskkill', ['/pid', child.pid, '/f', '/t'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // ignore
    }
  }
}

async function start() {
  console.log('\x1b[1m\x1b[35m=== Starting Dough & Co. Pizza Delivery (Full-Stack) ===\x1b[0m\n');

  // 1. Check if configured database is remote (Atlas) or local
  const mongoTarget = getMongoTarget();
  const isRemote = mongoTarget.startsWith('mongodb+srv://')
    || (!mongoTarget.includes('127.0.0.1') && !mongoTarget.includes('localhost'));

  if (isRemote) {
    const masked = mongoTarget.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    log('MONGO', '\x1b[32m', `Using remote MongoDB Atlas cluster: ${masked}`);
  } else {
    // Check & start local MongoDB on port 27017
    const mongoActive = await checkPort(27017);
    if (!mongoActive) {
      log('MONGO', '\x1b[33m', 'Starting local MongoDB replica set on port 27017...');
      const mongoChild = runProcess('MONGO', '\x1b[33m', 'node', ['server/src/scripts/startLocalMongo.js']);

      let mongoExited = false;
      mongoChild.on('exit', () => {
        mongoExited = true;
      });

      let ready = false;
      for (let i = 0; i < 25; i += 1) {
        /* eslint-disable no-await-in-loop */
        await new Promise((r) => setTimeout(r, 1000));
        if (mongoExited) {
          log('MONGO', '\x1b[31m', 'Local MongoDB process terminated prematurely. Aborting startup.');
          cleanup();
          process.exit(1);
        }
        if (await checkPort(27017)) {
          ready = true;
          break;
        }
      }
      if (ready) {
        log('MONGO', '\x1b[32m', 'Local MongoDB is ready on port 27017 (rs0).');
      } else {
        log('MONGO', '\x1b[31m', 'Timed out waiting for MongoDB to become ready on port 27017. Aborting startup.');
        cleanup();
        process.exit(1);
      }
    } else {
      log('MONGO', '\x1b[32m', 'MongoDB is active on port 27017.');
    }
  }

  // 2. Pre-check port 5001 for conflicts
  const conflict5001 = findConflictingProcess(5001);
  const port5001Busy = conflict5001 || (await checkPort(5001));
  if (port5001Busy) {
    const conflict = conflict5001 || findConflictingProcess(5001);
    log('SERVER', '\x1b[31m', `Port conflict: port 5001 is already in use by process: ${conflict?.processName || 'unknown'} (PID: ${conflict?.pid || 'unknown'}).`);
    log('SERVER', '\x1b[31m', 'Cannot start Express backend on port 5001. Please terminate the conflicting process or change PORT in server/.env.');
    cleanup();
    process.exit(1);
  }

  // 3. Start Express Server
  log('SERVER', '\x1b[36m', 'Starting Express server on http://localhost:5001...');
  const serverChild = runProcess('SERVER', '\x1b[36m', 'node', ['server/server.js']);

  let serverExited = false;
  serverChild.on('exit', () => {
    serverExited = true;
  });

  // 4. Wait for Express to be listening on 5001
  let serverReady = false;
  for (let i = 0; i < 40; i += 1) {
    /* eslint-disable no-await-in-loop */
    await new Promise((r) => setTimeout(r, 500));
    if (serverExited) {
      log('SERVER', '\x1b[31m', 'Express server exited unexpectedly during startup. Aborting.');
      cleanup();
      process.exit(1);
    }
    if (await checkPort(5001)) {
      serverReady = true;
      break;
    }
  }

  if (!serverReady) {
    log('SERVER', '\x1b[31m', 'Timed out waiting for Express server to bind to port 5001. Aborting.');
    cleanup();
    process.exit(1);
  }
  log('SERVER', '\x1b[32m', 'Express server is confirmed listening on http://localhost:5001.');

  // 5. Check if port 5173 is already in use
  const port5173Busy = await checkPort(5173);
  if (port5173Busy) {
    const conflict = findConflictingProcess(5173);
    log('CLIENT', '\x1b[33m', `Notice: port 5173 is already occupied by ${conflict?.processName || 'process'} (PID: ${conflict?.pid || 'unknown'}). Vite may choose another port or reuse connection.`);
  }

  // 6. Start Vite Client
  log('CLIENT', '\x1b[32m', 'Starting Vite frontend on http://localhost:5173...');
  runProcess('CLIENT', '\x1b[32m', npmCmd, ['run', 'dev', '--prefix', 'client']);

  // 7. Wait for Vite to bind
  let clientReady = false;
  for (let i = 0; i < 30; i += 1) {
    /* eslint-disable no-await-in-loop */
    await new Promise((r) => setTimeout(r, 300));
    if (await checkPort(5173)) {
      clientReady = true;
      break;
    }
  }

  if (clientReady) {
    console.log('\n\x1b[1m\x1b[32m✔ Both Server and Client are running!\x1b[0m');
    console.log('  ➜ \x1b[1mFrontend:\x1b[0m \x1b[34mhttp://localhost:5173\x1b[0m');
    console.log('  ➜ \x1b[1mBackend:\x1b[0m  \x1b[34mhttp://localhost:5001\x1b[0m');
    console.log('  ➜ Press \x1b[1mCtrl+C\x1b[0m to stop all services.\n');
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start application:', err);
  cleanup();
  process.exit(1);
});
