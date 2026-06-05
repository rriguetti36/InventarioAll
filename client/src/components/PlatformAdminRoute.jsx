import React from 'react'
import { Navigate } from 'react-router-dom'
import { Center, Text } from '@chakra-ui/react'

export default function PlatformAdminRoute({ children }) {
  const token = localStorage.getItem('token')
  const user = localStorage.getItem('user')

  if (!token) {
    return <Navigate to="/" replace />
  }

  try {
    const userData = JSON.parse(user)
    if (userData?.role !== 'admin' || userData?.companySlug) {
      return (
        <Center minH="100vh">
          <Text color="red.500" fontSize="lg">
            Acceso denegado: necesitas una sesion de administrador de plataforma
          </Text>
        </Center>
      )
    }
  } catch {
    return <Navigate to="/" replace />
  }

  return children
}
