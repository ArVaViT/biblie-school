"""Convert scripts/assets/acts_sources.md into a nicely formatted PDF
for inclusion in the course materials. No Markdown parser is pulled in;
we do a lightweight pass that handles the subset of Markdown we use:
H1/H2/H3 headings, horizontal rules, unordered/ordered list items, bold
inline (**...**), italic inline (*...*), and paragraph text.

Output: scripts/assets/acts_sources.pdf

Run once whenever the Markdown source changes:

    pip install fpdf2
    python scripts/build_sources_pdf.py
"""
from __future__ import annotations

import re
from pathlib import Path

from fpdf import FPDF

REPO = Path(__file__).resolve().parent.parent
MD = REPO / "scripts" / "assets" / "acts_sources.md"
OUT = REPO / "scripts" / "assets" / "acts_sources.pdf"

# Bundled DejaVuSans has full Cyrillic coverage and ships with many
# Python installs under matplotlib. Fall back to a local copy if needed.
CANDIDATE_FONTS = [
    Path("C:/Windows/Fonts/DejaVuSans.ttf"),
    Path("C:/Windows/Fonts/arial.ttf"),
]


def _pick_font() -> Path:
    # Prefer DejaVu (full Unicode); Arial also works on Windows for Cyrillic.
    for p in CANDIDATE_FONTS:
        if p.is_file():
            return p
    raise SystemExit("No suitable TTF font found for Cyrillic PDF output")


def _render_inline(pdf: FPDF, text: str) -> None:
    """Render inline Markdown with **bold** and *italic* spans."""
    parts = re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*)", text)
    style = ""
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            style = "B"
            content = part[2:-2]
        elif part.startswith("*") and part.endswith("*"):
            style = "I"
            content = part[1:-1]
        else:
            style = ""
            content = part
        pdf.set_font("body", style, 11)
        pdf.write(5.5, content)
    pdf.ln(5.5)


def main() -> None:
    font_path = _pick_font()
    md = MD.read_text(encoding="utf-8")

    pdf = FPDF(format="A4", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("body", "", str(font_path))
    # Paired bold/italic from same family when present; otherwise fall
    # back to the regular face so we never crash on "undefined font".
    variants = {
        "B": ("arialbd.ttf", "DejaVuSans-Bold.ttf"),
        "I": ("ariali.ttf", "DejaVuSans-Oblique.ttf"),
        "BI": ("arialbi.ttf", "DejaVuSans-BoldOblique.ttf"),
    }
    for style, names in variants.items():
        added = False
        for name in names:
            cand = font_path.with_name(name)
            if cand.is_file():
                pdf.add_font("body", style, str(cand))
                added = True
                break
        if not added:
            pdf.add_font("body", style, str(font_path))

    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    in_list = False
    for raw_line in md.splitlines():
        line = raw_line.rstrip()
        if not line:
            pdf.ln(3)
            in_list = False
            continue
        if line.startswith("# "):
            pdf.set_font("body", "B", 20)
            pdf.multi_cell(0, 8, line[2:].strip())
            pdf.ln(3)
            continue
        if line.startswith("## "):
            pdf.ln(2)
            pdf.set_font("body", "B", 15)
            pdf.multi_cell(0, 7, line[3:].strip())
            pdf.ln(1)
            continue
        if line.startswith("### "):
            pdf.set_font("body", "B", 12)
            pdf.multi_cell(0, 6, line[4:].strip())
            pdf.ln(1)
            continue
        if line.strip() in {"---", "***"}:
            y = pdf.get_y() + 2
            pdf.set_draw_color(150, 150, 150)
            pdf.line(20, y, 190, y)
            pdf.ln(6)
            continue
        m_ol = re.match(r"^(\d+)\.\s+(.*)", line)
        m_ul = re.match(r"^[-*]\s+(.*)", line)
        if m_ol:
            in_list = True
            pdf.set_font("body", "", 11)
            pdf.set_x(22)
            pdf.cell(6, 5.5, f"{m_ol.group(1)}.")
            _render_inline(pdf, m_ol.group(2))
            continue
        if m_ul:
            in_list = True
            pdf.set_font("body", "", 11)
            pdf.set_x(22)
            pdf.cell(6, 5.5, "•")
            _render_inline(pdf, m_ul.group(1))
            continue
        pdf.set_font("body", "", 11)
        _render_inline(pdf, line)

    pdf.output(str(OUT))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
