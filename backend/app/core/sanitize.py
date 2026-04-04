import re

_TAG_RE = re.compile(r"<\s*/?\s*(script|iframe|object|embed|form|style|link|meta)[^>]*>", re.IGNORECASE)
_EVENT_ATTR_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JS_PROTO_RE = re.compile(r"javascript\s*:", re.IGNORECASE)


def sanitize_string(value: str) -> str:
    """Strip dangerous HTML/JS patterns from user-supplied strings.
    This is a lightweight defence-in-depth measure; the real XSS
    protection comes from React's auto-escaping on the frontend."""
    if not value:
        return value
    value = _TAG_RE.sub("", value)
    value = _EVENT_ATTR_RE.sub("", value)
    value = _JS_PROTO_RE.sub("", value)
    return value.strip()
