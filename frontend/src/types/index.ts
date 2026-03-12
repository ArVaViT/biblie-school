export type UserRole = 'admin' | 'teacher' | 'pending_teacher' | 'student'

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  title: string
  description: string | null
  image_url: string | null
  status: 'draft' | 'published'
  created_by: string
  created_at: string
  updated_at: string
  modules?: Module[]
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string | null
  order_index: number
  chapters?: Chapter[]
}

export interface Chapter {
  id: string
  module_id: string
  title: string
  content: string | null
  video_url: string | null
  order_index: number
}

export interface ChapterProgress {
  id: string
  user_id: string
  chapter_id: string
  completed_at: string
}

export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  enrolled_at: string
  progress: number
  course?: Course
}

export interface StudentGrade {
  id: string
  student_id: string
  course_id: string
  grade: string | null
  comment: string | null
  graded_by: string
  graded_at: string
  updated_at: string
}

export interface FileMetadata {
  id: string
  name: string
  url: string
  file_type: string
  course_id: string | null
  user_id: string | null
  uploaded_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  course_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface StudentNote {
  id: string
  user_id: string
  chapter_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface QuizOption {
  id: string
  question_id: string
  option_text: string
  is_correct?: boolean
  order_index: number
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  order_index: number
  points: number
  options: QuizOption[]
}

export interface Quiz {
  id: string
  chapter_id: string
  title: string
  description: string | null
  passing_score: number
  questions: QuizQuestion[]
  created_at: string
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  user_id: string
  score: number | null
  max_score: number | null
  passed: boolean | null
  started_at: string
  completed_at: string | null
}

export interface Assignment {
  id: string
  chapter_id: string
  title: string
  description: string | null
  max_score: number
  due_date: string | null
  created_at: string
}

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  student_id: string
  content: string | null
  file_url: string | null
  submitted_at: string
  status: 'submitted' | 'graded' | 'returned'
  grade: number | null
  feedback: string | null
  graded_by: string | null
  graded_at: string | null
}

export interface Certificate {
  id: string
  user_id: string
  course_id: string
  issued_at: string
  certificate_number: string
}

export interface CourseReview {
  id: string
  user_id: string
  course_id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_name?: string | null
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string | null
}

