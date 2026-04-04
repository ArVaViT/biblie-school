from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class QuizOptionCreate(BaseModel):
    option_text: str = Field(..., max_length=500)
    is_correct: bool = False
    order_index: int = 0


class QuizOptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    option_text: str
    is_correct: bool
    order_index: int


class QuizOptionStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    option_text: str
    order_index: int


class QuizQuestionCreate(BaseModel):
    question_text: str = Field(..., max_length=1000)
    question_type: str = "multiple_choice"
    order_index: int = 0
    points: int = Field(1, ge=1)
    options: list[QuizOptionCreate] = []


class QuizQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_text: str
    question_type: str
    order_index: int
    points: int
    options: list[QuizOptionResponse] = []


class QuizQuestionStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_text: str
    question_type: str
    order_index: int
    points: int
    options: list[QuizOptionStudentResponse] = []


class QuizCreate(BaseModel):
    chapter_id: str
    title: str
    description: str | None = None
    quiz_type: Literal["quiz", "exam"] = "quiz"
    max_attempts: int | None = Field(None, ge=1, le=10)
    passing_score: int = Field(70, ge=0, le=100)
    questions: list[QuizQuestionCreate] = []


class QuizUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    quiz_type: Literal["quiz", "exam"] | None = None
    max_attempts: int | None = Field(None, ge=1, le=10)
    passing_score: int | None = Field(None, ge=0, le=100)


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chapter_id: str
    title: str
    description: str | None = None
    quiz_type: Literal["quiz", "exam"] = "quiz"
    max_attempts: int | None = None
    passing_score: int
    created_at: datetime
    updated_at: datetime | None = None
    questions: list[QuizQuestionResponse] = []


class QuizStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chapter_id: str
    title: str
    description: str | None = None
    quiz_type: Literal["quiz", "exam"] = "quiz"
    max_attempts: int | None = None
    passing_score: int
    questions: list[QuizQuestionStudentResponse] = []


class QuizSubmitAnswer(BaseModel):
    question_id: UUID
    selected_option_id: UUID | None = None
    text_answer: str | None = None


class QuizSubmitRequest(BaseModel):
    answers: list[QuizSubmitAnswer]


class QuizAnswerResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    question_id: UUID
    selected_option_id: UUID | None = None
    text_answer: str | None = None
    is_correct: bool | None = None
    points_earned: int = 0
    correct_option_id: UUID | None = None


class QuizAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quiz_id: UUID
    user_id: UUID
    score: int | None = None
    max_score: int | None = None
    passed: bool | None = None
    started_at: datetime
    completed_at: datetime | None = None
    answers: list[QuizAnswerResult] = []


class GrantExtraAttemptsRequest(BaseModel):
    user_id: UUID
    extra_attempts: int = Field(..., ge=1, le=10)


class ExtraAttemptsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quiz_id: UUID
    user_id: UUID
    extra_attempts: int
    granted_by: UUID
    created_at: datetime
