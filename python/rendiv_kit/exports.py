"""Export a rendiv project as a deck, so it survives a projector that takes no video.

    rendiv-export pdf            one page per beat, stills only
    rendiv-export pptx-stills    one slide per beat, stills only
    rendiv-export pptx-video     one slide per beat, that beat's clip, plays on advance
    rendiv-export pptx-settled   one slide per segment, final state only

Four flavours, three of which are per beat. Per beat is the unit because beats
replace each other as often as they accumulate: a segment that shows records,
then gaps, then a claim is three pictures, and one slide per segment keeps the
last and drops the other two without saying so.

`pptx-video` carries one clip per *beat*, not per segment. A clip covering a
whole segment plays every one of its beats on a single advance, which is the
deck's navigation gone: the room cannot be stopped between two of them, and the
presenter cannot go back one step. `pptx-settled` is the only flavour that works
per segment, and it is named for what it loses.

The PDF is the one export that cannot hold video, so a clip beat becomes its
still there.

Stills are read from a directory the Node side renders; see `--stills` and
`--render-missing`. Clips are cut out of the segment renders in `out/segments/`.
"""

from __future__ import annotations

import argparse
import shlex
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

from pptx import Presentation
from pptx.util import Emu

from .timeline import SETTLE_TAIL, Beat, Timeline

# 16:9 at the size PowerPoint itself uses, so the deck opens without a prompt
# about slide size. 13.333 x 7.5 inches.
SLIDE_W = Emu(12192000)
SLIDE_H = Emu(6858000)

# 1920 / 13.333in is 144, so a PDF at this resolution measures exactly the same
# as the pptx beside it. Anything else prints the deck at a different size than
# the file it was exported with.
PDF_DPI = 144.0

FLAVOURS = ("pdf", "pptx-stills", "pptx-video", "pptx-settled")

PER_BEAT = {"pdf", "pptx-stills", "pptx-video"}


@dataclass
class ExportConfig:
    """Everything about one project that the exporter needs.

    Nothing here has a default that names a project. `stem` in particular is the
    filename handed to a room, and no two projects share one.
    """

    root: Path
    stem: str
    timeline: Path | None = None
    stills_dir: Path | None = None
    segments_dir: Path | None = None
    out_dir: Path | None = None
    ffmpeg: Path | None = None
    # Appended to the output filename, per flavour. Named for the room rather
    # than for the build: nobody handed a deck knows what a beat is, so the
    # per-beat deck takes the bare name.
    suffixes: dict = field(
        default_factory=lambda: {
            "pdf": "",
            "pptx-stills": "",
            "pptx-video": "-video",
            "pptx-settled": "-per-segment",
        }
    )
    # Shelled out to when a still is missing and --render-missing is given.
    # `{names}` expands to the space separated still names that are absent.
    render_command: str | None = None

    def __post_init__(self) -> None:
        self.root = Path(self.root).resolve()
        self.timeline = self.timeline or self.root / "src" / "timeline.json"
        self.out_dir = self.out_dir or self.root / "out"
        self.stills_dir = self.stills_dir or self.out_dir / "stills"
        self.segments_dir = self.segments_dir or self.out_dir / "segments"
        if self.ffmpeg is None:
            name = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
            local = self.root / "node_modules" / "ffmpeg-static" / name
            # The same binary the renderer stitches with, rather than whatever is
            # on PATH, so the clips in the deck encode the way the video did.
            self.ffmpeg = local if local.exists() else Path("ffmpeg")


def _run_ffmpeg(cfg: ExportConfig, args: list[str]) -> None:
    proc = subprocess.run(
        [str(cfg.ffmpeg), "-y", "-hide_banner", "-loglevel", "error", *args],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise SystemExit(f"ffmpeg failed:\n{proc.stderr.strip()}")


def beat_clip(cfg: ExportConfig, tl: Timeline, beat: Beat) -> Path:
    """The slice of a rendered segment that belongs to one beat.

    Cut out of the segment render rather than rendered again, so the clip in the
    deck is frame for frame the clip in the video. Re-encoded rather than stream
    copied: a copy can only cut on a keyframe, and beats do not start on one, so
    the slide would open on whatever the previous beat left behind.
    """
    src = cfg.segments_dir / f"{beat.segment}.mp4"
    if not src.exists():
        raise SystemExit(
            f"missing segment render for {beat.segment}: {src}\n"
            f"  render it first, then re-run this export"
        )

    dest = cfg.out_dir / "beat-clips" / beat.clip_name
    if dest.exists() and dest.stat().st_size > 0 and dest.stat().st_mtime >= src.stat().st_mtime:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)

    _run_ffmpeg(
        cfg,
        [
            "-ss", f"{beat.start / tl.fps:.3f}",
            "-t", f"{beat.len / tl.fps:.3f}",
            "-i", str(src),
            "-an",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(dest),
        ],
    )
    if dest.stat().st_size == 0:
        raise SystemExit(f"ffmpeg wrote an empty clip for {beat.segment}.{beat.name}")
    return dest


def add_full_bleed(prs: Presentation, image: Path) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.shapes.add_picture(str(image), 0, 0, width=SLIDE_W, height=SLIDE_H)
    return slide


