import { connect } from '@ombori/ga-module';

import cp from 'child_process';
import net from 'net';

import initProxy from './ws-proxy.js';
import { Settings } from './schema.js';
import { resizeScreenshot, takeScreenshot, uploadScreenshot, analyzeScreenshot } from './screenshot.js';
import { setupXorgConfig, startOrRestartXorg, isDrmAvailable } from './xorg.js';
import supervisor from './supervisor.js';
import udev from './udev.js';

const { DEVICE_NAME, IOTEDGE_DEVICEID } = process.env;

const module = await connect<Settings>();

let crashes = 0;
module.updateTelemetry({ crashes });

const sendCrashReport = (reason: string) =>
  module.emit('uplink', {
    type: 'Screen.BrowserRestart',
    reason,
    name: DEVICE_NAME,
    deviceId: IOTEDGE_DEVICEID
  });

let lastHeartbeat = 0;
module.subscribe('App.Heartbeat', () => {
  if (!lastHeartbeat) console.log('Heartbeat: an initial heartbeat is received');
  lastHeartbeat = new Date().getTime();
});

initProxy(module);

let activeUrl: string = module.settings.url || supervisor.getUrl();
async function onSupervisorUrlUpdated() {
  const url = module.settings.url || supervisor.getUrl();
  if (url === activeUrl) return;
  activeUrl = url;

  module.updateTelemetry({ settingsReceived: supervisor.getSettingsReceived() });

  console.log(`URL: changed to ${url}`);
  setupXorgConfig({activeUrl});
  startOrRestartXorg();
  // cog.setEnv(supervisor.getEnv());
  // await cog.open(url);
}

supervisor.start({
  onUrlUpdated: onSupervisorUrlUpdated,
  onStatusUpdated: (connected:any) =>
    module.updateTelemetry({
      supervisorConnected: connected
    })
});

let prevSettings = { ...module.settings };
module.onSettings(async (settings) => {
  // @ts-ignore
  const { $version, ...rest } = settings;
  console.log({settings});
  // @ts-ignore
  const changed = Object.keys(rest).filter(key => prevSettings[key] !== settings[key]);

  console.log('changed settings', changed);
  if (changed.length === 0) return;

  prevSettings = settings;

  const { sound_output, screen_orientation, screen_resolution, url } = settings;

  if (changed.length === 1 && changed[0] === "url") {
    return onSupervisorUrlUpdated();
  }

  // await sound.setup(sound_output);
  await setupXorgConfig({
    activeUrl,
    resolution: screen_resolution,
    orientation: screen_orientation,
    headless: !isDrmAvailable(),
  });
  startOrRestartXorg();
});

if (!module.settings.screen_resolution) module.settings.screen_resolution = 'default';
if (!module.settings.screen_orientation) module.settings.screen_orientation = 'landscape';
if (!module.settings.sound_output) module.settings.sound_output = 'hdmi1';

console.log('settings', module.settings);

console.log(`Setting up config file for xorg`);
const { disableWebSecurity, enable_debug: enableDebug, tz, enableKeyboard } = module.settings;
await setupXorgConfig({
  activeUrl,
  orientation: module.settings.screen_orientation,
  resolution: module.settings.screen_resolution,
  headless: !isDrmAvailable(),
  disableWebSecurity,
  enableDebug,
  tz,
  enableKeyboard,
});

// sound.onDevices((devices) => {
//   const sound = devices.reduce((prev, { device, card, name }) => ({
//     ...prev,
//     [`${card}:${device}`]: name,
//   }), {});
//   module.updateTelemetry({ sound });
// })

console.log('Setting up sound output');
// await sound.setup(module.settings.sound_output);

let restartInterval = 0;

const delay = (n: number) => new Promise(resolve => setTimeout(resolve, n));

const onIoUpdated = async ({ inputs, outputs }: { inputs: any[], outputs: any[] }) => {
  if (outputs.length === 0) {
    module.updateTelemetry({ output: null });
  } else {
    const { name, current_mode: { width, height }, model, serial, make } = outputs[0];
    module.updateTelemetry({
      output: {
        name,
        mode: `${width}x${height}`,
        model: `${make} ${model}`,
        serial,
      }
    })
  };
};

const startBrowser = async () => {
  while (true) {
    try {
      const { disableWebSecurity, enable_debug: enableDebug, tz, enableKeyboard } = module.settings;
      const started = new Date().getTime();

      module.updateTelemetry({ settingsReceived: supervisor.getSettingsReceived() });
      // cog.setEnv(supervisor.getEnv());

      const code = '';
      // const code = await cog.start({
      //   settings: {
      //     enableDebug,
      //     enableKeyboard,
      //     url: activeUrl,
      //     disableWebSecurity,
      //     headless: !isDrmAvailable(),
      //     tz,
      //   },
      //   onCfgUpdated: onIoUpdated,
      //   onUrlUpdated: (url:string) => {
      //     lastHeartbeat = 0; // reset the heartbeat, new app may not support it
      //     module.updateTelemetry({ url });
      //   },
      //   onCrashed: () => {
      //     // cog.restart();
      //     sendCrashReport('crash');
      //     module.updateTelemetry({ crashes: crashes++ });
      //   },
      // });

      const exitedRightAway = (new Date().getTime() - started) <= 10000;
      if (exitedRightAway) {
        restartInterval += 1000;
      } else {
        restartInterval = 0;
      }

      // if (restartInterval >= 10000) {
      //   console.error("Browser crashed 10 times in a row, giving up");
      //   await sendCrashReport('keeps_restarting');
      //   process.exit(1);
      // }

      console.error(`Browser exited with code ${code}, restarting browser in ${restartInterval}ms`);
      await delay(restartInterval);
    } catch (e:any) {
      console.error('Cog error', e.toString())
    }
  }
}
// startBrowser();

