"""Simulate the worst realistic projector path, from the real stills.

A room that offers HDMI or VGA, with a projector not known in advance. The worse
case is a 1024x768 panel showing 16:9 letterboxed, so the picture is 1024x576,
through an analogue chain, with a tired lamp in a lit lecture hall.

  downscale 1920x1080 to 1024x576   what the panel can actually resolve
  Gaussian 0.6 px                   the analogue chain
  contrast 0.80, brightness 0.94    tired lamp, ambient light
  upscale back to 1920x1080         so the loss is visible at viewing size
                                    rather than hidden by the image being small

The upscale is the point. Reviewing a 1024 wide file on a 27 inch monitor is
reviewing it at four times the angular size it will have from the back row.

    rendiv-vga                  the configured target set
    rendiv-vga s09 s12          only the stills matching those patterns
    rendiv-vga --all            every still

**Every pattern must match something.** A target that matches nothing raises
rather than being skipped. Two decks carried target lists that had gone stale
against renamed stages, and both reported a clean run while simulating nothing
at all. That failure is silent and it survives a build.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

PANEL = (1024, 576)
FULL = (1920, 1080)
BLUR = 0.6
CONTRAST = 0.80
BRIGHTNESS = 0.94


def degrade(
    src: Path,
    dst: Path,
    panel: tuple[int, int] = PANEL,
    full: tuple[int, int] = FULL,
    blur: float = BLUR,
    contrast: float = CONTRAST,
    brightness: float = BRIGHTNESS,
) -> None:
    img = Image.open(src).convert("RGB")
    small = img.resize(panel, Image.LANCZOS)
    small = small.filter(ImageFilter.GaussianBlur(blur))
    small = ImageEnhance.Contrast(small).enhance(contrast)
    small = ImageEnhance.Brightness(small).enhance(brightness)
    small.resize(full, Image.BICUBIC).save(dst)


def select(patterns: list[str], available: list[str]) -> list[str]:
    """Resolve every pattern, or raise naming the ones that resolved to nothing."""
    wanted: list[str] = []
    empty: list[str] = []
    for p in patterns:
        hits = [n for n in available if p.lower() in n.lower()]
        if not hits:
            empty.append(p)
        for h in hits:
            if h not in wanted:
                wanted.append(h)
    if empty:
        raise SystemExit(
            "vga: these targets matched no still, so nothing was simulated for them:\n"
            + "".join(f"  {p}\n" for p in empty)
            + "Fix the target list rather than trusting the result."
        )
    return wanted


def default_targets(config: Path | None) -> list[str]:
    """The boards worth checking, which is a per-project judgement.

    The densest type, the thinnest drawn edges, the quoted documents and the
    tables with the most rows. If those hold, the headline boards hold. Which
    boards those are is not something the kit can know, so it is declared in the
    project rather than guessed here.
    """
    if config and config.exists():
        return json.loads(config.read_text(encoding="utf-8"))
    return []


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("targets", nargs="*", help="substring patterns against still names")
    ap.add_argument("--all", action="store_true", help="every still, ignoring the target list")
    ap.add_argument("--stills", default="out/stills")
    ap.add_argument("--out", default="out/vga")
    ap.add_argument(
        "--targets-file", default="scripts/vga-targets.json",
        help="JSON array of default patterns, used when none are given on the command line",
    )
    ap.add_argument("--blur", type=float, default=BLUR)
    ap.add_argument("--contrast", type=float, default=CONTRAST)
    ap.add_argument("--brightness", type=float, default=BRIGHTNESS)
    ap.add_argument("--panel", default="1024x576")
    args = ap.parse_args(argv)

    stills = Path(args.stills)
    out = Path(args.out)
    panel = tuple(int(n) for n in args.panel.split("x"))

    available = sorted(p.stem for p in stills.glob("*.png"))
    if not available:
        raise SystemExit(f"no stills in {stills}; render them first")

    if args.all:
        wanted = available
    else:
        patterns = args.targets or default_targets(Path(args.targets_file))
        if not patterns:
            raise SystemExit(
                f"no targets given and {args.targets_file} holds none. "
                "Name the boards to check, or pass --all."
            )
        wanted = select(patterns, available)

    out.mkdir(parents=True, exist_ok=True)
    started = time.time()
    for name in wanted:
        degrade(
            stills / f"{name}.png", out / f"{name}.png",
            panel=panel, blur=args.blur,
            contrast=args.contrast, brightness=args.brightness,
        )
        print(f"{name} ok")
    print(
        f"\n{len(wanted)} boards through {panel[0]}x{panel[1]}, blur {args.blur}, "
        f"contrast {args.contrast}, brightness {args.brightness} "
        f"in {time.time() - started:.1f}s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
