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
  enrollment_start: string | null
  enrollment_end: string | null
  start_date: string | null
  end_date: string | null
  modules?: Module[]
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string | null
  order_index: number
  due_date: string | null
  chapters?: Chapter[]
}

export type ChapterType = 'reading' | 'content' | 'video' | 'audio' | 'quiz' | 'exam' | 'assignment' | 'discussion' | 'mixed'

export interface Chapter {
  id: string
  module_id: string
  title: string
  content: string | null
  video_url: string | null
  order_index: number
  chapter_type: ChapterType
  requires_completion: boolean
  is_locked: boolean
}

export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  cohort_id: string | null
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

export interface GradingConfig {
  quiz_weight: number
  assignment_weight: number
  participation_weight: number
}

export interface GradeBreakdown {
  quiz_avg: number
  quiz_weighted: number
  assignment_avg: number
  assignment_weighted: number
  participation_pct: number
  participation_weighted: number
  final_score: number
  letter_grade: string
}

export interface StudentCalculatedGrade {
  student_id: string
  student_name: string | null
  student_email: string
  breakdown: GradeBreakdown
  manual_grade: string | null
}

export interface GradeSummaryResponse {
  course_id: string
  config: GradingConfig
  students: StudentCalculatedGrade[]
  class_average: number
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
  quiz_type: 'quiz' | 'exam'
  max_attempts: number | null
  passing_score: number
  questions: QuizQuestion[]
  created_at: string
}

export interface QuizAnswerResult {
  question_id: string
  selected_option_id: string | null
  text_answer: string | null
  is_correct: boolean | null
  points_earned: number
  correct_option_id: string | null
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
  answers?: QuizAnswerResult[]
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
  status: 'pending' | 'teacher_approved' | 'approved' | 'rejected'
  requested_at: string
}

export interface ChapterBlock {
  id: string
  chapter_id: string
  block_type: string
  order_index: number
  content: string | null
  video_url: string | null
  quiz_id: string | null
  assignment_id: string | null
  file_url: string | null
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

export interface Cohort {
  id: string
  course_id: string
  name: string
  start_date: string
  end_date: string
  enrollment_start: string | null
  enrollment_end: string | null
  status: 'upcoming' | 'active' | 'completed' | 'archived'
  max_students: number | null
  student_count: number
  created_at: string
  updated_at: string
}

export type NotificationType =
  | 'certificate_approved'
  | 'certificate_rejected'
  | 'assignment_graded'
  | 'new_announcement'
  | 'course_update'
  | 'enrollment_confirmed'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
  metadata: Record<string, unknown> | null
}

export interface NotificationListResponse {
  items: Notification[]
  total: number
  page: number
  page_size: number
}

export interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string
  details: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditLogPage {
  items: AuditLogEntry[]
  total: number
  page: number
  page_size: number
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

export type CalendarEventType = 'deadline' | 'live_session' | 'exam' | 'other'
export type CalendarEventSource = 'module_deadline' | 'assignment_deadline' | 'course_event'

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  event_type: CalendarEventType
  event_date: string
  course_id: string
  course_title: string | null
  source: CalendarEventSource
}

export interface StudentChapterInfo {
  id: string
  title: string
  module_id: string
  chapter_type: string
  requires_completion: boolean
  completed: boolean
  completed_by: 'teacher' | 'self' | 'quiz' | null
  quiz_result: { score: number; max_score: number; passed: boolean } | null
  assignment_result: { status: string; grade: number | null; max_score: number } | null
}

export interface StudentQuizResult {
  chapter_title: string
  chapter_id: string
  quiz_id: string
  score: number
  max_score: number
  passed: boolean
  attempts_used: number
}

export interface StudentAssignmentResult {
  chapter_title: string
  chapter_id: string
  title: string
  status: string
  grade: number | null
  max_score: number
}

export interface StudentProgressEntry {
  id: string
  full_name: string
  email: string
  enrolled_at: string | null
  progress: number
  chapters_completed: number
  total_chapters: number
  quiz_results: StudentQuizResult[]
  assignment_results: StudentAssignmentResult[]
  last_activity: string | null
  chapters: StudentChapterInfo[]
}

export interface StudentProgressResponse {
  course_id: string
  course_title: string
  total_chapters: number
  total_students: number
  modules: { id: string; title: string; order_index: number }[]
  students: StudentProgressEntry[]
}

export interface CourseEvent {
  id: string
  course_id: string
  title: string
  description: string | null
  event_type: CalendarEventType
  event_date: string
  created_by: string
  created_at: string
}

