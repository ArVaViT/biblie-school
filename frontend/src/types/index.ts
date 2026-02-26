export type UserRole = 'admin' | 'teacher' | 'student'

export interface User {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  title: string
  description: string | null
  image_url: string | null
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
  order_index: number
}

export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  enrolled_at: string
  progress: number
  course?: Course
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

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string | null
}

