import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Убираем trailing slash если есть
const cleanApiUrl = API_URL.replace(/\/+$/, '')

const api = axios.create({
  baseURL: `${cleanApiUrl}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor для добавления JWT токена
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

