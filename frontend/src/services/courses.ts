import api from "./api"
import { supabase } from "@/lib/supabase"
import type {
  Course, Module, Chapter, Enrollment, ChapterProgress, Announcement, StudentNote, StudentGrade,
  Quiz, QuizAttempt, Assignment, AssignmentSubmission, Certificate, CourseReview,
} from "../types"

export const coursesService = {
  async getCourses(search?: string): Promise<Course[]> {
    const params = search ? { search } : undefined
    const response = await api.get<Course[]>("/courses", { params })
    return response.data
  },

  async getCourse(id: string): Promise<Course> {
    const response = await api.get<Course>(`/courses/${id}`)
    return response.data
  },

  async getModule(courseId: string, moduleId: string): Promise<Module> {
    const response = await api.get<Module>(`/courses/${courseId}/modules/${moduleId}`)
    return response.data
  },

  // Enrollment
  async enrollInCourse(courseId: string): Promise<Enrollment> {
    const response = await api.post<Enrollment>(`/courses/${courseId}/enroll`)
    return response.data
  },

  async getMyCourses(): Promise<Enrollment[]> {
    const response = await api.get<Enrollment[]>("/users/me/courses")
    return response.data
  },

  async updateProgress(courseId: string, progress: number): Promise<Enrollment> {
    const response = await api.put<Enrollment>(
      `/courses/${courseId}/progress`,
      null,
      { params: { progress } },
    )
    return response.data
  },

  // Chapter progress (via Supabase direct)
  async getChapterProgress(chapterIds: string[]): Promise<ChapterProgress[]> {
    if (chapterIds.length === 0) return []
    const { data, error } = await supabase
      .from("chapter_progress")
      .select("*")
      .in("chapter_id", chapterIds)
    if (error) throw error
    return data ?? []
  },

  async markChapterComplete(chapterId: string): Promise<ChapterProgress> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("chapter_progress")
      .upsert(
        { user_id: session.user.id, chapter_id: chapterId },
        { onConflict: "user_id,chapter_id" },
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async unmarkChapterComplete(chapterId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("chapter_progress")
      .delete()
      .eq("chapter_id", chapterId)
      .eq("user_id", session.user.id)

    if (error) throw error
  },

  // Admin: all users
  async getAllUsers() {
    const response = await api.get("/users/admin/users")
    return response.data
  },

  async updateUserRole(userId: string, role: string) {
    await api.put(`/users/admin/users/${userId}/role`, null, { params: { role } })
  },

  // Teacher CRUD — Courses
  async getTeacherCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>("/courses/my")
    return response.data
  },

  async createCourse(data: { title: string; description?: string; image_url?: string }): Promise<Course> {
    const response = await api.post<Course>("/courses", data)
    return response.data
  },

  async updateCourse(
    id: string,
    data: { title?: string; description?: string; image_url?: string; status?: string },
  ): Promise<Course> {
    const response = await api.put<Course>(`/courses/${id}`, data)
    return response.data
  },

  async deleteCourse(id: string): Promise<void> {
    await api.delete(`/courses/${id}`)
  },

  // Teacher CRUD — Modules
  async createModule(
    courseId: string,
    data: { title: string; description?: string; order_index?: number },
  ): Promise<Module> {
    const response = await api.post<Module>(`/courses/${courseId}/modules`, data)
    return response.data
  },

  async updateModule(
    courseId: string,
    moduleId: string,
    data: { title?: string; description?: string; order_index?: number },
  ): Promise<Module> {
    const response = await api.put<Module>(`/courses/${courseId}/modules/${moduleId}`, data)
    return response.data
  },

  async deleteModule(courseId: string, moduleId: string): Promise<void> {
    await api.delete(`/courses/${courseId}/modules/${moduleId}`)
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
    return response.data
  },

  async updateChapter(
    courseId: string,
    moduleId: string,
    chapterId: string,
    data: { title?: string; content?: string; video_url?: string; order_index?: number },
  ): Promise<Chapter> {
    const response = await api.put<Chapter>(
      `/courses/${courseId}/modules/${moduleId}/chapters/${chapterId}`,
      data,
    )
    return response.data
  },

  async deleteChapter(
    courseId: string,
    moduleId: string,
    chapterId: string,
  ): Promise<void> {
    await api.delete(`/courses/${courseId}/modules/${moduleId}/chapters/${chapterId}`)
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

  // Student notes
  async getNote(chapterId: string): Promise<StudentNote | null> {
    try {
      const response = await api.get<StudentNote>(`/notes/chapter/${chapterId}`)
      return response.data
    } catch {
      return null
    }
  },

  async saveNote(chapterId: string, content: string): Promise<StudentNote> {
    const response = await api.put<StudentNote>(`/notes/chapter/${chapterId}`, { content })
    return response.data
  },

  async deleteNote(chapterId: string): Promise<void> {
    await api.delete(`/notes/chapter/${chapterId}`)
  },

  // Grades (via API instead of Supabase direct)
  async getCourseGrades(courseId: string) {
    const response = await api.get(`/grades/course/${courseId}`)
    return response.data
  },

  async upsertGrade(courseId: string, studentId: string, data: { grade?: string; comment?: string }) {
    const response = await api.put(`/grades/course/${courseId}/student/${studentId}`, data)
    return response.data
  },

  async getMyGrades(): Promise<StudentGrade[]> {
    const response = await api.get<StudentGrade[]>("/grades/my")
    return response.data
  },

  // Analytics (via API instead of Supabase direct)
  async getCourseAnalyticsAPI(courseId: string) {
    const response = await api.get(`/analytics/course/${courseId}`)
    return response.data
  },

  // Quizzes
  async getChapterQuiz(chapterId: string): Promise<Quiz | null> {
    try {
      const response = await api.get<Quiz[]>(`/quizzes/chapter/${chapterId}`)
      return response.data.length > 0 ? response.data[0] : null
    } catch { return null }
  },
  async createQuiz(data: any): Promise<Quiz> {
    const response = await api.post<Quiz>("/quizzes", data)
    return response.data
  },
  async deleteQuiz(quizId: string): Promise<void> {
    await api.delete(`/quizzes/${quizId}`)
  },
  async submitQuiz(quizId: string, answers: { question_id: string; selected_option_id?: string; text_answer?: string }[]): Promise<QuizAttempt> {
    const response = await api.post<QuizAttempt>(`/quizzes/${quizId}/submit`, { answers })
    return response.data
  },
  async getMyQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
    const response = await api.get<QuizAttempt[]>(`/quizzes/${quizId}/my-attempts`)
    return response.data
  },

  // Assignments
  async getChapterAssignments(chapterId: string): Promise<Assignment[]> {
    const response = await api.get<Assignment[]>(`/assignments/chapter/${chapterId}`)
    return response.data
  },
  async createAssignment(data: any): Promise<Assignment> {
    const response = await api.post<Assignment>("/assignments", data)
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
  async gradeSubmission(submissionId: string, data: { grade: number; feedback?: string; status: string }): Promise<AssignmentSubmission> {
    const response = await api.put<AssignmentSubmission>(`/assignments/submissions/${submissionId}/grade`, data)
    return response.data
  },

  // Certificates
  async getCourseCertificate(courseId: string): Promise<Certificate | null> {
    try {
      const response = await api.get<Certificate>(`/certificates/course/${courseId}`)
      return response.data
    } catch {
      return null
    }
  },
  async issueCertificate(courseId: string): Promise<Certificate> {
    const response = await api.post<Certificate>(`/certificates/course/${courseId}`)
    return response.data
  },
  async getMyCertificates(): Promise<Certificate[]> {
    const response = await api.get<Certificate[]>("/certificates/my")
    return response.data
  },

  // Reviews
  async getCourseReviews(courseId: string): Promise<CourseReview[]> {
    const response = await api.get<CourseReview[]>(`/reviews/course/${courseId}`)
    return response.data
  },
  async submitReview(courseId: string, data: { rating: number; comment?: string }): Promise<CourseReview> {
    const response = await api.post<CourseReview>(`/reviews/course/${courseId}`, data)
    return response.data
  },
  async updateReview(reviewId: string, data: { rating: number; comment?: string }): Promise<CourseReview> {
    const response = await api.put<CourseReview>(`/reviews/${reviewId}`, data)
    return response.data
  },
  async deleteReview(id: string): Promise<void> {
    await api.delete(`/reviews/${id}`)
  },

  // Student progress (teacher)
  async getStudentProgress(courseId: string) {
    const response = await api.get(`/progress/course/${courseId}/students`)
    return response.data
  },
}
