import api from "./api"
import type { AuthResponse, User } from "../types"

export const authService = {
  async register(
    email: string,
    password: string,
    fullName: string,
    role: "teacher" | "student" = "student",
  ): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register", {
      email,
      password,
      full_name: fullName,
      role,
    })
    if (response.data.access_token) {
      localStorage.setItem("token", response.data.access_token)
    }
    return response.data
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    })
    if (response.data.access_token) {
      localStorage.setItem("token", response.data.access_token)
    }
    return response.data
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>("/auth/me")
    return response.data
  },

  logout(): void {
    localStorage.removeItem("token")
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("token")
  },
}
