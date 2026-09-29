# HDZero Audio Cleaner

HDZero Audio Cleaner is a Windows desktop application for repairing, denoising, previewing, and optionally re-encoding HDZero video recordings. It supports individual files and sequential batch processing through a native Electron interface.

## Features

- Add one video or queue multiple videos by browsing or dragging and dropping.
- Process the queue sequentially with per-video status and live progress.
- Keep the left channel, keep the right channel, or leave both channels untouched.
- Duplicate a selected channel across both stereo output channels.
- Optionally remove background noise with DeepFilterNet 3.
- Adjust noise-reduction attenuation from natural to aggressive.
- Optionally re-encode video with CPU or NVIDIA GPU encoders.
- Apply global audio settings or assign custom settings to individual videos.
- Organize originals and processed files automatically or choose a custom destination.
- Stop and cancel an active batch from the main processing button.
- Prevent multiple application instances from running at the same time.

## Audio processing

The **Channel handling** setting controls how the output audio is produced:

- **Keep right channel** replaces the left channel with a copy of the original right channel. The result remains stereo and plays the selected channel through both speakers.
- **Keep left channel** replaces the right channel with a copy of the original left channel. The result remains stereo and plays the selected channel through both speakers.
- **Keep both channels** applies no channel filter. When noise reduction is disabled, the original audio stream is left untouched.

Enable **AI noise reduction** to process the selected audio with DeepFilterNet 3. The maximum attenuation control determines how aggressively background noise is suppressed.

When channel handling and video re-encoding are both enabled, the application processes the audio first and then explicitly adds the corrected stereo track to the encoded video.

## Video re-encoding

Video re-encoding is optional and disabled by default. When it is disabled, the original video stream is copied without re-encoding. When enabled, the application detects the source video bitrate and uses it as the target for the selected encoder. This keeps the output filesize and perceived quality close to the original while still converting the video codec.

Optional **Compression** is disabled by default. When enabled, its slider reduces the source-matched target bitrate by 5–75%. Higher values create smaller files at the cost of more visible quality loss. Compressed output filenames include the selected reduction, such as `flight_reencoded-h264+compressed-25pct.mp4`.

Available CPU encoders:

- **H.264 / AVC** — MP4
- **H.265 / HEVC** — MP4
- **AV1** — MP4
- **VP9** — MKV

Available NVIDIA NVENC encoders:

- **H.264 / AVC NVENC** — MP4
- **H.265 / HEVC NVENC** — MP4
- **AV1 NVENC** — MP4

Re-encoding cannot produce a mathematically identical image at exactly the same filesize. Small differences in quality and size are expected because codecs compress video differently. NVENC uses a compatible NVIDIA GPU to accelerate video encoding. H.264 and H.265 support varies by GPU generation, while AV1 NVENC requires newer supported hardware and current NVIDIA drivers. CPU encoders remain available when NVENC is unsupported.

## Video editor

Select **Edit / preview** beside a queued video to open the editor inside the main application window.

The editor provides:

- Source video playback in a stable 16:9 viewer.
- Live left-channel and right-channel monitoring.
- Automatic A–B preview ranges of 5, 10, 20, or 30 seconds.
- Optional live timeline synchronization with video playback.
- DeepFilterNet preview generation for the selected range.
- Tabs for switching between the original and generated preview.
- Per-video settings identified by a `CUSTOM` badge in the queue.
- Controls for saving settings to one video, returning to global settings, or making the editor settings global.

## File organization

The **File organization** control determines where completed files are placed:

- **Together** keeps the original and processed video side by side.
- **Original** moves successfully processed source videos into an `Original` folder.
- **Fixed Videos** places processed results in a `Fixed Videos` folder.
- **Custom** places every processed video in a selected destination.

The selected organization mode and **Open file location when complete** preference are remembered across application launches. Existing files are never overwritten; a numbered suffix is added when a filename is already in use.

When several output locations are involved, the application asks for confirmation and opens each unique directory only once.

## Output filenames

Output filenames describe the operations that were performed:

- `flight_fixed.mp4`
- `flight_denoised-30db.mp4`
- `flight_fixed+denoised-30db.mp4`
- `flight_reencoded-h264.mp4`
- `flight_fixed+reencoded-h264-nvenc.mp4`
- `flight_fixed+denoised-30db+reencoded-h265.mp4`

## Supported input formats

- MP4
- MKV
- MOV
- AVI
- WebM
- M4V

## Appearance

Use the title-bar **Settings** button to customize the application.

The **Interface** tab contains a font-size slider that proportionally scales the existing interface text. The **Theme** tab provides Black & Red, Cyan, Magenta, Violet, Amber, and Emerald color schemes.

Theme and font-size selections are remembered across restarts and applied to both the queue and editor.

## Install and run

Requirements:

- Windows 10 or Windows 11
- Node.js with npm
- Python 3.11 for optional AI noise reduction
- A compatible NVIDIA GPU and driver for optional NVENC encoding

Setup:

1. Run `[Client_Install_Requirements].bat`.
2. Allow the installer to install Python 3.11 if AI noise reduction is needed.
3. Run `[Client_Run].bat` to start the application.

The requirements installer installs the Electron packages, downloads FFmpeg when necessary, installs the compatible DeepFilterNet dependencies, and downloads the DeepFilterNet3 model. Channel handling and video encoding remain available if the optional noise-reduction setup is skipped or unavailable.

## Build

Run `[Client_Build].bat` to create the unpacked Windows application in `client\dist-client`.

The requirements installer must be completed before building so FFmpeg and the DeepFilterNet3 model can be included with the packaged application.
