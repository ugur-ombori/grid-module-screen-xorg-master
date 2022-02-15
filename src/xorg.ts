import fs from 'fs';
import cp from 'child_process';

let xorgConfig = {
  activeUrl: '',
  resolution: '',
  orientation: '',
  disableWebSecurity: '',
  enableDebug: '',
  tz: '',
  enableKeyboard: '',
};

async function setupXorgConfig(args = {}) {
  console.log('Xorg Config', {xorgConfig, args});
  xorgConfig = { ...xorgConfig, ...args};
  console.log('xonfig done', {xorgConfig});
}


const startOrRestartXorg = () => {
  console.log('startOrRestartXorg', { xorgConfig });
  let SCREEN_ROTATION;
  switch (xorgConfig.orientation) {
    case 'portrait':
      SCREEN_ROTATION='right';
      break;
    case 'portrait-left':
      SCREEN_ROTATION='left';
      break;
    case 'landscape':
      SCREEN_ROTATION='normal';
      break;
    case 'landscape-inverted':
      SCREEN_ROTATION='inverted';
      break;
  }
  try {
    cp.execSync('killall electron || true');
  } catch (e:any) { console.error(e.toString()) }

  try {
    const child = cp.spawn('dbus-run-session', ['startx', '/app/xinit'], { env: { ...process.env, ...xorgConfig, SCREEN_ROTATION, ELECTRON_ENABLE_LOGGING: 'true' }});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', console.log);

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', console.log);

    child.on('close', () => {
      console.log('xinit closed');
      cp.execSync('systemctl reboot');
    });
  } catch (e:any) { console.error(e.toString()) }
}

const isNoDrms = () => {
  return fs.readdirSync("/sys/class/drm").join(' ') === "version";
}

const isDrmAvailable = () => {
  try {
    for (const file of fs.readdirSync("/sys/class/drm")) {
      const statusFile = `/sys/class/drm/${file}/status`;
      if (!fs.existsSync(statusFile)) continue;

      const status = fs.readFileSync(statusFile).toString().trim();
      if (status === 'connected') return true;
    }
  } catch (e:any) {
    console.log('err', e.toString());
    return false;
  }
}

export { setupXorgConfig, startOrRestartXorg, isDrmAvailable }
