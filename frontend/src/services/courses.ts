import api from "./api"
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "@/lib/cache"
import { isAxiosError } from "axios"
import type {
  User, Course, Module, Chapter, Enrollment, Announcement, StudentGrade,
  Quiz, QuizAttempt, Assignment, AssignmentSubmission, Certificate, CourseReview, ChapterBlock, BlockType, Cohort,
  Notification, NotificationListResponse,
  AuditLogPage,
  GradingConfig, GradeSummaryResponse,
  CalendarEvent, CourseEvent,
  StudentProgressResponse,
} from "../types"

type CohortMutation = {
  name: string
  start_date: string
  end_date: string
  enrollment_start?: string | null
  enrollment_end?: string | null
  max_students?: number | null
  status?: Cohort["status"]
}

type AssignmentCreateData = {
  chapter_id: string
  title: string
  description?: string | null
  max_score?: number
  due_date?: string | null
}

type ChapterBlockCreateData = {
  block_type: BlockType
  order_index?: number
  content?: string | null
  video_url?: string | null
  quiz_id?: string | null
  assignment_id?: string | null
  file_url?: string | null
}

type ChapterBlockUpdateData = Partial<Omit<ChapterBlockCreateData, "block_type">> & {
  block_type?: BlockType
}

export const coursesService = {
  async getCourses(search?: string): Promise<Course[]> {
    const key = `courses:list:${search ?? ""}`
    const cached = cacheGet<Course[]>(key)
    if (cached) return cached
    const params = search ? { search } : undefined
    const response = await api.get<Course[]>("/courses", { params })
    cacheSet(key, response.data, 2 * 60 * 1000)
    return response.data
  },

  async getCourse(id: string): Promise<Course> {
    const key = `courses:detail:${id}`
    const cached = cacheGet<Course>(key)
    if (cached) return cached
    const response = await api.get<Course>(`/courses/${id}`)
    cacheSet(key, response.data, 3 * 60 * 1000)
    return response.data
  },

  async getModule(courseId: string, moduleId: string): Promise<Module> {
    const response = await api.get<Module>(`/courses/${courseId}/modules/${moduleId}`)
    return response.data
  },

  // Cohorts
  async getCourseCohorts(courseId: string): Promise<Cohort[]> {
    const response = await api.get<Cohort[]>(`/cohorts/course/${courseId}`)
    return response.data
  },
  async createCohort(courseId: string, data: CohortMutation): Promise<Cohort> {
    const response = await api.post<Cohort>(`/cohorts/course/${courseId}`, data)
    return response.data
  },
  async updateCohort(cohortId: string, data: Partial<CohortMutation>): Promise<Cohort> {
    const response = await api.put<Cohort>(`/cohorts/${cohortId}`, data)
    return response.data
  },
  async deleteCohort(cohortId: string): Promise<void> {
    await api.delete(`/cohorts/${cohortId}`)
  },
  
  async completeCohort(cohortId: string): Promise<void> {
    await api.post(`/cohorts/${cohortId}/complete`)
  },

  // Enrollment
  async enrollInCourse(courseId: string, cohortId?: string): Promise<Enrollment> {
    const response = await api.post<Enrollment>(
      `/courses/${courseId}/enroll`,
      cohortId ? { cohort_id: cohortId } : {},
    )
    // Invalidate the per-user course list so HomePage/Profile/Calendar refresh
    // their dashboards after an enroll. Same for the one-off status probe.
    cacheInvalidate("courses:my")
    cacheInvalidate(`courses:enrollment-status:${courseId}`)
    return response.data
  },

  async getMyCourses(): Promise<Enrollment[]> {
    // Cached per-session. HomePage, ProfilePage, CalendarPage, and
    // CertificatesPage all call this on mount, so without a small TTL we'd
    // hit `/users/me/courses` four times during a normal navigation.
    const key = "courses:my"
    const cached = cacheGet<Enrollment[]>(key)
    if (cached) return cached
    const response = await api.get<Enrollment[]>("/users/me/courses")
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },

  async getEnrollmentStatus(courseId: string): Promise<{ enrolled: boolean; enrollment: Enrollment | null }> {
    const key = `courses:enrollment-status:${courseId}`
    const cached = cacheGet<{ enrolled: boolean; enrollment: Enrollment | null }>(key)
    if (cached) return cached
    const response = await api.get<{ enrolled: boolean; enrollment: Enrollment | null }>(
      `/courses/${courseId}/enrollment-status`,
    )
    cacheSet(key, response.data, 60 * 1000)
    return response.data
  },

  async getAllUsers(): Promise<User[]> {
    const response = await api.get<User[]>("/users/admin/users")
    return response.data
  },

  async updateUserRole(userId: string, role: string): Promise<void> {
    await api.put(`/users/admin/users/${userId}/role`, null, { params: { role } })
  },

  async bulkUpdateUserRoles(userIds: string[], role: string): Promise<{ updated: number; role: string }> {
    const response = await api.put<{ updated: number; role: string }>("/users/admin/users/bulk-role", { user_ids: userIds, role })
    return response.data
  },

  // Teacher CRUD — Courses
  async getTeacherCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>("/courses/my")
    return response.data
  },

  async createCourse(data: { title: string; description?: string; image_url?: string }): Promise<Course> {
    const response = await api.post<Course>("/courses", data)
    cacheInvalidatePrefix("courses:list:")
    return response.data
  },

  async updateCourse(
    id: string,
    data: { title?: string; description?: string; image_url?: string; status?: string; enrollment_start?: string | null; enrollment_end?: string | null },
  ): Promise<Course> {
    const response = await api.put<Course>(`/courses/${id}`, data)
    cacheInvalidate(`courses:detail:${id}`)
    cacheInvalidatePrefix("courses:list:")
    return response.data
  },

  async deleteCourse(id: string): Promise<void> {
    await api.delete(`/courses/${id}`)
    cacheInvalidate(`courses:detail:${id}`)
    cacheInvalidatePrefix("courses:list:")
  },

  async getTrashedCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>("/courses/my/trash")
    return response.data
  },

  async restoreCourse(id: string): Promise<Course> {
    const response = await api.post<Course>(`/courses/${id}/restore`)
    cacheInvalidatePrefix("courses:list:")
    return response.data
  },

  async permanentlyDeleteCourse(id: string): Promise<void> {
    await api.delete(`/courses/${id}/permanent`)
    cacheInvalidate(`courses:detail:${id}`)
    cacheInvalidatePrefix("courses:list:")
  },

  async cloneCourse(id: string): Promise<Course> {
    const response = await api.post<Course>(`/courses/${id}/clone`)
    cacheInvalidatePrefix("courses:list:")
    return response.data
  },

  // Teacher CRUD — Modules
  async createModule(
    courseId: string,
    data: { title: string; description?: string; order_index?: number },
  ): Promise<Module> {
    const response = await api.post<Module>(`/courses/${courseId}/modules`, data)
    cacheInvalidate(`courses:detail:${courseId}`)
    return response.data
  },

  async updateModule(
    courseId: string,
    moduleId: string,
    data: { title?: string; description?: string; order_index?: number; due_date?: string | null },
  ): Promise<Module> {
    const response = await api.put<Module>(`/courses/${courseId}/modules/${moduleId}`, data)
    cacheInvalidate(`courses:detail:${courseId}`)
    return response.data
  },

  async deleteModule(courseId: string, moduleId: string): Promise<void> {
    await api.delete(`/courses/${courseId}/modules/${moduleId}`)
    cacheInvalidate(`courses:detail:${courseId}`)
  },

  // Teacher CRUD — Chapters
  async createChapter(
    courseId: string,
    moduleId: string,
    data: { title: string; content?: string; video_url?: string; order_index?: number },
  ): Promise<Chapter> {
    const response = await api.post<Chapter>(
      `/courses/${courseId}/modules/${moduleId}/chapters`,
      data,
    )
    cacheInvalidate(`courses:detail:${courseId}`)
    return response.data
  },

  async updateChapter(
    courseId: string,
    moduleId: string,
    chapterId: string,
    data: { title?: string; content?: string; video_url?: string; order_index?: number; chapter_type?: string; requires_completion?: boolean; is_locked?: boolean },
  ): Promise<Chapter> {
    const response = await api.put<Chapter>(
      `/courses/${courseId}/modules/${moduleId}/chapters/${chapterId}`,
      data,
    )
    cacheInvalidate(`courses:detail:${courseId}`)
    return response.data
  },

  async deleteChapter(
    courseId: string,
    moduleId: string,
    chapterId: string,
  ): Promise<void> {
    await api.delete(`/courses/${courseId}/modules/${moduleId}/chapters/${chapterId}`)
    cacheInvalidate(`courses:detail:${courseId}`)
  },

  // Announcements
  async getAnnouncements(courseId?: string): Promise<Announcement[]> {
    const params = courseId ? { course_id: courseId } : undefined
    const response = await api.get<Announcement[]>("/announcements", { params })
    return response.data
  },

  async createAnnouncement(data: { title: string; content: string; course_id?: string }): Promise<Announcement> {
    const response = await api.post<Announcement>("/announcements", data)
    return response.data
  },

  async deleteAnnouncement(id: string): Promise<void> {
    await api.delete(`/announcements/${id}`)
  },

  async getCourseGrades(courseId: string): Promise<StudentGrade[]> {
    const response = await api.get<StudentGrade[]>(`/grades/course/${courseId}`)
    return response.data
  },

  async upsertGrade(courseId: string, studentId: string, data: { grade?: string; comment?: string }): Promise<StudentGrade> {
    const response = await api.put<StudentGrade>(`/grades/course/${courseId}/student/${studentId}`, data)
    return response.data
  },

  async getMyGrades(): Promise<StudentGrade[]> {
    const response = await api.get<StudentGrade[]>("/grades/my")
    return response.data
  },

  async updateGradingConfig(courseId: string, data: GradingConfig): Promise<GradingConfig> {
    const response = await api.put<GradingConfig>(`/grades/course/${courseId}/config`, data)
    return response.data
  },

  async getGradeSummary(courseId: string): Promise<GradeSummaryResponse> {
    const response = await api.get<GradeSummaryResponse>(`/grades/course/${courseId}/summary`)
    return response.data
  },

  async exportGradesCSV(courseId: string): Promise<Blob> {
    const response = await api.get(`/grades/course/${courseId}/export-csv`, { responseType: "blob" })
    return response.data
  },

  async getCourseAnalyticsAPI(courseId: string): Promise<{
    course_id: string
    course_title: string
    total_students: number
    avg_progress: number
    completion_count: number
    enrollments: Array<{
      enrollment_id: string
      user_id: string
      full_name: string | null
      email: string
      progress: number
      enrolled_at: string | null
    }>
  }> {
    const response = await api.get(`/analytics/course/${courseId}`)
    return response.data
  },

  // Quizzes
  async getChapterQuiz(chapterId: string): Promise<Quiz | null> {
    const key = `quiz:chapter:${chapterId}`
    const cached = cacheGet<Quiz | null>(key)
    if (cached !== undefined) return cached
    try {
      const response = await api.get<Quiz | null>(`/quizzes/chapter/${chapterId}`)
      cacheSet(key, response.data, 5 * 60 * 1000)
      return response.data
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) {
        cacheSet(key, null, 5 * 60 * 1000)
        return null
      }
      throw err
    }
  },
  async createQuiz(data: {
    chapter_id: string
    title: string
    description?: string | null
    quiz_type?: "quiz" | "exam"
    max_attempts?: number | null
    passing_score: number
    questions: Array<{
      question_text: string
      question_type: "multiple_choice" | "true_false" | "short_answer"
      order_index: number
      points: number
      options: Array<{
        option_text: string
        is_correct: boolean
        order_index: number
      }>
    }>
  }): Promise<Quiz> {
    const response = await api.post<Quiz>("/quizzes", data)
    cacheInvalidate(`quiz:chapter:${data.chapter_id}`)
    return response.data
  },
  async deleteQuiz(quizId: string): Promise<void> {
    await api.delete(`/quizzes/${quizId}`)
    cacheInvalidatePrefix("quiz:chapter:")
  },
  async submitQuiz(quizId: string, answers: { question_id: string; selected_option_id?: string; text_answer?: string }[]): Promise<QuizAttempt> {
    const response = await api.post<QuizAttempt>(`/quizzes/${quizId}/submit`, { answers })
    return response.data
  },
  async getMyQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
    const response = await api.get<QuizAttempt[]>(`/quizzes/${quizId}/my-attempts`)
    return response.data
  },
  async grantExtraAttempts(quizId: string, userId: string, extraAttempts: number): Promise<void> {
    await api.post(`/quizzes/${quizId}/extra-attempts`, {
      user_id: userId,
      extra_attempts: extraAttempts,
    })
  },

  // Assignments
  async getChapterAssignments(chapterId: string): Promise<Assignment[]> {
    const response = await api.get<Assignment[]>(`/assignments/chapter/${chapterId}`)
    return response.data
  },
  async createAssignment(data: AssignmentCreateData): Promise<Assignment> {
    const response = await api.post<Assignment>("/assignments", data)
    return response.data
  },
  async updateAssignment(id: string, data: Partial<AssignmentCreateData>): Promise<Assignment> {
    const response = await api.put<Assignment>(`/assignments/${id}`, data)
    return response.data
  },
  async deleteAssignment(id: string): Promise<void> {
    await api.delete(`/assignments/${id}`)
  },
  async submitAssignment(id: string, data: { content?: string; file_url?: string }): Promise<AssignmentSubmission> {
    const response = await api.post<AssignmentSubmission>(`/assignments/${id}/submit`, data)
    return response.data
  },
  async getSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
    const response = await api.get<AssignmentSubmission[]>(`/assignments/${assignmentId}/submissions`)
    return response.data
  },
  async getMySubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
    const response = await api.get<AssignmentSubmission[]>(`/assignments/${assignmentId}/my-submissions`)
    return response.data
  },
  async gradeSubmission(submissionId: string, data: { grade: number; feedback?: string; status: string }): Promise<AssignmentSubmission> {
    const response = await api.put<AssignmentSubmission>(`/assignments/submissions/${submissionId}/grade`, data)
    return response.data
  },

  // Chapter blocks
  async getChapterBlocks(chapterId: string): Promise<ChapterBlock[]> {
    const key = `blocks:chapter:${chapterId}`
    const cached = cacheGet<ChapterBlock[]>(key)
    if (cached) return cached
    const response = await api.get<ChapterBlock[]>(`/blocks/chapter/${chapterId}`)
    cacheSet(key, response.data, 5 * 60 * 1000)
    return response.data
  },
  async createBlock(chapterId: string, data: ChapterBlockCreateData): Promise<ChapterBlock> {
    const response = await api.post<ChapterBlock>(`/blocks/chapter/${chapterId}`, data)
    cacheInvalidate(`blocks:chapter:${chapterId}`)
    return response.data
  },
  async updateBlock(blockId: string, data: ChapterBlockUpdateData): Promise<ChapterBlock> {
    const response = await api.put<ChapterBlock>(`/blocks/${blockId}`, data)
    cacheInvalidatePrefix("blocks:chapter:")
    return response.data
  },
  async deleteBlock(blockId: string): Promise<void> {
    await api.delete(`/blocks/${blockId}`)
    cacheInvalidatePrefix("blocks:chapter:")
  },
  async reorderBlocks(chapterId: string, blocks: { id: string; order_index: number }[]): Promise<void> {
    await api.put(`/blocks/chapter/${chapterId}/reorder`, blocks)
    cacheInvalidate(`blocks:chapter:${chapterId}`)
  },

  // Certificates
  async getCourseCertificate(courseId: string): Promise<Certificate | null> {
    try {
      const response = await api.get<Certificate>(`/certificates/course/${courseId}`)
      return response.data
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) return null
      throw err
    }
  },
  async requestCertificate(courseId: string): Promise<Certificate> {
    const response = await api.post<Certificate>(`/certificates/course/${courseId}`)
    return response.data
  },
  async getMyCertificates(): Promise<Certificate[]> {
    const response = await api.get<Certificate[]>("/certificates/my")
    return response.data
  },
  async getPendingCertificates(): Promise<Certificate[]> {
    const response = await api.get<Certificate[]>("/certificates/pending")
    return response.data
  },
  async teacherApproveCert(certId: string): Promise<void> {
    await api.put(`/certificates/${certId}/teacher-approve`)
  },
  async adminApproveCert(certId: string): Promise<void> {
    await api.put(`/certificates/${certId}/admin-approve`)
  },
  async rejectCert(certId: string): Promise<void> {
    await api.put(`/certificates/${certId}/reject`)
  },
  async getAdminPendingCerts(): Promise<Certificate[]> {
    const response = await api.get<Certificate[]>("/certificates/admin/pending")
    return response.data
  },

  async teacherMarkComplete(chapterId: string, studentId: string): Promise<void> {
    await api.put(`/progress/chapter/${chapterId}/student/${studentId}/complete`)
  },
  async teacherMarkIncomplete(chapterId: string, studentId: string): Promise<void> {
    await api.put(`/progress/chapter/${chapterId}/student/${studentId}/incomplete`)
  },

  // Reviews
  async getCourseReviews(courseId: string): Promise<CourseReview[]> {
    const key = `reviews:course:${courseId}`
    const cached = cacheGet<CourseReview[]>(key)
    if (cached) return cached
    const response = await api.get<CourseReview[]>(`/reviews/course/${courseId}`)
    cacheSet(key, response.data, 2 * 60 * 1000)
    return response.data
  },
  async submitReview(courseId: string, data: { rating: number; comment?: string }): Promise<CourseReview> {
    const response = await api.post<CourseReview>(`/reviews/course/${courseId}`, data)
    cacheInvalidate(`reviews:course:${courseId}`)
    return response.data
  },

  async deleteReview(id: string): Promise<void> {
    await api.delete(`/reviews/${id}`)
    cacheInvalidatePrefix("reviews:course:")
  },

  async getMyChapterProgress(courseId: string): Promise<string[]> {
    const response = await api.get<string[]>(`/progress/course/${courseId}/my-progress`)
    return response.data
  },

  async getStudentProgress(courseId: string): Promise<StudentProgressResponse> {
    const response = await api.get<StudentProgressResponse>(`/progress/course/${courseId}/students`)
    return response.data
  },

  // Notifications
  async getNotifications(page: number = 1): Promise<NotificationListResponse> {
    const response = await api.get<NotificationListResponse>("/notifications", { params: { page } })
    return response.data
  },
  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ count: number }>("/notifications/unread-count")
    return response.data.count
  },
  async markAsRead(id: string): Promise<Notification> {
    const response = await api.patch<Notification>(`/notifications/${id}/read`)
    return response.data
  },
  async markAllAsRead(): Promise<void> {
    await api.post("/notifications/read-all")
  },
  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`)
  },

  // Audit logs (admin)
  async getAuditLogs(params: {
    page?: number
    page_size?: number
    user_id?: string
    resource_type?: string
    action?: string
    date_from?: string
    date_to?: string
  } = {}): Promise<AuditLogPage> {
    const response = await api.get<AuditLogPage>("/audit", { params })
    return response.data
  },

  // Calendar
  async getCalendarEvents(courseId?: string): Promise<CalendarEvent[]> {
    const params = courseId ? { course_id: courseId } : undefined
    const response = await api.get<CalendarEvent[]>("/calendar/events", { params })
    return response.data
  },

  async getCourseEvents(courseId: string): Promise<CourseEvent[]> {
    const response = await api.get<CourseEvent[]>(`/courses/${courseId}/events`)
    return response.data
  },

  async createCourseEvent(courseId: string, data: {
    title: string
    description?: string
    event_type?: string
    event_date: string
  }): Promise<CourseEvent> {
    const response = await api.post<CourseEvent>(`/courses/${courseId}/events`, data)
    return response.data
  },

  async updateCourseEvent(courseId: string, eventId: string, data: {
    title?: string
    description?: string
    event_type?: string
    event_date?: string
  }): Promise<CourseEvent> {
    const response = await api.put<CourseEvent>(`/courses/${courseId}/events/${eventId}`, data)
    return response.data
  },

  async deleteCourseEvent(courseId: string, eventId: string): Promise<void> {
    await api.delete(`/courses/${courseId}/events/${eventId}`)
  },
}
