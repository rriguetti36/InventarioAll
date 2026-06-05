import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  IconButton,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Spinner,
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
  useToast,
} from '@chakra-ui/react'
import { AddIcon, ArrowBackIcon, CheckIcon, DeleteIcon, EditIcon, ViewIcon } from '@chakra-ui/icons'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'
import ConfirmDialog from '../components/ConfirmDialog'

const today = new Date().toISOString().slice(0, 10)

const attributeTemplates = {
  prenda: ['talla', 'color', 'material', 'genero', 'temporada'],
  repuesto: ['marca', 'tipoMedida', 'largo', 'ancho', 'alto', 'diametro', 'peso', 'compatibilidad'],
  otros: ['marca', 'serie', 'presentacion'],
}

function parseAttributes(value) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function summarizeAttributes(value) {
  if (Array.isArray(value)) {
    const pairs = value
      .filter((item) => Array.isArray(item.values) && item.values.length > 0)
      .slice(0, 3)
      .map((item) => `${item.name}: ${item.values.join(', ')}`)
    return pairs.length ? pairs.join('; ') : '-'
  }

  const attributes = parseAttributes(value)
  const pairs = Object.entries(attributes).filter(([, itemValue]) => itemValue !== undefined && itemValue !== null && itemValue !== '')
  if (!pairs.length) return '-'
  return pairs.slice(0, 3).map(([key, itemValue]) => `${key}: ${itemValue}`).join(', ')
}

function taxFlag(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback
  if (value === true || value === 1 || value === '1') return 1
  if (value === false || value === 0 || value === '0') return 0
  return Number(value) === 1 ? 1 : 0
}

function taxableLine(quantity, unitPrice, affectsTax) {
  const total = Number(quantity || 0) * Number(unitPrice || 0)
  if (!taxFlag(affectsTax)) return { subtotal: total, taxAmount: 0, total }
  const subtotal = total / 1.18
  return {
    subtotal,
    taxAmount: total - subtotal,
    total,
  }
}

function normalizedWhatsappPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits || digits.length < 9) return ''
  if (digits.length === 9) return `51${digits}`
  return digits
}

function WhatsAppIcon() {
  return (
    <Box as="svg" viewBox="0 0 32 32" boxSize="1em" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16.02 4C9.4 4 4.04 9.33 4.04 15.9c0 2.1.56 4.15 1.62 5.95L4 28l6.33-1.64a12.1 12.1 0 0 0 5.69 1.43C22.6 27.79 28 22.47 28 15.9 28 9.33 22.6 4 16.02 4Zm0 21.75c-1.74 0-3.44-.46-4.94-1.34l-.35-.2-3.75.97 1-3.64-.23-.38a9.8 9.8 0 0 1-1.5-5.16c0-5.46 4.48-9.9 9.98-9.9 5.5 0 9.98 4.44 9.98 9.9 0 5.46-4.48 9.9-9.98 9.9Zm5.48-7.4c-.3-.15-1.77-.87-2.04-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.01-1.04 2.47s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.41.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
    </Box>
  )
}

function PdfIcon() {
  return (
    <Box as="svg" viewBox="0 0 24 24" boxSize="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v6h6" />
      <path d="M8 17v-4h1.5a1.5 1.5 0 0 1 0 3H8" />
      <path d="M12 17v-4h1a2 2 0 0 1 0 4h-1" />
      <path d="M16 17v-4h2" />
      <path d="M16 15h1.5" />
    </Box>
  )
}

function ReceiptIcon() {
  return (
    <Box as="svg" viewBox="0 0 24 24" boxSize="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h3" />
    </Box>
  )
}

function PageHeader({ title, backTo, addTo }) {
  const navigate = useNavigate()
  return (
    <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} mb={6} gap={3}>
      <Heading size={{ base: 'md', md: 'lg' }}>{title}</Heading>
      {backTo ? (
        <Button leftIcon={<ArrowBackIcon />} variant="outline" onClick={() => navigate(backTo)} alignSelf={{ base: 'stretch', sm: 'auto' }}>
          Volver al listado
        </Button>
      ) : (
        addTo && (
          <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={() => navigate(addTo)} alignSelf={{ base: 'stretch', sm: 'auto' }}>
            Agregar +
          </Button>
        )
      )}
    </Flex>
  )
}

function DataTable({ columns, rows, loading, error, actions, searchable = true }) {
  const pageSize = 10
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const normalizedSearch = searchable ? search.trim().toLowerCase() : ''
  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return rows
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch)))
  }, [rows, normalizedSearch])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = useMemo(() => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredRows, currentPage])

  useEffect(() => {
    setPage(1)
  }, [rows.length, normalizedSearch])

  if (loading) return <Spinner />
  if (error) return <Text color="red.500">{error}</Text>

  return (
    <Box bg="white" boxShadow="sm" borderRadius="md" p={{ base: 3, md: 4 }}>
      {searchable && (
        <Flex mb={4} justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en listado"
            maxW={{ base: '100%', md: '360px' }}
          />
          <Text fontSize="sm" color="gray.600">
            {filteredRows.length} de {rows.length} registros
          </Text>
        </Flex>
      )}

      <Box display={{ base: 'none', md: 'block' }} overflowX="auto" overflowY="auto" maxH="560px">
        <Table variant="simple">
          <Thead bg="gray.100" position="sticky" top={0} zIndex={1}>
            <Tr>
              {columns.map((column) => <Th key={column.key}>{column.label}</Th>)}
              {actions && <Th>Acciones</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {pageRows.map((row) => (
              <Tr key={row.id}>
                {columns.map((column) => (
                  <Td key={column.key}>{column.render ? column.render(row) : row[column.key]}</Td>
                ))}
                {actions && <Td>{actions(row)}</Td>}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <VStack display={{ base: 'flex', md: 'none' }} align="stretch" spacing={3} maxH="620px" overflowY="auto">
        {pageRows.length ? pageRows.map((row) => (
          <Box key={row.id} borderWidth="1px" borderRadius="md" p={3} bg="white">
            <SimpleGrid columns={2} spacing={3}>
              {columns.map((column) => (
                <Box key={column.key} minW={0}>
                  <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">
                    {column.label}
                  </Text>
                  <Box fontSize="sm" color="gray.800" overflowWrap="anywhere">
                    {column.render ? column.render(row) : row[column.key]}
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
            {actions && (
              <Box mt={3} pt={3} borderTopWidth="1px">
                {actions(row)}
              </Box>
            )}
          </Box>
        )) : (
          <Text color="gray.500">Sin registros</Text>
        )}
      </VStack>

      <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} mt={4} gap={3}>
        <Text fontSize="sm" color="gray.600">
          Indice {currentPage} de {totalPages} | {filteredRows.length} registros
        </Text>
        <Flex gap={2} justify={{ base: 'space-between', sm: 'flex-start' }}>
          <Button size="sm" variant="outline" onClick={() => setPage((prev) => Math.max(1, prev - 1))} isDisabled={currentPage === 1}>
            Anterior
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} isDisabled={currentPage === totalPages}>
            Siguiente
          </Button>
        </Flex>
      </Flex>
    </Box>
  )
}

function DetailTable({ columns, rows, actions, maxH = '360px' }) {
  return (
    <Box borderWidth="1px" borderRadius="md" overflow="hidden">
      <Box overflowX="auto" overflowY="auto" maxH={maxH}>
        <Table variant="simple" size="sm">
          <Thead bg="gray.100" position="sticky" top={0} zIndex={1}>
            <Tr>
              {columns.map((column) => <Th key={column.key}>{column.label}</Th>)}
              {actions && <Th>Acciones</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {rows.length ? rows.map((row, index) => (
              <Tr key={row.id ?? index}>
                {columns.map((column) => (
                  <Td key={column.key}>{column.render ? column.render(row) : row[column.key]}</Td>
                ))}
                {actions && <Td>{actions(row)}</Td>}
              </Tr>
            )) : (
              <Tr>
                <Td colSpan={columns.length + (actions ? 1 : 0)}>
                  <Text color="gray.500">Sin registros</Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>
    </Box>
  )
}

function useList(endpoint) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(endpoint)
      setRows(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [endpoint])

  return { rows, loading, error, load }
}

function CrudList({ title, endpoint, addTo, columns, editTo }) {
  const { rows, loading, error, load } = useList(endpoint)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`${endpoint}/${deleteTarget.id}`)
      toast({ title: 'Registro eliminado', status: 'success', duration: 3000, isClosable: true })
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box>
      <PageHeader title={title} addTo={addTo} />
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        actions={(row) => (
          <Flex gap={2}>
            <IconButton aria-label="Editar" icon={<EditIcon />} size="sm" onClick={() => navigate(`${editTo}/${row.id}`, { state: row })} />
            <IconButton aria-label="Eliminar" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => setDeleteTarget(row)} />
          </Flex>
        )}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Eliminar registro"
        message="Esta accion eliminara el registro seleccionado."
        confirmLabel="Eliminar"
        colorScheme="red"
        isLoading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
    </Box>
  )
}

function FormShell({ title, backTo, children, onSubmit, saving }) {
  const navigate = useNavigate()
  return (
    <Box>
      <PageHeader title={title} backTo={backTo} />
      <Box
        p={{ base: 4, md: 6 }}
        bg="white"
        boxShadow="lg"
        borderRadius="md"
        maxW="100%"
        overflow="hidden"
        sx={{
          '.chakra-form-control': { minWidth: 0 },
          input: { minWidth: 0 },
          select: { minWidth: 0 },
          textarea: { minWidth: 0 },
        }}
      >
        <form onSubmit={onSubmit}>
          <VStack spacing={4} align="stretch">
            {children}
            <Flex gap={3} direction={{ base: 'column', sm: 'row' }}>
              <Button type="submit" colorScheme="blue" isLoading={saving}>
                Guardar
              </Button>
              <Button variant="outline" onClick={() => navigate(backTo)}>
                Cancelar
              </Button>
            </Flex>
          </VStack>
        </form>
      </Box>
    </Box>
  )
}

function useOptions() {
  const [suppliers, setSuppliers] = useState([])
  const [locations, setLocations] = useState([])
  const [shelves, setShelves] = useState([])
  const [products, setProducts] = useState([])
  const [sellableItems, setSellableItems] = useState([])
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    Promise.allSettled([
      api.get('/inventory/suppliers'),
      api.get('/inventory/locations'),
      api.get('/inventory/shelves'),
      api.get('/inventory/products'),
      api.get('/inventory/sellable-items'),
      api.get('/inventory/customers'),
    ]).then(([supplierRes, locationRes, shelfRes, productRes, sellableRes, customerRes]) => {
      if (supplierRes.status === 'fulfilled') setSuppliers(supplierRes.value.data)
      if (locationRes.status === 'fulfilled') setLocations(locationRes.value.data)
      if (shelfRes.status === 'fulfilled') setShelves(shelfRes.value.data)
      if (productRes.status === 'fulfilled') setProducts(productRes.value.data)
      if (sellableRes.status === 'fulfilled') setSellableItems(sellableRes.value.data)
      if (customerRes.status === 'fulfilled') setCustomers(customerRes.value.data)
    })
  }, [])

  return { suppliers, locations, shelves, products, sellableItems, customers }
}

function CatalogForm({ title, endpoint, backTo, defaults, children }) {
  const [formData, setFormData] = useState(defaults)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (formData.id) {
        await api.put(`${endpoint}/${formData.id}`, formData)
      } else {
        await api.post(endpoint, formData)
      }
      toast({ title: 'Registro guardado', status: 'success', duration: 3000, isClosable: true })
      navigate(backTo)
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormShell title={title} backTo={backTo} onSubmit={handleSubmit} saving={saving}>
      {children(formData, handleChange, setFormData)}
    </FormShell>
  )
}

