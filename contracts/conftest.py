"""Windows shim for gltest's direct runner, which unlinks a temp file it still
has open (WinError 32). Ignore that one failure; a stray temp file is harmless."""

import os
import sys

if sys.platform == "win32":
    _unlink = os.unlink

    def _tolerant_unlink(path, *args, **kwargs):
        try:
            _unlink(path, *args, **kwargs)
        except PermissionError:
            pass

    os.unlink = _tolerant_unlink
