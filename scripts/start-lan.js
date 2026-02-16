#!/usr/bin/env node
const os = require('os');
const { spawn } = require('child_process');

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function detectLanIPv4() {
  const interfaces = os.networkInterfaces();
  const privateIPs = [];
  const otherIPs = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      if (isPrivateIPv4(entry.address)) {
        privateIPs.push(entry.address);
      } else {
        otherIPs.push(entry.address);
      }
    }
  }

  return privateIPs[0] || otherIPs[0] || null;
}

const lanIp = detectLanIPv4();
if (!lanIp) {
  console.warn('[start:lan] Could not detect a LAN IPv4 address. Expo may fall back to 127.0.0.1.');
} else {
  console.log(`[start:lan] Using LAN IP ${lanIp} for Expo bundler host.`);
}

const env = {
  ...process.env,
  EXPO_DEVTOOLS_LISTEN_ADDRESS: '0.0.0.0',
};

if (lanIp) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
}

const expoBin = process.platform === 'win32' ? 'node_modules/.bin/expo.cmd' : 'node_modules/.bin/expo';
const args = ['start', '-c', '--lan', '--go'];

const child = spawn(expoBin, args, {
  stdio: 'inherit',
  env,
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('[start:lan] Failed to launch Expo CLI:', error.message);
  process.exit(1);
});