export function ProductList() {
  return (
    <CrudList
      title="Productos"
      endpoint="/inventory/products"
      addTo="/inventory/products/add"
      editTo="/inventory/products/edit"
      columns={[
        { key: 'imageUrl', label: 'Imagen', render: (row) => row.imageUrl ? <Image src={row.imageUrl} boxSize="48px" objectFit="cover" borderRadius="md" /> : '-' },
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Producto' },
        { key: 'type', label: 'Tipo' },
        { key: 'model', label: 'Modelo', render: (row) => row.model || '-' },
        { key: 'characteristics', label: 'Caracteristicas', render: (row) => summarizeAttributes(row.characteristics) },
        { key: 'supplierName', label: 'Proveedor', render: (row) => row.supplierName || '-' },
        { key: 'salePrice', label: 'Precio venta' },
        { key: 'estado', label: 'Estado', render: (row) => row.estado ? 'activo' : 'inactivo' },
      ]}
    />
  )
}

export function ProductForm() {
  const { suppliers } = useOptions()
  const [isVariableOpen, setIsVariableOpen] = useState(false)
  const [newCharacteristic, setNewCharacteristic] = useState('')
  const [valueDrafts, setValueDrafts] = useState({})
  const state = window.history.state?.usr
  const defaults = state
    ? {
        ...state,
        characteristics: state.characteristics || (state.variables || []).map((item) => ({
          name: item.name,
          values: item.value ? [item.value] : [],
        })),
      }
    : { sku: '', name: '', type: 'repuesto', model: '', description: '', imageUrl: '', characteristics: [], supplierId: '', unit: 'unidad', minStock: 0, costPrice: 0, salePrice: 0, affectsTax: 1, estado: 1 }

  return (
    <CatalogForm title={state ? 'Editar Producto' : 'Crear Producto'} endpoint="/inventory/products" backTo="/inventory/products" defaults={defaults}>
      {(formData, handleChange, setFormData) => {
        const characteristics = Array.isArray(formData.characteristics) ? formData.characteristics : []
        const fields = attributeTemplates[formData.type] || attributeTemplates.otros
        const characteristicNames = [...new Set([...fields, ...characteristics.map((item) => item.name)])]

        const setCharacteristicValues = (name, values) => {
          setFormData((prev) => {
            const prevCharacteristics = Array.isArray(prev.characteristics) ? prev.characteristics : []
            const exists = prevCharacteristics.some((item) => item.name === name)
            const nextCharacteristics = exists
              ? prevCharacteristics.map((item) => item.name === name ? { ...item, values } : item)
              : [...prevCharacteristics, { name, values }]
            return { ...prev, characteristics: nextCharacteristics }
          })
        }

        const addCharacteristic = () => {
          const name = newCharacteristic.trim()
          if (!name) return
          setCharacteristicValues(name, [])
          setNewCharacteristic('')
        }

        const removeCharacteristic = (name) => {
          setFormData((prev) => {
            const prevCharacteristics = Array.isArray(prev.characteristics) ? prev.characteristics : []
            return { ...prev, characteristics: prevCharacteristics.filter((item) => item.name !== name) }
          })
        }

        const valuesFor = (name) => characteristics.find((item) => item.name === name)?.values || []

        const addValue = (name) => {
          const value = (valueDrafts[name] || '').trim()
          if (!value) return
          const values = valuesFor(name)
          if (!values.includes(value)) {
            setCharacteristicValues(name, [...values, value])
          }
          setValueDrafts((prev) => ({ ...prev, [name]: '' }))
        }

        const removeValue = (name, value) => {
          setCharacteristicValues(name, valuesFor(name).filter((item) => item !== value))
        }

        return (
          <>
            <FormControl isRequired><FormLabel>SKU</FormLabel><Input name="sku" value={formData.sku} onChange={handleChange} /></FormControl>
            <FormControl isRequired><FormLabel>Nombre</FormLabel><Input name="name" value={formData.name} onChange={handleChange} /></FormControl>
            <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
              <FormControl><FormLabel>Tipo</FormLabel><Select name="type" value={formData.type} onChange={handleChange}><option value="repuesto">Repuesto</option><option value="prenda">Prenda</option><option value="otros">Otros</option></Select></FormControl>
              <FormControl><FormLabel>Modelo</FormLabel><Input name="model" value={formData.model || ''} onChange={handleChange} /></FormControl>
            </Flex>
            <FormControl><FormLabel>URL de imagen</FormLabel><Input name="imageUrl" value={formData.imageUrl || ''} onChange={handleChange} /></FormControl>
            <Box borderWidth="1px" borderRadius="md" p={4}>
              <Flex justify="space-between" align="center" mb={3}>
                <Heading size="sm">Caracteristicas</Heading>
                <Button type="button" size="sm" leftIcon={<AddIcon />} onClick={() => setIsVariableOpen(true)}>Agregar Variable</Button>
              </Flex>
              {characteristicNames.length ? (
                <VStack align="stretch" spacing={2}>
                  {characteristicNames.map((name) => (
                    <Flex key={name} gap={3} align="center">
                      <Text minW="140px" fontWeight="semibold">{name}</Text>
                      <Text>{valuesFor(name).join(', ') || '-'}</Text>
                    </Flex>
                  ))}
                </VStack>
              ) : (
                <Text color="gray.500">Sin caracteristicas registradas</Text>
              )}
            </Box>
            <Modal isOpen={isVariableOpen} onClose={() => setIsVariableOpen(false)}>
              <ModalOverlay />
              <ModalContent maxW="720px">
                <ModalHeader>Variables del producto</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  <VStack align="stretch" spacing={3}>
                    {characteristicNames.map((name) => (
                      <Box key={name} borderWidth="1px" borderRadius="md" p={3}>
                        <Flex gap={2} align="center" mb={3}>
                          <Input value={name} isReadOnly />
                          <IconButton type="button" aria-label="Quitar caracteristica" icon={<DeleteIcon />} colorScheme="red" isDisabled={fields.includes(name)} onClick={() => removeCharacteristic(name)} />
                        </Flex>
                        <Flex gap={2} mb={3}>
                          <Input placeholder={`Valor para ${name}`} value={valueDrafts[name] || ''} onChange={(e) => setValueDrafts((prev) => ({ ...prev, [name]: e.target.value }))} />
                          <Button type="button" leftIcon={<AddIcon />} onClick={() => addValue(name)}>Agregar</Button>
                        </Flex>
                        <Flex gap={2} wrap="wrap">
                          {valuesFor(name).map((value) => (
                            <Flex key={value} gap={2} align="center" borderWidth="1px" borderRadius="md" px={2} py={1}>
                              <Text>{value}</Text>
                              <IconButton type="button" aria-label="Quitar valor" icon={<DeleteIcon />} size="xs" onClick={() => removeValue(name, value)} />
                            </Flex>
                          ))}
                        </Flex>
                      </Box>
                    ))}
                    <Flex gap={2}>
                      <Input placeholder="Nueva caracteristica, por ejemplo Talla" value={newCharacteristic} onChange={(e) => setNewCharacteristic(e.target.value)} />
                      <Button type="button" leftIcon={<AddIcon />} onClick={addCharacteristic}>Agregar</Button>
                    </Flex>
                  </VStack>
                </ModalBody>
                <ModalFooter>
                  <Button type="button" colorScheme="blue" onClick={() => setIsVariableOpen(false)}>Cerrar</Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
            <FormControl><FormLabel>Proveedor</FormLabel><Select name="supplierId" value={formData.supplierId || ''} onChange={handleChange}><option value="">Sin proveedor</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
            <FormControl><FormLabel>Unidad</FormLabel><Input name="unit" value={formData.unit} onChange={handleChange} /></FormControl>
            <Flex gap={4} direction={{ base: 'column', md: 'row' }}><FormControl><FormLabel>Stock minimo</FormLabel><Input name="minStock" type="number" value={formData.minStock} onChange={handleChange} /></FormControl><FormControl><FormLabel>Costo</FormLabel><Input name="costPrice" type="number" value={formData.costPrice} onChange={handleChange} /></FormControl><FormControl><FormLabel>Precio venta</FormLabel><Input name="salePrice" type="number" value={formData.salePrice} onChange={handleChange} /></FormControl></Flex>
            <FormControl><FormLabel>Afecta IGV 18%</FormLabel><Select name="affectsTax" value={taxFlag(formData.affectsTax)} onChange={handleChange}><option value={1}>Si</option><option value={0}>No</option></Select></FormControl>
            <FormControl><FormLabel>Descripcion</FormLabel><Textarea name="description" value={formData.description || ''} onChange={handleChange} /></FormControl>
            <FormControl><FormLabel>Estado</FormLabel><Select name="estado" value={formData.estado} onChange={handleChange}><option value={1}>Activo</option><option value={0}>Inactivo</option></Select></FormControl>
          </>
        )
      }}
    </CatalogForm>
  )
}

export function SupplierList() {
  return <CrudList title="Proveedores" endpoint="/inventory/suppliers" addTo="/inventory/suppliers/add" editTo="/inventory/suppliers/edit" columns={[{ key: 'name', label: 'Proveedor' }, { key: 'contactName', label: 'Contacto' }, { key: 'phone', label: 'Telefono' }, { key: 'email', label: 'Email' }, { key: 'estado', label: 'Estado', render: (row) => row.estado ? 'activo' : 'inactivo' }]} />
}

