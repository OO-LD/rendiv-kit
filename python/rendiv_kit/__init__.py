"""Deck exports, projector simulation and cut checks for rendiv video projects."""

from .timeline import Beat, Timeline, SETTLE_TAIL
from .exports import ExportConfig, FLAVOURS, PER_BEAT, export, beat_clip
from .vga import degrade, select

__all__ = [
    "Beat",
    "Timeline",
    "SETTLE_TAIL",
    "ExportConfig",
    "FLAVOURS",
    "PER_BEAT",
    "export",
    "beat_clip",
    "degrade",
    "select",
]

__version__ = "0.1.5"
