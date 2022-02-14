import cp from 'child_process';

async function monitorProcess(cb: (d: string) => void) {
  await new Promise<void>(resolve => {
    const monitor = cp.spawn("udevadm", ["monitor", "--kernel", "--property"], { stdio: 'pipe' });

    monitor.stderr.on('data', (data) => console.error('Udev:', data.toString().trim()));
    monitor.stdout.on('data', (line) => cb(line.toString().trim()));

    monitor.on('exit', () => resolve());
  });
}

type DeviceInfo = { [s: string]: string };
async function monitor(onChange: (s: DeviceInfo) => void) {
  while (true) {
    let result: DeviceInfo = {};

    console.log('Udev: monitoring devices');
    await monitorProcess(line => {
      line.split('\n').map(chunk => chunk.trim()).forEach(chunk => {
        if (chunk === "") {
          onChange(result);
          result = {};
          return;
        }

        const info = /^([A-Z0-9]+)=(.+)$/.exec(chunk);
        if (!info) return;
        const [, name, value] = info;
        result[name.toLowerCase()] = value;
      });
    })

    console.log('Udev: monitor exited, restarting');
    await new Promise(resolve => setTimeout(resolve, 5 * 1000));
  }
}

export default { monitor };