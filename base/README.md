apt-get install -y x11-apps xterm ubuntu-restricted-extras

electron --enable-features=UseOzonePlatform --ozone-platform=wayland

--enable-feature=VaapiVideoDecoder

  cabextract gstreamer1.0-libav libaribb24-0 libavcodec-extra libavcodec-extra58 libavfilter7 libgfortran5 liblapack3
  libmspack0 libpocketsphinx3 libsphinxbase3 libutempter0 libvo-amrwbenc0 ttf-mscorefonts-installer
  ubuntu-restricted-addons ubuntu-restricted-extras unrar xterm






The following packages were automatically installed and are no longer required:
  libatomic1:i386 libbsd0:i386 libdrm-amdgpu1:i386 libdrm-intel1:i386 libdrm-nouveau2:i386
  libdrm-radeon1:i386 libdrm2:i386 libedit2:i386 libelf1:i386 libexpat1:i386 libffi8:i386
  libgl1:i386 libgl1-mesa-dri:i386 libglapi-mesa:i386 libglvnd0:i386 libglx-mesa0:i386
  libglx0:i386 libicu67:i386 libllvm12:i386 libmd0:i386 libnvidia-cfg1-470 libnvidia-common-470
  libnvidia-compute-470:i386 libnvidia-decode-470 libnvidia-decode-470:i386 libnvidia-encode-470
  libnvidia-encode-470:i386 libnvidia-extra-470 libnvidia-fbc1-470 libnvidia-fbc1-470:i386
  libnvidia-gl-470 libnvidia-gl-470:i386 libnvidia-ifr1-470 libnvidia-ifr1-470:i386
  libpciaccess0:i386 libsensors5:i386 libstdc++6:i386 libvulkan1:i386 libwayland-client0:i386
  libx11-6:i386 libx11-xcb1:i386 libxau6:i386 libxcb-dri2-0:i386 libxcb-dri3-0:i386
  libxcb-glx0:i386 libxcb-present0:i386 libxcb-randr0:i386 libxcb-shm0:i386 libxcb-sync1:i386
  libxcb-xfixes0:i386 libxcb1:i386 libxdmcp6:i386 libxext6:i386 libxfixes3:i386 libxml2:i386
  libxnvctrl0 libxshmfence1:i386 libxxf86vm1:i386 mesa-vulkan-drivers:i386
  nvidia-compute-utils-470 nvidia-kernel-source-470 nvidia-prime nvidia-settings
  nvidia-utils-470 screen-resolution-extra xserver-xorg-video-nvidia-470
Use 'apt autoremove' to remove them.
The following additional packages will be installed:
  cabextract libaribb24-0 libavcodec-extra libavcodec-extra58 libmspack0 libvo-amrwbenc0
  ttf-mscorefonts-installer ubuntu-restricted-addons unrar



gstreamer1.0-vaapi libigdgmm-dev libigdgmm11 libvdpau-va-gl1 i965-va-driver-shaders intel-media-va-driver-non-free
libgl1-mesa-glx




electron --enable-accelerated-mjpeg-decode --enable-accelerated-video --ignore-gpu-blacklist --enable-native-gpu-memory-buffers --enable-gpu-rasterization


electron \
  --use-gl=egl \
  --enable-accelerated-video-decode \
  --enable-gpu-rasterization \
  --ignore-gpu-blocklist \
  --enable-feature=VaapiVideoDecoder \
  chrome://gpu


  electron \
  --use-gl=desktop \
  --ignore-gpu-blocklist \
  --enable-feature=VaapiVideoDecoder \
  chrome://gpu

  electron \
  --use-gl=desktop \
  --enable-accelerated-video-decode \
  --enable-gpu-rasterization \
  --enable-feature=VaapiVideoDecoder \
  chrome://gpu
