"""Shared ``router`` for every quiz endpoint module.

Each of the endpoint modules in this package (``crud``, ``attempts``,
``grading``, ``extra``) attaches its routes to this single shared router
so that all quiz endpoints are reachable under ``/quizzes`` without a
module-per-sub-prefix explosion.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/quizzes", tags=["quizzes"])
