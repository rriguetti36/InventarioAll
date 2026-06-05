import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  useDisclosure,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from '@chakra-ui/react'
import { EditIcon } from '@chakra-ui/icons'
import api from '../services/api'

const licenseOptions = [
  { value: 'trial', label: 'Trial' },
  { value: 'activa', label: 'Activa' },
  { value: 'suspendida', label: 'Suspendida' },
  { value: 'vencida', label: 'Vencida' },
]

const paymentOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'al_dia', label: 'Al dia' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'exonerado', label: 'Exonerado' },
]

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

function toDateInput(value) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function licenseColor(status) {
  if (status === 'activa') return 'green'
  if (status === 'suspendida') return 'orange'
  if (status === 'vencida') return 'red'
  return 'blue'
}

function paymentColor(status) {
  if (status === 'al_dia' || status === 'exonerado') return 'green'
  if (status === 'vencido') return 'red'
  return 'yellow'
}

export default function CompanyAdmin() {
  const [companies, setCompanies] = useState([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const modal = useDisclosure()

  const loadCompanies = async () => {
    const res = await api.get('/companies')
    setCompanies(res.data)
  }

  useEffect(() => {
    loadCompanies().catch((err) => {
      toast({ status: 'error', title: err.response?.data?.error || err.message })
    })
  }, [])

  const filteredCompanies = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return companies
    return companies.filter((company) => (
      `${company.name} ${company.slug} ${company.databaseName} ${company.planName || ''}`
        .toLowerCase()
        .includes(term)
    ))
  }, [companies, query])

  const openEdit = (company) => {
    setEditing({
      ...company,
      licenseExpiresAt: toDateInput(company.licenseExpiresAt),
      estado: Boolean(company.estado),
    })
    modal.onOpen()
  }

  const updateField = (field, value) => {
    setEditing((current) => ({ ...current, [field]: value }))
  }

  const saveCompany = async () => {
    setSaving(true)
    try {
      const payload = {
        name: editing.name,
        planName: editing.planName,
        licenseStatus: editing.licenseStatus,
        licenseExpiresAt: editing.licenseExpiresAt || null,
        paymentStatus: editing.paymentStatus,
        notes: editing.notes,
        estado: editing.estado,
      }
      await api.put(`/companies/${editing.id}`, payload)
      await loadCompanies()
      modal.onClose()
      toast({ status: 'success', title: 'Compania actualizada' })
    } catch (err) {
      toast({ status: 'error', title: err.response?.data?.error || err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <HStack justify="space-between" align="start" mb={4} gap={4}>
        <Box>
          <Heading size="md">Companias</Heading>
          <Text color="gray.600" fontSize="sm">Control de accesos, pagos y licencias.</Text>
        </Box>
        <Input
          maxW="320px"
          placeholder="Buscar compania"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </HStack>

      <Box overflowX="auto" borderWidth="1px" borderRadius="md">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Compania</Th>
              <Th>Codigo</Th>
              <Th>Plan</Th>
              <Th>Licencia</Th>
              <Th>Pago</Th>
              <Th>Vence</Th>
              <Th>Acceso</Th>
              <Th textAlign="right">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredCompanies.map((company) => (
              <Tr key={company.id}>
                <Td fontWeight="semibold">{company.name}</Td>
                <Td>{company.slug}</Td>
                <Td>{company.planName || '-'}</Td>
                <Td><Badge colorScheme={licenseColor(company.licenseStatus)}>{company.licenseStatus}</Badge></Td>
                <Td><Badge colorScheme={paymentColor(company.paymentStatus)}>{company.paymentStatus}</Badge></Td>
                <Td>{formatDate(company.licenseExpiresAt)}</Td>
                <Td>
                  <Badge colorScheme={company.estado ? 'green' : 'red'}>
                    {company.estado ? 'Activo' : 'Bloqueado'}
                  </Badge>
                </Td>
                <Td textAlign="right">
                  <Tooltip label="Editar compania">
                    <IconButton size="sm" aria-label="Editar compania" icon={<EditIcon />} onClick={() => openEdit(company)} />
                  </Tooltip>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Editar compania</ModalHeader>
          <ModalCloseButton />
          {editing && (
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Nombre</FormLabel>
                  <Input value={editing.name || ''} onChange={(e) => updateField('name', e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>Plan</FormLabel>
                  <Input value={editing.planName || ''} onChange={(e) => updateField('planName', e.target.value)} placeholder="Basico, Pro, Enterprise" />
                </FormControl>
                <HStack align="start">
                  <FormControl>
                    <FormLabel>Licencia</FormLabel>
                    <Select value={editing.licenseStatus || 'trial'} onChange={(e) => updateField('licenseStatus', e.target.value)}>
                      {licenseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Pago</FormLabel>
                    <Select value={editing.paymentStatus || 'pendiente'} onChange={(e) => updateField('paymentStatus', e.target.value)}>
                      {paymentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </FormControl>
                </HStack>
                <HStack align="start">
                  <FormControl>
                    <FormLabel>Vencimiento</FormLabel>
                    <Input type="date" value={editing.licenseExpiresAt || ''} onChange={(e) => updateField('licenseExpiresAt', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Acceso</FormLabel>
                    <Select value={editing.estado ? '1' : '0'} onChange={(e) => updateField('estado', e.target.value === '1')}>
                      <option value="1">Activo</option>
                      <option value="0">Bloqueado</option>
                    </Select>
                  </FormControl>
                </HStack>
                <FormControl>
                  <FormLabel>Notas</FormLabel>
                  <Textarea value={editing.notes || ''} onChange={(e) => updateField('notes', e.target.value)} />
                </FormControl>
              </VStack>
            </ModalBody>
          )}
          <ModalFooter gap={2}>
            <Button onClick={modal.onClose}>Cancelar</Button>
            <Button colorScheme="blue" isLoading={saving} onClick={saveCompany}>Guardar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
