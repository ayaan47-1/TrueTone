#!/usr/bin/env python3
# scripts/export_stub_model.py
#
# Produces a trivial but REAL ExecuTorch model: global-average-pool the input image,
# a small linear head -> 8 sigmoid scores + 4 skin-type logits. The result is deterministic
# and input-dependent, so the native runtime + tensor I/O are genuinely exercised on-device
# (this is the "deep stub" — the real model later is a file swap, no code change).
#
# Output contract (must match src/features/read/decode-output.ts):
#   forward(x: [1,3,224,224]) -> [1,12]
#     out[:, 0:8]  = sigmoid(...)  -> 8 cosmetic scores in 0..1, positionally mapped to DIMENSIONS
#     out[:, 8:12] = logits        -> 4 skin-type logits, argmax -> SKIN_TYPE_FEELS
#
# Run once (Python 3.10+; ExecuTorch wheels are CPython-only):
#   python3 -m venv .venv && source .venv/bin/activate
#   pip install torch executorch
#   python scripts/export_stub_model.py
#
# DEVICE-ONLY follow-up: the generated .pte is consumed by executorch-engine.ts, which must be
# verified on a physical iPhone (the Simulator has no camera; CLAUDE.md §4). Generating the .pte
# itself is host-runnable and does not require a device.

from pathlib import Path

import torch
from torch import nn
from torch.export import export

# Repo-root-relative output path, independent of the current working directory.
REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "src" / "features" / "read" / "assets" / "stub-model.pte"

NUM_SCORES = 8       # len(DIMENSIONS) in src/content/cosmetic-vocab.ts
NUM_SKIN_TYPES = 4   # len(SKIN_TYPE_FEELS) in src/content/cosmetic-vocab.ts
INPUT_SIZE = 224     # INPUT_SIZE in src/features/read/preprocess.ts


class StubSkinModel(nn.Module):
    """Global-avg-pool -> linear head -> 8 sigmoid scores ++ 4 skin-type logits."""

    def __init__(self) -> None:
        super().__init__()
        # 3 channel means -> 8 scores + 4 skin-type logits
        self.head = nn.Linear(3, NUM_SCORES + NUM_SKIN_TYPES)

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # x: [1, 3, 224, 224]
        pooled = x.mean(dim=(2, 3))                       # [1, 3]
        out = self.head(pooled)                           # [1, 12]
        scores = torch.sigmoid(out[:, :NUM_SCORES])       # [1, 8] in 0..1
        skin = out[:, NUM_SCORES:]                        # [1, 4] logits
        return torch.cat([scores, skin], dim=1)           # [1, 12]


def _to_executorch_program(model: nn.Module, example: tuple):
    """Lower an exported model to an ExecuTorch program.

    Uses the documented `to_edge(...).to_executorch()` path; falls back to the newer
    `to_edge_transform_and_lower` helper if the installed ExecuTorch renamed the export
    surface. The model graph (pool -> linear -> sigmoid/concat) is unchanged either way.
    Confirm against Context7 (resolve-library-id: executorch -> query-docs: "export to .pte")
    if both import paths fail on a future ExecuTorch release.
    """
    exported = export(model, example)
    try:
        from executorch.exir import to_edge

        return to_edge(exported).to_executorch()
    except ImportError:
        from executorch.exir import to_edge_transform_and_lower

        return to_edge_transform_and_lower(exported).to_executorch()


def main() -> None:
    torch.manual_seed(0)  # deterministic placeholder weights
    model = StubSkinModel().eval()
    example = (torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE),)

    with torch.no_grad():
        program = _to_executorch_program(model, example)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "wb") as f:
        f.write(program.buffer)
    print(f"wrote {OUTPUT_PATH.relative_to(REPO_ROOT)} ({OUTPUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
