import React, { useEffect, useState } from 'react'
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
  Select,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon } from '@chakra-ui/icons'
import api from '../services/api'

const emptyProfile = {
  legalName: '',
  ruc: '',
  phones: '',
  whatsappPhones: '',
  address: '',
  email: '',
  industry: '',
  taxRate: 18,
  logoDataUrl: '',
  bankAccounts: [],
  website: '',
  socialLinks: [],
}

const industryOptions = [
  'Alimentos y bebidas',
  'Ropa, calzado y textiles',
  'Ferreteria y construccion',
  'Automotriz y repuestos',
  'Tecnologia y electronica',
  'Farmacia y salud',
  'Belleza y cuidado personal',
  'Hogar y decoracion',
  'Industria y manufactura',
  'Restaurantes y cocina',
  'Servicios profesionales',
  'Otros',
]

function normalizeRows(rows, fallback) {
  return Array.isArray(rows) && rows.length ? rows : [fallback]
}

export default function CompanyProfile() {
  const [form, setForm] = useState(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/company-profile')
      setForm({
        ...emptyProfile,
        ...res.data,
        bankAccounts: normalizeRows(res.data.bankAccounts, { bankName: '', accountNumber: '', cci: '', currency: 'PEN', holder: '' }),
        socialLinks: normalizeRows(res.data.socialLinks, { network: '', url: '' }),
      })
    } catch (err) {
      toast({ status: 'error', title: err.response?.data?.error || err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateBankAccount = (index, field, value) => {
    setForm((current) => ({
      ...current,
      bankAccounts: current.bankAccounts.map((item, currentIndex) => currentIndex === index ? { ...item, [field]: value } : item),
    }))
  }

  const updateSocialLink = (index, field, value) => {
    setForm((current) => ({
      ...current,
      socialLinks: current.socialLinks.map((item, currentIndex) => currentIndex === index ? { ...item, [field]: value } : item),
    }))
  }

  const addBankAccount = () => {
    setForm((current) => ({
      ...current,
      bankAccounts: [...current.bankAccounts, { bankName: '', accountNumber: '', cci: '', currency: 'PEN', holder: '' }],
    }))
  }

  const addSocialLink = () => {
    setForm((current) => ({
      ...current,
      socialLinks: [...current.socialLinks, { network: '', url: '' }],
    }))
  }

  const removeBankAccount = (index) => {
    setForm((current) => ({
      ...current,
      bankAccounts: normalizeRows(current.bankAccounts.filter((_, currentIndex) => currentIndex !== index), { bankName: '', accountNumber: '', cci: '', currency: 'PEN', holder: '' }),
    }))
  }

  const removeSocialLink = (index) => {
    setForm((current) => ({
      ...current,
      socialLinks: normalizeRows(current.socialLinks.filter((_, currentIndex) => currentIndex !== index), { network: '', url: '' }),
    }))
  }

  const handleLogo = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ status: 'warning', title: 'Selecciona una imagen valida' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ status: 'warning', title: 'El logo debe pesar menos de 2 MB' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => updateField('logoDataUrl', reader.result)
    reader.readAsDataURL(file)
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        bankAccounts: form.bankAccounts.filter((item) => item.bankName || item.accountNumber || item.cci || item.holder),
        socialLinks: form.socialLinks.filter((item) => Object.values(item).some(Boolean)),
      }
      const res = await api.put('/company-profile', payload)
      setForm({
        ...emptyProfile,
        ...res.data,
        bankAccounts: normalizeRows(res.data.bankAccounts, { bankName: '', accountNumber: '', cci: '', currency: 'PEN', holder: '' }),
        socialLinks: normalizeRows(res.data.socialLinks, { network: '', url: '' }),
      })
      toast({ status: 'success', title: 'Compania actualizada' })
    } catch (err) {
      toast({ status: 'error', title: err.response?.data?.error || err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Text>Cargando configuracion...</Text>

  return (
    <Box>
      <Heading size={{ base: 'md', md: 'lg' }} mb={6}>Compania</Heading>
      <Box as="form" onSubmit={save} bg="white" borderRadius="md" boxShadow="lg" p={{ base: 4, md: 6 }}>
        <VStack align="stretch" spacing={6}>
          <Box>
            <Heading size="sm" mb={4}>Datos fiscales y comerciales</Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Nombre o Razon Social CIA</FormLabel>
                <Input value={form.legalName || ''} onChange={(e) => updateField('legalName', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>RUC CIA</FormLabel>
                <Input value={form.ruc || ''} onChange={(e) => updateField('ruc', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Telefonos CIA</FormLabel>
                <Input value={form.phones || ''} onChange={(e) => updateField('phones', e.target.value)} placeholder="Separados por coma" />
              </FormControl>
              <FormControl>
                <FormLabel>Telefonos WhatsApp</FormLabel>
                <Input value={form.whatsappPhones || ''} onChange={(e) => updateField('whatsappPhones', e.target.value)} placeholder="Separados por coma" />
              </FormControl>
              <FormControl>
                <FormLabel>Correo</FormLabel>
                <Input type="email" value={form.email || ''} onChange={(e) => updateField('email', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Rubro Industrial</FormLabel>
                <Input list="industry-options" value={form.industry || ''} onChange={(e) => updateField('industry', e.target.value)} />
                <datalist id="industry-options">
                  {industryOptions.map((item) => <option key={item} value={item} />)}
                </datalist>
              </FormControl>
              <FormControl>
                <FormLabel>% de IGV</FormLabel>
                <Input type="number" step="0.01" value={form.taxRate ?? 18} onChange={(e) => updateField('taxRate', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Pagina Web</FormLabel>
                <Input value={form.website || ''} onChange={(e) => updateField('website', e.target.value)} placeholder="https://..." />
              </FormControl>
            </SimpleGrid>
            <FormControl mt={4}>
              <FormLabel>Direccion CIA</FormLabel>
              <Input value={form.address || ''} onChange={(e) => updateField('address', e.target.value)} />
            </FormControl>
          </Box>

          <Box>
            <Heading size="sm" mb={4}>Logo</Heading>
            <Flex align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4}>
              {form.logoDataUrl ? (
                <Image src={form.logoDataUrl} alt="Logo de empresa" boxSize="96px" objectFit="contain" borderWidth="1px" borderRadius="md" bg="gray.50" />
              ) : (
                <Flex boxSize="96px" align="center" justify="center" borderWidth="1px" borderRadius="md" bg="gray.50">
                  <Text fontSize="sm" color="gray.500">Sin logo</Text>
                </Flex>
              )}
              <Flex gap={3} direction={{ base: 'column', sm: 'row' }}>
                <Input type="file" accept="image/*" onChange={handleLogo} maxW={{ base: '100%', sm: '320px' }} />
                <Button type="button" variant="outline" onClick={() => updateField('logoDataUrl', '')}>Quitar logo</Button>
              </Flex>
            </Flex>
          </Box>

          <Box>
            <Flex justify="space-between" align="center" mb={4}>
              <Heading size="sm">Numero de Cuentas y Bancos</Heading>
              <Button type="button" size="sm" leftIcon={<AddIcon />} onClick={addBankAccount}>Agregar cuenta</Button>
            </Flex>
            <VStack align="stretch" spacing={3}>
              {form.bankAccounts.map((account, index) => (
                <Box key={index} borderWidth="1px" borderRadius="md" p={3}>
                  <SimpleGrid columns={{ base: 1, md: 5 }} spacing={3}>
                    <FormControl><FormLabel>Banco</FormLabel><Input value={account.bankName || ''} onChange={(e) => updateBankAccount(index, 'bankName', e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Cuenta</FormLabel><Input value={account.accountNumber || ''} onChange={(e) => updateBankAccount(index, 'accountNumber', e.target.value)} /></FormControl>
                    <FormControl><FormLabel>CCI</FormLabel><Input value={account.cci || ''} onChange={(e) => updateBankAccount(index, 'cci', e.target.value)} /></FormControl>
                    <FormControl><FormLabel>Moneda</FormLabel><Select value={account.currency || 'PEN'} onChange={(e) => updateBankAccount(index, 'currency', e.target.value)}><option value="PEN">PEN</option><option value="USD">USD</option><option value="EUR">EUR</option></Select></FormControl>
                    <FormControl><FormLabel>Titular</FormLabel><Input value={account.holder || ''} onChange={(e) => updateBankAccount(index, 'holder', e.target.value)} /></FormControl>
                  </SimpleGrid>
                  <Flex justify="flex-end" mt={3}>
                    <IconButton type="button" aria-label="Quitar cuenta" icon={<DeleteIcon />} colorScheme="red" size="sm" onClick={() => removeBankAccount(index)} />
                  </Flex>
                </Box>
              ))}
            </VStack>
          </Box>

          <Box>
            <Flex justify="space-between" align="center" mb={4}>
              <Heading size="sm">Redes sociales</Heading>
              <Button type="button" size="sm" leftIcon={<AddIcon />} onClick={addSocialLink}>Agregar red</Button>
            </Flex>
            <VStack align="stretch" spacing={3}>
              {form.socialLinks.map((social, index) => (
                <Flex key={index} gap={3} align="end" direction={{ base: 'column', md: 'row' }}>
                  <FormControl>
                    <FormLabel>Red social</FormLabel>
                    <Input value={social.network || ''} onChange={(e) => updateSocialLink(index, 'network', e.target.value)} placeholder="Facebook, Instagram, LinkedIn" />
                  </FormControl>
                  <FormControl>
                    <FormLabel>URL</FormLabel>
                    <Input value={social.url || ''} onChange={(e) => updateSocialLink(index, 'url', e.target.value)} placeholder="https://..." />
                  </FormControl>
                  <IconButton type="button" aria-label="Quitar red" icon={<DeleteIcon />} colorScheme="red" onClick={() => removeSocialLink(index)} />
                </Flex>
              ))}
            </VStack>
          </Box>

          <Flex justify="flex-end">
            <Button type="submit" colorScheme="blue" isLoading={saving}>Guardar configuracion</Button>
          </Flex>
        </VStack>
      </Box>
    </Box>
  )
}
