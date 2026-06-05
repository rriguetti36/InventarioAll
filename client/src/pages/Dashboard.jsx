import React, { useEffect, useState } from 'react'
import { Box, Heading, Text, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  return (
    <DashboardLayout>
      <Box>
        <Heading size="md" mb={4}>Dashboard</Heading>
        <Text mb={4}>Bienvenido{user ? `, ${user.name}` : ''}.</Text>
        {user?.role === 'admin' && (
          <Button colorScheme="blue" onClick={() => navigate('/create-user')}>
            Ir a Crear Usuario
          </Button>
        )}
      </Box>
    </DashboardLayout>
  )
}
