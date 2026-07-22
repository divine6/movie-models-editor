# -*- coding: utf-8 -*-
"""Convert user-guide markdown to PDF via Chrome headless."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[1]
MD_PATH = ROOT / "docs" / "user-guide" / "3D场景编辑器使用说明.md"
HTML_PATH = ROOT / "docs" / "user-guide" / "_tmp-guide.html"
PDF_PATH = ROOT / "docs" / "user-guide" / "3D场景编辑器使用说明.pdf"

CHROME_CANDIDATES = [
    Path.home() / "AppData/Local/Google/Chrome/Application/chrome.exe",
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
]

CSS = """
@page { size: A4; margin: 16mm 12mm; }
* { box-sizing: border-box; }
body {
  font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 11pt;
  line-height: 1.65;
  color: #1a1a1a;
  margin: 0;
  padding: 8px;
}
h1 { font-size: 22pt; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px; margin-top: 0; page-break-after: avoid; }
h2 { font-size: 16pt; color: #2b6cb0; margin-top: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; page-break-after: avoid; }
h3 { font-size: 13pt; color: #2d3748; margin-top: 20px; page-break-after: avoid; }
h4 { font-size: 11.5pt; color: #4a5568; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 12px 0 18px; font-size: 10pt; page-break-inside: avoid; }
th, td { border: 1px solid #cbd5e0; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #edf2f7; font-weight: 600; }
tr:nth-child(even) td { background: #f7fafc; }
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px auto 18px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  page-break-inside: avoid;
}
blockquote {
  margin: 12px 0;
  padding: 8px 14px;
  border-left: 4px solid #2b6cb0;
  background: #ebf8ff;
  color: #2d3748;
}
code {
  font-family: Consolas, "Courier New", monospace;
  background: #edf2f7;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9.5pt;
}
pre {
  background: #1a202c;
  color: #e2e8f0;
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
pre code { background: transparent; color: inherit; padding: 0; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
a { color: #2b6cb0; text-decoration: none; }
"""


def find_browser() -> Path:
    for p in CHROME_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError("未找到 Chrome 或 Edge")


def main() -> int:
    if not MD_PATH.exists():
        print(f"找不到 Markdown: {MD_PATH}", file=sys.stderr)
        return 1

    md_text = MD_PATH.read_text(encoding="utf-8")
    body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists", "toc"],
    )
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>UltimateBox 3D 场景编辑器 — 客户使用说明</title>
<style>{CSS}</style>
</head>
<body>
{body}
</body>
</html>
"""
    HTML_PATH.write_text(html, encoding="utf-8")

    browser = find_browser()
    # Chrome requires absolute file URL and absolute PDF path
    file_url = HTML_PATH.resolve().as_uri()
    pdf_out = str(PDF_PATH.resolve())

    cmd = [
        str(browser),
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_out}",
        file_url,
    ]
    print("Running:", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        return result.returncode

    if not PDF_PATH.exists():
        print("PDF 未生成", file=sys.stderr)
        return 1

    # cleanup temp html
    try:
        HTML_PATH.unlink(missing_ok=True)
    except OSError:
        pass

    size_kb = PDF_PATH.stat().st_size / 1024
    print(f"PDF 已生成: {PDF_PATH} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