const checkPortOpen = (port: number) => new Promise<boolean>((resolve) => {
  const conn = net.createConnection({ port, timeout: 10000 });
  conn.on('connect', () => {
    resolve(true);
    conn.end();
  });
  conn.on('error', () => {
    resolve(false);
  })
});

let vncCounter = 0;
let server: cp.ChildProcess | null = null;
module.onStream('vnc', async (sock) => {
  vncCounter++;
  if (!server) {
    console.log('VNC: starting server');
    server = cp.spawn("x11vnc", ['-nopw'], { stdio: 'inherit' });
  }

  sock.on('end', () => {
    console.log('VNC: Socket is closed');
    vncCounter--;
    if (vncCounter === 0) {
      console.log('VNC: last session is closed, killing vnc server');
      server?.kill();
      server = null;
    }
  });

  for (let i = 0; i < 10; i++) {
    const success = await checkPortOpen(5900);
    console.log("VNC: port is", success ? "open" : "closed");
    if (success) break;
    await delay(1000);
  }

  module.proxyTcp(sock, 5900);
});

module.onStream('debug', async (ws) => module.proxyTcp(ws, 1234));

module.onMethod('open', async (data) => {
  const { url } = data;
  // await cog.open(url);
  return 'Opened';
});

module.onMethod('kill', async () => {
  console.log('Kill command received, killing browser');
  startOrRestartXorg();
  // cog.restart();
  return 'Killing browser';
});

module.onMethod('reload', async () => {
  console.log('Reloading browser');
  startOrRestartXorg();
  // cog.reload();
  return 'Reloading';
});

// module.onMethod('inputs', () => cog.sendMsg('-t get_inputs'));
// module.onMethod('outputs', () => cog.sendMsg('-t get_outputs'));
// module.onMethod('swaymsg', ({ msg }) => cog.sendMsg(msg));

module.onMethod('screenshot', async () => {
  const data = await takeScreenshot();
  const resized = await resizeScreenshot(data);
  const [allWhite, allBlack] = await analyzeScreenshot(resized);
  const token = supervisor.getToken(); // TODO: renew
  if (!token) throw new Error('Screenshot: cannot upload, invalid token')

  const url = await uploadScreenshot(resized, token);

  return { url, allWhite, allBlack };
});

module.onMethod('sound_test', async (params) => {
  const { output = module.settings.sound_output } = params;
  // const success = await sound.test(output);
  const success = true;
  return success ? 'Success' : 'Failed';
});

const checkHeartbeats = async () => {
  while (true) {
    await delay(60 * 1000);
    if (!lastHeartbeat) continue; // no heartbeats ever received

    const now = new Date().getTime();
    if (now - lastHeartbeat <= 60000) continue;

    console.error("Heartbeat: not registered for 60 seconds, restarting app");
    lastHeartbeat = 0;
    await sendCrashReport('no_heartbeat');
    startOrRestartXorg();
  }
}

let prevUrl: string = '';
const takeScreenshots = async () => {
  let whiteColorCount = 0;
  let blackColorCount = 0;

  await delay(20 * 1000);

  while (true) {
    const { restartIfAllWhite = true, restartIfAllBlack = true } = module.settings;

    let data: Buffer | null = null;
    try {
      data = await takeScreenshot();
    } catch (e:any) {
      console.error(e.toString());
      await sendCrashReport('cant_take_screenshot');
      // process.exit(1);
    }

    if (!data) throw new Error("Screenshot: not a buffer");

    try {
      const resized = await resizeScreenshot(data);
      const [allWhite, allBlack] = await analyzeScreenshot(resized);

      const token = supervisor.getToken(); // TODO: renew
      if (!token) {
        console.error('Screenshot: cannot upload, invalid token');
      } else {
        const url = await uploadScreenshot(resized, token);
        if (url !== prevUrl) {
          prevUrl = url;
          module.updateTelemetry({ screenshot: url });
        }
      }

      whiteColorCount = (allWhite && restartIfAllWhite) ? whiteColorCount + 1 : 0;
      blackColorCount = (allBlack && restartIfAllBlack) ? blackColorCount + 1 : 0;
    } catch (e:any) {
      console.error("Screenshot: error,", e.toString());
    }

    if (whiteColorCount) console.log(`Screenshot: all white (${whiteColorCount} try)`);
    if (blackColorCount) console.log(`Screenshot: all black (${blackColorCount} try)`);

    if (whiteColorCount > 2) {
      await sendCrashReport('screen_all_white');
      startOrRestartXorg();
      whiteColorCount = 0;
    }
    if (blackColorCount > 2) {
      await sendCrashReport('screen_all_black');
      startOrRestartXorg();
      blackColorCount = 0;
    }

    // only wait for 5 secs if smth is wrong with the screen
    await delay((whiteColorCount + blackColorCount) ? 5 * 1000 : 60 * 1000);
  }
}

const isTouchConnected = (info: any) => (info.driver === 'hid-multitouch' && info.action === 'bind');
const isMouseLikeConnected = (info: any) => (info.action === 'add' && info.subsystem === 'input' && /^\/dev\/input\/mouse[0-9]/.test(info.devname));
udev.monitor(async (info) => {
  if (isTouchConnected(info) || isMouseLikeConnected(info)) {
    console.log('Udev change:', info);
    console.log('Killing xorg');
    startOrRestartXorg();
  } else {
    console.log('Udev ignored', info)
  }
});

startOrRestartXorg();
checkHeartbeats();
takeScreenshots();
