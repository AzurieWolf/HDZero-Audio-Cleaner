# HDZero Audio Cleaner

A Windows desktop application for repairing, previewing, and cleaning audio in HDZero video recordings.

## Features

- Add one video or build a queue by browsing or dragging and dropping multiple files.
- Process queued videos sequentially with live progress percentages.
- Keep the left channel, keep the right channel, or preserve the original stereo audio.
- Send a kept channel through both speakers for a clean mono result.
- Optionally reduce background noise with DeepFilterNet 3.
- Adjust the maximum noise-reduction attenuation from natural to aggressive.
- Apply one set of global settings or give individual videos custom settings.
- Preserve the original video stream without re-encoding it.
- Keep original files untouched and avoid overwriting existing results.

## Video editor

Select **Edit / preview** beside any queued video to open the editor inside the main window.

The editor provides:

- Source video playback in a stable 16:9 viewer.
- Live left-channel or right-channel muting without generating a preview.
- Automatic A–B preview ranges of 5, 10, 20, or 30 seconds.
- Optional live timeline synchronization with video playback.
- DeepFilterNet preview generation for the selected range.
- Original and generated-preview playback switching.
- Per-video settings marked with a `CUSTOM` badge in the queue.
- Controls to apply settings to one video, return to global settings, or make the editor settings global.

## Output files

Processed videos are placed in a **Fixed Videos** folder beside each source by default. This folder option can be disabled, or a different base output location can be selected.

Output filenames describe the work performed:

- `flight_fixed.mp4`
- `flight_denoised-30db.mp4`
- `flight_fixed+denoised-30db.mp4`

If a filename already exists, the application adds a numbered suffix instead of replacing it. **Open file location when complete** opens each distinct output folder only once after the batch finishes.

## Supported video formats

MP4, MKV, MOV, AVI, WEBM, and M4V.

## Appearance

Use the title-bar **Settings** button to switch between:

- **Black & Red** — a dark interface with red accents.
- **Cyan** — a dark interface with cyan accents.

The selected theme is remembered across restarts and is applied to both the queue and editor.

## Install and run

Requirements:

- Windows 10 or Windows 11
- Node.js with npm
- Python 3.11 for optional AI noise reduction

Setup:

1. Run `[Client_Install_Requirements].bat` once.
2. Allow the installer to install Python 3.11 if AI noise reduction is required.
3. Run `[Client_Run].bat` to start the application.

The requirements installer installs the application packages and prepares FFmpeg automatically. Channel cleanup remains available if the optional AI noise-reduction setup is skipped or unavailable.

## Build

Run `[Client_Build].bat` to create the unpacked Windows application in `client\dist-client`.
