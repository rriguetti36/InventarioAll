import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  IconButton,
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
  Th,
  Thead,
  Tooltip,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { AddIcon, CheckIcon, DeleteIcon, RepeatIcon } from '@chakra-ui/icons'
import api from '../services/api'

function formatMoney(value) {
  return Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function lineTotal(item) {
  const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0)
  return Math.max(0, gross - Number(item.discountAmount || 0))
}

function taxableLine(item) {
  const total = lineTotal(item)
  if (Number(item.affectsTax ?? 1) !== 1) return { subtotal: total, taxAmount: 0, total }
  const subtotal = total / 1.18
  return { subtotal, taxAmount: total - subtotal, total }
}

function ticketDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeWhatsappPhone(value) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length % 2 === 0) {
    const half = digits.length / 2
    if (digits.slice(0, half) === digits.slice(half)) digits = digits.slice(0, half)
  }
  while (digits.startsWith('5151') && digits.length > 11) {
    digits = digits.slice(2)
  }
  if (digits.startsWith('0') && digits.length === 10) digits = digits.slice(1)
  if (digits.length === 9) return `51${digits}`
  if (digits.startsWith('51') && digits.length === 11) return digits
  return digits
}

function displayWhatsappPhone(value) {
  const normalized = normalizeWhatsappPhone(value)
  return normalized || 'Sin numero'
}

function receiptTypeLabel(value) {
  const labels = {
    boleta: 'Boleta Electronica',
    factura: 'Factura Electronica',
    ticket: 'Ticket interno',
  }
  return labels[value] || 'Comprobante'
}

function paymentNeedsVoucher(methodName) {
  const normalized = String(methodName || '').toLowerCase()
  return ['yape', 'plin', 'transferencia', 'deposito', 'depósito'].some((term) => normalized.includes(term))
}

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

function buildTicketText(ticket) {
  const sale = ticket?.sale || {}
  const items = ticket?.items || []
  const payments = ticket?.payments || []
  const showTax = sale.receiptType !== 'boleta'
  const lines = [
    sale.locationName || 'Tienda',
    `POS ${sale.terminalName || ''}`.trim(),
    `${receiptTypeLabel(sale.receiptType)} ${sale.receiptFullNumber || sale.id || ''}`.trim(),
    `Fecha: ${ticketDate(sale.saleDate)}`,
    `Cliente: ${sale.customerName || 'Cliente varios'}`,
    '------------------------------',
    ...items.map((item) => `${Number(item.quantity || 0)} x ${item.productDescription} S/ ${formatMoney(item.total)}`),
    '------------------------------',
    showTax ? `Subtotal: S/ ${formatMoney(sale.subtotal)}` : '',
    showTax ? `IGV: S/ ${formatMoney(sale.taxTotal)}` : '',
    `Total: S/ ${formatMoney(sale.total)}`,
    `Pagado: S/ ${formatMoney(sale.paidTotal)}`,
    `Vuelto: S/ ${formatMoney(sale.changeAmount)}`,
    payments.length ? `Pago: ${payments.map((payment) => payment.methodName).join(', ')}` : '',
    'Gracias por su compra',
  ]
  return lines.filter(Boolean).join('\n')
}

