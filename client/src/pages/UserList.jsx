import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Spinner,
  Flex,
  Button,
  Text,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  FormControl,
  FormLabel,
  Input,
  ModalFooter,
  Select,
  SimpleGrid,
} from '@chakra-ui/react'
import { AddIcon, EditIcon, DeleteIcon, UnlockIcon } from '@chakra-ui/icons'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { roleLabels, roleOptionsForAppMode, storeScopedRoles } from '../utils/access'
import ConfirmDialog from '../components/ConfirmDialog'

export default function UserList() {
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [passwordData, setPasswordData] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [page, setPage] = useState(1)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editData, setEditData] = useState({ name: '', email: '', role: 'user', assignedLocationId: '', estado: 1 })
  const toast = useToast()
  const navigate = useNavigate()
  const availableRoleOptions = roleOptionsForAppMode()
  const editRoleOptions = availableRoleOptions.some((role) => role.value === editData.role) || !editData.role
    ? availableRoleOptions
    : [{ value: editData.role, label: roleLabels[editData.role] || editData.role }, ...availableRoleOptions]

  useEffect(() => {
    loadUsers()
    api.get('/inventory/locations')
      .then((res) => setLocations(res.data.filter((item) => item.type === 'tienda')))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setPage(1)
  }, [users.length])

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageUsers = useMemo(() => users.slice((currentPage - 1) * pageSize, currentPage * pageSize), [users, currentPage])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/users')
      setUsers(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await api.delete(`/users/${deleteTarget.id}`)
      toast({ title: 'Usuario eliminado', status: 'success', duration: 3000, isClosable: true })
      setDeleteTarget(null)
      loadUsers()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setDeletingId(null)
    }
  }

  const openEdit = (user) => {
    setSelectedUser(user)
    setEditData({
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      assignedLocationId: user.assignedLocationId || '',
      estado: user.estado ? 1 : 0,
    })
    setIsEditOpen(true)
  }

  const openPassword = (user) => {
    setSelectedUser(user)
    setPasswordData('')
    setIsPasswordOpen(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) return
    setSaving(true)
    try {
      await api.put(`/users/${selectedUser.id}`, {
        name: editData.name,
        email: editData.email,
        role: editData.role,
        assignedLocationId: storeScopedRoles.includes(editData.role) ? editData.assignedLocationId : null,
        estado: Number(editData.estado),
      })
      toast({ title: 'Usuario actualizado', status: 'success', duration: 3000, isClosable: true })
      setIsEditOpen(false)
      setSelectedUser(null)
      loadUsers()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) return
    if (!passwordData) {
      toast({ title: 'Error', description: 'Ingresa una nueva contraseña', status: 'error', duration: 3000, isClosable: true })
      return
    }
    setSaving(true)
    try {
      await api.put(`/users/${selectedUser.id}/password`, { password: passwordData })
      toast({ title: 'Contraseña actualizada', status: 'success', duration: 3000, isClosable: true })
      setIsPasswordOpen(false)
      setSelectedUser(null)
      setPasswordData('')
      loadUsers()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} mb={6} gap={3}>
        <Heading size={{ base: 'md', md: 'lg' }}>Usuarios</Heading>
        <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={() => navigate('/users/add')} alignSelf={{ base: 'stretch', sm: 'auto' }}>
          Agregar +
        </Button>
      </Flex>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Text color="red.500">{error}</Text>
      ) : (
        <Box bg="white" boxShadow="sm" borderRadius="md" p={{ base: 3, md: 4 }}>
          <Box display={{ base: 'none', md: 'block' }} overflowX="auto" overflowY="auto" maxH="560px">
          <Table variant="simple">
            <Thead bg="gray.100" position="sticky" top={0} zIndex={1}>
              <Tr>
                <Th>Nombre</Th>
                <Th>Email</Th>
                <Th>Rol</Th>
                <Th>Tienda</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pageUsers.map((user) => (
                <Tr key={user.id}>
                  <Td>{user.name}</Td>
                  <Td>{user.email}</Td>
                  <Td>{roleLabels[user.role] || user.role || 'Usuario'}</Td>
                  <Td>{user.assignedLocationName || '-'}</Td>
                  <Td>{user.estado ? 'activo' : 'inactivo'}</Td>
                  <Td>
                    <Flex gap={2}>
                      <IconButton aria-label="Editar" icon={<EditIcon />} size="sm" onClick={() => openEdit(user)} />
                      <IconButton aria-label="Eliminar" icon={<DeleteIcon />} size="sm" colorScheme="red" isLoading={deletingId === user.id} onClick={() => setDeleteTarget(user)} />
                      <IconButton aria-label="Cambiar contraseña" icon={<UnlockIcon />} size="sm" colorScheme="yellow" onClick={() => openPassword(user)} />
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          </Box>

          <Flex display={{ base: 'flex', md: 'none' }} direction="column" gap={3} maxH="620px" overflowY="auto">
            {pageUsers.map((user) => (
              <Box key={user.id} borderWidth="1px" borderRadius="md" p={3}>
                <SimpleGrid columns={2} spacing={3}>
                  <Box minW={0}>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Nombre</Text>
                    <Text fontSize="sm" overflowWrap="anywhere">{user.name}</Text>
                  </Box>
                  <Box minW={0}>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Email</Text>
                    <Text fontSize="sm" overflowWrap="anywhere">{user.email}</Text>
                  </Box>
                  <Box minW={0}>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Rol</Text>
                    <Text fontSize="sm">{roleLabels[user.role] || user.role || 'Usuario'}</Text>
                  </Box>
                  <Box minW={0}>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Tienda</Text>
                    <Text fontSize="sm" overflowWrap="anywhere">{user.assignedLocationName || '-'}</Text>
                  </Box>
                  <Box minW={0}>
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">Estado</Text>
                    <Text fontSize="sm">{user.estado ? 'activo' : 'inactivo'}</Text>
                  </Box>
                </SimpleGrid>
                <Flex gap={2} mt={3} pt={3} borderTopWidth="1px">
                  <IconButton aria-label="Editar" icon={<EditIcon />} size="sm" onClick={() => openEdit(user)} />
                  <IconButton aria-label="Eliminar" icon={<DeleteIcon />} size="sm" colorScheme="red" isLoading={deletingId === user.id} onClick={() => setDeleteTarget(user)} />
                  <IconButton aria-label="Cambiar contraseÃ±a" icon={<UnlockIcon />} size="sm" colorScheme="yellow" onClick={() => openPassword(user)} />
                </Flex>
              </Box>
            ))}
          </Flex>

          <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} mt={4} gap={3}>
            <Text fontSize="sm" color="gray.600">
              Indice {currentPage} de {totalPages} | {users.length} registros
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
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Eliminar usuario"
        message="Esta accion eliminara el usuario seleccionado."
        confirmLabel="Eliminar"
        colorScheme="red"
        isLoading={Boolean(deletingId)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Editar usuario</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box as="form" onSubmit={handleEditSubmit}>
              <FormControl mb={4} isRequired>
                <FormLabel>Nombre</FormLabel>
                <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </FormControl>
              <FormControl mb={4} isRequired>
                <FormLabel>Email</FormLabel>
                <Input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
              </FormControl>
              <FormControl mb={4}>
                <FormLabel>Rol</FormLabel>
                <Select value={editData.role} onChange={(e) => setEditData({
                  ...editData,
                  role: e.target.value,
                  assignedLocationId: storeScopedRoles.includes(e.target.value) ? editData.assignedLocationId : '',
                })}>
                  {editRoleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </Select>
              </FormControl>
              {storeScopedRoles.includes(editData.role) && (
                <FormControl mb={4} isRequired>
                  <FormLabel>Tienda asignada</FormLabel>
                  <Select value={editData.assignedLocationId} onChange={(e) => setEditData({ ...editData, assignedLocationId: e.target.value })}>
                    <option value="">Selecciona una tienda</option>
                    {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </Select>
                </FormControl>
              )}
              <FormControl mb={4}>
                <FormLabel>Estado</FormLabel>
                <Select value={editData.estado} onChange={(e) => setEditData({ ...editData, estado: Number(e.target.value) })}>
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </Select>
              </FormControl>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button colorScheme="blue" onClick={handleEditSubmit} isLoading={saving}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isPasswordOpen} onClose={() => setIsPasswordOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Cambiar contraseña</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4} isRequired>
              <FormLabel>Nueva contraseña</FormLabel>
              <Input type="password" value={passwordData} onChange={(e) => setPasswordData(e.target.value)} />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setIsPasswordOpen(false)}>
              Cancelar
            </Button>
            <Button colorScheme="blue" onClick={handlePasswordSubmit} isLoading={saving}>
              Guardar contraseña
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
