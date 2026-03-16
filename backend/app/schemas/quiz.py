from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID


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
    """Option response without is_correct — used when serving quizzes to students."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    option_text: str
    order_index: int


class QuizQuestionCreate(BaseModel):
    question_text: str = Field(..., max_length=1000)
    question_type: str = "multiple_choice"
    order_index: int = 0
    points: int = 1
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
    """Question response that hides correct answers."""
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
    description: Optional[str] = None
    quiz_type: Literal["quiz", "exam"] = "quiz"
    max_attempts: Optional[int] = Field(None, ge=1, le=10)
    passing_score: int = Field(70, ge=0, le=100)
    questions: list[QuizQuestionCreate] = []


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    quiz_type: Optional[Literal["quiz", "exam"]] = None
    max_attempts: Optional[int] = Field(None, ge=1, le=10)
    passing_score: Optional[int] = None


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chapter_id: str
    title: str
    description: Optional[str] = None
    quiz_type: Literal["quiz", "exam"] = "quiz"
    max_attempts: Optional[int] = None
    passing_score: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    questions: list[QuizQuestionResponse] = []


class QuizStudentResponse(BaseModel):
    """Quiz response that hides correct answers from students."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chapter_id: str
    title: str
    description: Optional[str] = None
    quiz_type: Literal["quiz", "exam"] = "quiz"
    max_attempts: Optional[int] = None
    passing_score: int
    questions: list[QuizQuestionStudentResponse] = []


class QuizSubmitAnswer(BaseModel):
    question_id: UUID
    selected_option_id: Optional[UUID] = None
    text_answer: Optional[str] = None


class QuizSubmitRequest(BaseModel):
    answers: list[QuizSubmitAnswer]


class QuizAnswerResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    question_id: UUID
    selected_option_id: Optional[UUID] = None
    text_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    points_earned: int = 0
    correct_option_id: Optional[UUID] = None


class QuizAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quiz_id: UUID
    user_id: UUID
    score: Optional[int] = None
    max_score: Optional[int] = None
    passed: Optional[bool] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
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
