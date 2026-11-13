from pathlib import Path

p = Path("app/agent/prompts.py")
s = p.read_text(encoding="utf-8")
old = "Recommendations must not contain numbers. "
new = ("Recommendations must not contain numbers. When a value rose or fell, do not also put a minus sign "
       "on it (write 'fell by 345,052.78', not 'fell by -345,052.78'). ")
assert s.count(old) == 1, "prompt line not found exactly once"
p.write_text(s.replace(old, new), encoding="utf-8")
print("prompt patched")