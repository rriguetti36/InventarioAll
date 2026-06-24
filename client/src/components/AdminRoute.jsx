import React from 'react'
import { Navigate } from 'react-router-dom'
import { Center, Spinner, Text } from '@chakra-ui/react'
import { isAdminLike } from '../utils/access'

export default function AdminRoute({ children }) {
  const token = localStorage.getItem('token')
  const user = localStorage.getItem('user')

  if (!token) {
    return <Navigate to="/" replace />
  }

  try {
    const userData = JSON.parse(user)
    if (!isAdminLike(userData)) {
      return (
        <Center minH="100vh">
          <Text color="red.500" fontSize="lg">
            Acceso denegado: necesitas ser administrador
          </Text>
        </Center>
      )
    }
  } catch {
    return <Navigate to="/" replace />
  }

  return children
}
