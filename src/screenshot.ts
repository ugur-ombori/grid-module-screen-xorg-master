import cp from 'child_process';
import stream from 'stream';
import AzureStorage from 'azure-storage';
import getColors from 'get-image-colors';

import { Token } from './supervisor.js';

const SCREENSHOT_TIMEOUT = 60000; // 1min

const { IOTEDGE_DEVICEID } = process.env;

if (!IOTEDGE_DEVICEID) {
  console.error('IOTEDGE_DEVICEID is not set');
  process.exit(1);
}

const takeScreenshot = async () => {
  let result: Buffer[] = [];

  const timeout = setTimeout(() => {
    console.error('Timeout when creating a screenshot, probably xorg is not running correctly, exiting now');
    process.exit(1);
  }, SCREENSHOT_TIMEOUT);

  const code = await new Promise((resolve) => {
    const child = cp.spawn("/usr/bin/xwd", ['-root'], { stdio: ['inherit', 'pipe', 'inherit'] });
    child.stdout.on('data', (data) => result.push(data));
    child.on('close', resolve);
  });

  clearTimeout(timeout);

  if (code !== 0) throw new Error('Error encountered when creating a screenshot');
  if (result.length === 0) throw new Error("Cannot create screenshot, zero size");

  return Buffer.concat(result);
}

const resizeScreenshot = async (data: Buffer) => {
  const result: Buffer[] = [];
  const code = await new Promise(resolve => {
    const child = cp.spawn("/usr/bin/convert", [
      '-strip',
      '-interlace', 'Plane',
      '-gaussian-blur', '0.05',
      '-quality', '45%',
      '-thumbnail', '600x600',
      `xwd:-`,
      `jpg:-`
    ], { stdio: ['pipe', 'pipe', 'inherit'] });
    child.stdout.on('data', d => result.push(d));
    child.on('close', resolve);

    child.stdin.write(data);
    child.stdin.end();
  });

  if (code) throw Error('Cannot convert screenshot');
  if (result.length === 0) throw Error("Cannot convert screenshot, zero size");

  return Buffer.concat(result);
}

const uploadScreenshot = async (data: Buffer, { sas_token, sas_token_subject }: Token) => {
  const [proto, , hostname, container, file] = sas_token_subject.split('/');
  const blobService = AzureStorage.createBlobServiceWithSas(`${proto}//${hostname}`, sas_token).withFilter(
    new AzureStorage.ExponentialRetryPolicyFilter(1),
  );

  await new Promise<void>((resolve, reject) => blobService.createBlockBlobFromText(
    container,
    file,
    data,
    { contentSettings: { contentType: 'image/jpeg' } },
    (error) => error ? reject(error) : resolve()
  ));

  return sas_token_subject;
}

const analyzeScreenshot = async (data: Buffer) => {
  try {
    const cl = await getColors(data, 'image/jpeg');
    if (!cl) return [false, false];

    const allWhite = cl.every((c) => c.rgb().every(color => color > 250));
    const allBlack = cl.every((c) => c.rgb().every(color => color < 5));
    return [allWhite, allBlack];
  } catch (e:any) {
    console.log('error', e.toString());
    return [false, false];
  }
}

export { resizeScreenshot, takeScreenshot, uploadScreenshot, analyzeScreenshot };
