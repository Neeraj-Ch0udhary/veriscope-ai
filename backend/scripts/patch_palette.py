import re
from pathlib import Path

p = Path("app/services/charts.py")
s = p.read_text(encoding="utf-8")
m = re.search(r'^BLUE\s*=\s*["\'][^"\']*["\']', s, re.M)
if not m:
    raise SystemExit("BLUE constant not found. Run: Select-String app\\services\\charts.py -Pattern 'BLUE'")
p.write_text(s[:m.start()] + 'BLUE = "#06b6d4"' + s[m.end():], encoding="utf-8")
print("palette patched")