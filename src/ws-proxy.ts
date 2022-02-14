import ws from 'ws';
import https from 'https';
import cp from 'child_process';
import fs from 'fs';

import { Module } from '@ombori/ga-module';

const WS_PORT = 8080;

// initialize a certificate for gdmagent
const AGENT_KEY = '/app/agent.key';
const AGENT_CERT = '/usr/local/share/ca-certificates/GdmAgent.crt';
cp.execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${AGENT_KEY} -out ${AGENT_CERT} -days 365 -nodes -subj '/CN=GdmAgent'`);
cp.execSync('update-ca-certificates'); // TODO: check if works offline

const server = https.createServer({
  cert: fs.readFileSync(AGENT_CERT),
  key: fs.readFileSync(AGENT_KEY)
});

// initialize ws-to-mqtt proxy
const wss = new ws.Server({ server });

export default (module: Module<any>) => {
  // initialize websocket, forward messages to mqtt
  wss.on('connection', (ws) => {
    console.log('incoming websocket connection');
    ws.on('message', (message) => {
      try {
        const { type, ...rest } = JSON.parse(message.toString());
        module.publish(type, rest);
      } catch (e:any) {
        console.error('Cannot process websocket message', e.toString());
      }
    });
  });

  module.subscribe("+/+", async (payload, _, msgType, channel) => {
    const type = channel === "message" ? msgType : `${channel}/${msgType}`;
    const msg = JSON.stringify({ ...payload, type });
    wss.clients.forEach(ws => ws.send(msg));
  });

  server.listen(WS_PORT);
}