def add_clip(prs: Presentation, clip: Path, poster: Path):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.shapes.add_movie(
        str(clip), 0, 0, SLIDE_W, SLIDE_H,
        poster_frame_image=str(poster), mime_type="video/mp4",
    )
    # python-pptx leaves the media waiting for a click. Advancing to the slide
    # should play it, which is the whole point of this flavour.
    #
    # The trigger is not near the shape: it is a `p:cond` inside the slide's own
    # `p:timing`, carrying `delay="indefinite"`, which is PowerPoint for "wait".
    # Setting it to 0 starts the media when the slide appears. Walking up from
    # the movie element instead lands above `p:timing` and silently changes
    # nothing.
    P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
    timing = slide._element.find(P + "timing")
    if timing is None:
        raise RuntimeError("no p:timing on the slide, cannot set the media to autoplay")
    changed = 0
    for cond in timing.iter(P + "cond"):
        if cond.get("delay") == "indefinite":
            cond.set("delay", "0")
            changed += 1
    if not changed:
        raise RuntimeError("no indefinite trigger found, media would wait for a click")
    return slide


def set_notes(slide, text: str) -> None:
    """The beat name in the notes rather than on the slide, so frames stay full bleed."""
    slide.notes_slide.notes_text_frame.text = text


def write_pdf(pages: list[Path], dest: Path) -> None:
    from PIL import Image

    if not pages:
        raise SystemExit("no pages to write")
    first, *rest = [Image.open(p).convert("RGB") for p in pages]
    first.save(str(dest), "PDF", save_all=True, append_images=rest, resolution=PDF_DPI)


def _require_stills(cfg: ExportConfig, wanted: list[tuple[str, Path]]) -> None:
    missing = [(name, p) for name, p in wanted if not p.exists()]
    if not missing:
        return
    names = " ".join(n for n, _ in missing)
    if cfg.render_command:
        cmd = cfg.render_command.replace("{names}", names)
        print(f"rendering {len(missing)} missing stills: {cmd}")
        subprocess.run(shlex.split(cmd), cwd=cfg.root, check=True)
        still_gone = [p for _, p in missing if not p.exists()]
        if still_gone:
            raise SystemExit(
                f"{len(still_gone)} stills are still missing after the render command, "
                f"first: {still_gone[0]}"
            )
        return
    raise SystemExit(
        f"{len(missing)} stills are missing from {cfg.stills_dir}, first: {missing[0][1].name}\n"
        f"  render them, or pass --render-missing with --render-command"
    )


def export(cfg: ExportConfig, flavour: str, tail: int = SETTLE_TAIL) -> Path:
    if flavour not in FLAVOURS:
        raise SystemExit(f"unknown flavour {flavour}, expected one of {', '.join(FLAVOURS)}")

    tl = Timeline.load(cfg.timeline)
    per_beat = flavour in PER_BEAT

    if per_beat:
        units = [(b, cfg.stills_dir / b.still_name) for b in tl.all_beats()]
    else:
        units = [
            (seg, cfg.stills_dir / tl.settled_still_name(seg)) for seg in tl.segments
        ]
    _require_stills(cfg, [(p.stem, p) for _, p in units])

    suffix = "pdf" if flavour == "pdf" else "pptx"
    dest = cfg.out_dir / f"{cfg.stem}{cfg.suffixes.get(flavour, '')}.{suffix}"
    dest.parent.mkdir(parents=True, exist_ok=True)

    if flavour == "pdf":
        write_pdf([p for _, p in units], dest)
        count = len(units)
    else:
        prs = Presentation()
        prs.slide_width, prs.slide_height = SLIDE_W, SLIDE_H
        count = 0
        for unit, image in units:
            if flavour == "pptx-video":
                # One clip per beat. This is the whole correction: reaching for a
                # segment clip here would put every beat of that segment behind a
                # single advance.
                slide = add_clip(prs, beat_clip(cfg, tl, unit), image)
                set_notes(slide, f"{unit.segment} {unit.name}")
            elif flavour == "pptx-stills":
                # A beat whose evidence is the motion is a video even in the
                # stills deck: a frame of a screen recording is a screenshot of a
                # moment nobody chose.
                if unit.clip:
                    slide = add_clip(prs, beat_clip(cfg, tl, unit), image)
                else:
                    slide = add_full_bleed(prs, image)
                set_notes(slide, f"{unit.segment} {unit.name}")
            else:  # pptx-settled
                slide = add_full_bleed(prs, image)
                set_notes(slide, unit["id"])
            count += 1
        prs.save(str(dest))

    size = dest.stat().st_size / 1024 / 1024
    unit_name = "beats" if per_beat else "segments"
    print(f"{count} slides from {count} {unit_name} -> {dest}  {size:.1f} MB  ({flavour})")
    return dest


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("flavour", choices=FLAVOURS)
    ap.add_argument("--root", default=".", help="project root, the directory holding src/")
    ap.add_argument("--stem", required=True, help="output filename without extension or suffix")
    ap.add_argument("--timeline", default=None)
    ap.add_argument("--stills", default=None, help="directory holding the rendered stills")
    ap.add_argument("--segments", default=None, help="directory holding the segment renders")
    ap.add_argument("--out", default=None)
    ap.add_argument(
        "--render-missing", action="store_true",
        help="run --render-command for stills that are absent instead of failing",
    )
    ap.add_argument(
        "--render-command", default=None,
        help="shell command that renders stills; {names} expands to the missing names",
    )
    args = ap.parse_args(argv)

    cfg = ExportConfig(
        root=Path(args.root),
        stem=args.stem,
        timeline=Path(args.timeline) if args.timeline else None,
        stills_dir=Path(args.stills) if args.stills else None,
        segments_dir=Path(args.segments) if args.segments else None,
        out_dir=Path(args.out) if args.out else None,
        render_command=args.render_command if args.render_missing else None,
    )
    export(cfg, args.flavour)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
