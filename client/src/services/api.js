import axios from 'axios'

const apiBaseURL = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: apiBaseURL,
})

function apiOrigin() {
  try {
    return new URL(apiBaseURL, window.location.origin).origin
  } catch {
    return window.location.origin
  }
}

export function resolveAssetUrl(value) {
  if (!value) return ''

  try {
    const url = new URL(value, window.location.origin)
    const isUpload = url.pathname.startsWith('/api/uploads/') || url.pathname.startsWith('/uploads/')
    if (!isUpload) return value

    const pathname = url.pathname.startsWith('/uploads/') ? `/api${url.pathname}` : url.pathname
    return `${apiOrigin()}${pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
}

// Interceptor to add token
api.interceptors.request.use((config)=>{
  const token = localStorage.getItem('token')
  if(token){
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      error.message = 'Tu sesion expiro. Vuelve a iniciar sesion.'
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      }
    }
    return Promise.reject(error)
  },
)

export default api
