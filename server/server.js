const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const http = require('http');
const { spawnSync } = require('child_process');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { initLowStockCron } = require('./src/jobs/lowStockCheck');
const seedAdmin = require('./src/scripts/seedAdmin');
const { seedPizzaOptions } = require('./src/scripts/seedPizzaOptions');
const { seedDemoCustomer } = require('./src/scripts/seedDemoOrder');

const PORT = Number(process.env.PORT) || 5001;

/**
 * Identify PID and process name holding a specific local TCP port.
 * @param {number} port
 * @returns {{ pid: string, processName: string } | null}
 */
const findConflictingProcess = (port) => {
  try {
    if (process.platform === 'win32') {
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
    // Port lookup failure should not prevent error reporting
  }
  return null;
};

const startServer = async () => {
  try {
    // 1. Connect to MongoDB with lifecycle logging & transaction probe
    await connectDB();

    // 2. In development mode, auto-seed admin, options, and demo customer if database is fresh
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      try {
        console.log('[MongoDB] Verifying development seeds...');
        await seedAdmin();
        await seedPizzaOptions();
        await seedDemoCustomer();
        console.log('[MongoDB] Development seeds verified successfully.');
      } catch (seedErr) {
        console.warn('[MongoDB] Development auto-seed notice:', seedErr.message);
      }
    }

    // 3. Start scheduled low-stock inventory check job (Phase 7)
    if (process.env.NODE_ENV !== 'test') {
      initLowStockCron();
    }

    // 4. Create HTTP server and listen on port
    const server = http.createServer(app);

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n[SERVER] Port conflict: port ${PORT} is already in use!`);
        const conflict = findConflictingProcess(PORT);
        if (conflict) {
          console.error(`[SERVER] Conflicting process: ${conflict.processName} (PID: ${conflict.pid})`);
          console.error(`[SERVER] Please terminate process ${conflict.pid} or update PORT in server/.env\n`);
        } else {
          console.error(`[SERVER] Please terminate the process on port ${PORT} or update PORT in server/.env\n`);
        }
      } else {
        console.error(`[SERVER] Fatal server error: ${error.message}`);
      }
      process.exit(1);
    });

    server.listen(PORT, () => {
      console.log(`[SERVER] Express server listening on http://localhost:${PORT}`);
      console.log(`[SERVER] Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('[SERVER] Failed to start backend server due to database or startup error.');
    process.exit(1);
  }
};

startServer();
