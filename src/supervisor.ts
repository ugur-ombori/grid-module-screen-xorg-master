import fetch from 'node-fetch';
import fs from 'fs';

const API_HOSTNAME = 'browser-api.prod.omborigrid.com';

const { BROWSER_ID, BROWSER_ACCESS_KEY } = process.env;
const API_ACCESS_KEY = 'E/INnKchA6si1LWKNwWIVnKecMIMKz9W2IPBjxx1wNiZWwQt8Oda8A==';
const FILENAME = '/root/.local/ombori-supervisor.cfg';

const NO_SETTINGS_URL = 'file:///app/idle-screen/index.html#no-settings';
const NO_NETWORK_URL = 'file:///app/idle-screen/index.html#no-network';
const DEFAULT_URL = NO_SETTINGS_URL;

type Pair = {
  accessKey?: string;
  browserId: string;
};

export type Token = {
  sas_token: string;
  sas_token_subject: string;
  sas_token_valid_until_utc_timestamp: number;
};

async function getUploadToken(creds: Pair): Promise<any | undefined> {
  const res = await fetch(
    'https://browser-api.prod.omborigrid.com/api/healthcheck-config?code=ENeN3WKnD1CaGfSsg0/eZH57cprb9C6gzanhoor4GbijVd5OyLmZ8g==',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(creds),
    },
  );

  if (res.status > 299) {
    console.error('Cannot aquire upload token', res.statusText);
    return undefined;
  }

  return await res.json();
}

let lastStatus: number = 0;
async function getSettings(creds: Pair): Promise<any | undefined> {
  const request = await fetch(`https://${API_HOSTNAME}/api/settings`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-functions-key': API_ACCESS_KEY,
    },
    body: JSON.stringify({
      browserId,
      accessKey,
    }),
  });

  if (lastStatus !== request.status) {
    lastStatus = request.status;
    console.error(
      `Supervisor: settings query status is ${request.status} ${request.statusText}`,
    );
    lastStatus = request.status;

    if (request.status > 299) {
      const data = await request.text();
      console.error('Supervisor: settings query response', data);
    }
  }

  if (request.status > 299) return undefined;

  return await request.json();
}

let browserId: string | undefined = BROWSER_ID;
let accessKey: string | undefined = BROWSER_ACCESS_KEY;
let settings: any | undefined = undefined;
let settingsLastUpdated = 0;
let uploadToken: Token | undefined = undefined;
let activeUrl: string | null = null;

const getUrl = () => activeUrl || DEFAULT_URL;
const getToken = () => uploadToken;
const getSettingsReceived = () => !!settings;
const getEnv = (): string | undefined => (settings ? settings.env : undefined);

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILENAME).toString());
    console.log('Supervisor: loaded browser settings', data);
    browserId = BROWSER_ID || data.browserId;
    settings = data.settings;
    accessKey = BROWSER_ACCESS_KEY || data.accessKey;
    activeUrl = settings ? settings.url : null;
  } catch (e:any) {
    console.error('Supervisor: cannot load supervisor settings', e.toString());
  }
  // TODO: process a corner-case when we have a browserId stored locally and adifferent browserId in env
}

load();

let prevSaved: any = null;
async function save(data: any) {
  const json = JSON.stringify(data);
  if (json === prevSaved) return;
  prevSaved = json;

  try {
    await fs.promises.writeFile(FILENAME, json);
  } catch (e:any) {
    console.error(`Supervisor: unable to save settings: ${e.toString()}`);
  }
}

const getBrowserUrl = async (): Promise<string> => {
  while (true) {
    if (!browserId) console.log('Supervisor: no browserId');
    if (!accessKey) console.log('Supervisor: no accessKey');

    if (!accessKey || !browserId) return NO_SETTINGS_URL;

    let now = new Date().getTime();
    const settingsAreOutdated = settings && now - settingsLastUpdated > 5000;
    if (!settings || settingsAreOutdated) {
      let newSettings;
      try {
        newSettings = await getSettings({ browserId, accessKey });
      } catch (e:any) {
        if (!settings) return NO_NETWORK_URL;
      }

      if (newSettings) {
        settings = newSettings;
        settingsLastUpdated = now;

        try {
          const { env, spaces, url } = settings;
          const spaceId = (spaces && spaces.length) ? spaces[0] : '';
          const newUrl = `${url}#browserId=${browserId}&accessKey=${accessKey}&env=${env}&spaceId=${spaceId}`;
          settings.url = newUrl;
          await save({ browserId, accessKey, settings: { env, url: newUrl } });
        } catch(e) {
          console.log('Weird Error: ', e);
        }
      }
    }

    if (!settings) return NO_SETTINGS_URL;

    const tokenAboutToExpire =
      uploadToken && now - uploadToken.sas_token_valid_until_utc_timestamp < 60000;
    if (!uploadToken || tokenAboutToExpire) {
      let newToken = await getUploadToken({ browserId, accessKey });
      if (!newToken) console.error('Cant update upload token');

      console.log('Supervisor: token updated');
      uploadToken = newToken;
    }

    return settings.url;
  }
};

const delay = (n: number) => new Promise((resolve) => setTimeout(resolve, n));

const start = async ({
  onUrlUpdated,
  onStatusUpdated,
}: {
  onUrlUpdated: () => void;
  onStatusUpdated: (connected: boolean) => void;
}) => {
  let connected = undefined;
  let lastError = null;
  await delay(0);
  console.log('Supervisor: started');

  while (true) {
    try {
      const newUrl = await getBrowserUrl();
      if (newUrl !== activeUrl) {
        console.log(`Supervisor: URL updated ${newUrl || DEFAULT_URL}`);
        activeUrl = newUrl;
        onUrlUpdated();
      }
      lastError = null;
    } catch (e:any) {
      if (lastError === e.toString()) {
        lastError = e.toString();
        console.error('Supervisor: error', lastError);
      }
    }

    const now = new Date().getTime();
    const newConnected = !!settings && now - settingsLastUpdated < 60 * 1000;
    if (newConnected !== connected) {
      connected = newConnected;
      console.log(`Supervisor: ${connected ? 'connected' : 'disconnected'}`);
      onStatusUpdated(connected);
    }

    await delay(5000);
  }
};

export default {
  start,
  getUrl,
  getToken,
  getSettingsReceived,
  getEnv,
};
