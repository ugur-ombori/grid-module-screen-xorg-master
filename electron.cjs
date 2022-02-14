const { app, BrowserWindow } = require("electron");
const url = require("url");

function newApp() {
  const win = new BrowserWindow({
    kiosk: true,
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: false,
    }
  });
  win.loadURL(
    // 'chrome://gpu'
    // 'https://www.youtube.com/'
    process.env.activeUrl
  );

  // Enable loading of webpages which send x-frame-options to prevent iframe embedding
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({responseHeaders: Object.fromEntries(Object.entries(details.responseHeaders).filter(header => !/x-frame-options/i.test(header[0])))});
  });
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(message + " " +sourceId+" ("+line+")");
  });
  win.webContents.on('render-process-gone', (event, reason) => {
    console.log('webContents crashed, restarting', {reason});
    console.error(event);
    // app.relaunch();
    // If renderer crashes, kill the app so container can recover
    app.exit();
  });
}

app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');
app.commandLine.appendArgument("--disable-site-isolation-trials");
app.commandLine.appendSwitch(
  'autoplay-policy',
  'no-user-gesture-required',
  'touch-events',
);
// TODO remove this, handle certificates properly
app.commandLine.appendArgument("--ignore-certificate-errors");
app.commandLine.appendArgument("--ignore-ssl-errors");

app.on("ready", newApp);

