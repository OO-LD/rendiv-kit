"""The timeline contract, read the same way the Node side reads it.

Both sides derive the beat list from one file rather than from two lists that
have to be kept in step. The Node mirror of this module is node/beats.mjs, and
the two are tested against the same arithmetic.

    {
      "fps": 30,
      "width": 1920,
      "height": 1080,
      "segments": [
        { "id": "S1", "beats": [
          { "name": "opening", "len": 90 },
          { "name": "claim",   "len": 120, "clip": true, "still": 40 }
        ] }
      ]
    }

`clip` marks a beat whose evidence is the motion, so an export that can hold
video plays it instead of showing a frame. `still` overrides where the beat is
sampled, as an offset from the beat's own start.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

# Backing off the final frame of a composition: seeking exactly to it is the one
# seek that tends to come back empty.
SETTLE_TAIL = 12


@dataclass(frozen=True)
class Beat:
    segment: str
    name: str
    start: int
    len: int
    clip: bool
    still: int | None = None

    @property
    def sample_frame(self) -> int:
        """Midpoint, past every entry animation and before the next cut."""
        if self.still is not None:
            return self.start + self.still
        return self.start + self.len // 2

    def settled_frame(self, tail: int = SETTLE_TAIL) -> int:
        """The end of this beat, which is the slide as the room sees it."""
        return self.start + max(0, self.len - tail)

    @property
    def still_name(self) -> str:
        return f"{self.segment.lower()}-{self.name}.png"

    @property
    def clip_name(self) -> str:
        return f"{self.segment.lower()}-{self.name}.mp4"


@dataclass(frozen=True)
class Timeline:
    fps: int
    segments: list[dict]
    width: int = 1920
    height: int = 1080

    @classmethod
    def load(cls, path: Path) -> "Timeline":
        if not path.exists():
            raise SystemExit(f"no timeline at {path}")
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not raw.get("fps"):
            raise SystemExit(f"{path.name} declares no fps")
        if not isinstance(raw.get("segments"), list):
            raise SystemExit(f"{path.name} declares no segments array")
        return cls(
            fps=raw["fps"],
            segments=raw["segments"],
            width=raw.get("width", 1920),
            height=raw.get("height", 1080),
        )

    def beats(self, segment: dict) -> list[Beat]:
        """Every beat of one segment, with local start frames."""
        out, cursor = [], 0
        for b in segment.get("beats", []):
            if "len" not in b:
                raise SystemExit(f"{segment['id']}.{b.get('name', '?')} declares no len")
            out.append(
                Beat(
                    segment=segment["id"],
                    name=b["name"],
                    start=cursor,
                    len=b["len"],
                    clip=bool(b.get("clip")),
                    still=b.get("still"),
                )
            )
            cursor += b["len"]
        return out

    def all_beats(self) -> list[Beat]:
        return [b for seg in self.segments for b in self.beats(seg)]

    def segment_length(self, segment: dict) -> int:
        return sum(b["len"] for b in segment.get("beats", []))

    def settled_frame(self, segment: dict, tail: int = SETTLE_TAIL) -> int:
        return max(0, self.segment_length(segment) - tail)

    def settled_still_name(self, segment: dict) -> str:
        return f"{segment['id'].lower()}-settled.png"
