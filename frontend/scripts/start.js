const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const appRoot = path.resolve(__dirname, '..');
const envPath = path.join(appRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const port = process.env.PORT || '7010';
const env = {
  ...process.env,
  PORT: port,
  BROWSER: 'none',
};

const cracoBin = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'craco.cmd' : 'craco');
const child = spawn(cracoBin, ['start'], {
  cwd: appRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code || 0);
  }
});
