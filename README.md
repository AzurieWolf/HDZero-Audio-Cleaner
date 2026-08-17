# HDZero Audio Cleaner

An Electron desktop application for repairing and cleaning audio in HDZero video recordings.

- HDZero channel repair: keep the right goggle-microphone channel (or the left VTX channel) and convert it to mono.
- Optional DeepFilterNet 3 denoising with adjustable maximum attenuation.
- Batch processing: add or drag in multiple videos and process them sequentially.
- Per-video editor with source playback, an automatic highlighted A–B range, and 5, 10, 20, or 30-second processed previews.
- Per-video custom audio settings with a visible `CUSTOM` indicator in the main queue.

The video stream is copied without re-encoding. Output filenames describe the selected work, such as `_fixed`, `_denoised-30db`, or `_fixed+denoised-30db`. The app chooses a numbered suffix rather than overwriting an existing output.

## Run

1. Run `[Client_Install_Requirements].bat` once. It installs Node dependencies, verifies or downloads FFmpeg, and installs Python/DeepFilterNet for AI noise reduction.
2. Run `[Client_Run].bat`.
3. Add videos, choose channel handling, optionally enable AI noise reduction, and select **Process queue**.

Use **Edit / preview** on any queued video to slide from the queue into the editor in the same window. Use **Back** in the upper-left corner to return to the preserved queue. Choose a timeline position and preview duration; the editor calculates the A–B range automatically. Enable **Live timeline sync** when you want that range to follow source playback; it is off by default, while manually moving either timeline thumb still updates the range. Channel choices are monitored live: selecting one channel mutes the other and sends the kept channel to both speakers. Preview generation is only used for DeepFilterNet noise reduction. Choose **Apply to this video** to override the global settings for only that queue item, **Use global settings** to remove the override, or **Use as global settings** to send the editor choices to the main window and all queued videos without custom overrides.

By default, each result is saved beside its source. Use **Change** under Output location to send the whole batch to another folder.
Enable **Open file location when complete** to open every distinct output folder once after a successful batch.

## Requirements

- Windows 10/11
- Node.js and npm
- Python 3.11 for optional DeepFilterNet denoising. The installer can download Python 3.11.9 from python.org after asking for confirmation.

Channel removal uses FFmpeg and does not require Python. If `client\dependencies\ffmpeg.exe` is missing, the installer downloads and verifies the Windows release essentials build automatically. If that fails, it opens the FFmpeg download page and explains where to place the executable. AI noise reduction uses DeepFilterNet 3 with CPU-only Torch and TorchAudio 2.1.2.

## Build

Run `[Client_Build].bat`. The unpacked Windows application is placed in `client\dist-client`. The build includes FFmpeg, the DeepFilterNet 3 model, and the Python bridge. AI denoising requires Python 3.11 with the packages from `client\requirements.txt` on the target computer.
