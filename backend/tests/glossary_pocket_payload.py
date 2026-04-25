# Human-facing HTML / quiz copy uses typographic dashes and apostrophes.
# ruff: noqa: RUF001
"""
Payload and request sequence for the “Pocket Glossary” demo course.

This mirrors what you would do by hand: POST/PUT the same API routes in order.
The pytest ``test_glossary_course_seed`` uses it to lock the contract; there
is no separate user-facing seed script in the repo.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from collections.abc import Callable

# Tests only: fake same-origin path; real runs use storage upload (see dev_run_*, ``set_cover``).
TEST_SEED_COVER_PATH = "/img/course-assets/00000000-0000-0000-0000-000000000000/cover.png"

COURSE_TITLE = "A Pocket Glossary: Bible Words That Keep Coming Up"
COURSE_DESCRIPTION = (
    "Short definitions for words you will see over and over in English Bibles and classes. "
    "No heavy theology here—just enough to read and discuss without tripping on vocabulary."
)

INTRO_HTML = """
<h2>What this is</h2>
<p>These notes are a cheat sheet, not a full theology course. The goal is simple: when a word keeps appearing in your reading or in class, you have a place to look.</p>
<p>Translations differ; this glossary sticks to <strong>common English Bible use</strong> and tries to stay close to the text everyone can look up for themselves.</p>
<p>Work through the two reading chapters, then take the short quiz. You can retry if the app allows—check the attempt limit on the last chapter.</p>
""".strip()

READ_A_HTML = """
<h2>Names you will hear a lot</h2>
<p><strong>Israel</strong> — in the Old Testament, the name often refers to the people group descended from Jacob (also called Israel) and, later, the northern and southern kingdoms. In the New Testament, the term can be used in more than one way—so always look at the sentence around it.</p>
<p><strong>Gentile</strong> — simply “nations” or “non-Israelite.” English Bibles use “Gentile” to keep the same contrast you see in the Greek text: insider community versus the wider world.</p>
<p><strong>Apostle</strong> — a “sent one.” In the Gospels, Jesus chooses twelve. After his resurrection, the same word shows up in other messengers, too, but the Twelve get the spotlight early on.</p>
<h2>Kinds of writing</h2>
<p><strong>Psalm</strong> — a song or poem, usually in the book of Psalms, meant to be prayed and sung, not just studied.</p>
<p><strong>Proverb</strong> — a short, punchy line of wisdom, especially in the book of Proverbs. It teaches how life tends to go when God is honored.</p>
<p><strong>Parable</strong> — a brief story in the Gospels, often from Jesus, that works like a picture to make a single point. It is not a hidden code for every detail.</p>
<p><strong>Epistle</strong> — a letter. A big chunk of the New Testament is letters to churches and leaders, with teaching, encouragement, and practical counsel.</p>
""".strip()

READ_B_HTML = """
<h2>Old and New</h2>
<p><strong>Old Testament</strong> — the first big section of a Protestant Bible, usually arranged as Law, history, poetry, and prophets, all pointing forward to the story that picks up in Jesus.</p>
<p><strong>New Testament</strong> — the second section: four accounts of Jesus (often called the Gospels), the story of the first churches in Acts, letters, and Revelation.</p>
<p><strong>Gospel</strong> — first, the “good news” of what God has done in Jesus. Second, a label for the first four New Testament books (Matthew–John), which tell that story in narrative form.</p>
<h2>Big-picture terms</h2>
<p><strong>Law and the Prophets</strong> — a phrase Jesus and others use for the same Scriptures you now split across many books. It is not a book title; it is shorthand for what was already on the scroll shelf.</p>
<p><strong>Covenant</strong> — a serious promise God makes with a people. The Bible carries several, and the New Testament re-reads the older ones in light of Jesus—without re-labeling the pages for you here.</p>
<p><strong>Scripture / the Scriptures</strong> — the writings treated as God’s word to his people, quoted with weight and not as a footnote. Context decides whether a verse means a single line or a whole book.</p>
<p><strong>Grace</strong> — favor you did not earn. The word shows up in blessings, rescue stories, and the letters, always tied to what God has done first.</p>
<p><strong>Faith</strong> — trust: leaning your weight on who God is and what he has said, the way a child trusts a parent. It is not the same as “a vague good attitude.”</p>
""".strip()


def quiz_questions() -> list[dict[str, Any]]:
    return [
        {
            "question_text": "In a Protestant Bible, the “Old Testament” section is best described as:",
            "question_type": "multiple_choice",
            "order_index": 0,
            "points": 1,
            "options": [
                {
                    "option_text": "The first major part of the Bible, leading up to the New Testament",
                    "is_correct": True,
                    "order_index": 0,
                },
                {
                    "option_text": "A single long poem in the back of the book of Psalms",
                    "is_correct": False,
                    "order_index": 1,
                },
                {
                    "option_text": "Only the first five books, with everything else left out",
                    "is_correct": False,
                    "order_index": 2,
                },
                {"option_text": "A table of church holidays", "is_correct": False, "order_index": 3},
            ],
        },
        {
            "question_text": "The word “Gospel” in talking about the first four New Testament books usually means:",
            "question_type": "multiple_choice",
            "order_index": 1,
            "points": 1,
            "options": [
                {
                    "option_text": "Narrative books that tell the story of Jesus' life, death, and resurrection",
                    "is_correct": True,
                    "order_index": 0,
                },
                {"option_text": "A list of proverbs in the book of Proverbs", "is_correct": False, "order_index": 1},
                {"option_text": "A letter Paul wrote to Rome", "is_correct": False, "order_index": 2},
                {"option_text": "A collection of psalms for morning prayer", "is_correct": False, "order_index": 3},
            ],
        },
        {
            "question_text": "A “psalm” is most often:",
            "question_type": "multiple_choice",
            "order_index": 2,
            "points": 1,
            "options": [
                {
                    "option_text": "A song or prayer-poem, especially in the book of Psalms",
                    "is_correct": True,
                    "order_index": 0,
                },
                {"option_text": "A legal rule from the book of Deuteronomy", "is_correct": False, "order_index": 1},
                {"option_text": "A travel journal from Acts", "is_correct": False, "order_index": 2},
                {"option_text": "A list of family names in Genesis", "is_correct": False, "order_index": 3},
            ],
        },
        {
            "question_text": "A “parable” in the Gospels is best described as:",
            "question_type": "multiple_choice",
            "order_index": 3,
            "points": 1,
            "options": [
                {
                    "option_text": "A short story that illustrates one main point, often from Jesus",
                    "is_correct": True,
                    "order_index": 0,
                },
                {"option_text": "A contract between a king and a nation", "is_correct": False, "order_index": 1},
                {"option_text": "A type of psalm with no music", "is_correct": False, "order_index": 2},
                {"option_text": "A Roman census record", "is_correct": False, "order_index": 3},
            ],
        },
        {
            "question_text": "In Bible English, a “Gentile” is:",
            "question_type": "multiple_choice",
            "order_index": 4,
            "points": 1,
            "options": [
                {
                    "option_text": "Someone from the nations—outside Israel’s line—unless the sentence says otherwise",
                    "is_correct": True,
                    "order_index": 0,
                },
                {"option_text": "Only a Roman citizen", "is_correct": False, "order_index": 1},
                {"option_text": "Only a Jewish priest", "is_correct": False, "order_index": 2},
                {"option_text": "A person who only reads Psalms", "is_correct": False, "order_index": 3},
            ],
        },
        {
            "question_text": "A “covenant” in Scripture is closest to:",
            "question_type": "multiple_choice",
            "order_index": 5,
            "points": 1,
            "options": [
                {
                    "option_text": "A serious binding promise, especially one God makes with his people",
                    "is_correct": True,
                    "order_index": 0,
                },
                {"option_text": "A building where believers meet on Sundays", "is_correct": False, "order_index": 1},
                {"option_text": "A type of New Testament parable with animals", "is_correct": False, "order_index": 2},
                {"option_text": "A list of food laws only", "is_correct": False, "order_index": 3},
            ],
        },
        {
            "question_text": "The phrase “Law and the Prophets” (as Jesus uses it) points to:",
            "question_type": "multiple_choice",
            "order_index": 6,
            "points": 1,
            "options": [
                {
                    "option_text": "The same Scriptures, in scroll form, that Jesus treated as God’s word",
                    "is_correct": True,
                    "order_index": 0,
                },
                {
                    "option_text": "Only the first five books of the Bible, nothing else",
                    "is_correct": False,
                    "order_index": 1,
                },
                {"option_text": "A Roman law code adopted by the synagogue", "is_correct": False, "order_index": 2},
                {"option_text": "A separate book not included in the Bible", "is_correct": False, "order_index": 3},
            ],
        },
        {
            "question_text": "Biblical “faith” most often matches which idea below?",
            "question_type": "multiple_choice",
            "order_index": 7,
            "points": 1,
            "options": [
                {
                    "option_text": "Active trust in God, not a mere opinion",
                    "is_correct": True,
                    "order_index": 0,
                },
                {"option_text": "A guarantee that life will be easy this week", "is_correct": False, "order_index": 1},
                {
                    "option_text": "Only religious feelings with no change in behavior",
                    "is_correct": False,
                    "order_index": 2,
                },
                {
                    "option_text": "Memorizing chapter numbers without reading them",
                    "is_correct": False,
                    "order_index": 3,
                },
            ],
        },
    ]


class _Http(Protocol):
    def post(self, path: str, body: dict[str, Any] | None) -> dict[str, Any]: ...
    def put(self, path: str, body: dict[str, Any] | None) -> dict[str, Any]: ...


def run_pocket_glossary(
    http: _Http,
    *,
    image_url: str | None = None,
    set_cover: Callable[[str], str] | None = None,
) -> str:
    """Create module tree, blocks, quiz, publish. Returns ``course_id``."""
    if image_url is not None and set_cover is not None:
        raise ValueError("pass at most one of image_url, set_cover")

    course = http.post(
        "/courses",
        {
            "title": COURSE_TITLE,
            "description": COURSE_DESCRIPTION,
            "image_url": None,
        },
    )
    cid: str = course["id"]
    if set_cover is not None:
        cover = set_cover(cid)
        if cover:
            http.put(f"/courses/{cid}", {"image_url": cover})
    elif image_url is not None:
        http.put(f"/courses/{cid}", {"image_url": image_url})
    mod = http.post(
        f"/courses/{cid}/modules",
        {
            "title": "Glossary and check-up",
            "description": "Read the notes, then take the short quiz on the last chapter.",
            "order_index": 1,
        },
    )
    mid: str = mod["id"]

    ch_intro = http.post(
        f"/courses/{cid}/modules/{mid}/chapters",
        {"title": "Start here", "chapter_type": "reading", "order_index": 1},
    )
    ch_a = http.post(
        f"/courses/{cid}/modules/{mid}/chapters",
        {"title": "Story, people, and everyday words", "chapter_type": "reading", "order_index": 2},
    )
    ch_b = http.post(
        f"/courses/{cid}/modules/{mid}/chapters",
        {"title": "How the library fits together", "chapter_type": "reading", "order_index": 3},
    )
    ch_q = http.post(
        f"/courses/{cid}/modules/{mid}/chapters",
        {"title": "Quick check (8 questions)", "chapter_type": "quiz", "order_index": 4},
    )

    for chapter_id, html in [
        (ch_intro["id"], INTRO_HTML),
        (ch_a["id"], READ_A_HTML),
        (ch_b["id"], READ_B_HTML),
    ]:
        http.post(
            f"/blocks/chapter/{chapter_id}",
            {"block_type": "text", "order_index": 0, "content": html},
        )

    qid: str = ch_q["id"]
    http.post(
        "/quizzes",
        {
            "chapter_id": qid,
            "title": "Glossary check-up",
            "description": "Covers the words from the two reading chapters. Pass mark is 70%.",
            "quiz_type": "quiz",
            "max_attempts": 3,
            "passing_score": 70,
            "questions": quiz_questions(),
        },
    )

    http.put(f"/courses/{cid}", {"status": "published"})
    return cid
