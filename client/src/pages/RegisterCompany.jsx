import React, { useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
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
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react'

const features = [
  {
    title: 'Inventario independiente',
    text: 'Productos, existencias, almacenes y kardex viven en una base propia para tu compania.',
  },
  {
    title: 'Ventas y cotizaciones',
    text: 'Gestiona cotizaciones, preventas, ventas cerradas, comprobantes y PDFs desde un solo flujo.',
  },
  {
    title: 'Usuarios corporativos',
    text: 'Crea administradores, vendedores y usuarios por tienda con accesos separados.',
  },
  {
    title: 'Control de licencias',
    text: 'La plataforma permite habilitar, bloquear o renovar el acceso segun pagos y vigencia.',
  },
]

const planLabels = {
  pos: 'POS',
  inventory: 'Inventarios',
  inventario: 'Inventarios',
  inventarios: 'Inventarios',
  invenpos: 'POS + Inventarios',
}

export default function RegisterCompany(){
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const selectedPlan = (params.get('plan') || params.get('product') || 'invenpos').toLowerCase()
  const [form, setForm] = useState({
    companyName: '',
    slug: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try{
      const payload = {
        ...form,
        slug: form.slug.trim() || form.companyName,
        plan: selectedPlan,
      }
      const res = await api.post('/auth/register-company', payload)
      navigate('/', { state: { companySlug: res.data.slug } })
    }catch(err){
      setError(err.response?.data?.error || err.message)
    }finally{
      setLoading(false)
    }
  }

  return (
    <Flex minH="100vh" bg="#f4f7fb" align="center" justify="center" px={{ base: 4, md: 8 }} py={8}>
      <Flex
        w="100%"
        maxW="1120px"
        minH={{ base: 'auto', md: '680px' }}
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="lg"
        boxShadow="0 24px 70px rgba(15, 23, 42, 0.12)"
        overflow="hidden"
        direction={{ base: 'column', md: 'row' }}
      >
        <Box
          flex="1.1"
          bg="#102033"
          color="white"
          p={{ base: 8, md: 12 }}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
        >
          <Box>
            <HStack spacing={3} mb={10}>
              <Box w="38px" h="38px" borderRadius="md" bg="#2bbf7f" display="grid" placeItems="center" fontWeight="bold">
                IN
              </Box>
              <Box>
                <Text fontWeight="bold" lineHeight="1">Inventario Cloud</Text>
                <Text fontSize="sm" color="whiteAlpha.700">Nueva compania</Text>
              </Box>
            </HStack>

            <Badge bg="whiteAlpha.200" color="white" mb={4} px={3} py={1} borderRadius="full">
              Entorno dedicado
            </Badge>
            <Heading size="xl" lineHeight="1.15" maxW="480px">
              Crea el espacio operativo para tu empresa.
            </Heading>
            <Text mt={5} color="whiteAlpha.800" maxW="520px">
              Al registrar tu compania se prepara una base de datos propia, un usuario administrador y las funciones necesarias para iniciar ventas, inventario y control comercial.
            </Text>
          </Box>

          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mt={10}>
            {features.map((feature) => (
              <Box key={feature.title} borderWidth="1px" borderColor="whiteAlpha.200" borderRadius="md" p={4} bg="whiteAlpha.100">
                <Text fontWeight="bold">{feature.title}</Text>
                <Text mt={2} fontSize="sm" color="whiteAlpha.800">{feature.text}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>

        <Box flex="0.9" p={{ base: 8, md: 12 }} display="flex" alignItems="center">
          <Box w="100%" maxW="430px" mx="auto">
            <Box mb={8}>
              <Heading size="lg" color="gray.800">Registrar empresa</Heading>
              <Text mt={2} color="gray.600">Configura el acceso inicial de tu compania.</Text>
              <Badge mt={3} colorScheme="purple">{planLabels[selectedPlan] || 'POS + Inventarios'}</Badge>
            </Box>

            <form onSubmit={handleSubmit}>
              <VStack spacing={5} align="stretch">
                <FormControl>
                  <FormLabel color="gray.700">Empresa</FormLabel>
                  <Input
                    value={form.companyName}
                    onChange={e=>updateField('companyName', e.target.value)}
                    placeholder="Nombre comercial"
                    bg="gray.50"
                    borderColor="gray.200"
                    h="46px"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color="gray.700">Codigo de acceso</FormLabel>
                  <Input
                    value={form.slug}
                    onChange={e=>updateField('slug', e.target.value)}
                    placeholder="ejemplo: mi-empresa"
                    bg="gray.50"
                    borderColor="gray.200"
                    h="46px"
                  />
                  <Text mt={2} fontSize="xs" color="gray.500">Este codigo se usara en el login de tus usuarios.</Text>
                </FormControl>
                <FormControl>
                  <FormLabel color="gray.700">Administrador</FormLabel>
                  <Input
                    value={form.adminName}
                    onChange={e=>updateField('adminName', e.target.value)}
                    placeholder="Nombre del responsable"
                    bg="gray.50"
                    borderColor="gray.200"
                    h="46px"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color="gray.700">Email admin</FormLabel>
                  <Input
                    value={form.adminEmail}
                    onChange={e=>updateField('adminEmail', e.target.value)}
                    placeholder="admin@empresa.com"
                    bg="gray.50"
                    borderColor="gray.200"
                    h="46px"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color="gray.700">Password admin</FormLabel>
                  <Input
                    type="password"
                    value={form.adminPassword}
                    onChange={e=>updateField('adminPassword', e.target.value)}
                    placeholder="Crea una clave segura"
                    bg="gray.50"
                    borderColor="gray.200"
                    h="46px"
                  />
                </FormControl>
                {error && <Alert status="error" borderRadius="md">{error}</Alert>}
                <Button type="submit" colorScheme="blue" h="46px" fontWeight="semibold" isLoading={loading}>Crear empresa</Button>
                <HStack justify="center" fontSize="sm">
                  <Text color="gray.500">Ya tienes una cuenta?</Text>
                  <Link as={RouterLink} to="/" color="blue.600" fontWeight="semibold">Volver al login</Link>
                </HStack>
              </VStack>
            </form>
          </Box>
        </Box>
      </Flex>
    </Flex>
  )
}
