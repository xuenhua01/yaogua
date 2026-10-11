"""把 Android 工程里的六十四卦数据导出成网页用的 data.js。

数据源：
  app/src/main/java/com/guabook/liuyao/Gua.kt          卦名、上下卦、卦辞、通阻、释义
  app/src/main/java/com/guabook/liuyao/GuaExtraBook.kt 典故轶闻 + 六爻爻辞直解

改完 Android 那边的文案，重跑一次这个脚本，网页版就同步了。
"""

import json
import pathlib
import re
import sys

ANDROID_SRC = pathlib.Path(r"D:\AndroidProjects\YaoGua\app\src\main\java\com\guabook\liuyao")
OUT_FILE = pathlib.Path(__file__).resolve().parent.parent / "data.js"


def parse_guas(text: str):
    pattern = re.compile(
        r'g\(\s*(\d+),\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",'
        r'\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\s*\)',
        re.S,
    )
    guas = []
    for m in pattern.finditer(text):
        guas.append({
            "num": int(m.group(1)),
            "name": m.group(2),
            "full": m.group(3),
            "upper": m.group(4),
            "lower": m.group(5),
            "text": m.group(6),
            "luck": m.group(7),
            "plain": m.group(8),
        })
    return guas


def parse_extras(text: str):
    entry = re.compile(
        r'"([^"]+)"\s*to\s*GuaExtra\(\s*"([^"]*)",\s*listOf\((.*?)\)\s*\)',
        re.S,
    )
    pair = re.compile(r'"([^"]*)"\s*to\s*"([^"]*)"')
    extras = {}
    for m in entry.finditer(text):
        name, story, body = m.group(1), m.group(2), m.group(3)
        extras[name] = {
            "story": story,
            "yao": [{"t": t, "p": p} for t, p in pair.findall(body)],
        }
    return extras


def main() -> int:
    gua_file = ANDROID_SRC / "Gua.kt"
    extra_file = ANDROID_SRC / "GuaExtraBook.kt"
    if not gua_file.exists() or not extra_file.exists():
        print("找不到 Android 源码：%s" % ANDROID_SRC, file=sys.stderr)
        return 1

    guas = parse_guas(gua_file.read_text(encoding="utf-8"))
    extras = parse_extras(extra_file.read_text(encoding="utf-8"))

    problems = []
    if len(guas) != 64:
        problems.append("卦只有 %d 个" % len(guas))
    if len(extras) != 64:
        problems.append("详解只有 %d 个" % len(extras))
    for g in guas:
        e = extras.get(g["name"])
        if e is None:
            problems.append("%s 缺详解" % g["name"])
        elif len(e["yao"]) != 6:
            problems.append("%s 的爻辞只有 %d 条" % (g["name"], len(e["yao"])))
    if problems:
        print("导出失败：", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        return 1

    body = (
        "/* 由 tools/export_data.py 从 Android 工程自动导出，手改会被覆盖。 */\n"
        "const GUA = " + json.dumps(guas, ensure_ascii=False, indent=1) + ";\n\n"
        "const EXTRA = " + json.dumps(extras, ensure_ascii=False, indent=1) + ";\n"
    )
    OUT_FILE.write_text(body, encoding="utf-8")
    print("写好 %s" % OUT_FILE)
    print("  卦 %d 个，详解 %d 个，爻共 %d 条"
          % (len(guas), len(extras), sum(len(e["yao"]) for e in extras.values())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
