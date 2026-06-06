import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Progress,
  SimpleGrid,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
} from '@chakra-ui/react'
import {
  AddIcon,
  ArrowForwardIcon,
  CalendarIcon,
  RepeatIcon,
  StarIcon,
  WarningIcon,
} from '@chakra-ui/icons'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import api from '../services/api'

const today = new Date().toISOString().slice(0, 10)

function formatMoney(value) {
  return Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function monthKey(value) {
  const date = String(value || '').slice(0, 10)
  return date.length >= 7 ? date.slice(0, 7) : ''
}

function monthLabel(key) {
  if (!key) return '-'
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '')
}

function isCurrentMonth(value) {
  return monthKey(value) === today.slice(0, 7)
}

function sumBy(rows, amountKey = 'total') {
  return rows.reduce((sum, row) => sum + Number(row[amountKey] || 0), 0)
}

function groupAmountByMonth(rows, dateKey) {
  return rows.reduce((acc, row) => {
    const key = monthKey(row[dateKey])
    if (!key) return acc
    acc[key] = (acc[key] || 0) + Number(row.total || 0)
    return acc
  }, {})
}

function topBy(rows, nameKey, amountKey = 'total', limit = 5) {
  const totals = rows.reduce((acc, row) => {
    const name = row[nameKey] || 'Sin asignar'
    acc[name] = (acc[name] || 0) + Number(row[amountKey] || 0)
    return acc
  }, {})
  return Object.entries(totals)
    .map(([name, total], index) => ({ id: `${name}-${index}`, name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

function buildMonthlyTrend(sales, purchases) {
  const saleMonths = groupAmountByMonth(sales, 'saleDate')
  const purchaseMonths = groupAmountByMonth(purchases, 'purchaseDate')
  const keys = [...new Set([...Object.keys(saleMonths), ...Object.keys(purchaseMonths)])].sort().slice(-6)
  return keys.map((key) => ({
    key,
    label: monthLabel(key),
    sales: saleMonths[key] || 0,
    purchases: purchaseMonths[key] || 0,
  }))
}

function KpiCard({ label, value, hint, tone = 'blue', icon }) {
  return (
    <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="md" p={4} boxShadow="sm" minH="126px">
      <Flex justify="space-between" gap={3} align="flex-start">
        <Box minW={0}>
          <Text fontSize="sm" color="gray.600" fontWeight="medium">{label}</Text>
          <Heading size="lg" mt={2} lineHeight="1.1" color="gray.800" overflowWrap="anywhere">
            {value}
          </Heading>
        </Box>
        <Flex boxSize="38px" borderRadius="md" bg={`${tone}.50`} color={`${tone}.600`} align="center" justify="center" flexShrink={0}>
          {icon}
        </Flex>
      </Flex>
      {hint && <Text fontSize="xs" color="gray.500" mt={3}>{hint}</Text>}
    </Box>
  )
}

function Panel({ title, action, children, minH }) {
  return (
    <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="md" p={{ base: 3, md: 4 }} boxShadow="sm" minH={minH}>
      <Flex justify="space-between" align="center" mb={4} gap={3}>
        <Heading size="sm" color="gray.800">{title}</Heading>
        {action}
      </Flex>
      {children}
    </Box>
  )
}

function MonthlyBars({ rows }) {
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.sales, row.purchases]))
  if (!rows.length) return <Text color="gray.500">Aun no hay movimientos para graficar.</Text>

  return (
    <VStack align="stretch" spacing={4}>
      {rows.map((row) => (
        <Box key={row.key}>
          <Flex justify="space-between" mb={2} fontSize="sm" color="gray.600">
            <Text fontWeight="semibold" textTransform="capitalize">{row.label}</Text>
            <Text>S/ {formatMoney(row.sales)} / S/ {formatMoney(row.purchases)}</Text>
          </Flex>
          <HStack spacing={3} align="center">
            <Text fontSize="xs" color="green.600" w="52px">Ventas</Text>
            <Progress value={(row.sales / maxValue) * 100} colorScheme="green" borderRadius="full" flex={1} size="sm" />
          </HStack>
          <HStack spacing={3} align="center" mt={2}>
            <Text fontSize="xs" color="blue.600" w="52px">Compras</Text>
            <Progress value={(row.purchases / maxValue) * 100} colorScheme="blue" borderRadius="full" flex={1} size="sm" />
          </HStack>
        </Box>
      ))}
    </VStack>
  )
}

function RankingList({ rows }) {
  const maxValue = Math.max(1, ...rows.map((row) => row.total))
  if (!rows.length) return <Text color="gray.500">Sin ventas registradas.</Text>

  return (
    <VStack align="stretch" spacing={3}>
      {rows.map((row, index) => (
        <Box key={row.id}>
          <Flex justify="space-between" gap={3} mb={1}>
            <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>{index + 1}. {row.name}</Text>
            <Text fontSize="sm" color="gray.600" flexShrink={0}>S/ {formatMoney(row.total)}</Text>
          </Flex>
          <Progress value={(row.total / maxValue) * 100} colorScheme="purple" size="sm" borderRadius="full" />
        </Box>
      ))}
    </VStack>
  )
}

function AlertTable({ rows }) {
  if (!rows.length) {
    return (
      <Alert status="success" borderRadius="md">
        <AlertIcon />
        No hay alertas criticas de inventario por ahora.
      </Alert>
    )
  }

  return (
    <Box overflowX="auto">
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Producto</Th>
            <Th>Ubicacion</Th>
            <Th isNumeric>Stock</Th>
            <Th isNumeric>Minimo</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td maxW="280px">
                <Text fontWeight="semibold" noOfLines={1}>{row.variantName || row.productName}</Text>
                <Text fontSize="xs" color="gray.500">{row.variantSku || row.sku || '-'}</Text>
              </Td>
              <Td>{row.locationName || '-'}</Td>
              <Td isNumeric>
                <Badge colorScheme={Number(row.quantity || 0) <= 0 ? 'red' : 'orange'}>{row.quantity}</Badge>
              </Td>
              <Td isNumeric>{row.minStock}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  )
}

function ActivityList({ rows }) {
  if (!rows.length) return <Text color="gray.500">Sin actividad reciente.</Text>

  return (
    <VStack align="stretch" spacing={3}>
      {rows.map((row) => (
        <Flex key={row.id} justify="space-between" align="center" gap={3} borderBottomWidth="1px" borderColor="gray.100" pb={3}>
          <Box minW={0}>
            <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>{row.title}</Text>
            <Text fontSize="xs" color="gray.500">{row.description}</Text>
          </Box>
          <Badge colorScheme={row.tone}>{row.label}</Badge>
        </Flex>
      ))}
    </VStack>
  )
}

function QuickAction({ label, to, icon, colorScheme = 'blue' }) {
  const navigate = useNavigate()
  return (
    <Button
      justifyContent="space-between"
      rightIcon={<ArrowForwardIcon />}
      leftIcon={icon}
      colorScheme={colorScheme}
      variant="outline"
      h="44px"
      onClick={() => navigate(to)}
    >
      {label}
    </Button>
  )
}

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [data, setData] = useState({
    sales: [],
    purchases: [],
    stock: [],
    quotations: [],
    kardex: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) setUser(JSON.parse(userData))
  }, [])

  useEffect(() => {
    let alive = true
    async function loadDashboard() {
      setLoading(true)
      try {
        const [sales, purchases, stock, quotations, kardex] = await Promise.all([
          api.get('/inventory/sales'),
          api.get('/inventory/purchases'),
          api.get('/inventory/stock'),
          api.get('/inventory/quotations'),
          api.get('/inventory/kardex'),
        ])
        if (!alive) return
        setData({
          sales: sales.data || [],
          purchases: purchases.data || [],
          stock: stock.data || [],
          quotations: quotations.data || [],
          kardex: kardex.data || [],
        })
        setError(null)
      } catch (err) {
        if (alive) setError(err.response?.data?.error || err.message)
      } finally {
        if (alive) setLoading(false)
      }
    }
    loadDashboard()
    return () => {
      alive = false
    }
  }, [])

  const metrics = useMemo(() => {
    const closedSales = data.sales.filter((row) => row.status === 'cerrada')
    const todaySales = closedSales.filter((row) => String(row.saleDate || '').slice(0, 10) === today)
    const monthPurchases = data.purchases.filter((row) => isCurrentMonth(row.purchaseDate))
    const stockValue = data.stock.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.costPrice || 0), 0)
    const lowStock = data.stock.filter((row) => Number(row.quantity || 0) <= Number(row.minStock || 0))
    const pendingQuotations = data.quotations.filter((row) => !row.saleStatus && ['creada', 'emitida'].includes(row.status || 'emitida'))
    const totalUnits = data.stock.reduce((sum, row) => sum + Number(row.quantity || 0), 0)

    return {
      todaySalesAmount: sumBy(todaySales),
      todaySalesCount: todaySales.length,
      monthPurchasesAmount: sumBy(monthPurchases),
      monthPurchasesCount: monthPurchases.length,
      stockValue,
      totalUnits,
      lowStock,
      pendingQuotations,
      closedSales,
    }
  }, [data])

  const monthlyRows = useMemo(() => buildMonthlyTrend(metrics.closedSales, data.purchases), [metrics.closedSales, data.purchases])
  const topCustomers = useMemo(() => topBy(metrics.closedSales, 'customerName'), [metrics.closedSales])
  const recentActivity = useMemo(() => {
    const sales = data.sales.slice(0, 4).map((row) => ({
      id: `sale-${row.id}`,
      title: row.customerName || row.quotationNumber || 'Venta',
      description: `${String(row.saleDate || '').slice(0, 10)} | S/ ${formatMoney(row.total)} | ${row.locationName || 'Sin ubicacion'}`,
      label: row.status || 'venta',
      tone: row.status === 'cerrada' ? 'green' : 'yellow',
    }))
    const purchases = data.purchases.slice(0, 4).map((row) => ({
      id: `purchase-${row.id}`,
      title: row.supplierName || 'Compra',
      description: `${String(row.purchaseDate || '').slice(0, 10)} | S/ ${formatMoney(row.total)} | ${row.locationName || 'Sin ubicacion'}`,
      label: 'compra',
      tone: 'blue',
    }))
    return [...sales, ...purchases].slice(0, 6)
  }, [data.sales, data.purchases])

  return (
    <DashboardLayout>
      <Box>
        <Flex
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="md"
          p={{ base: 4, md: 5 }}
          boxShadow="sm"
          justify="space-between"
          align={{ base: 'stretch', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
          gap={4}
          mb={5}
        >
          <Box>
            <Text color="gray.500" fontSize="sm">Panel ejecutivo</Text>
            <Heading size={{ base: 'md', md: 'lg' }} color="gray.800" mt={1}>
              Bienvenido{user ? `, ${user.name}` : ''}
            </Heading>
            <Text color="gray.600" mt={2}>Resumen operativo de ventas, compras e inventario.</Text>
          </Box>
          <HStack spacing={3} align="center">
            <Badge colorScheme="blue" px={3} py={2} borderRadius="md">
              {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Badge>
            {loading && <Spinner size="sm" />}
          </HStack>
        </Flex>

        {error && (
          <Alert status="warning" borderRadius="md" mb={5}>
            <AlertIcon />
            {error}
          </Alert>
        )}

        <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4} mb={5}>
          <KpiCard
            label="Ventas de hoy"
            value={`S/ ${formatMoney(metrics.todaySalesAmount)}`}
            hint={`${metrics.todaySalesCount} operaciones cerradas`}
            tone="green"
            icon={<StarIcon />}
          />
          <KpiCard
            label="Compras del mes"
            value={`S/ ${formatMoney(metrics.monthPurchasesAmount)}`}
            hint={`${metrics.monthPurchasesCount} documentos registrados`}
            tone="blue"
            icon={<CalendarIcon />}
          />
          <KpiCard
            label="Stock valorizado"
            value={`S/ ${formatMoney(metrics.stockValue)}`}
            hint={`${metrics.totalUnits} unidades en inventario`}
            tone="purple"
            icon={<RepeatIcon />}
          />
          <KpiCard
            label="Alertas de stock"
            value={metrics.lowStock.length}
            hint={`${metrics.pendingQuotations.length} cotizaciones pendientes`}
            tone={metrics.lowStock.length ? 'orange' : 'green'}
            icon={<WarningIcon />}
          />
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4} mb={5}>
          <Box gridColumn={{ base: 'auto', xl: 'span 2' }}>
            <Panel title="Ventas vs compras" minH="380px">
              <MonthlyBars rows={monthlyRows} />
            </Panel>
          </Box>
          <Panel title="Accesos rapidos" minH="380px">
            <SimpleGrid columns={{ base: 1, sm: 2, xl: 1 }} spacing={3}>
              <QuickAction label="Nueva venta" to="/inventory/sales/add" icon={<AddIcon />} colorScheme="green" />
              <QuickAction label="Nueva compra" to="/inventory/purchases/add" icon={<AddIcon />} colorScheme="blue" />
              <QuickAction label="Nuevo producto" to="/inventory/products/add" icon={<AddIcon />} colorScheme="purple" />
              <QuickAction label="Nueva cotizacion" to="/inventory/quotations/add" icon={<AddIcon />} colorScheme="orange" />
              <QuickAction label="Ver Kardex" to="/inventory/kardex" icon={<RepeatIcon />} colorScheme="gray" />
            </SimpleGrid>
          </Panel>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4} mb={5}>
          <Panel
            title="Stock critico"
            action={(
              <Tooltip label="Ver reporte de reposicion">
                <IconButton aria-label="Ver reporte de reposicion" icon={<ArrowForwardIcon />} size="sm" variant="outline" as="a" href="/inventory/reports/low-stock" />
              </Tooltip>
            )}
          >
            <AlertTable rows={metrics.lowStock.slice(0, 6)} />
          </Panel>
          <Panel title="Top clientes">
            <RankingList rows={topCustomers} />
          </Panel>
        </SimpleGrid>

        <Panel title="Actividad reciente">
          <ActivityList rows={recentActivity} />
        </Panel>
      </Box>
    </DashboardLayout>
  )
}
