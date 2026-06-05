import React, { useState } from 'react'
import api from '../services/api'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react'

export default function Login(){
  const location = useLocation()
  const [companySlug, setCompanySlug] = useState(location.state?.companySlug || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try{
      const res = await api.post('/auth/login', { email, password, companySlug: companySlug.trim() || null })
      const data = res.data
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role || 'user',
        assignedLocationId: data.assignedLocationId || null,
        companyId: data.companyId || null,
        companyName: data.companyName || null,
        companySlug: data.companySlug || null,
      }))
      navigate('/dashboard')
    }catch(err){
      setError(err.response?.data?.error || err.message)
    }
  }

  return (
    <Flex minH="100vh" bg="#f4f7fb" align="center" justify="center" px={{ base: 4, md: 8 }} py={8}>
      <Flex
        w="100%"
        maxW="1040px"
        minH={{ base: 'auto', md: '620px' }}
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="lg"
        boxShadow="0 24px 70px rgba(15, 23, 42, 0.12)"
        overflow="hidden"
        direction={{ base: 'column', md: 'row' }}
      >
        <Box
          flex="1"
          bg="#102033"
          color="white"
          p={{ base: 8, md: 12 }}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          minH={{ base: '280px', md: 'auto' }}
        >
          <Box>
            <HStack spacing={3} mb={10}>
              <Box w="38px" h="38px" borderRadius="md" bg="#2bbf7f" display="grid" placeItems="center" fontWeight="bold">
                IN
              </Box>
              <Box>
                <Text fontWeight="bold" lineHeight="1">Inventario Cloud</Text>
                <Text fontSize="sm" color="whiteAlpha.700">Gestion corporativa</Text>
              </Box>
            </HStack>

            <Badge bg="whiteAlpha.200" color="white" mb={4} px={3} py={1} borderRadius="full">
              Multiempresa
            </Badge>
            <Heading size="xl" lineHeight="1.15" maxW="420px">
              Plataforma operativa para ventas, stock y cotizaciones.
            </Heading>
            <Text mt={5} color="whiteAlpha.800" maxW="420px">
              Accede a tu entorno corporativo con datos independientes por compania y control administrativo centralizado.
            </Text>
          </Box>

          <HStack spacing={6} color="whiteAlpha.800" fontSize="sm" mt={10}>
            <Text>Inventario</Text>
            <Text>Ventas</Text>
            <Text>Licencias</Text>
          </HStack>
        </Box>

        <Box flex="1" p={{ base: 8, md: 12 }} display="flex" alignItems="center">
          <Box w="100%" maxW="420px" mx="auto">
            <Box mb={8}>
              <Heading size="lg" color="gray.800">Iniciar sesion</Heading>
              <Text mt={2} color="gray.600">Ingresa con tu usuario corporativo.</Text>
            </Box>

            <form onSubmit={handleSubmit}>
              <VStack spacing={5} align="stretch">
                <FormControl>
                  <FormLabel color="gray.700">Empresa</FormLabel>
                  <Input
                    value={companySlug}
                    onChange={e=>setCompanySlug(e.target.value)}
                    placeholder="codigo de empresa opcional"
                    bg="gray.50"
                    borderColor="gray.200"
                    h="46px"
                  />
                  <Text mt={2} fontSize="xs" color="gray.500">Puedes dejarlo vacio; lo usaremos solo si tu email pertenece a varias empresas.</Text>
                </FormControl>
                <FormControl>
                  <FormLabel color="gray.700">Email</FormLabel>
                  <Input
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    bg="gray.50"
                    borderColor="gray.200"
                    h="46px"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color="gray.700">Password</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={e=>setPassword(e.target.value)}
                    placeholder="Ingresa tu password"
                    bg="gray.50"
                    borderColor="gray.200"
                    h="46px"
                  />
                </FormControl>
                {error && <Alert status="error" borderRadius="md">{error}</Alert>}
                <Button type="submit" colorScheme="blue" h="46px" fontWeight="semibold">Entrar</Button>
                <HStack justify="center" fontSize="sm">
                  <Text color="gray.500">Nueva compania?</Text>
                  <Link as={RouterLink} to="/register-company" color="blue.600" fontWeight="semibold">
                    Registrar empresa
                  </Link>
                </HStack>
              </VStack>
            </form>
          </Box>
        </Box>
      </Flex>
    </Flex>
  )
}
