import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Quiz(Base):
    __tablename__ = "quizzes"
    __table_args__ = (Index("ix_quizzes_chapter_id", "chapter_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    quiz_type = Column(String(20), nullable=False, default="quiz", server_default="quiz")
    max_attempts = Column(Integer, nullable=True)
    passing_score = Column(Integer, nullable=False, default=70)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    questions = relationship(
        "QuizQuestion",
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.order_index",
    )


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    __table_args__ = (Index("ix_quiz_questions_quiz_id_order", "quiz_id", "order_index"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(20), nullable=False, default="multiple_choice")
    order_index = Column(Integer, nullable=False, default=0)
    points = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quiz = relationship("Quiz", back_populates="questions")
    options = relationship(
        "QuizOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuizOption.order_index",
    )


class QuizOption(Base):
    __tablename__ = "quiz_options"
    __table_args__ = (Index("ix_quiz_options_question_id", "question_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)
    order_index = Column(Integer, nullable=False, default=0)

    question = relationship("QuizQuestion", back_populates="options")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        Index("ix_quiz_attempts_user_quiz", "user_id", "quiz_id"),
        Index("ix_quiz_attempts_quiz_id", "quiz_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    score = Column(Integer)
    max_score = Column(Integer)
    passed = Column(Boolean)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))


class QuizExtraAttempt(Base):
    __tablename__ = "quiz_extra_attempts"
    __table_args__ = (Index("ix_quiz_extra_attempts_quiz_user", "quiz_id", "user_id", unique=True),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    extra_attempts = Column(Integer, nullable=False, default=1)
    granted_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"
    __table_args__ = (
        Index("ix_quiz_answers_attempt_id", "attempt_id"),
        Index("ix_quiz_answers_question_id", "question_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    selected_option_id = Column(UUID(as_uuid=True), ForeignKey("quiz_options.id", ondelete="SET NULL"))
    text_answer = Column(Text)
    is_correct = Column(Boolean)
    points_earned = Column(Integer, nullable=False, default=0)
