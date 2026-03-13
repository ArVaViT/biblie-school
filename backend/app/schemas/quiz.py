from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID


class QuizOptionCreate(BaseModel):
    option_text: str = Field(..., max_length=500)
    is_correct: bool = False
    order_index: int = 0


class QuizOptionResponse(BaseModel):
    id: UUID
    option_text: str
    is_correct: bool
    order_index: int

    class Config:
        from_attributes = True


class QuizOptionStudentResponse(BaseModel):
    """Option response without is_correct — used when serving quizzes to students."""
    id: UUID
    option_text: str
    order_index: int

    class Config:
        from_attributes = True


class QuizQuestionCreate(BaseModel):
    question_text: str = Field(..., max_length=1000)
    question_type: str = "multiple_choice"
    order_index: int = 0
    points: int = 1
    options: list[QuizOptionCreate] = []


class QuizQuestionResponse(BaseModel):
    id: UUID
    question_text: str
    question_type: str
    order_index: int
    points: int
    options: list[QuizOptionResponse] = []

    class Config:
        from_attributes = True


class QuizQuestionStudentResponse(BaseModel):
    """Question response that hides correct answers."""
    id: UUID
    question_text: str
    question_type: str
    order_index: int
    points: int
    options: list[QuizOptionStudentResponse] = []

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


class QuizStudentResponse(BaseModel):
    """Quiz response that hides correct answers from students."""
    id: UUID
    chapter_id: str
    title: str
    description: Optional[str] = None
    quiz_type: Literal["quiz", "exam"] = "quiz"
    max_attempts: Optional[int] = None
    passing_score: int
    questions: list[QuizQuestionStudentResponse] = []

    class Config:
        from_attributes = True


class QuizSubmitAnswer(BaseModel):
    question_id: UUID
    selected_option_id: Optional[UUID] = None
    text_answer: Optional[str] = None


class QuizSubmitRequest(BaseModel):
    answers: list[QuizSubmitAnswer]


class QuizAttemptResponse(BaseModel):
    id: UUID
    quiz_id: UUID
    user_id: UUID
    score: Optional[int] = None
    max_score: Optional[int] = None
    passed: Optional[bool] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
