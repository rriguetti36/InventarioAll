import React from 'react'
import { Navigate } from 'react-router-dom'
import { Center, Text } from '@chakra-ui/react'
import { canAccess } from '../utils/access'

export default function RoleRoute({ section, children }) {
  const token = localStorage.getItem('token')
  const rawUser = localStorage.getItem('user')

  if (!token) return <Navigate to="/" replace />

  try {
    const user = JSON.parse(rawUser)
    if (!canAccess(user, section)) {
      return (
        <Center minH="100vh">
          <Text color="red.500" fontSize="lg">
            Acceso denegado para este perfil
          </Text>
        </Center>
      )
    }
  } catch {
    return <Navigate to="/" replace />
  }

  return children
}
