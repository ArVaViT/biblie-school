"""Shared ``router`` for every courses endpoint module.

Each of the endpoint modules in this package (``catalog``, ``crud``,
``modules``, ``chapters``, ``enrollment``) attaches its routes to this
single router so everything stays under ``/courses`` without a
module-per-sub-prefix explosion.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/courses", tags=["courses"])
