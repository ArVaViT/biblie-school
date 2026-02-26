import api from "./api"
import type { User } from "../types"

export const usersService = {
  async updateProfile(data: { full_name?: string }): Promise<User> {
    const response = await api.put<User>("/users/me", data)
    return response.data
  },
}
