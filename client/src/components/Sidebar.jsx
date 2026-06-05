import React, { useState } from 'react'
import { Box, VStack, Link as ChakraLink, Heading, Button, Divider, IconButton, Text } from '@chakra-ui/react'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, HamburgerIcon } from '@chakra-ui/icons'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { canAccess } from '../utils/access'

function MenuLink({ to, children, collapsed, onNavigate }) {
  return (
    <ChakraLink as={RouterLink} to={to} _hover={{ textDecoration: 'none' }} w="100%" onClick={onNavigate}>
      <Box
        p={2}
        borderRadius="md"
        _hover={{ bg: 'gray.700' }}
        cursor="pointer"
        textAlign={collapsed ? 'center' : 'left'}
        title={collapsed ? String(children) : undefined}
      >
        {collapsed ? String(children).slice(0, 1).toUpperCase() : children}
      </Box>
    </ChakraLink>
  )
}

export default function Sidebar({ user, onLogout, isDrawer = false, onNavigate }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')
  const [inventoryOpen, setInventoryOpen] = useState(() => localStorage.getItem('inventoryMenuOpen') !== 'false')
  const [securityOpen, setSecurityOpen] = useState(() => localStorage.getItem('securityMenuOpen') !== 'false')
  const isAdmin = user?.role === 'admin'
  const isPlatformAdmin = isAdmin && !user?.companySlug
  const effectiveCollapsed = isDrawer ? false : collapsed
  const width = isDrawer ? '100%' : effectiveCollapsed ? '76px' : '250px'

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebarCollapsed', String(!prev))
      return !prev
    })
  }

  const toggleInventory = () => {
    setInventoryOpen((prev) => {
      localStorage.setItem('inventoryMenuOpen', String(!prev))
      return !prev
    })
  }

  const toggleSecurity = () => {
    setSecurityOpen((prev) => {
      localStorage.setItem('securityMenuOpen', String(!prev))
      return !prev
    })
  }

  return (
    <Box
      w={width}
      minW={width}
      bg="gray.800"
      color="white"
      p={effectiveCollapsed ? 3 : 6}
      h={isDrawer ? '100%' : '100vh'}
      overflowY="auto"
      transition="width 0.2s ease, min-width 0.2s ease, padding 0.2s ease"
    >
      <Box display="flex" justifyContent={effectiveCollapsed ? 'center' : 'space-between'} alignItems="center" mb={6} gap={2}>
        {effectiveCollapsed ? (
          <IconButton aria-label="Expandir menu" icon={<HamburgerIcon />} size="sm" variant="ghost" colorScheme="whiteAlpha" onClick={toggleCollapsed} />
        ) : (
          <>
            <Box minW={0}>
              <Heading size="md" noOfLines={1}>
                {user?.name || 'Usuario'}
              </Heading>
              <Text fontSize="xs" color="gray.300" noOfLines={1}>
                {user?.role || 'user'}
              </Text>
            </Box>
            {!isDrawer && <IconButton aria-label="Colapsar menu" icon={<ChevronLeftIcon />} size="sm" variant="ghost" colorScheme="whiteAlpha" onClick={toggleCollapsed} />}
          </>
        )}
      </Box>
      <Divider mb={4} />

      <VStack align="stretch" spacing={effectiveCollapsed ? 2 : 4}>
        <MenuLink to="/dashboard" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Dashboard</MenuLink>

        <Button
          variant="ghost"
          colorScheme="whiteAlpha"
          justifyContent={effectiveCollapsed ? 'center' : 'space-between'}
          px={2}
          mt={effectiveCollapsed ? 0 : 4}
          title={effectiveCollapsed ? 'Inventarios' : undefined}
          onClick={toggleInventory}
        >
          {effectiveCollapsed ? 'I' : 'Inventarios'}
          {!effectiveCollapsed && (inventoryOpen ? <ChevronUpIcon /> : <ChevronDownIcon />)}
        </Button>

        {inventoryOpen && (
          <VStack align="stretch" spacing={effectiveCollapsed ? 2 : 1} pl={effectiveCollapsed ? 0 : 3}>
            {canAccess(user, 'products') && <MenuLink to="/inventory/products" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Productos</MenuLink>}
            {canAccess(user, 'stock') && <MenuLink to="/inventory/stock" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Existencias</MenuLink>}
            {canAccess(user, 'purchases') && <MenuLink to="/inventory/purchases" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Compras</MenuLink>}
            {canAccess(user, 'transfers') && <MenuLink to="/inventory/transfers" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Traslados</MenuLink>}
            {canAccess(user, 'sales') && <MenuLink to="/inventory/sales" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Ventas</MenuLink>}
            {canAccess(user, 'quotations') && <MenuLink to="/inventory/quotations" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Cotizaciones</MenuLink>}
            {canAccess(user, 'paymentMethods') && <MenuLink to="/inventory/payment-methods" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Formas de pago</MenuLink>}
            {canAccess(user, 'kardex') && <MenuLink to="/inventory/kardex" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Kardex</MenuLink>}
            {canAccess(user, 'customers') && <MenuLink to="/inventory/customers" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Clientes</MenuLink>}
            {canAccess(user, 'suppliers') && <MenuLink to="/inventory/suppliers" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Proveedores</MenuLink>}
            {canAccess(user, 'locations') && <MenuLink to="/inventory/locations" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Tiendas y almacenes</MenuLink>}
            {canAccess(user, 'shelves') && <MenuLink to="/inventory/shelves" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Estantes</MenuLink>}
          </VStack>
        )}

        {isAdmin && (
          <>
            <Button
              variant="ghost"
              colorScheme="whiteAlpha"
              justifyContent={effectiveCollapsed ? 'center' : 'space-between'}
              px={2}
              mt={effectiveCollapsed ? 0 : 4}
              title={effectiveCollapsed ? 'Seguridad' : undefined}
              onClick={toggleSecurity}
            >
              {effectiveCollapsed ? 'S' : 'Seguridad'}
              {!effectiveCollapsed && (securityOpen ? <ChevronUpIcon /> : <ChevronDownIcon />)}
            </Button>

            {securityOpen && (
              <VStack align="stretch" spacing={effectiveCollapsed ? 2 : 1} pl={effectiveCollapsed ? 0 : 3}>
                <MenuLink to="/users" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Usuarios</MenuLink>
                {isPlatformAdmin && <MenuLink to="/companies" collapsed={effectiveCollapsed} onNavigate={onNavigate}>Companias</MenuLink>}
              </VStack>
            )}
          </>
        )}
      </VStack>

      <Divider my={4} />

      {effectiveCollapsed ? (
        <IconButton
          aria-label="Expandir menu"
          icon={<ChevronRightIcon />}
          size="sm"
          w="100%"
          mb={2}
          variant="outline"
          colorScheme="whiteAlpha"
          onClick={toggleCollapsed}
        />
      ) : null}
      <Button
        colorScheme="red"
        size="sm"
        w="100%"
        px={effectiveCollapsed ? 0 : 4}
        onClick={() => {
          onLogout()
          navigate('/')
        }}
      >
        {effectiveCollapsed ? 'S' : 'Logout'}
      </Button>
    </Box>
  )
}
