const cp = require('child_process');
// const settings = require('./display/src/settings');

const settings = {
  audio: {}
};

function exec(cmd, logger) {
  if (!logger) {
    logger = console;
  }
  const text = [];
  return new Promise((resolve, reject) => {
    const proc = cp.spawn('/bin/sh', ['-x']);
    proc.stdout.on('data', (data) => {
      logger.log(data.toString().trim());
      text.push(data.toString());
    });
    proc.stderr.on('data', (data) => logger.error(data.toString().trim()));
    proc.on('close', (code) => (code ? reject(code) : resolve(text.join(''))));

    proc.on('error', (err) => {
      logger.error('Failed to start subprocess.', err);
    });

    proc.stdin.end(cmd);
  });
}

// Stream desktop
// ffmpeg -f x11grab -s 1920x1080 -r 30 -i :0.0+0,0  -f alsa -ac 2 -i pulse -vcodec libx264 -preset ultrafast -s 1280x720 -threads 0 -f mpegts - | vlc -I dummy - --sout '#std{access=http,mux=ts,dst=:3030}'

// With embedded webcam
// ffmpeg -f alsa -ac 2 -i pulse -itsoffset -0.2 -f x11grab -s 1680x1050 -r 30 -i :0.0+0,0 -vf "movie=/dev/video0:f=video4linux2, scale=180:-1, setpts=PTS-STARTPTS [movie]; [in][movie] overlay=main_w-overlay_w-2:main_h-overlay_h-2 [out]" -vcodec libx264 -preset ultrafast -s 704x480 -acodec libfaac -threads 0 -f mpegts - | tee myrecording.mpeg | vlc -I dummy - --sout '#std{access=http,mux=ts,dst=:8080}

// Better
// ffmpeg \
// -f x11grab -s 1920x1080 -framerate 30 -i :0.0 \
// -thread_queue_size 1024 -f alsa -ac 2 -i pulse  \
// -vaapi_device /dev/dri/renderD128 -vf 'format=nv12,hwupload,scale_vaapi=w=640:h=480' \
// -c:v h264_vaapi -qp:v 19 -bf 4 -threads 4 -aspect 16:9 \
// -f mpegts - | vlc -I dummy - --sout '#std{access=http,mux=ts,dst=:3030}'

const screenBrightness = parseInt(process.env.SCREEN_BRIGHTNESS || '100', 10);

let audioConfig = `
pulseaudio --system -D
`;
settings.audio = settings.audio || { output: 'hdmi', playback: '100', recording: '90' };
const audioOutput = process.env.AUDIO_OUTPUT || settings.audio.output;
const audioPlayback = parseInt(
  process.env.AUDIO_PLAYBACK || settings.audio.playback || '100',
  10,
);
const audioRecording = parseInt(
  process.env.AUDIO_RECORDING || settings.audio.recording || '90',
  10,
);
if (audioOutput === 'hdmi') {
  audioConfig += `echo "Setting pulseaudio output to hdmi 0"
pactl set-card-profile 0 output:hdmi-stereo
echo "Setting pulseaudio output to hdmi 1"
pactl set-card-profile 1 output:hdmi-stereo`;
}

if (audioOutput === 'none') {
  audioConfig = '';
}

const volumeAdjustmentCommand = `
amixer -c0 set Master -- ${audioPlayback}% >/dev/null 2>&1
amixer -c0 set Headphone -- 100% >/dev/null 2>&1
amixer -c0 set Speaker -- 100% >/dev/null 2>&1
amixer -c0 set PCM -- 100% >/dev/null 2>&1
amixer -c0 set Mic -- ${audioRecording}% >/dev/null 2>&1

amixer -c1 set Master -- ${audioPlayback}% >/dev/null 2>&1
amixer -c1 set Headphone -- 100% >/dev/null 2>&1
amixer -c1 set Speaker -- 100% >/dev/null 2>&1
amixer -c1 set PCM -- 100% >/dev/null 2>&1
amixer -c1 set Mic -- ${audioRecording}% >/dev/null 2>&1
amixer -q -D pulse sset Mic ${audioRecording}% >/dev/null 2>&1

xbacklight -set ${screenBrightness}
`;

// Reset volume levels every 10 seconds
// setInterval(() => {
//   cp.exec(volumeAdjustmentCommand);
// }, 10 * 1000);
// exec(`X -configure
// cp xorg.conf.new /etc/X11/xorg.conf`);

exec(`
# Make sure everything goes to syslog as well

echo 127.0.0.1 \`hostname\` \`hostname\`.local >> /etc/hosts

# By default docker gives us 64MB of shared memory size but to display heavy
# pages we need more.
umount /dev/shm && mount -t tmpfs shm /dev/shm

# Power saving and hopefully cooler CPU
# tlp start
# thermald

# HDMI
${audioConfig}

${volumeAdjustmentCommand}

echo "Waiting for X to be ready"
export DISPLAY=:0
echo 'export DISPLAY=:0' >> ~/.bashrc

export PROVIDER="${settings.provider}"
echo 'export PROVIDER="${settings.provider}"' >> ~/.bashrc

export GRID_ENV="production"
echo 'export GRID_ENV="production"' >> ~/.bashrc

export NODE_ENV="production"
echo 'export NODE_ENV="production"' >> ~/.bashrc

export ELECTRON_ENABLE_LOGGING=true
echo 'export ELECTRON_ENABLE_LOGGING=true' >> ~/.bashrc

export DEBUG="@ombori/*"
echo 'export DEBUG="@ombori/*"' >> ~/.bashrc

echo "READY, starting app"
startx /usr/src/app/xinit

# If the app dies, restart the container
# TMP disable, TODO re-enable
echo "ERROR: App crashed, restarting"
# curl -X POST --header "Content-Type:application/json" --data '{"appId": '$BALENA_APP_ID'}'  "$BALENA_SUPERVISOR_ADDRESS/v1/restart?apikey=$BALENA_SUPERVISOR_API_KEY"
`);
