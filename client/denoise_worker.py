"""Command-line bridge between Electron and the supplied DeepFilterNet model."""

import argparse
import os
import sys
import warnings
from pathlib import Path


warnings.filterwarnings(
    "ignore",
    message=r"`torchaudio\.backend\.common\.AudioMetaData` has been moved.*",
    category=UserWarning,
)


def progress(percent, message):
    print(f"HDZERO_PROGRESS={percent}:{message}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--attenuation", type=float, default=None)
    args = parser.parse_args()

    progress(2, "Starting noise reduction")
    try:
        import soundfile as sf
        import torch
        import df.checkpoint
        import df.utils
        from df.enhance import enhance, init_df
    except ImportError as error:
        raise RuntimeError(
            "DeepFilterNet is not installed. Run [Client_Install_Requirements].bat first."
        ) from error

    # DeepFilterNet probes its installation directory with Git when initializing
    # logging. Installed Python packages are not repositories, so skip that probe.
    df.utils.get_git_root = lambda: None

    # DeepFilterNet uses glob on the complete checkpoint path. Characters such
    # as [ and ] are valid in Windows folder names but glob treats them as a
    # pattern. Keep the parent directory literal and only match the filename.
    def literal_directory_glob(pattern):
        checkpoint_pattern = Path(pattern)
        return [str(match) for match in checkpoint_pattern.parent.glob(checkpoint_pattern.name)]

    df.checkpoint.glob.glob = literal_directory_glob

    progress(8, "Loading DeepFilterNet model")
    model_directory = os.path.abspath(args.model)
    checkpoints = list((Path(model_directory) / "checkpoints").glob("model*.ckpt*"))
    if not checkpoints:
        raise FileNotFoundError(
            "DeepFilterNet3 model checkpoint is missing. Run "
            "[Client_Install_Requirements].bat, then rebuild the packaged application."
        )
    model, state, _ = init_df(model_directory, post_filter=True, log_file=None)
    progress(22, "Loading extracted audio")
    audio_data, sample_rate = sf.read(args.input, dtype="float32", always_2d=True)
    if sample_rate != state.sr():
        raise RuntimeError(
            f"Extracted audio uses {sample_rate} Hz; DeepFilterNet requires {state.sr()} Hz."
        )
    audio = torch.from_numpy(audio_data.T.copy())
    progress(30, "Suppressing background noise")
    cleaned = enhance(model, state, audio, atten_lim_db=args.attenuation)
    progress(90, "Saving cleaned audio")
    sf.write(args.output, cleaned.cpu().numpy().T, state.sr(), subtype="PCM_16")
    progress(100, "Noise reduction complete")


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        message = str(error).strip() or repr(error)
        print(f"{type(error).__name__}: {message}", file=sys.stderr)
        sys.exit(1)