export function SupplierForm() {
  const state = window.history.state?.usr
  const defaults = state || { name: '', contactName: '', phone: '', email: '', address: '', estado: 1 }
  return (
    <CatalogForm title={state ? 'Editar Proveedor' : 'Crear Proveedor'} endpoint="/inventory/suppliers" backTo="/inventory/suppliers" defaults={defaults}>
      {(formData, handleChange) => (
        <>
          <FormControl isRequired><FormLabel>Nombre</FormLabel><Input name="name" value={formData.name} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Contacto</FormLabel><Input name="contactName" value={formData.contactName || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Telefono</FormLabel><Input name="phone" value={formData.phone || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Email</FormLabel><Input name="email" value={formData.email || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Direccion</FormLabel><Input name="address" value={formData.address || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Estado</FormLabel><Select name="estado" value={formData.estado} onChange={handleChange}><option value={1}>Activo</option><option value={0}>Inactivo</option></Select></FormControl>
        </>
      )}
    </CatalogForm>
  )
}

export function PaymentMethodList() {
  return (
    <CrudList
      title="Formas de pago"
      endpoint="/inventory/payment-methods"
      addTo="/inventory/payment-methods/add"
      editTo="/inventory/payment-methods/edit"
      columns={[
        { key: 'companyName', label: 'Empresa' },
        { key: 'name', label: 'Forma de pago' },
        { key: 'description', label: 'Descripcion', render: (row) => row.description || '-' },
        { key: 'estado', label: 'Estado', render: (row) => row.estado ? 'activo' : 'inactivo' },
      ]}
    />
  )
}

export function PaymentMethodForm() {
  const state = window.history.state?.usr
  const defaults = state || { companyName: '', name: '', description: '', estado: 1 }
  return (
    <CatalogForm title={state ? 'Editar Forma de pago' : 'Crear Forma de pago'} endpoint="/inventory/payment-methods" backTo="/inventory/payment-methods" defaults={defaults}>
      {(formData, handleChange) => (
        <>
          <FormControl isRequired><FormLabel>Empresa</FormLabel><Input name="companyName" value={formData.companyName} onChange={handleChange} /></FormControl>
          <FormControl isRequired><FormLabel>Forma de pago</FormLabel><Input name="name" value={formData.name} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Descripcion</FormLabel><Textarea name="description" value={formData.description || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Estado</FormLabel><Select name="estado" value={formData.estado} onChange={handleChange}><option value={1}>Activo</option><option value={0}>Inactivo</option></Select></FormControl>
        </>
      )}
    </CatalogForm>
  )
}

export function CustomerList() {
  return (
    <CrudList
      title="Clientes"
      endpoint="/inventory/customers"
      addTo="/inventory/customers/add"
      editTo="/inventory/customers/edit"
      columns={[
        { key: 'name', label: 'Cliente' },
        { key: 'documentNumber', label: 'Documento', render: (row) => row.documentNumber || '-' },
        { key: 'phone', label: 'Telefono', render: (row) => row.phone || '-' },
        { key: 'email', label: 'Email', render: (row) => row.email || '-' },
        { key: 'estado', label: 'Estado', render: (row) => row.estado ? 'activo' : 'inactivo' },
      ]}
    />
  )
}

export function CustomerForm() {
  const state = window.history.state?.usr
  const defaults = state || { documentType: 'DNI', documentNumber: '', name: '', phone: '', email: '', address: '', estado: 1 }
  return (
    <CatalogForm title={state ? 'Editar Cliente' : 'Crear Cliente'} endpoint="/inventory/customers" backTo="/inventory/customers" defaults={defaults}>
      {(formData, handleChange) => (
        <>
          <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
            <FormControl><FormLabel>Tipo documento</FormLabel><Select name="documentType" value={formData.documentType || ''} onChange={handleChange}><option value="DNI">DNI</option><option value="RUC">RUC</option><option value="CE">CE</option><option value="OTRO">Otro</option></Select></FormControl>
            <FormControl><FormLabel>Numero documento</FormLabel><Input name="documentNumber" value={formData.documentNumber || ''} onChange={handleChange} /></FormControl>
          </Flex>
          <FormControl isRequired><FormLabel>Nombre</FormLabel><Input name="name" value={formData.name} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Telefono</FormLabel><Input name="phone" value={formData.phone || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Email</FormLabel><Input name="email" value={formData.email || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Direccion</FormLabel><Input name="address" value={formData.address || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Estado</FormLabel><Select name="estado" value={formData.estado} onChange={handleChange}><option value={1}>Activo</option><option value={0}>Inactivo</option></Select></FormControl>
        </>
      )}
    </CatalogForm>
  )
}

export function LocationList() {
  return <CrudList title="Tiendas y almacenes" endpoint="/inventory/locations" addTo="/inventory/locations/add" editTo="/inventory/locations/edit" columns={[{ key: 'name', label: 'Nombre' }, { key: 'type', label: 'Tipo' }, { key: 'address', label: 'Direccion' }, { key: 'estado', label: 'Estado', render: (row) => row.estado ? 'activo' : 'inactivo' }]} />
}

export function LocationForm() {
  const state = window.history.state?.usr
  const defaults = state || { name: '', type: 'almacen', address: '', description: '', estado: 1 }
  return (
    <CatalogForm title={state ? 'Editar Ubicacion' : 'Crear Ubicacion'} endpoint="/inventory/locations" backTo="/inventory/locations" defaults={defaults}>
      {(formData, handleChange) => (
        <>
          <FormControl isRequired><FormLabel>Nombre</FormLabel><Input name="name" value={formData.name} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Tipo</FormLabel><Select name="type" value={formData.type} onChange={handleChange}><option value="tienda">Tienda</option><option value="almacen">Almacen</option><option value="otro">Otro</option></Select></FormControl>
          <FormControl><FormLabel>Direccion</FormLabel><Input name="address" value={formData.address || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Descripcion</FormLabel><Textarea name="description" value={formData.description || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Estado</FormLabel><Select name="estado" value={formData.estado} onChange={handleChange}><option value={1}>Activo</option><option value={0}>Inactivo</option></Select></FormControl>
        </>
      )}
    </CatalogForm>
  )
}

export function ShelfList() {
  return <CrudList title="Estantes" endpoint="/inventory/shelves" addTo="/inventory/shelves/add" editTo="/inventory/shelves/edit" columns={[{ key: 'locationName', label: 'Ubicacion' }, { key: 'name', label: 'Estante' }, { key: 'code', label: 'Codigo' }, { key: 'estado', label: 'Estado', render: (row) => row.estado ? 'activo' : 'inactivo' }]} />
}

export function ShelfForm() {
  const state = window.history.state?.usr
  const { locations } = useOptions()
  const defaults = state || { locationId: '', name: '', code: '', description: '', estado: 1 }
  return (
    <CatalogForm title={state ? 'Editar Estante' : 'Crear Estante'} endpoint="/inventory/shelves" backTo="/inventory/shelves" defaults={defaults}>
      {(formData, handleChange) => (
        <>
          <FormControl isRequired><FormLabel>Ubicacion</FormLabel><Select name="locationId" value={formData.locationId} onChange={handleChange}><option value="">Selecciona</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
          <FormControl isRequired><FormLabel>Nombre</FormLabel><Input name="name" value={formData.name} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Codigo</FormLabel><Input name="code" value={formData.code || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Descripcion</FormLabel><Textarea name="description" value={formData.description || ''} onChange={handleChange} /></FormControl>
          <FormControl><FormLabel>Estado</FormLabel><Select name="estado" value={formData.estado} onChange={handleChange}><option value={1}>Activo</option><option value={0}>Inactivo</option></Select></FormControl>
        </>
      )}
    </CatalogForm>
  )
}

function MovementList({ type }) {
  const endpoint = type === 'purchase' ? '/inventory/purchases' : '/inventory/sales'
  const title = type === 'purchase' ? 'Compras' : 'Ventas'
  const addTo = type === 'purchase' ? '/inventory/purchases/add' : '/inventory/sales/add'
  const { rows, loading, error } = useList(endpoint)
  return (
    <Box>
      <PageHeader title={title} addTo={addTo} />
      <DataTable
        columns={[
          { key: 'documentNumber', label: 'Documento', render: (row) => row.documentNumber || '-' },
          ...(type === 'sale' ? [{ key: 'saleDocumentNumber', label: 'Comprobante', render: (row) => row.saleDocumentNumber || '-' }] : []),
          { key: type === 'purchase' ? 'supplierName' : 'customerName', label: type === 'purchase' ? 'Proveedor' : 'Cliente', render: (row) => row.supplierName || row.customerName || '-' },
          ...(type === 'sale' ? [{ key: 'sellerName', label: 'Vendedor', render: (row) => row.sellerName || '-' }] : []),
          { key: 'locationName', label: 'Ubicacion' },
          { key: 'shelfName', label: 'Estante', render: (row) => row.shelfName || '-' },
          { key: type === 'purchase' ? 'purchaseDate' : 'saleDate', label: 'Fecha', render: (row) => String(row.purchaseDate || row.saleDate).slice(0, 10) },
          { key: 'total', label: 'Total' },
        ]}
        rows={rows}
        loading={loading}
        error={error}
      />
    </Box>
  )
}

function MovementForm({ type }) {
  const { suppliers, locations, shelves, sellableItems, customers } = useOptions()
  const loggedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [])
  const [formData, setFormData] = useState({ supplierId: '', customerId: '', customerName: '', locationId: '', shelfId: '', documentNumber: '', movementDate: today, notes: '', details: [] })
  const [saving, setSaving] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [detailDraft, setDetailDraft] = useState({ quantity: 1, price: 0 })
  const [showCustomerOptions, setShowCustomerOptions] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const backTo = type === 'purchase' ? '/inventory/purchases' : '/inventory/sales'
  const title = type === 'purchase' ? 'Registrar Compra' : 'Registrar Venta'
  const selectedShelves = useMemo(() => shelves.filter((item) => String(item.locationId) === String(formData.locationId)), [shelves, formData.locationId])

  useEffect(() => {
    if (!formData.locationId && locations.length === 1) {
      setFormData((prev) => ({ ...prev, locationId: String(locations[0].id) }))
    }
  }, [locations, formData.locationId])

  const filteredProducts = sellableItems.filter((product) => {
    const text = `${product.variantSku || product.productSku || ''} ${productLabel(product)}`.toLowerCase()
    return text.includes(productSearch.toLowerCase())
  }).slice(0, 12)

  const filteredCustomers = customers.filter((customer) => {
    const text = `${customer.name || ''} ${customer.documentNumber || ''} ${customer.phone || ''} ${customer.email || ''}`.toLowerCase()
    return text.includes(formData.customerName.toLowerCase())
  }).slice(0, 8)

  const saleTotals = formData.details.reduce((acc, item) => {
    const line = type === 'sale'
      ? taxableLine(item.quantity, item.price, item.affectsTax)
      : { subtotal: Number(item.quantity || 0) * Number(item.price || 0), taxAmount: 0, total: Number(item.quantity || 0) * Number(item.price || 0) }
    return {
      subtotal: acc.subtotal + line.subtotal,
      taxTotal: acc.taxTotal + line.taxAmount,
      total: acc.total + line.total,
    }
  }, { subtotal: 0, taxTotal: 0, total: 0 })

  const openProductModal = () => {
    setProductSearch('')
    setSelectedProduct(null)
    setDetailDraft({ quantity: 1, price: 0 })
    setProductModalOpen(true)
  }

  const chooseProduct = (product) => {
    if (type === 'sale' && Number(product.stock || 0) <= 0) {
      toast({ title: 'Producto sin stock', description: 'No se puede seleccionar un producto con 0 existencias', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setSelectedProduct(product)
    setProductSearch(productLabel(product))
    setDetailDraft({ quantity: 1, price: type === 'purchase' ? Number(product.costPrice || 0) : Number(product.salePrice || 0) })
  }

  const chooseCustomer = (customer) => {
    setFormData((prev) => ({ ...prev, customerId: String(customer.id), customerName: customer.name }))
    setShowCustomerOptions(false)
  }

  const acceptProduct = () => {
    if (!selectedProduct) {
      toast({ title: 'Selecciona una existencia', status: 'warning', duration: 2500, isClosable: true })
      return
    }
    if (type === 'sale' && Number(selectedProduct.stock || 0) <= 0) {
      toast({ title: 'Producto sin stock', description: 'No se puede agregar un producto con 0 existencias', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setFormData((prev) => ({
      ...prev,
      details: [...prev.details, {
        productId: selectedProduct.productId,
        variantId: selectedProduct.variantId,
        productDescription: productLabel(selectedProduct),
        productSku: selectedProduct.productSku,
        variantSku: selectedProduct.variantSku,
        quantity: Number(detailDraft.quantity || 0),
        price: Number(detailDraft.price || 0),
        affectsTax: taxFlag(selectedProduct.affectsTax) === 1,
      }],
    }))
    setProductModalOpen(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const details = formData.details.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      productDescription: item.productDescription,
      quantity: Number(item.quantity),
      listPrice: Number(item.price || 0),
      affectsTax: item.affectsTax,
      [type === 'purchase' ? 'unitCost' : 'unitPrice']: Number(item.price || 0),
    }))
    const payload = {
      supplierId: formData.supplierId || null,
      customerId: formData.customerId || null,
      customerName: formData.customerName,
      sellerId: type === 'sale' ? loggedUser.id || null : null,
      locationId: formData.locationId,
      shelfId: formData.shelfId || null,
      documentNumber: formData.documentNumber,
      [type === 'purchase' ? 'purchaseDate' : 'saleDate']: formData.movementDate,
      notes: formData.notes,
      details,
    }

    try {
      await api.post(type === 'purchase' ? '/inventory/purchases' : '/inventory/sales', payload)
      toast({ title: 'Registro guardado', status: 'success', duration: 3000, isClosable: true })
      navigate(backTo)
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormShell title={title} backTo={backTo} onSubmit={submit} saving={saving}>
      {type === 'purchase' ? (
        <FormControl><FormLabel>Proveedor</FormLabel><Select value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}><option value="">Sin proveedor</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
      ) : (
        <VStack align="stretch" spacing={4}>
          <FormControl>
            <FormLabel>Vendedor</FormLabel>
            <Input value={loggedUser.name || loggedUser.username || ''} isReadOnly />
          </FormControl>
          <FormControl>
            <FormLabel>Cliente</FormLabel>
            <Box position="relative">
              <Input
                value={formData.customerName}
                onChange={(e) => {
                  setFormData({ ...formData, customerId: '', customerName: e.target.value })
                  setShowCustomerOptions(true)
                }}
                onFocus={() => setShowCustomerOptions(true)}
                placeholder="Buscar por nombre, documento, telefono o correo"
              />
              {showCustomerOptions && formData.customerName && filteredCustomers.length > 0 && (
                <Box position="absolute" top="42px" left={0} right={0} zIndex={10} borderWidth="1px" borderRadius="md" bg="white" boxShadow="lg" maxH="220px" overflowY="auto">
                  {filteredCustomers.map((customer) => (
                    <Box key={customer.id} p={3} cursor="pointer" _hover={{ bg: 'gray.50' }} onMouseDown={() => chooseCustomer(customer)}>
                      <Text fontWeight="semibold">{customer.name}</Text>
                      <Text fontSize="sm">{customer.documentNumber || 'Sin documento'} | {customer.phone || 'Sin telefono'} | {customer.email || 'Sin correo'}</Text>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </FormControl>
        </VStack>
      )}
      <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
        <FormControl isRequired><FormLabel>Ubicacion</FormLabel><Select value={formData.locationId} onChange={(e) => setFormData({ ...formData, locationId: e.target.value, shelfId: '' })}><option value="">Selecciona</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
        <FormControl><FormLabel>Estante</FormLabel><Select value={formData.shelfId} onChange={(e) => setFormData({ ...formData, shelfId: e.target.value })}><option value="">Sin estante</option>{selectedShelves.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
      </Flex>
      <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
        <FormControl><FormLabel>Documento</FormLabel><Input value={formData.documentNumber} onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })} /></FormControl>
        <FormControl><FormLabel>Fecha</FormLabel><Input type="date" value={formData.movementDate} onChange={(e) => setFormData({ ...formData, movementDate: e.target.value })} /></FormControl>
      </Flex>
      <Box borderWidth="1px" borderRadius="md" p={4}>
        <Flex justify="space-between" align="center" mb={3}>
          <Heading size="sm">Detalle</Heading>
          <Button size="sm" leftIcon={<AddIcon />} onClick={openProductModal}>Agregar producto</Button>
        </Flex>
        <DetailTable
          columns={[
            { key: type === 'sale' ? 'productSku' : 'variantSku', label: 'SKU', render: (row) => type === 'sale' ? row.productSku || '-' : row.variantSku || '-' },
            { key: 'productDescription', label: 'Existencia' },
            { key: 'quantity', label: 'Cantidad' },
            { key: 'price', label: type === 'purchase' ? 'Costo' : 'Precio' },
            { key: 'subtotal', label: type === 'sale' ? 'Subtotal' : 'Importe', render: (row) => {
              if (type !== 'sale') return (Number(row.quantity || 0) * Number(row.price || 0)).toFixed(2)
              return taxableLine(row.quantity, row.price, row.affectsTax).subtotal.toFixed(2)
            } },
            ...(type === 'sale' ? [
              { key: 'taxAmount', label: 'IGV', render: (row) => taxableLine(row.quantity, row.price, row.affectsTax).taxAmount.toFixed(2) },
              { key: 'lineTotal', label: 'Total', render: (row) => {
                return taxableLine(row.quantity, row.price, row.affectsTax).total.toFixed(2)
              } },
            ] : []),
          ]}
          rows={formData.details.map((item, index) => ({ ...item, id: index }))}
          actions={(row) => <IconButton aria-label="Quitar" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => setFormData({ ...formData, details: formData.details.filter((_, current) => current !== row.id) })} />}
        />
        {type === 'sale' && (
          <Flex justify="flex-end" mt={4}>
            <Box minW="260px">
              <Flex justify="space-between"><Text>Subtotal</Text><Text>{saleTotals.subtotal.toFixed(2)}</Text></Flex>
              <Flex justify="space-between"><Text>IGV 18%</Text><Text>{saleTotals.taxTotal.toFixed(2)}</Text></Flex>
              <Flex justify="space-between" fontWeight="bold" fontSize="lg"><Text>Total Venta</Text><Text>{saleTotals.total.toFixed(2)}</Text></Flex>
            </Box>
          </Flex>
        )}
      </Box>
      <FormControl><FormLabel>Notas</FormLabel><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></FormControl>
      <Modal isOpen={productModalOpen} onClose={() => setProductModalOpen(false)}>
        <ModalOverlay />
        <ModalContent maxW="760px">
          <ModalHeader>Agregar producto</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl><FormLabel>Buscar existencia</FormLabel><Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Escribe nombre, modelo, SKU o caracteristicas" /></FormControl>
              {productSearch && (
                <Box borderWidth="1px" borderRadius="md" maxH="220px" overflowY="auto">
                  {filteredProducts.map((product) => (
                    <Box key={`${product.productId}-${product.variantId || 'base'}`} p={3} cursor={type === 'sale' && Number(product.stock || 0) <= 0 ? 'not-allowed' : 'pointer'} opacity={type === 'sale' && Number(product.stock || 0) <= 0 ? 0.65 : 1} _hover={{ bg: type === 'sale' && Number(product.stock || 0) <= 0 ? 'red.50' : 'gray.50' }} onClick={() => chooseProduct(product)}>
                      <Text fontWeight="semibold">{productLabel(product)}</Text>
                      <Text fontSize="sm" color={type === 'sale' && Number(product.stock || 0) <= 0 ? 'red.600' : 'gray.700'}>SKU: {product.variantSku} | Stock: {product.stock} | Precio: {type === 'purchase' ? product.costPrice : product.salePrice} | Unidad: {product.unit || 'unidad'}</Text>
                    </Box>
                  ))}
                </Box>
              )}
              <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
                <FormControl><FormLabel>{type === 'purchase' ? 'Costo' : 'Precio'}</FormLabel><Input type="number" value={detailDraft.price} onChange={(e) => setDetailDraft({ ...detailDraft, price: e.target.value })} /></FormControl>
                <FormControl><FormLabel>Cantidad</FormLabel><Input type="number" value={detailDraft.quantity} onChange={(e) => setDetailDraft({ ...detailDraft, quantity: e.target.value })} /></FormControl>
                <FormControl><FormLabel>Importe</FormLabel><Input value={(Number(detailDraft.quantity || 0) * Number(detailDraft.price || 0)).toFixed(2)} isReadOnly /></FormControl>
              </Flex>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setProductModalOpen(false)}>Cancelar</Button>
            <Button colorScheme="blue" onClick={acceptProduct}>Aceptar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </FormShell>
  )
}

export function PurchaseList() {
  return <MovementList type="purchase" />
}

export function PurchaseForm() {
  return <MovementForm type="purchase" />
}

export function TransferList() {
  const { rows, loading, error } = useList('/inventory/transfers')
  return (
    <Box>
      <PageHeader title="Traslados" addTo="/inventory/transfers/add" />
      <DataTable
        columns={[
          { key: 'documentNumber', label: 'Documento', render: (row) => row.documentNumber || '-' },
          { key: 'sourceLocationName', label: 'Origen' },
          { key: 'sourceShelfName', label: 'Estante origen', render: (row) => row.sourceShelfName || '-' },
          { key: 'targetLocationName', label: 'Destino' },
          { key: 'targetShelfName', label: 'Estante destino', render: (row) => row.targetShelfName || '-' },
          { key: 'transferDate', label: 'Fecha', render: (row) => String(row.transferDate).slice(0, 10) },
          { key: 'notes', label: 'Notas', render: (row) => row.notes || '-' },
        ]}
        rows={rows}
        loading={loading}
        error={error}
      />
    </Box>
  )
}

export function TransferForm() {
  const { locations, shelves, sellableItems } = useOptions()
  const [formData, setFormData] = useState({
    sourceLocationId: '',
    sourceShelfId: '',
    targetLocationId: '',
    targetShelfId: '',
    documentNumber: '',
    transferDate: today,
    notes: '',
    details: [],
  })
  const [saving, setSaving] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [detailDraft, setDetailDraft] = useState({ quantity: 1 })
  const toast = useToast()
  const navigate = useNavigate()

  const sourceShelves = useMemo(() => shelves.filter((item) => String(item.locationId) === String(formData.sourceLocationId)), [shelves, formData.sourceLocationId])
  const targetShelves = useMemo(() => shelves.filter((item) => String(item.locationId) === String(formData.targetLocationId)), [shelves, formData.targetLocationId])

  const filteredProducts = sellableItems.filter((product) => {
    const text = `${product.variantSku || product.productSku || ''} ${productLabel(product)}`.toLowerCase()
    return text.includes(productSearch.toLowerCase())
  }).slice(0, 12)

  const openProductModal = () => {
    setProductSearch('')
    setSelectedProduct(null)
    setDetailDraft({ quantity: 1 })
    setProductModalOpen(true)
  }

  const chooseProduct = (product) => {
    if (Number(product.stock || 0) <= 0) {
      toast({ title: 'Producto sin stock', description: 'No se puede seleccionar un producto con 0 existencias', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setSelectedProduct(product)
    setProductSearch(productLabel(product))
    setDetailDraft({ quantity: 1 })
  }

  const acceptProduct = () => {
    if (!selectedProduct) {
      toast({ title: 'Selecciona una existencia', status: 'warning', duration: 2500, isClosable: true })
      return
    }
    if (Number(selectedProduct.stock || 0) <= 0) {
      toast({ title: 'Producto sin stock', description: 'No se puede agregar un producto con 0 existencias', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setFormData((prev) => ({
      ...prev,
      details: [...prev.details, {
        productId: selectedProduct.productId,
        variantId: selectedProduct.variantId,
        productDescription: productLabel(selectedProduct),
        variantSku: selectedProduct.variantSku,
        stock: selectedProduct.stock,
        quantity: Number(detailDraft.quantity || 0),
      }],
    }))
    setProductModalOpen(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/inventory/transfers', {
        ...formData,
        sourceShelfId: formData.sourceShelfId || null,
        targetShelfId: formData.targetShelfId || null,
        details: formData.details.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: Number(item.quantity),
        })),
      })
      toast({ title: 'Traslado registrado', status: 'success', duration: 3000, isClosable: true })
      navigate('/inventory/transfers')
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormShell title="Registrar Traslado" backTo="/inventory/transfers" onSubmit={submit} saving={saving}>
      <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
        <FormControl isRequired><FormLabel>Almacen origen</FormLabel><Select value={formData.sourceLocationId} onChange={(e) => setFormData({ ...formData, sourceLocationId: e.target.value, sourceShelfId: '' })}><option value="">Selecciona</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
        <FormControl><FormLabel>Estante origen</FormLabel><Select value={formData.sourceShelfId} onChange={(e) => setFormData({ ...formData, sourceShelfId: e.target.value })}><option value="">Sin estante</option>{sourceShelves.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
      </Flex>
      <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
        <FormControl isRequired><FormLabel>Tienda destino</FormLabel><Select value={formData.targetLocationId} onChange={(e) => setFormData({ ...formData, targetLocationId: e.target.value, targetShelfId: '' })}><option value="">Selecciona</option>{locations.filter((item) => item.type === 'tienda').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
        <FormControl><FormLabel>Estante destino</FormLabel><Select value={formData.targetShelfId} onChange={(e) => setFormData({ ...formData, targetShelfId: e.target.value })}><option value="">Sin estante</option>{targetShelves.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
      </Flex>
      <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
        <FormControl><FormLabel>Documento</FormLabel><Input value={formData.documentNumber} onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })} /></FormControl>
        <FormControl><FormLabel>Fecha</FormLabel><Input type="date" value={formData.transferDate} onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })} /></FormControl>
      </Flex>
      <Box borderWidth="1px" borderRadius="md" p={4}>
        <Flex justify="space-between" align="center" mb={3}>
          <Heading size="sm">Detalle</Heading>
          <Button size="sm" leftIcon={<AddIcon />} onClick={openProductModal}>Agregar existencia</Button>
        </Flex>
        <DetailTable
          columns={[
            { key: 'variantSku', label: 'SKU', render: (row) => row.variantSku || '-' },
            { key: 'productDescription', label: 'Existencia' },
            { key: 'stock', label: 'Stock' },
            { key: 'quantity', label: 'Cantidad' },
          ]}
          rows={formData.details.map((item, index) => ({ ...item, id: index }))}
          actions={(row) => <IconButton aria-label="Quitar" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => setFormData({ ...formData, details: formData.details.filter((_, current) => current !== row.id) })} />}
        />
      </Box>
      <FormControl><FormLabel>Notas</FormLabel><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></FormControl>
      <Modal isOpen={productModalOpen} onClose={() => setProductModalOpen(false)}>
        <ModalOverlay />
        <ModalContent maxW="760px">
          <ModalHeader>Agregar existencia</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl><FormLabel>Buscar existencia</FormLabel><Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Escribe nombre, modelo, SKU o caracteristicas" /></FormControl>
              {productSearch && (
                <Box borderWidth="1px" borderRadius="md" maxH="220px" overflowY="auto">
                  {filteredProducts.map((product) => (
                    <Box key={`${product.productId}-${product.variantId || 'base'}`} p={3} cursor={Number(product.stock || 0) <= 0 ? 'not-allowed' : 'pointer'} opacity={Number(product.stock || 0) <= 0 ? 0.65 : 1} _hover={{ bg: Number(product.stock || 0) <= 0 ? 'red.50' : 'gray.50' }} onClick={() => chooseProduct(product)}>
                      <Text fontWeight="semibold">{productLabel(product)}</Text>
                      <Text fontSize="sm" color={Number(product.stock || 0) <= 0 ? 'red.600' : 'gray.700'}>SKU: {product.variantSku} | Stock: {product.stock} | Unidad: {product.unit || 'unidad'}</Text>
                    </Box>
                  ))}
                </Box>
              )}
              <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
                <FormControl><FormLabel>Cantidad</FormLabel><Input type="number" value={detailDraft.quantity} onChange={(e) => setDetailDraft({ ...detailDraft, quantity: e.target.value })} /></FormControl>
                <FormControl><FormLabel>Stock actual</FormLabel><Input value={selectedProduct?.stock ?? 0} isReadOnly /></FormControl>
              </Flex>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setProductModalOpen(false)}>Cancelar</Button>
            <Button colorScheme="blue" onClick={acceptProduct}>Aceptar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </FormShell>
  )
}

export function SaleList() {
  const { rows, loading, error, load } = useList('/inventory/sales')
  const { locations, shelves } = useOptions()
  const [selectedSale, setSelectedSale] = useState(null)
  const [viewSale, setViewSale] = useState(null)
  const [documentTarget, setDocumentTarget] = useState(null)
  const [whatsappTarget, setWhatsappTarget] = useState(null)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [closeData, setCloseData] = useState({ locationId: '', shelfId: '', documentNumber: '', notes: '' })
  const [documentData, setDocumentData] = useState({
    documentType: 'boleta',
    series: 'B001',
    issueDate: today,
    currency: 'PEN',
    customerDocumentType: 'DNI',
    customerDocumentNumber: '',
    customerName: '',
    customerAddress: '',
  })
  const [saving, setSaving] = useState(false)
  const [viewLoading, setViewLoading] = useState(false)
  const [issuingDocument, setIssuingDocument] = useState(false)
  const [downloadingDocumentId, setDownloadingDocumentId] = useState(null)
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)
  const toast = useToast()
  const selectedShelves = useMemo(() => shelves.filter((item) => String(item.locationId) === String(closeData.locationId)), [shelves, closeData.locationId])

  const openClose = (sale) => {
    setSelectedSale(sale)
    setCloseData({ locationId: locations.length === 1 ? String(locations[0].id) : '', shelfId: '', documentNumber: sale.documentNumber || '', notes: sale.notes || '' })
  }

  const openView = async (sale) => {
    setViewLoading(true)
    try {
      const res = await api.get(`/inventory/sales/${sale.id}`)
      setViewSale(res.data)
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setViewLoading(false)
    }
  }

  const openDocumentModal = async (sale) => {
    setViewLoading(true)
    try {
      const res = await api.get(`/inventory/sales/${sale.id}`)
      const header = res.data.header
      const defaultType = header.customerDocumentType === 'RUC' ? 'factura' : 'boleta'
      setDocumentTarget(header)
      setDocumentData({
        documentType: defaultType,
        series: defaultType === 'factura' ? 'F001' : 'B001',
        issueDate: today,
        currency: 'PEN',
        customerDocumentType: header.customerDocumentType || (defaultType === 'factura' ? 'RUC' : 'DNI'),
        customerDocumentNumber: header.customerDocumentNumber || '',
        customerName: header.customerFullName || header.customerName || 'CLIENTE VARIOS',
        customerAddress: header.customerAddress || '',
      })
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setViewLoading(false)
    }
  }

  const changeDocumentType = (documentType) => {
    setDocumentData((prev) => ({
      ...prev,
      documentType,
      series: documentType === 'factura' ? 'F001' : 'B001',
      customerDocumentType: documentType === 'factura' ? 'RUC' : (prev.customerDocumentType || 'DNI'),
    }))
  }

  const issueDocument = async () => {
    if (!documentTarget) return
    setIssuingDocument(true)
    try {
      const res = await api.post(`/inventory/sales/${documentTarget.id}/documents`, documentData)
      toast({ title: 'Comprobante emitido', description: res.data.fullNumber, status: 'success', duration: 3000, isClosable: true })
      setDocumentTarget(null)
      const saleForWhatsapp = {
        ...documentTarget,
        saleDocumentId: res.data.id,
        saleDocumentNumber: res.data.fullNumber,
        customerName: documentData.customerName,
        customerPhone: documentTarget.customerPhone,
      }
      openWhatsappFlow(saleForWhatsapp)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3500, isClosable: true })
    } finally {
      setIssuingDocument(false)
    }
  }

  const downloadSaleDocument = async (documentId, fullNumber) => {
    setDownloadingDocumentId(documentId)
    try {
      const res = await api.get(`/inventory/sale-documents/${documentId}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `comprobante-${fullNumber || documentId}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
      throw err
    } finally {
      setDownloadingDocumentId(null)
    }
  }

  const sendSaleDocumentByWhatsapp = async (sale, phone) => {
    const whatsappNumber = normalizedWhatsappPhone(phone)
    if (!whatsappNumber) {
      toast({ title: 'Telefono requerido', description: 'Ingresa un numero de WhatsApp valido', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setSendingWhatsapp(true)
    try {
      await downloadSaleDocument(sale.saleDocumentId, sale.saleDocumentNumber)
      const customerName = sale.customerFullName || sale.customerName || 'cliente'
      const message = `Hola ${customerName}, te envio tu comprobante ${sale.saleDocumentNumber}. El PDF se acaba de descargar para adjuntarlo en este chat.`
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      setWhatsappTarget(null)
      setWhatsappPhone('')
    } finally {
      setSendingWhatsapp(false)
    }
  }

  const openWhatsappFlow = (sale) => {
    if (!sale?.saleDocumentId) return
    if (normalizedWhatsappPhone(sale.customerPhone)) {
      sendSaleDocumentByWhatsapp(sale, sale.customerPhone)
      return
    }
    setWhatsappTarget(sale)
    setWhatsappPhone('')
  }

  const closeSale = async () => {
    if (!selectedSale || !closeData.locationId) return
    setSaving(true)
    try {
      await api.post(`/inventory/sales/${selectedSale.id}/close`, closeData)
      toast({ title: 'Venta cerrada', status: 'success', duration: 3000, isClosable: true })
      setSelectedSale(null)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <PageHeader title="Ventas" addTo="/inventory/sales/add" />
      <DataTable
        columns={[
          { key: 'saleDocumentNumber', label: 'Comprobante', render: (row) => row.saleDocumentNumber || '-' },
          { key: 'status', label: 'Estado', render: (row) => row.status === 'preventa' ? 'Preventa' : 'Cerrada' },
          { key: 'customerName', label: 'Cliente', render: (row) => row.customerName || '-' },
          { key: 'locationName', label: 'Ubicacion', render: (row) => row.locationName || '-' },
          { key: 'saleDate', label: 'Fecha', render: (row) => String(row.saleDate).slice(0, 10) },
          { key: 'total', label: 'Total' },
        ]}
        rows={rows}
        loading={loading}
        error={error}
        actions={(row) => (
          <Flex gap={2} wrap="wrap">
            <IconButton aria-label="Ver venta" icon={<ViewIcon />} size="sm" onClick={() => openView(row)} isLoading={viewLoading} />
            {row.saleDocumentId ? (
              <>
                <Tooltip label="Descargar PDF" hasArrow>
                  <IconButton aria-label="Descargar PDF" icon={<PdfIcon />} size="sm" variant="outline" isLoading={downloadingDocumentId === row.saleDocumentId} onClick={() => downloadSaleDocument(row.saleDocumentId, row.saleDocumentNumber)} />
                </Tooltip>
                <Tooltip label="Enviar por WhatsApp" hasArrow>
                  <IconButton aria-label="Enviar por WhatsApp" icon={<WhatsAppIcon />} size="sm" colorScheme="green" variant="outline" isLoading={sendingWhatsapp && whatsappTarget?.id === row.id} onClick={() => openWhatsappFlow(row)} />
                </Tooltip>
              </>
            ) : (
              row.status === 'cerrada' && (
                <Tooltip label="Emitir comprobante" hasArrow>
                  <IconButton aria-label="Emitir comprobante" icon={<ReceiptIcon />} size="sm" variant="outline" onClick={() => openDocumentModal(row)} />
                </Tooltip>
              )
            )}
            {row.status === 'preventa' && <Button size="sm" colorScheme="blue" onClick={() => openClose(row)}>Cerrar venta</Button>}
          </Flex>
        )}
      />
      <Modal isOpen={!!documentTarget} onClose={() => setDocumentTarget(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Emitir comprobante</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
                <FormControl><FormLabel>Tipo</FormLabel><Select value={documentData.documentType} onChange={(e) => changeDocumentType(e.target.value)}><option value="boleta">Boleta</option><option value="factura">Factura</option></Select></FormControl>
                <FormControl><FormLabel>Serie</FormLabel><Input value={documentData.series} onChange={(e) => setDocumentData({ ...documentData, series: e.target.value.toUpperCase() })} /></FormControl>
                <FormControl><FormLabel>Fecha</FormLabel><Input type="date" value={documentData.issueDate} onChange={(e) => setDocumentData({ ...documentData, issueDate: e.target.value })} /></FormControl>
              </Flex>
              <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
                <FormControl><FormLabel>Tipo documento</FormLabel><Select value={documentData.customerDocumentType} onChange={(e) => setDocumentData({ ...documentData, customerDocumentType: e.target.value })}><option value="DNI">DNI</option><option value="RUC">RUC</option><option value="CE">CE</option><option value="OTRO">Otro</option></Select></FormControl>
                <FormControl><FormLabel>Numero documento</FormLabel><Input value={documentData.customerDocumentNumber} onChange={(e) => setDocumentData({ ...documentData, customerDocumentNumber: e.target.value })} /></FormControl>
              </Flex>
              <FormControl isRequired><FormLabel>Cliente</FormLabel><Input value={documentData.customerName} onChange={(e) => setDocumentData({ ...documentData, customerName: e.target.value })} /></FormControl>
              <FormControl><FormLabel>Direccion</FormLabel><Input value={documentData.customerAddress} onChange={(e) => setDocumentData({ ...documentData, customerAddress: e.target.value })} /></FormControl>
              <Box borderWidth="1px" borderRadius="md" p={3}>
                <Flex justify="space-between"><Text>Subtotal</Text><Text>{Number(documentTarget?.subtotal || 0).toFixed(2)}</Text></Flex>
                <Flex justify="space-between"><Text>IGV 18%</Text><Text>{Number(documentTarget?.taxTotal || 0).toFixed(2)}</Text></Flex>
                <Flex justify="space-between" fontWeight="bold"><Text>Total</Text><Text>{Number(documentTarget?.total || 0).toFixed(2)}</Text></Flex>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setDocumentTarget(null)}>Cancelar</Button>
            <Button colorScheme="blue" isLoading={issuingDocument} onClick={issueDocument}>Emitir</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={!!whatsappTarget} onClose={() => setWhatsappTarget(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Enviar comprobante por WhatsApp</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Text>El cliente no tiene telefono registrado. Ingresa el numero para abrir WhatsApp y adjuntar el PDF descargado.</Text>
              <FormControl isRequired>
                <FormLabel>Telefono WhatsApp</FormLabel>
                <Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="Ej. 987654321" />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setWhatsappTarget(null)}>Cancelar</Button>
            <Button colorScheme="green" isLoading={sendingWhatsapp} onClick={() => sendSaleDocumentByWhatsapp(whatsappTarget, whatsappPhone)}>Enviar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={!!viewSale} onClose={() => setViewSale(null)} size="5xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Detalle de venta</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {viewSale && (
              <VStack align="stretch" spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Documento</Text>
                    <Text>{viewSale.header.documentNumber || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Comprobante</Text>
                    <Text>{viewSale.documents?.find((item) => item.status !== 'anulado')?.fullNumber || '-'}</Text>
                    {viewSale.documents?.find((item) => item.status !== 'anulado') ? (
                      <IconButton
                        mt={2}
                        size="xs"
                        aria-label="Enviar por WhatsApp"
                        icon={<WhatsAppIcon />}
                        colorScheme="green"
                        variant="outline"
                        isLoading={sendingWhatsapp}
                        onClick={() => {
                          const document = viewSale.documents.find((item) => item.status !== 'anulado')
                          openWhatsappFlow({
                            ...viewSale.header,
                            saleDocumentId: document.id,
                            saleDocumentNumber: document.fullNumber,
                            customerName: viewSale.header.customerFullName || viewSale.header.customerName,
                          })
                        }}
                      />
                    ) : null}
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Fecha</Text>
                    <Text>{String(viewSale.header.saleDate || '').slice(0, 10)}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Estado</Text>
                    <Text>{viewSale.header.status === 'preventa' ? 'Preventa' : 'Cerrada'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Cliente</Text>
                    <Text>{viewSale.header.customerFullName || viewSale.header.customerName || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Vendedor</Text>
                    <Text>{viewSale.header.sellerName || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Cotizacion</Text>
                    <Text>{viewSale.header.quotationNumber || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Ubicacion</Text>
                    <Text>{viewSale.header.locationName || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Estante</Text>
                    <Text>{viewSale.header.shelfName || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Tipo</Text>
                    <Text>{viewSale.header.saleType === 'formal' ? 'Formal' : 'Directa'}</Text>
                  </Box>
                </SimpleGrid>

                <Box>
                  <Heading size="sm" mb={3}>Productos</Heading>
                  <DetailTable
                    columns={[
                      { key: 'productSku', label: 'SKU', render: (row) => row.productSku || '-' },
                      { key: 'productDescription', label: 'Producto', render: (row) => row.productDescription || row.variantName || '-' },
                      { key: 'unit', label: 'Unidad' },
                      { key: 'quantity', label: 'Cantidad' },
                      { key: 'unitPrice', label: 'Precio' },
                      { key: 'subtotal', label: 'Sub total' },
                      { key: 'taxAmount', label: 'IGV' },
                      { key: 'total', label: 'Total' },
                    ]}
                    rows={viewSale.details}
                  />
                </Box>

                <Flex justify="flex-end">
                  <Box minW={{ base: '100%', md: '280px' }}>
                    <Flex justify="space-between"><Text>Subtotal</Text><Text>{Number(viewSale.header.subtotal || 0).toFixed(2)}</Text></Flex>
                    <Flex justify="space-between"><Text>IGV 18%</Text><Text>{Number(viewSale.header.taxTotal || 0).toFixed(2)}</Text></Flex>
                    <Flex justify="space-between" fontWeight="bold" fontSize="lg"><Text>Total venta</Text><Text>{Number(viewSale.header.total || 0).toFixed(2)}</Text></Flex>
                  </Box>
                </Flex>

                {viewSale.header.notes && (
                  <Box>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Notas</Text>
                    <Text>{viewSale.header.notes}</Text>
                  </Box>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setViewSale(null)}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Cerrar venta oficial</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired><FormLabel>Ubicacion de salida</FormLabel><Select value={closeData.locationId} onChange={(e) => setCloseData({ ...closeData, locationId: e.target.value, shelfId: '' })}><option value="">Selecciona</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
              <FormControl><FormLabel>Estante</FormLabel><Select value={closeData.shelfId} onChange={(e) => setCloseData({ ...closeData, shelfId: e.target.value })}><option value="">Sin estante</option>{selectedShelves.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
              <FormControl><FormLabel>Documento venta</FormLabel><Input value={closeData.documentNumber} onChange={(e) => setCloseData({ ...closeData, documentNumber: e.target.value })} /></FormControl>
              <FormControl><FormLabel>Notas</FormLabel><Textarea value={closeData.notes} onChange={(e) => setCloseData({ ...closeData, notes: e.target.value })} /></FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setSelectedSale(null)}>Cancelar</Button>
            <Button colorScheme="blue" isLoading={saving} onClick={closeSale}>Cerrar venta</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export function SaleForm() {
  return <MovementForm type="sale" />
}

function productLabel(product) {
  if (product.displayName) return product.displayName
  const chars = summarizeAttributes(product.characteristics)
  return `${product.name}${product.model ? ` ${product.model}` : ''}${chars !== '-' ? ` (${chars})` : ''}`
}

function quotationBusinessStatus(quotation) {
  if (quotation.saleStatus === 'cerrada') return 'Venta cerrada'
  if (quotation.saleStatus === 'preventa' || quotation.status === 'aprobada') return 'Preventa'
  return 'Creada'
}

function quotationCanEdit(quotation) {
  return ['creada', 'emitida'].includes(quotation.status || 'emitida') && !quotation.saleStatus
}

function paymentMethodLabel(method) {
  return `${method.companyName} - ${method.name}`
}

const quotationWizardSteps = [
  { id: 1, label: 'Datos', description: 'Cliente y vendedor' },
  { id: 2, label: 'Productos', description: 'Detalle y totales' },
  { id: 3, label: 'Condiciones', description: 'Pago y entrega' },
]

function WizardStepper({ steps, currentStep, onStepClick }) {
  return (
    <Flex gap={2} mb={6} align="stretch" direction={{ base: 'column', md: 'row' }}>
      {steps.map((item, index) => {
        const isActive = currentStep === item.id
        const isComplete = currentStep > item.id
        return (
          <React.Fragment key={item.id}>
            <Button
              type="button"
              variant={isActive ? 'solid' : 'outline'}
              colorScheme={isActive || isComplete ? 'blue' : 'gray'}
              h="auto"
              minH="64px"
              flex="1"
              justifyContent="flex-start"
              px={4}
              py={3}
              onClick={() => onStepClick(item.id)}
            >
              <Flex align="center" gap={3} minW={0}>
                <Flex
                  align="center"
                  justify="center"
                  boxSize="32px"
                  borderRadius="full"
                  bg={isComplete ? 'green.500' : isActive ? 'white' : 'gray.100'}
                  color={isComplete ? 'white' : isActive ? 'blue.600' : 'gray.600'}
                  flexShrink={0}
                  fontWeight="bold"
                >
                  {isComplete ? <CheckIcon boxSize={3} /> : item.id}
                </Flex>
                <Box textAlign="left" minW={0}>
                  <Text fontWeight="semibold" lineHeight="1.1">{item.label}</Text>
                  <Text fontSize="xs" opacity={0.8} noOfLines={1}>{item.description}</Text>
                </Box>
              </Flex>
            </Button>
            {index < steps.length - 1 && (
              <Box display={{ base: 'none', md: 'block' }} w="28px" alignSelf="center" borderTopWidth="2px" borderColor={currentStep > item.id ? 'blue.400' : 'gray.200'} />
            )}
          </React.Fragment>
        )
      })}
    </Flex>
  )
}

export function QuotationList() {
  const { rows, loading, error, load } = useList('/inventory/quotations')
  const [approvingId, setApprovingId] = useState(null)
  const [approvalTarget, setApprovalTarget] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [whatsappTarget, setWhatsappTarget] = useState(null)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const approve = async () => {
    if (!approvalTarget) return
    setApprovingId(approvalTarget.id)
    try {
      await api.post(`/inventory/quotations/${approvalTarget.id}/approve`)
      toast({ title: 'Cotizacion aprobada y convertida en preventa', status: 'success', duration: 3000, isClosable: true })
      setApprovalTarget(null)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setApprovingId(null)
    }
  }

  const downloadPdf = async (quotation, shouldThrow = false) => {
    setDownloadingId(quotation.id)
    try {
      const res = await api.get(`/inventory/quotations/${quotation.id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `cotizacion-${quotation.quotationNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
      if (shouldThrow) throw err
    } finally {
      setDownloadingId(null)
    }
  }

  const sendQuotationByWhatsapp = async (quotation, phone) => {
    const whatsappNumber = normalizedWhatsappPhone(phone)
    if (!whatsappNumber) {
      toast({ title: 'Telefono requerido', description: 'Ingresa un numero de WhatsApp valido', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setSendingWhatsapp(true)
    try {
      await downloadPdf(quotation, true)
      const customerName = quotation.customerName || 'cliente'
      const message = `Hola ${customerName}, te envio la cotizacion ${quotation.quotationNumber}. El PDF se acaba de descargar para adjuntarlo en este chat.`
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      setWhatsappTarget(null)
      setWhatsappPhone('')
    } finally {
      setSendingWhatsapp(false)
    }
  }

  const openQuotationWhatsappFlow = (quotation) => {
    if (normalizedWhatsappPhone(quotation.customerPhone)) {
      sendQuotationByWhatsapp(quotation, quotation.customerPhone)
      return
    }
    setWhatsappTarget(quotation)
    setWhatsappPhone('')
  }

  return (
    <Box>
      <PageHeader title="Cotizaciones" addTo="/inventory/quotations/add" />
      <DataTable
        columns={[
          { key: 'quotationNumber', label: 'Numero' },
          { key: 'quotationDate', label: 'Fecha', render: (row) => String(row.quotationDate).slice(0, 10) },
          { key: 'customerName', label: 'Cliente' },
          { key: 'sellerName', label: 'Vendedor' },
          { key: 'currency', label: 'Moneda' },
          { key: 'status', label: 'Estado', render: (row) => quotationBusinessStatus(row) },
          { key: 'total', label: 'Total' },
        ]}
        rows={rows}
        loading={loading}
        error={error}
        actions={(row) => (
          <Flex gap={2}>
            {quotationCanEdit(row) ? (
              <Tooltip label="Aprobar cotizacion" hasArrow>
                <IconButton aria-label="Aprobar cotizacion" icon={<CheckIcon />} size="sm" colorScheme="green" isLoading={approvingId === row.id} onClick={() => setApprovalTarget(row)} />
              </Tooltip>
            ) : null}
            {quotationCanEdit(row) ? (
              <Tooltip label="Editar cotizacion" hasArrow>
                <IconButton aria-label="Editar cotizacion" icon={<EditIcon />} size="sm" variant="outline" onClick={() => navigate(`/inventory/quotations/edit/${row.id}`)} />
              </Tooltip>
            ) : null}
            <Tooltip label="Descargar PDF" hasArrow>
              <IconButton aria-label="Descargar PDF" icon={<PdfIcon />} size="sm" variant="outline" isLoading={downloadingId === row.id} onClick={() => downloadPdf(row)} />
            </Tooltip>
            <Tooltip label="Enviar por WhatsApp" hasArrow>
              <IconButton aria-label="Enviar por WhatsApp" icon={<WhatsAppIcon />} size="sm" colorScheme="green" variant="outline" isLoading={sendingWhatsapp && whatsappTarget?.id === row.id} onClick={() => openQuotationWhatsappFlow(row)} />
            </Tooltip>
          </Flex>
        )}
      />
      <Modal isOpen={!!whatsappTarget} onClose={() => setWhatsappTarget(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Enviar cotizacion por WhatsApp</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Text>El cliente no tiene telefono registrado o el numero esta incompleto. Ingresa el numero para abrir WhatsApp y adjuntar el PDF descargado.</Text>
              <FormControl isRequired>
                <FormLabel>Telefono WhatsApp</FormLabel>
                <Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="Ej. 987654321" />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setWhatsappTarget(null)}>Cancelar</Button>
            <Button colorScheme="green" isLoading={sendingWhatsapp} onClick={() => sendQuotationByWhatsapp(whatsappTarget, whatsappPhone)}>Enviar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(approvalTarget)}
        title="Aprobar cotizacion"
        message="Esta cotizacion se convertira en una preventa."
        confirmLabel="Aprobar"
        colorScheme="green"
        isLoading={Boolean(approvingId)}
        onClose={() => setApprovalTarget(null)}
        onConfirm={approve}
      />
    </Box>
  )
}

export function QuotationForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const loggedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [])
  const isSellerScoped = ['comercial', 'vendedor_tienda'].includes(loggedUser?.role)
  const [step, setStep] = useState(1)
  const [customers, setCustomers] = useState([])
  const [sellers, setSellers] = useState([])
  const [products, setProducts] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [saving, setSaving] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [detailDraft, setDetailDraft] = useState({ quantity: 1, unitPrice: 0 })
  const [formData, setFormData] = useState({
    quotationNumber: '',
    quotationDate: today,
    currency: 'PEN',
    customerId: '',
    sellerId: isSellerScoped ? String(loggedUser.id || '') : '',
    details: [],
    paymentMethod: '',
    deliveryDate: '',
    deliveryMethod: '',
    comments: '',
  })
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const baseRequests = [
      api.get('/inventory/customers'),
      api.get('/inventory/sellers'),
      api.get('/inventory/sellable-items'),
      api.get('/inventory/payment-methods'),
    ]
    const requests = isEditing
      ? [api.get(`/inventory/quotations/${id}`), ...baseRequests]
      : [api.get('/inventory/quotations/next-number'), ...baseRequests]

    Promise.all(requests).then(([quotationRes, customerRes, sellerRes, productRes, paymentMethodRes]) => {
      if (isEditing) {
        const { header, details } = quotationRes.data
        const editable = quotationCanEdit(header)
        if (!editable) {
          toast({ title: 'No se puede editar', description: 'Solo se puede editar una cotizacion en estado creada', status: 'warning', duration: 3000, isClosable: true })
          navigate('/inventory/quotations')
          return
        }
        setFormData({
          quotationNumber: header.quotationNumber || '',
          quotationDate: String(header.quotationDate || today).slice(0, 10),
          currency: header.currency || 'PEN',
          customerId: String(header.customerId || ''),
          sellerId: isSellerScoped ? String(loggedUser.id || '') : String(header.sellerId || ''),
          details: details.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productDescription: item.productDescription,
            unit: item.unit || 'unidad',
            quantity: Number(item.quantity || 0),
            listPrice: Number(item.listPrice || 0),
            unitPrice: Number(item.unitPrice || 0),
            affectsTax: taxFlag(item.affectsTax) === 1,
          })),
          paymentMethod: header.paymentMethod || '',
          deliveryDate: header.deliveryDate ? String(header.deliveryDate).slice(0, 10) : '',
          deliveryMethod: header.deliveryMethod || '',
          comments: header.comments || '',
        })
      } else {
        setFormData((prev) => ({
          ...prev,
          quotationNumber: quotationRes.data,
          sellerId: isSellerScoped ? String(loggedUser.id || '') : prev.sellerId,
        }))
      }
      setCustomers(customerRes.data)
      setSellers(sellerRes.data)
      setProducts(productRes.data)
      setPaymentMethods(paymentMethodRes.data)
    }).catch((err) => {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    })
  }, [id, isEditing, isSellerScoped, loggedUser.id, navigate, toast])

  useEffect(() => {
    if (!isEditing && isSellerScoped) {
      setFormData((prev) => ({
        ...prev,
        sellerId: isSellerScoped ? String(loggedUser.id || '') : prev.sellerId,
      }))
    }
  }, [isEditing, isSellerScoped, loggedUser.id])

  const totals = formData.details.reduce((acc, item) => {
    const line = taxableLine(item.quantity, item.unitPrice, item.affectsTax)
    return {
      subtotal: acc.subtotal + line.subtotal,
      taxTotal: acc.taxTotal + line.taxAmount,
      total: acc.total + line.total,
    }
  }, { subtotal: 0, taxTotal: 0, total: 0 })

  const filteredProducts = products.filter((product) => {
    const text = `${product.variantSku || product.productSku || ''} ${productLabel(product)}`.toLowerCase()
    return text.includes(productSearch.toLowerCase())
  }).slice(0, 12)

  const activePaymentMethods = paymentMethods.filter((item) => item.estado)
  const paymentCompanies = [...new Set(activePaymentMethods.map((item) => item.companyName))]

  const validateWizardStep = (stepToValidate) => {
    if (stepToValidate === 1 && (!formData.customerId || !formData.sellerId)) {
      toast({ title: 'Completa cliente y vendedor', status: 'warning', duration: 3000, isClosable: true })
      return false
    }
    if (stepToValidate === 2 && !formData.details.length) {
      toast({ title: 'Agrega al menos un producto', status: 'warning', duration: 3000, isClosable: true })
      return false
    }
    return true
  }

  const goToWizardStep = (targetStep) => {
    if (targetStep <= step) {
      setStep(targetStep)
      return
    }
    for (let current = step; current < targetStep; current += 1) {
      if (!validateWizardStep(current)) return
    }
    setStep(targetStep)
  }

  const openProductModal = () => {
    setProductSearch('')
    setSelectedProduct(null)
    setDetailDraft({ quantity: 1, unitPrice: 0 })
    setProductModalOpen(true)
  }

  const chooseProduct = (product) => {
    if (Number(product.stock || 0) <= 0) {
      toast({ title: 'Producto sin stock', description: 'No se puede seleccionar un producto con 0 existencias', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setSelectedProduct(product)
    setProductSearch(productLabel(product))
    setDetailDraft({ quantity: 1, unitPrice: Number(product.salePrice || 0) })
  }

  const acceptProduct = () => {
    if (!selectedProduct) {
      toast({ title: 'Selecciona un producto', status: 'warning', duration: 2500, isClosable: true })
      return
    }
    if (Number(selectedProduct.stock || 0) <= 0) {
      toast({ title: 'Producto sin stock', description: 'No se puede agregar un producto con 0 existencias', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    const quantity = Number(detailDraft.quantity || 0)
    const unitPrice = Number(detailDraft.unitPrice || 0)
    const detail = {
      productId: selectedProduct.productId,
      variantId: selectedProduct.variantId,
      productDescription: productLabel(selectedProduct),
      unit: selectedProduct.unit || 'unidad',
      quantity,
      listPrice: Number(selectedProduct.salePrice || 0),
      unitPrice,
      affectsTax: taxFlag(selectedProduct.affectsTax) === 1,
    }
    setFormData((prev) => ({ ...prev, details: [...prev.details, detail] }))
    setProductModalOpen(false)
  }

  const draftTaxLine = taxableLine(
    detailDraft.quantity,
    detailDraft.unitPrice,
    taxFlag(selectedProduct?.affectsTax) === 1,
  )

  const submit = async () => {
    if (!formData.customerId || !formData.sellerId || !formData.details.length) {
      toast({ title: 'Completa cliente, vendedor y productos', status: 'warning', duration: 3000, isClosable: true })
      return
    }
    setSaving(true)
    try {
      if (isEditing) {
        await api.put(`/inventory/quotations/${id}`, formData)
      } else {
        await api.post('/inventory/quotations', formData)
      }
      toast({ title: isEditing ? 'Cotizacion actualizada' : 'Cotizacion registrada', status: 'success', duration: 3000, isClosable: true })
      navigate('/inventory/quotations')
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <PageHeader title={isEditing ? 'Editar Cotizacion' : 'Crear Cotizacion'} backTo="/inventory/quotations" />
      <Box p={6} bg="white" boxShadow="lg" borderRadius="md">
        <WizardStepper steps={quotationWizardSteps} currentStep={step} onStepClick={goToWizardStep} />

        {step === 1 && (
          <VStack align="stretch" spacing={4}>
            <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
              <FormControl><FormLabel>Numero cotizacion</FormLabel><Input value={formData.quotationNumber} isReadOnly /></FormControl>
              <FormControl><FormLabel>Fecha</FormLabel><Input type="date" value={formData.quotationDate} onChange={(e) => setFormData({ ...formData, quotationDate: e.target.value })} /></FormControl>
              <FormControl><FormLabel>Moneda</FormLabel><Select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })}><option value="PEN">PEN</option><option value="USD">USD</option></Select></FormControl>
            </Flex>
            <FormControl isRequired><FormLabel>Cliente</FormLabel><Select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}><option value="">Selecciona cliente</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
            <FormControl isRequired><FormLabel>Vendedor</FormLabel><Select value={formData.sellerId} onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })} isDisabled={isSellerScoped}><option value="">Selecciona vendedor</option>{sellers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FormControl>
          </VStack>
        )}

        {step === 2 && (
          <VStack align="stretch" spacing={4}>
            <Flex justify="space-between" align="center">
              <Heading size="sm">Productos</Heading>
              <Button leftIcon={<AddIcon />} onClick={openProductModal}>Agregar producto</Button>
            </Flex>
            <DetailTable
              columns={[
                { key: 'productDescription', label: 'Producto' },
                { key: 'unit', label: 'Unidad' },
                { key: 'quantity', label: 'Cantidad' },
                { key: 'listPrice', label: 'Precio real' },
                { key: 'unitPrice', label: 'Precio cotizado' },
                { key: 'subtotal', label: 'Sub total', render: (row) => taxableLine(row.quantity, row.unitPrice, row.affectsTax).subtotal.toFixed(2) },
                { key: 'taxAmount', label: 'IGV', render: (row) => taxableLine(row.quantity, row.unitPrice, row.affectsTax).taxAmount.toFixed(2) },
                { key: 'total', label: 'Total', render: (row) => taxableLine(row.quantity, row.unitPrice, row.affectsTax).total.toFixed(2) },
              ]}
              rows={formData.details.map((item, index) => ({ ...item, id: index }))}
              actions={(row) => <IconButton aria-label="Quitar" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => setFormData({ ...formData, details: formData.details.filter((_, index) => index !== row.id) })} />}
            />
            <Flex justify="flex-end">
              <Box minW="280px">
                <Flex justify="space-between"><Text>Sub total</Text><Text>{totals.subtotal.toFixed(2)}</Text></Flex>
                <Flex justify="space-between"><Text>IGV 18%</Text><Text>{totals.taxTotal.toFixed(2)}</Text></Flex>
                <Flex justify="space-between" fontWeight="bold"><Text>Total a pagar</Text><Text>{totals.total.toFixed(2)}</Text></Flex>
              </Box>
            </Flex>
          </VStack>
        )}

        {step === 3 && (
          <VStack align="stretch" spacing={4}>
            <FormControl><FormLabel>Forma de pago</FormLabel><Select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}><option value="">Selecciona forma de pago</option>{formData.paymentMethod && !activePaymentMethods.some((item) => paymentMethodLabel(item) === formData.paymentMethod) ? <option value={formData.paymentMethod}>{formData.paymentMethod}</option> : null}{paymentCompanies.map((company) => <optgroup key={company} label={company}>{activePaymentMethods.filter((item) => item.companyName === company).map((item) => <option key={item.id} value={paymentMethodLabel(item)}>{item.name}</option>)}</optgroup>)}</Select></FormControl>
            <FormControl><FormLabel>Fecha de entrega</FormLabel><Input type="date" value={formData.deliveryDate} onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })} /></FormControl>
            <FormControl><FormLabel>Forma de entrega</FormLabel><Input value={formData.deliveryMethod} onChange={(e) => setFormData({ ...formData, deliveryMethod: e.target.value })} /></FormControl>
            <FormControl><FormLabel>Comentarios</FormLabel><Textarea value={formData.comments} onChange={(e) => setFormData({ ...formData, comments: e.target.value })} /></FormControl>
          </VStack>
        )}

        <Flex justify="space-between" mt={6}>
          <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} isDisabled={step === 1}>Anterior</Button>
          {step < 3 ? <Button colorScheme="blue" onClick={() => goToWizardStep(step + 1)}>Siguiente</Button> : <Button colorScheme="blue" onClick={submit} isLoading={saving}>{isEditing ? 'Actualizar cotizacion' : 'Guardar cotizacion'}</Button>}
        </Flex>
      </Box>

      <Modal isOpen={productModalOpen} onClose={() => setProductModalOpen(false)}>
        <ModalOverlay />
        <ModalContent maxW="760px">
          <ModalHeader>Agregar producto</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl><FormLabel>Buscar producto</FormLabel><Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Escribe nombre, modelo o caracteristicas" /></FormControl>
              {productSearch && (
                <Box borderWidth="1px" borderRadius="md" maxH="220px" overflowY="auto">
                  {filteredProducts.map((product) => (
                    <Box key={`${product.productId}-${product.variantId || 'base'}`} p={3} cursor={Number(product.stock || 0) <= 0 ? 'not-allowed' : 'pointer'} opacity={Number(product.stock || 0) <= 0 ? 0.65 : 1} _hover={{ bg: Number(product.stock || 0) <= 0 ? 'red.50' : 'gray.50' }} onClick={() => chooseProduct(product)}>
                      <Text fontWeight="semibold">{productLabel(product)}</Text>
                      <Text fontSize="sm" color={Number(product.stock || 0) <= 0 ? 'red.600' : 'gray.700'}>SKU: {product.variantSku} | Stock: {product.stock} | Precio: {product.salePrice} | Unidad: {product.unit || 'unidad'}</Text>
                    </Box>
                  ))}
                </Box>
              )}
              <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
                <FormControl><FormLabel>Precio real</FormLabel><Input value={selectedProduct?.salePrice || 0} isReadOnly /></FormControl>
                <FormControl><FormLabel>Variacion de precio</FormLabel><Input type="number" value={detailDraft.unitPrice} onChange={(e) => setDetailDraft({ ...detailDraft, unitPrice: e.target.value })} /></FormControl>
              </Flex>
              <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
                <FormControl><FormLabel>Unidad de medida</FormLabel><Input value={selectedProduct?.unit || 'unidad'} isReadOnly /></FormControl>
                <FormControl><FormLabel>Cantidad</FormLabel><Input type="number" value={detailDraft.quantity} onChange={(e) => setDetailDraft({ ...detailDraft, quantity: e.target.value })} /></FormControl>
                <FormControl><FormLabel>Total</FormLabel><Input value={draftTaxLine.total.toFixed(2)} isReadOnly /></FormControl>
              </Flex>
              <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
                <FormControl><FormLabel>Sub total sin IGV</FormLabel><Input value={draftTaxLine.subtotal.toFixed(2)} isReadOnly /></FormControl>
                <FormControl><FormLabel>IGV 18%</FormLabel><Input value={draftTaxLine.taxAmount.toFixed(2)} isReadOnly /></FormControl>
                <FormControl><FormLabel>Afecta IGV</FormLabel><Input value={taxFlag(selectedProduct?.affectsTax) === 1 ? 'Si' : 'No'} isReadOnly /></FormControl>
              </Flex>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setProductModalOpen(false)}>Cancelar</Button>
            <Button colorScheme="blue" onClick={acceptProduct}>Aceptar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export function StockList() {
  const { rows, loading, error } = useList('/inventory/stock')
  return (
    <Box>
      <PageHeader title="Existencias" />
      <DataTable
        columns={[
          { key: 'sku', label: 'SKU' },
          { key: 'productName', label: 'Producto' },
          { key: 'variantName', label: 'Existencia', render: (row) => row.variantName || row.productName },
          { key: 'productType', label: 'Tipo' },
          { key: 'locationName', label: 'Ubicacion' },
          { key: 'shelfName', label: 'Estante', render: (row) => row.shelfName || '-' },
          { key: 'quantity', label: 'Existencia' },
        ]}
        rows={rows}
        loading={loading}
        error={error}
      />
    </Box>
  )
}

export function KardexList() {
  const { rows, loading, error } = useList('/inventory/kardex')
  return (
    <Box>
      <PageHeader title="Kardex" />
      <DataTable
        columns={[
          { key: 'createdAt', label: 'Fecha', render: (row) => String(row.createdAt).replace('T', ' ').slice(0, 19) },
          { key: 'movementType', label: 'Movimiento', render: (row) => row.movementType === 'entrada' ? 'Entrada' : row.movementType === 'salida' ? 'Salida' : 'Ajuste' },
          { key: 'sourceType', label: 'Origen doc.', render: (row) => row.sourceType || '-' },
          { key: 'variantSku', label: 'SKU', render: (row) => row.variantSku || row.sku },
          { key: 'variantName', label: 'Existencia', render: (row) => row.variantName || row.productName },
          { key: 'locationName', label: 'Ubicacion' },
          { key: 'shelfName', label: 'Estante', render: (row) => row.shelfName || '-' },
          { key: 'quantity', label: 'Cantidad', render: (row) => row.movementType === 'salida' ? Number(row.quantity) * -1 : row.quantity },
          { key: 'notes', label: 'Notas', render: (row) => row.notes || '-' },
        ]}
        rows={rows}
        loading={loading}
        error={error}
      />
    </Box>
  )
}
