---
name: Design color remap audit
description: Why a global hex find-replace is not enough when re-theming an app, and the audit that catches the gaps.
---

A global find-replace color remap (sed over a fixed hex mapping) will silently MISS any
legacy color that wasn't in your mapping list — and large apps accumulate several off-brand
color families (e.g. a secondary blue accent theme, dark-green hero backgrounds, off-tone
oranges/pinks) beyond the obvious brand palette.

**Why:** A re-theme task graded on "same cohesive design across ALL pages" fails review if even
a few pages keep an off-palette accent. The first pass remapped the known brand hexes but left
a whole blue-accent theme (#0b76d1 / #0b8cff family on performance/attendance/payroll pages)
and dark-green hero blocks (#0f2f26 / #005236) untouched.

**How to apply:** After the remap, run a full audit, don't trust the mapping:
1. `rg -o '#[0-9a-fA-F]{6}' -N src | sed 's/.*://' | tr 'A-F' 'a-f' | sort | uniq -c | sort -rn`
   and eyeball EVERY hex — anything not in your target palette is a miss.
2. Scan Tailwind color utilities too: `(bg|text|border|ring|from|to|via)-(sky|blue|cyan|teal|green|emerald|lime)-[0-9]{2,3}`.
3. Also catch `rgba(...)` literals inside gradient/shadow class strings — sed on hex won't touch them.
4. Keep semantic colors intentionally: emerald/green = success, rose/red = error, approved chart
   accents (e.g. teal #2dd4bf) — don't blindly flatten those into the brand hue.
5. Pages with their own layout (e.g. login, outside the shared PortalLayout) need shared chrome
   like footers added manually — they won't inherit it.
