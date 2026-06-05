import React, { useEffect, useState } from 'react'
import {
  Box,
  Flex,
  IconButton,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { HamburgerIcon } from '@chakra-ui/icons'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }) {
  const [user, setUser] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      navigate('/')
    }
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  if (!user) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <Box textAlign="center">
          <Spinner mb={4} />
          <Text>Cargando layout...</Text>
        </Box>
      </Flex>
    )
  }

  return (
    <Flex minH="100vh" bg="gray.50">
      <Box display={{ base: 'none', md: 'block' }}>
        <Sidebar user={user} onLogout={handleLogout} />
      </Box>

      {mobileMenuOpen && (
        <Box display={{ base: 'block', md: 'none' }} position="fixed" inset={0} zIndex={1400}>
          <Box position="absolute" inset={0} bg="blackAlpha.600" onClick={() => setMobileMenuOpen(false)} />
          <Box position="absolute" top={0} left={0} bottom={0} w="290px" maxW="85vw" bg="gray.800">
            <Sidebar
              user={user}
              onLogout={handleLogout}
              isDrawer
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </Box>
        </Box>
      )}

      <Box flex={1} minW={0}>
        <Flex display={{ base: 'flex', md: 'none' }} align="center" bg="white" borderBottomWidth="1px" px={4} py={3} gap={3}>
          <IconButton
            aria-label="Abrir menu"
            icon={<HamburgerIcon />}
            size="sm"
            variant="outline"
            onClick={() => setMobileMenuOpen(true)}
          />
          <Text fontWeight="semibold">Menu</Text>
        </Flex>
        <Box p={{ base: 3, md: 6 }}>
        {children || <Outlet />}
        </Box>
      </Box>
    </Flex>
  )
}
