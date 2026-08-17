"""Command-line bridge between Electron and the supplied DeepFilterNet model."""

import argparse
import sys


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
        from df.enhance import enhance, init_df, load_audio, save_audio
    except ImportError as error:
        raise RuntimeError(
            "DeepFilterNet is not installed. Run [Client_Install_Requirements].bat first."
        ) from error

    progress(8, "Loading DeepFilterNet model")
    model, state, _ = init_df(args.model, post_filter=True)
    progress(22, "Loading extracted audio")
    audio, _ = load_audio(args.input, sr=state.sr())
    progress(30, "Suppressing background noise")
    cleaned = enhance(model, state, audio, atten_lim_db=args.attenuation)
    progress(90, "Saving cleaned audio")
    save_audio(args.output, cleaned, sr=state.sr())
    progress(100, "Noise reduction complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