function buildTicketHtml(ticket) {
  const sale = ticket?.sale || {}
  const items = ticket?.items || []
  const payments = ticket?.payments || []
  const showTax = sale.receiptType !== 'boleta'
  const itemRows = items.map((item) => `
    <tr>
      <td colspan="3">${escapeHtml(item.productDescription)}</td>
    </tr>
    <tr>
      <td>${formatMoney(item.quantity)}</td>
      <td>S/ ${formatMoney(item.unitPrice)}</td>
      <td class="right">S/ ${formatMoney(item.total)}</td>
    </tr>
  `).join('')

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(sale.receiptFullNumber || 'Ticket POS')}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          * { box-sizing: border-box; }
          body { width: 72mm; margin: 0; font-family: Consolas, "Courier New", monospace; font-size: 11px; color: #111; }
          h1, h2, p { margin: 0; text-align: center; }
          h1 { font-size: 15px; }
          h2 { font-size: 12px; margin-top: 2px; }
          .meta { margin: 8px 0; }
          .line { border-top: 1px dashed #111; margin: 7px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; vertical-align: top; }
          .right { text-align: right; }
          .total { font-size: 14px; font-weight: 700; }
          .thanks { margin-top: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(sale.locationName || 'Tienda')}</h1>
        <h2>${escapeHtml(sale.terminalName || 'POS')}</h2>
        <div class="line"></div>
        <div class="meta">
          <div>${escapeHtml(receiptTypeLabel(sale.receiptType))}: ${escapeHtml(sale.receiptFullNumber || sale.id || '')}</div>
          <div>Fecha: ${escapeHtml(ticketDate(sale.saleDate))}</div>
          <div>Vendedor: ${escapeHtml(sale.sellerName || '')}</div>
          <div>Cliente: ${escapeHtml(sale.customerName || 'Cliente varios')}</div>
        </div>
        <div class="line"></div>
        <table>${itemRows}</table>
        <div class="line"></div>
        <table>
          ${showTax ? `<tr><td>Subtotal</td><td class="right">S/ ${formatMoney(sale.subtotal)}</td></tr>` : ''}
          ${showTax ? `<tr><td>IGV</td><td class="right">S/ ${formatMoney(sale.taxTotal)}</td></tr>` : ''}
          <tr><td>Descuento</td><td class="right">S/ ${formatMoney(sale.discountTotal)}</td></tr>
          <tr class="total"><td>Total</td><td class="right">S/ ${formatMoney(sale.total)}</td></tr>
          <tr><td>Pagado</td><td class="right">S/ ${formatMoney(sale.paidTotal)}</td></tr>
          <tr><td>Vuelto</td><td class="right">S/ ${formatMoney(sale.changeAmount)}</td></tr>
        </table>
        ${payments.length ? `<div class="meta">Pago: ${escapeHtml(payments.map((payment) => payment.methodName).join(', '))}</div>` : ''}
        <div class="line"></div>
        <p class="thanks">Gracias por su compra</p>
        <script>window.onload = () => { window.focus(); window.print(); };</script>
      </body>
    </html>
  `
}

function SummaryBox({ label, value, tone = 'subtotal' }) {
  const palette = {
    subtotal: { bg: 'blue.50', border: 'blue.200', text: 'blue.800' },
    tax: { bg: 'orange.50', border: 'orange.200', text: 'orange.800' },
    discount: { bg: 'purple.50', border: 'purple.200', text: 'purple.800' },
    total: { bg: 'green.50', border: 'green.300', text: 'green.800' },
  }
  const color = palette[tone] || palette.subtotal
  return (
    <Box bg={color.bg} borderWidth="1px" borderColor={color.border} borderRadius="md" p={4}>
      <Text fontSize="sm" color={color.text} fontWeight="semibold">{label}</Text>
      <Heading size="md" mt={1} color={color.text}>{value}</Heading>
    </Box>
  )
}

function SectionCard({ title, accent = 'blue', children, ...props }) {
  const colors = {
    blue: { bg: 'blue.50', border: 'blue.300', title: 'blue.800' },
    teal: { bg: 'teal.50', border: 'teal.300', title: 'teal.800' },
    green: { bg: 'green.50', border: 'green.300', title: 'green.800' },
    orange: { bg: 'orange.50', border: 'orange.300', title: 'orange.800' },
    red: { bg: 'red.50', border: 'red.300', title: 'red.800' },
    purple: { bg: 'purple.50', border: 'purple.300', title: 'purple.800' },
  }
  const color = colors[accent] || colors.blue
  return (
    <Box bg="white" borderWidth="1px" borderColor={color.border} borderRadius="md" overflow="hidden" boxShadow="sm" {...props}>
      <Box bg={color.bg} borderBottomWidth="1px" borderColor={color.border} px={4} py={3}>
        <Heading size="md" color={color.title}>{title}</Heading>
      </Box>
      <Box p={4}>
        {children}
      </Box>
    </Box>
  )
}

export default function Pos() {
  const toast = useToast()
  const loggedUser = useMemo(() => storedUser(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingVoucher, setUploadingVoucher] = useState(false)
  const [terminals, setTerminals] = useState([])
  const [locations, setLocations] = useState([])
  const [openShift, setOpenShift] = useState(null)
  const [items, setItems] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [customers, setCustomers] = useState([])
  const [sales, setSales] = useState([])
  const [salesSummary, setSalesSummary] = useState({ totals: { saleCount: 0, total: 0 }, terminals: [] })
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [selected, setSelected] = useState({
    terminalId: '',
    openingCash: 0,
    customerId: '',
    customerPhone: '',
    receiptType: 'boleta',
    paymentMethodId: '',
    paidAmount: '',
    paymentReferenceNumber: '',
    paymentVoucherUrl: '',
  })
  const [terminalForm, setTerminalForm] = useState({ id: null, locationId: '', name: 'Caja principal', code: 'POS-01', receiptSeries: 'T001', defaultPaymentMethodId: '', estado: 1 })
  const [cashMovement, setCashMovement] = useState({ movementType: 'withdrawal', amount: '', reason: '', authorizerEmail: '', authorizerPassword: '' })
  const [closeData, setCloseData] = useState({ countedCash: '', notes: '', authorizerEmail: '', authorizerPassword: '' })
  const [activeModal, setActiveModal] = useState(null)
  const [lastTicket, setLastTicket] = useState(null)
  const canManageTerminals = ['admin', 'administrativo', 'admin_tienda'].includes(loggedUser.role)
  const requiresSupervisorAuth = loggedUser.role === 'vendedor_tienda'
  const cashMovementNeedsApproval = requiresSupervisorAuth && ['withdrawal', 'expense', 'adjustment'].includes(cashMovement.movementType)

  const totals = useMemo(() => cart.reduce((acc, item) => {
    const line = taxableLine(item)
    return {
      subtotal: acc.subtotal + line.subtotal,
      discountTotal: acc.discountTotal + Number(item.discountAmount || 0),
      taxTotal: acc.taxTotal + line.taxAmount,
      total: acc.total + line.total,
    }
  }, { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }), [cart])

  const recentSalesTotal = useMemo(() => sales.reduce((acc, sale) => acc + Number(sale.total || 0), 0), [sales])

  const paidAmount = selected.paidAmount === '' ? totals.total : Number(selected.paidAmount || 0)
  const changeAmount = Math.max(0, paidAmount - totals.total)
  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((item) => String(item.id) === String(selected.paymentMethodId)),
    [paymentMethods, selected.paymentMethodId],
  )
  const requiresPaymentVoucher = paymentNeedsVoucher(selectedPaymentMethod?.name)

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return items.filter((item) => [
      item.productSku,
      item.variantSku,
      item.name,
      item.displayName,
      item.model,
    ].some((value) => String(value || '').toLowerCase().includes(q))).slice(0, 30)
  }, [items, search])

  const findExactItem = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) return null
    return items.find((item) => [
      item.variantSku,
      item.productSku,
    ].some((candidate) => String(candidate || '').trim().toLowerCase() === normalized)) || null
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [{ data }, salesResult, summaryResult] = await Promise.all([
        api.get('/pos/bootstrap'),
        api.get('/pos/sales'),
        api.get('/pos/sales/daily-summary'),
      ])
      setTerminals(data.terminals || [])
      setLocations(data.locations || [])
      setOpenShift(data.openShift || null)
      setItems(data.sellableItems || [])
      setPaymentMethods(data.paymentMethods || [])
      setCustomers(data.customers || [])
      setSales(salesResult.data || [])
      setSalesSummary(summaryResult.data || { totals: { saleCount: 0, total: 0 }, terminals: [] })
      setSelected((prev) => ({
        ...prev,
        terminalId: data.openShift?.terminalId || data.terminals?.[0]?.id || '',
        paymentMethodId: data.paymentMethods?.[0]?.id || '',
      }))
      setTerminalForm((prev) => ({ ...prev, locationId: data.locations?.[0]?.id || prev.locationId, defaultPaymentMethodId: data.paymentMethods?.[0]?.id || prev.defaultPaymentMethodId }))
    } catch (err) {
      toast({ title: err.response?.data?.error || err.message, status: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const addItem = (item) => {
    const key = `${item.productId}-${item.variantId || 'base'}`
    setCart((prev) => {
      const existing = prev.find((row) => row.key === key)
      if (existing) {
        return prev.map((row) => row.key === key ? { ...row, quantity: Number(row.quantity || 0) + 1 } : row)
      }
      return [
        ...prev,
        {
          key,
          productId: item.productId,
          variantId: item.variantId,
          productDescription: item.displayName || item.name,
          unit: item.unit || 'unidad',
          quantity: 1,
          unitPrice: Number(item.salePrice || 0),
          discountAmount: 0,
          affectsTax: item.affectsTax ?? 1,
          stock: Number(item.stock || 0),
        },
      ]
    })
  }

  const addItemAndClearSearch = (item) => {
    addItem(item)
    setSearch('')
  }

  const handleSearchChange = (value) => {
    setSearch(value)
    const exactItem = findExactItem(value)
    if (exactItem) {
      addItem(exactItem)
      setSearch('')
    }
  }

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const exactItem = findExactItem(search)
    if (exactItem) {
      addItemAndClearSearch(exactItem)
      return
    }
    if (filteredItems.length === 1) {
      addItemAndClearSearch(filteredItems[0])
    }
  }

  const updateCart = (key, field, value) => {
    setCart((prev) => prev.map((item) => item.key === key ? { ...item, [field]: value } : item))
  }

  const removeCart = (key) => {
    setCart((prev) => prev.filter((item) => item.key !== key))
  }

  const handleCustomerChange = (customerId) => {
    const customer = customers.find((item) => String(item.id) === String(customerId))
    setSelected((prev) => ({
      ...prev,
      customerId,
      customerPhone: customer?.phone || '',
    }))
  }

  const openCashShift = async () => {
    setSaving(true)
    try {
      const { data } = await api.post('/pos/shifts/open', {
        terminalId: selected.terminalId,
        openingCash: Number(selected.openingCash || 0),
      })
      setOpenShift(data)
      toast({ title: 'Caja abierta', status: 'success' })
      await loadData()
    } catch (err) {
      toast({ title: err.response?.data?.error || err.message, status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const createTerminal = async () => {
    setSaving(true)
    try {
      if (terminalForm.id) {
        await api.put(`/pos/terminals/${terminalForm.id}`, terminalForm)
        toast({ title: 'Caja actualizada', status: 'success' })
      } else {
        await api.post('/pos/terminals', terminalForm)
        toast({ title: 'Caja creada', status: 'success' })
      }
      setTerminalForm({
        id: null,
        locationId: locations[0]?.id || '',
        name: 'Caja principal',
        code: 'POS-01',
        receiptSeries: 'T001',
        defaultPaymentMethodId: paymentMethods[0]?.id || '',
        estado: 1,
      })
      await loadData()
    } catch (err) {
      toast({ title: err.response?.data?.error || err.message, status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const editTerminal = (terminal) => {
    setTerminalForm({
      id: terminal.id,
      locationId: terminal.locationId || '',
      name: terminal.name || '',
      code: terminal.code || '',
      receiptSeries: terminal.receiptSeries || '',
      defaultPaymentMethodId: terminal.defaultPaymentMethodId || '',
      estado: terminal.estado ? 1 : 0,
    })
    setActiveModal('terminals')
  }

  const uploadVoucher = async (file) => {
    if (!file) return
    setUploadingVoucher(true)
    try {
      const { data } = await api.post('/uploads/pos-voucher', file, {
        headers: { 'Content-Type': file.type || 'image/jpeg' },
      })
      setSelected((prev) => ({ ...prev, paymentVoucherUrl: data.url }))
      toast({ title: 'Voucher cargado', status: 'success' })
    } catch (err) {
      toast({ title: err.response?.data?.error || err.message, status: 'error' })
    } finally {
      setUploadingVoucher(false)
    }
  }

  const createSale = async () => {
    if (!openShift) return
    const method = paymentMethods.find((item) => String(item.id) === String(selected.paymentMethodId))
    const customer = customers.find((item) => String(item.id) === String(selected.customerId))
    const amount = paidAmount
    const customerPhone = selected.customerPhone ? normalizeWhatsappPhone(selected.customerPhone) : null
    if (selected.receiptType === 'factura' && !customer) {
      toast({ title: 'Selecciona un cliente para emitir factura', status: 'warning' })
      return
    }
    if (requiresPaymentVoucher && (!selected.paymentReferenceNumber || !selected.paymentVoucherUrl)) {
      toast({ title: 'Registra numero de operacion y foto del voucher', status: 'warning' })
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post('/pos/sales', {
        shiftId: openShift.id,
        customerId: selected.customerId || null,
        customerNameSnapshot: customer?.name || null,
        customerPhone,
        receiptType: selected.receiptType,
        items: cart,
        payments: [{
          paymentMethodId: method?.id || null,
          methodName: method?.name || 'Contado',
          amount,
          referenceNumber: selected.paymentReferenceNumber || null,
          voucherImageUrl: selected.paymentVoucherUrl || null,
        }],
      })
      setCart([])
      setSelected((prev) => ({ ...prev, customerId: '', customerPhone: '', receiptType: 'boleta', paidAmount: '', paymentReferenceNumber: '', paymentVoucherUrl: '' }))
      setLastTicket(data)
      setActiveModal('ticket')
      toast({ title: 'Venta registrada', status: 'success' })
      await loadData()
    } catch (err) {
      toast({ title: err.response?.data?.error || err.message, status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const printTicket = (ticket) => {
    if (!ticket) return
    const printWindow = window.open('', '_blank', 'width=360,height=640')
    if (!printWindow) {
      toast({ title: 'El navegador bloqueo la ventana de impresion', status: 'warning' })
      return
    }
    printWindow.document.open()
    printWindow.document.write(buildTicketHtml(ticket))
    printWindow.document.close()
  }

  const sendWhatsapp = (ticket) => {
    if (!ticket) return
    const phone = normalizeWhatsappPhone(ticket.sale?.customerPhone)
    if (!phone) {
      toast({ title: 'Registra el WhatsApp del cliente antes de enviar', status: 'warning' })
      return
    }
    const message = encodeURIComponent(buildTicketText(ticket))
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  const downloadReceiptPdf = async (ticket) => {
    const saleId = ticket?.sale?.id
    if (!saleId) return null
    const response = await api.get(`/pos/sales/${saleId}/pdf`, { responseType: 'blob' })
    const filename = `${ticket.sale?.receiptFullNumber || `POS-${saleId}`}.pdf`
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    return filename
  }

  const sendWhatsappWithPdf = async (ticket) => {
    if (!ticket) return
    const phone = normalizeWhatsappPhone(ticket.sale?.customerPhone)
    if (!phone) {
      toast({ title: 'Registra el WhatsApp del cliente antes de enviar', status: 'warning' })
      return
    }
    try {
      const filename = await downloadReceiptPdf(ticket)
      const message = encodeURIComponent([
        `Hola, te enviamos tu comprobante ${ticket.sale?.receiptFullNumber || ''}.`,
        filename ? `Adjunta el archivo descargado: ${filename}` : '',
      ].filter(Boolean).join('\n'))
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer')
      toast({ title: 'PDF generado', description: 'WhatsApp Web no permite adjuntar automaticamente; adjunta el PDF descargado en el chat.', status: 'info', duration: 6500, isClosable: true })
    } catch (err) {
      toast({ title: err.response?.data?.error || err.message, status: 'error' })
    }
  }

  const registerCashMovement = async () => {
    if (!openShift) return
    setSaving(true)
    try {
      await api.post('/pos/cash-movements', { ...cashMovement, shiftId: openShift.id })
      setCashMovement({ movementType: 'withdrawal', amount: '', reason: '', authorizerEmail: '', authorizerPassword: '' })
      setActiveModal(null)
      toast({ title: 'Movimiento registrado', status: 'success' })
    } catch (err) {
      toast({ title: err.response?.data?.error || err.message, status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const closeShift = async () => {
    if (!openShift) return
    setSaving(true)
    try {
      await api.post(`/pos/shifts/${openShift.id}/close`, closeData)
      setOpenShift(null)
      setCart([])
      setCloseData({ countedCash: '', notes: '', authorizerEmail: '', authorizerPassword: '' })
      setActiveModal(null)
      toast({ title: 'Caja cerrada', status: 'success' })
      await loadData()
    } catch (err) {
      toast({ title: err.response?.data?.error || err.message, status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <Box>
      {!openShift && terminals.length === 0 ? (
        <SectionCard title="Configurar terminal POS" accent="purple" maxW="760px">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <FormControl>
              <FormLabel>Tienda</FormLabel>
              <Select value={terminalForm.locationId} onChange={(e) => setTerminalForm((prev) => ({ ...prev, locationId: e.target.value }))}>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Nombre</FormLabel>
              <Input value={terminalForm.name} onChange={(e) => setTerminalForm((prev) => ({ ...prev, name: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Codigo</FormLabel>
              <Input value={terminalForm.code} onChange={(e) => setTerminalForm((prev) => ({ ...prev, code: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel>Serie ticket interno</FormLabel>
              <Input value={terminalForm.receiptSeries} onChange={(e) => setTerminalForm((prev) => ({ ...prev, receiptSeries: e.target.value }))} />
            </FormControl>
          </SimpleGrid>
          <Button mt={4} colorScheme="blue" leftIcon={<CheckIcon />} isLoading={saving} onClick={createTerminal} isDisabled={!terminalForm.locationId}>
            Crear terminal
          </Button>
        </SectionCard>
      ) : !openShift ? (
        <SectionCard title="Apertura de caja" accent="orange" maxW="680px">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <FormControl>
              <FormLabel>Terminal</FormLabel>
              <Select value={selected.terminalId} onChange={(e) => setSelected((prev) => ({ ...prev, terminalId: e.target.value }))}>
                {terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name} | {terminal.locationName}</option>)}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Monto inicial</FormLabel>
              <NumberInput value={selected.openingCash} onChange={(value) => setSelected((prev) => ({ ...prev, openingCash: value }))}>
                <NumberInputField />
              </NumberInput>
            </FormControl>
          </SimpleGrid>
          <Button mt={4} colorScheme="blue" leftIcon={<CheckIcon />} isLoading={saving} onClick={openCashShift} isDisabled={!selected.terminalId}>
            Abrir caja
          </Button>
        </SectionCard>
      ) : (
        <SimpleGrid columns={{ base: 1, xl: 'minmax(320px, 0.9fr) minmax(560px, 2.1fr)' }} spacing={4} alignItems="start">
          <SectionCard title="Productos" accent="teal">
            <Box position="relative">
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Escanea codigo de barra o busca producto"
                autoFocus
              />
              {search.trim() && (
                <Box borderWidth="1px" borderColor="teal.200" borderRadius="md" mt={2} maxH="260px" overflowY="auto" bg="white" boxShadow="md">
                  {filteredItems.length ? filteredItems.map((item) => (
                    <Flex
                      key={`${item.productId}-${item.variantId || 'base'}`}
                      p={3}
                      justify="space-between"
                      align="center"
                      gap={3}
                      cursor="pointer"
                      borderBottomWidth="1px"
                      borderBottomColor="gray.100"
                      bg={Number(item.stock || 0) > 0 ? 'white' : 'red.50'}
                      opacity={Number(item.stock || 0) > 0 ? 1 : 0.7}
                      _hover={{ bg: Number(item.stock || 0) > 0 ? 'teal.50' : 'red.100' }}
                      onClick={() => addItemAndClearSearch(item)}
                    >
                      <Box minW={0}>
                        <Text fontWeight="semibold" noOfLines={1}>{item.displayName || item.name}</Text>
                        <Text fontSize="sm" color="gray.600">SKU {item.variantSku || item.productSku} | Stock {Number(item.stock || 0)} | S/ {formatMoney(item.salePrice)}</Text>
                      </Box>
                      <Tooltip label="Agregar">
                        <IconButton
                          aria-label="Agregar producto"
                          icon={<AddIcon />}
                          size="sm"
                          colorScheme="teal"
                          onClick={(event) => {
                            event.stopPropagation()
                            addItemAndClearSearch(item)
                          }}
                        />
                      </Tooltip>
                    </Flex>
                  )) : (
                    <Box p={3}>
                      <Text color="gray.500">Sin coincidencias</Text>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </SectionCard>

          <SectionCard title="Venta actual" accent="blue" minH={{ base: 'auto', xl: 'calc(100vh - 190px)' }}>
            <Box overflowX="auto" maxH={{ base: '360px', xl: 'calc(100vh - 520px)' }} overflowY="auto">
              <Table size="sm">
                <Thead bg="blue.50">
                  <Tr>
                    <Th>Producto</Th>
                    <Th>Cant.</Th>
                    <Th>Precio</Th>
                    <Th>Dscto.</Th>
                    <Th>Total</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {cart.map((item) => (
                    <Tr key={item.key}>
                      <Td minW="220px">{item.productDescription}</Td>
                      <Td><Input size="sm" type="number" min="1" value={item.quantity} onChange={(e) => updateCart(item.key, 'quantity', e.target.value)} w="78px" /></Td>
                      <Td><Input size="sm" type="number" min="0" value={item.unitPrice} onChange={(e) => updateCart(item.key, 'unitPrice', e.target.value)} w="96px" /></Td>
                      <Td><Input size="sm" type="number" min="0" value={item.discountAmount} onChange={(e) => updateCart(item.key, 'discountAmount', e.target.value)} w="96px" /></Td>
                      <Td>S/ {formatMoney(lineTotal(item))}</Td>
                      <Td><Button size="sm" leftIcon={<DeleteIcon />} variant="ghost" colorScheme="red" onClick={() => removeCart(item.key)}>Quitar</Button></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3} my={4}>
              <SummaryBox label="Subtotal" tone="subtotal" value={`S/ ${formatMoney(totals.subtotal)}`} />
              <SummaryBox label="IGV" tone="tax" value={`S/ ${formatMoney(totals.taxTotal)}`} />
              <SummaryBox label="Descuento" tone="discount" value={`S/ ${formatMoney(totals.discountTotal)}`} />
              <SummaryBox label="Total" tone="total" value={`S/ ${formatMoney(totals.total)}`} />
            </SimpleGrid>

            <Box bg="green.50" borderWidth="1px" borderColor="green.200" borderRadius="md" p={4} mb={4}>
              <Heading size="sm" color="green.800" mb={3}>Datos de cobro</Heading>
              <SimpleGrid columns={{ base: 1, md: 6 }} spacing={4}>
                <FormControl>
                  <FormLabel>Comprobante</FormLabel>
                  <Select bg="white" value={selected.receiptType} onChange={(e) => setSelected((prev) => ({ ...prev, receiptType: e.target.value }))}>
                    <option value="boleta">Boleta Electronica</option>
                    <option value="factura">Factura Electronica</option>
                    <option value="ticket">Ticket interno</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Cliente</FormLabel>
                  <Select bg="white" value={selected.customerId} onChange={(e) => handleCustomerChange(e.target.value)}>
                    <option value="">Cliente varios</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>WhatsApp</FormLabel>
                  <Input
                    bg="white"
                    value={selected.customerPhone}
                    placeholder="999888777 o +51999888777"
                    onChange={(e) => setSelected((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Medio de pago</FormLabel>
                  <Select bg="white" value={selected.paymentMethodId} onChange={(e) => setSelected((prev) => ({ ...prev, paymentMethodId: e.target.value }))}>
                    {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Recibido</FormLabel>
                  <Input
                    bg="white"
                    type="number"
                    min="0"
                    value={selected.paidAmount}
                    placeholder={formatMoney(totals.total)}
                    onChange={(e) => setSelected((prev) => ({ ...prev, paidAmount: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Vuelto</FormLabel>
                  <Input value={`S/ ${formatMoney(changeAmount)}`} isReadOnly bg="green.100" fontWeight="bold" color="green.800" />
                </FormControl>
              </SimpleGrid>
              {requiresPaymentVoucher && (
                <Box mt={4} p={4} bg="white" borderWidth="1px" borderColor="green.300" borderRadius="md">
                  <Heading size="sm" color="green.800" mb={3}>Voucher del cliente</Heading>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} alignItems="end">
                    <FormControl>
                      <FormLabel>Numero de operacion</FormLabel>
                      <Input
                        bg="gray.50"
                        value={selected.paymentReferenceNumber}
                        placeholder="Ej: 984512"
                        onChange={(e) => setSelected((prev) => ({ ...prev, paymentReferenceNumber: e.target.value }))}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Foto del voucher</FormLabel>
                      <Input
                        bg="gray.50"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => uploadVoucher(e.target.files?.[0])}
                      />
                    </FormControl>
                    <Box>
                      {selected.paymentVoucherUrl ? (
                        <Button as="a" href={selected.paymentVoucherUrl} target="_blank" rel="noreferrer" colorScheme="green" variant="outline" w="100%">
                          Ver voucher
                        </Button>
                      ) : (
                        <Button isLoading={uploadingVoucher} isDisabled w="100%">Voucher pendiente</Button>
                      )}
                    </Box>
                  </SimpleGrid>
                </Box>
              )}
            </Box>

            <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
              <Flex gap={2} wrap="wrap">
                {canManageTerminals && (
                  <Button colorScheme="blue" variant="outline" onClick={() => setActiveModal('terminals')}>
                    Cajas
                  </Button>
                )}
                <Button colorScheme="orange" variant="outline" onClick={() => setActiveModal('cash')}>
                  Movimiento de caja
                </Button>
                <Button colorScheme="red" variant="outline" onClick={() => setActiveModal('close')}>
                  Cierre de caja
                </Button>
                <Button colorScheme="purple" variant="outline" onClick={() => setActiveModal('sales')}>
                  Ventas recientes: S/ {formatMoney(recentSalesTotal)}
                </Button>
              </Flex>
              <Button colorScheme="green" leftIcon={<CheckIcon />} isLoading={saving} onClick={createSale} isDisabled={!cart.length} size="lg">
                Cobrar
              </Button>
            </Flex>
          </SectionCard>

          <Modal isOpen={activeModal === 'cash'} onClose={() => setActiveModal(null)} size="xl">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader bg="orange.50" color="orange.800">Movimiento de caja</ModalHeader>
              <ModalCloseButton />
              <ModalBody pt={4}>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <Select value={cashMovement.movementType} onChange={(e) => setCashMovement((prev) => ({ ...prev, movementType: e.target.value }))}>
                    <option value="withdrawal">Retiro</option>
                    <option value="expense">Egreso</option>
                    <option value="income">Ingreso</option>
                    <option value="adjustment">Ajuste</option>
                  </Select>
                  <Input type="number" placeholder="Monto" value={cashMovement.amount} onChange={(e) => setCashMovement((prev) => ({ ...prev, amount: e.target.value }))} />
                  <Input placeholder="Motivo" value={cashMovement.reason} onChange={(e) => setCashMovement((prev) => ({ ...prev, reason: e.target.value }))} />
                </SimpleGrid>
                {cashMovementNeedsApproval && (
                  <Box mt={4} p={4} bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="md">
                    <Heading size="sm" color="red.800" mb={3}>Autorizacion de administrador</Heading>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <Input
                        type="email"
                        bg="white"
                        placeholder="Correo autorizador"
                        value={cashMovement.authorizerEmail}
                        onChange={(e) => setCashMovement((prev) => ({ ...prev, authorizerEmail: e.target.value }))}
                      />
                      <Input
                        type="password"
                        bg="white"
                        placeholder="Password autorizador"
                        value={cashMovement.authorizerPassword}
                        onChange={(e) => setCashMovement((prev) => ({ ...prev, authorizerPassword: e.target.value }))}
                      />
                    </SimpleGrid>
                  </Box>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button colorScheme="orange" onClick={registerCashMovement} isLoading={saving}>Registrar</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal isOpen={activeModal === 'close'} onClose={() => setActiveModal(null)} size="lg">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader bg="red.50" color="red.800">Cierre de caja</ModalHeader>
              <ModalCloseButton />
              <ModalBody pt={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <Input type="number" placeholder="Efectivo contado" value={closeData.countedCash} onChange={(e) => setCloseData((prev) => ({ ...prev, countedCash: e.target.value }))} />
                  <Input placeholder="Notas" value={closeData.notes} onChange={(e) => setCloseData((prev) => ({ ...prev, notes: e.target.value }))} />
                </SimpleGrid>
                {requiresSupervisorAuth && (
                  <Box mt={4} p={4} bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="md">
                    <Heading size="sm" color="red.800" mb={3}>Autorizacion de administrador</Heading>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <Input
                        type="email"
                        bg="white"
                        placeholder="Correo autorizador"
                        value={closeData.authorizerEmail}
                        onChange={(e) => setCloseData((prev) => ({ ...prev, authorizerEmail: e.target.value }))}
                      />
                      <Input
                        type="password"
                        bg="white"
                        placeholder="Password autorizador"
                        value={closeData.authorizerPassword}
                        onChange={(e) => setCloseData((prev) => ({ ...prev, authorizerPassword: e.target.value }))}
                      />
                    </SimpleGrid>
                  </Box>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={() => setActiveModal(null)}>Cancelar</Button>
                <Button colorScheme="red" onClick={closeShift} isLoading={saving}>Cerrar turno</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal isOpen={activeModal === 'sales'} onClose={() => setActiveModal(null)} size="5xl">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader bg="purple.50" color="purple.800">Ventas recientes</ModalHeader>
              <ModalCloseButton />
              <ModalBody pt={4}>
                <Box bg="purple.50" borderWidth="1px" borderColor="purple.200" borderRadius="md" p={4} mb={4}>
                  <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={2} mb={3}>
                    <Box>
                      <Text fontSize="sm" color="purple.700" fontWeight="semibold">Resumen del dia {salesSummary.date || ''}</Text>
                      <Heading size="md" color="purple.900">S/ {formatMoney(salesSummary.totals?.total)}</Heading>
                    </Box>
                    <Text color="purple.800" fontWeight="semibold">
                      {Number(salesSummary.totals?.saleCount || 0)} ventas
                    </Text>
                  </Flex>

                  <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                    {(salesSummary.terminals || []).map((terminal) => (
                      <Box key={terminal.terminalId} bg="white" borderWidth="1px" borderColor="purple.200" borderRadius="md" p={3}>
                        <Flex justify="space-between" gap={3} align="start" mb={2}>
                          <Box minW={0}>
                            <Text fontWeight="bold" noOfLines={1}>{terminal.terminalName}</Text>
                            <Text fontSize="sm" color="gray.600" noOfLines={1}>{terminal.locationName} | {terminal.terminalCode}</Text>
                          </Box>
                          <Box textAlign="right">
                            <Text fontSize="sm" color="gray.500">{terminal.saleCount} ventas</Text>
                            <Text fontWeight="bold" color="purple.800">S/ {formatMoney(terminal.total)}</Text>
                          </Box>
                        </Flex>
                        {(terminal.payments || []).length ? (
                          <Box borderTopWidth="1px" borderColor="gray.100" pt={2}>
                            {terminal.payments.map((payment) => (
                              <Flex key={`${terminal.terminalId}-${payment.methodName}`} justify="space-between" py={1} fontSize="sm">
                                <Text color="gray.700">{payment.methodName}</Text>
                                <Text fontWeight="semibold">S/ {formatMoney(payment.amount)}</Text>
                              </Flex>
                            ))}
                          </Box>
                        ) : (
                          <Text fontSize="sm" color="gray.500">Sin pagos registrados</Text>
                        )}
                      </Box>
                    ))}
                  </SimpleGrid>
                </Box>

                <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
                  <Heading size="sm">Detalle de ventas</Heading>
                  <Text fontWeight="bold" color="purple.800">Total listado: S/ {formatMoney(recentSalesTotal)}</Text>
                </Flex>
                <Box overflowX="auto" maxH="520px" overflowY="auto">
                  <Table size="sm">
                    <Thead bg="purple.100" position="sticky" top={0} zIndex={1}>
                      <Tr>
                        <Th>Fecha</Th>
                        <Th>Comprobante</Th>
                        <Th>Cliente</Th>
                        <Th>Vendedor</Th>
                        <Th>Operacion</Th>
                        <Th>Voucher</Th>
                        <Th>Total</Th>
                        <Th>Estado</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {sales.slice(0, 20).map((sale) => (
                        <Tr key={sale.id}>
                          <Td>{String(sale.saleDate || '').replace('T', ' ').slice(0, 16)}</Td>
                          <Td>{sale.receiptFullNumber}</Td>
                          <Td>{sale.customerName || 'Cliente varios'}</Td>
                          <Td>{sale.sellerName}</Td>
                          <Td>{sale.paymentReferenceNumber || '-'}</Td>
                          <Td>
                            {sale.paymentVoucherImageUrl ? (
                              <Button as="a" href={sale.paymentVoucherImageUrl} target="_blank" rel="noreferrer" size="xs" variant="outline" colorScheme="purple">
                                Ver
                              </Button>
                            ) : '-'}
                          </Td>
                          <Td>S/ {formatMoney(sale.total)}</Td>
                          <Td>{sale.status}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </ModalBody>
              <ModalFooter>
                <Button onClick={() => setActiveModal(null)}>Cerrar</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal isOpen={activeModal === 'ticket'} onClose={() => setActiveModal(null)} size="lg">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader bg="green.50" color="green.800">Comprobante generado</ModalHeader>
              <ModalCloseButton />
              <ModalBody pt={4}>
                {lastTicket && (
                  <Box borderWidth="1px" borderColor="green.200" borderRadius="md" p={4} bg="white">
                    <Flex justify="space-between" align="start" gap={3} mb={3}>
                      <Box>
                        <Text fontSize="sm" color="gray.500">{receiptTypeLabel(lastTicket.sale?.receiptType)}</Text>
                        <Heading size="md">{lastTicket.sale?.receiptFullNumber}</Heading>
                      </Box>
                      <Box textAlign="right">
                        <Text fontSize="sm" color="gray.500">Total</Text>
                        <Heading size="md" color="green.700">S/ {formatMoney(lastTicket.sale?.total)}</Heading>
                      </Box>
                    </Flex>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mb={3}>
                      <Box>
                        <Text fontSize="sm" color="gray.500">Cliente</Text>
                        <Text fontWeight="semibold">{lastTicket.sale?.customerName || 'Cliente varios'}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="gray.500">WhatsApp</Text>
                        <Text fontWeight="semibold">{displayWhatsappPhone(lastTicket.sale?.customerPhone)}</Text>
                      </Box>
                      {(lastTicket.payments || []).some((payment) => payment.referenceNumber || payment.voucherImageUrl) && (
                        <>
                          <Box>
                            <Text fontSize="sm" color="gray.500">Operacion</Text>
                            <Text fontWeight="semibold">{lastTicket.payments?.[0]?.referenceNumber || '-'}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="sm" color="gray.500">Voucher</Text>
                            {lastTicket.payments?.[0]?.voucherImageUrl ? (
                              <Button as="a" href={lastTicket.payments[0].voucherImageUrl} target="_blank" rel="noreferrer" size="sm" colorScheme="green" variant="outline">
                                Ver voucher
                              </Button>
                            ) : <Text fontWeight="semibold">-</Text>}
                          </Box>
                        </>
                      )}
                    </SimpleGrid>
                    <Box maxH="220px" overflowY="auto" borderTopWidth="1px" borderColor="gray.100" pt={2}>
                      {(lastTicket.items || []).map((item) => (
                        <Flex key={item.id} justify="space-between" gap={3} py={2} borderBottomWidth="1px" borderColor="gray.100">
                          <Box minW={0}>
                            <Text fontWeight="semibold" noOfLines={1}>{item.productDescription}</Text>
                            <Text fontSize="sm" color="gray.600">{formatMoney(item.quantity)} x S/ {formatMoney(item.unitPrice)}</Text>
                          </Box>
                          <Text fontWeight="bold">S/ {formatMoney(item.total)}</Text>
                        </Flex>
                      ))}
                    </Box>
                  </Box>
                )}
              </ModalBody>
              <ModalFooter gap={2} flexWrap="wrap">
                <Button variant="outline" onClick={() => setActiveModal(null)}>Cerrar</Button>
                <Button colorScheme="blue" onClick={() => printTicket(lastTicket)} isDisabled={!lastTicket}>Imprimir ticket</Button>
                <Button colorScheme="purple" onClick={() => downloadReceiptPdf(lastTicket)} isDisabled={!lastTicket}>Descargar PDF</Button>
                <Button colorScheme="green" onClick={() => sendWhatsappWithPdf(lastTicket)} isDisabled={!lastTicket}>Enviar WhatsApp PDF</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </SimpleGrid>
      )}

      <Modal isOpen={activeModal === 'terminals'} onClose={() => setActiveModal(null)} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader bg="blue.50" color="blue.800">Cajas por tienda</ModalHeader>
          <ModalCloseButton />
          <ModalBody pt={4}>
            <SimpleGrid columns={{ base: 1, lg: '360px 1fr' }} spacing={5} alignItems="start">
              <Box bg="blue.50" borderWidth="1px" borderColor="blue.200" borderRadius="md" p={4}>
                <Heading size="sm" color="blue.800" mb={3}>{terminalForm.id ? 'Editar caja' : 'Nueva caja'}</Heading>
                <SimpleGrid columns={1} spacing={3}>
                  <FormControl>
                    <FormLabel>Tienda</FormLabel>
                    <Select bg="white" value={terminalForm.locationId} onChange={(e) => setTerminalForm((prev) => ({ ...prev, locationId: e.target.value }))}>
                      {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Nombre</FormLabel>
                    <Input bg="white" value={terminalForm.name} onChange={(e) => setTerminalForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Codigo</FormLabel>
                    <Input bg="white" value={terminalForm.code} onChange={(e) => setTerminalForm((prev) => ({ ...prev, code: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Serie ticket interno</FormLabel>
                    <Input bg="white" value={terminalForm.receiptSeries} onChange={(e) => setTerminalForm((prev) => ({ ...prev, receiptSeries: e.target.value }))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Medio de pago defecto</FormLabel>
                    <Select bg="white" value={terminalForm.defaultPaymentMethodId} onChange={(e) => setTerminalForm((prev) => ({ ...prev, defaultPaymentMethodId: e.target.value }))}>
                      <option value="">Sin defecto</option>
                      {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Estado</FormLabel>
                    <Select bg="white" value={terminalForm.estado} onChange={(e) => setTerminalForm((prev) => ({ ...prev, estado: Number(e.target.value) }))}>
                      <option value={1}>Activa</option>
                      <option value={0}>Inactiva</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
                <Flex mt={4} gap={2} wrap="wrap">
                  <Button colorScheme="blue" leftIcon={<CheckIcon />} isLoading={saving} onClick={createTerminal} isDisabled={!terminalForm.locationId}>
                    {terminalForm.id ? 'Guardar' : 'Crear caja'}
                  </Button>
                  {terminalForm.id && (
                    <Button
                      variant="outline"
                      onClick={() => setTerminalForm({
                        id: null,
                        locationId: locations[0]?.id || '',
                        name: 'Caja principal',
                        code: 'POS-01',
                        receiptSeries: 'T001',
                        defaultPaymentMethodId: paymentMethods[0]?.id || '',
                        estado: 1,
                      })}
                    >
                      Nueva
                    </Button>
                  )}
                </Flex>
              </Box>

              <Box overflowX="auto" maxH="560px" overflowY="auto">
                <Table size="sm">
                  <Thead bg="blue.50" position="sticky" top={0} zIndex={1}>
                    <Tr>
                      <Th>Tienda</Th>
                      <Th>Caja</Th>
                      <Th>Codigo</Th>
                      <Th>Serie</Th>
                      <Th>Pago defecto</Th>
                      <Th>Estado</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {terminals.map((terminal) => (
                      <Tr key={terminal.id}>
                        <Td>{terminal.locationName}</Td>
                        <Td>{terminal.name}</Td>
                        <Td>{terminal.code}</Td>
                        <Td>{terminal.receiptSeries || 'T001'}</Td>
                        <Td>{terminal.defaultPaymentMethodName || '-'}</Td>
                        <Td>{terminal.estado ? 'Activa' : 'Inactiva'}</Td>
                        <Td>
                          <Button size="sm" variant="outline" colorScheme="blue" onClick={() => editTerminal(terminal)}>
                            Editar
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </SimpleGrid>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setActiveModal(null)}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap={3}
        mt={5}
        bg="white"
        borderWidth="1px"
        borderColor={openShift ? 'green.300' : 'orange.300'}
        borderLeftWidth="6px"
        borderRadius="md"
        p={4}
        boxShadow="sm"
      >
        <Box>
          <Heading size="lg">POS</Heading>
          <Text color={openShift ? 'green.700' : 'orange.700'} fontWeight="semibold">
            {openShift ? `${openShift.terminalName || 'Terminal'} | ${openShift.locationName || ''}` : 'Caja sin turno abierto'}
          </Text>
        </Box>
        <Flex gap={2} wrap="wrap">
          {canManageTerminals && (
            <Button colorScheme="blue" variant="outline" onClick={() => setActiveModal('terminals')}>
              Cajas
            </Button>
          )}
          <Button leftIcon={<RepeatIcon />} variant="outline" onClick={loadData}>Actualizar</Button>
        </Flex>
      </Flex>
    </Box>
  )
}
