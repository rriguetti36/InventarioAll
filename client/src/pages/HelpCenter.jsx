import React, { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Input,
  ListItem,
  SimpleGrid,
  Text,
  UnorderedList,
  VStack,
} from '@chakra-ui/react'
import { ArrowForwardIcon, CheckCircleIcon, SearchIcon } from '@chakra-ui/icons'
import { useNavigate } from 'react-router-dom'

const quickStart = [
  { label: 'Configura los datos de la compania', to: '/company-profile', adminOnly: true },
  { label: 'Crea tus tiendas o almacenes', to: '/inventory/locations' },
  { label: 'Registra proveedores y clientes', to: '/inventory/suppliers' },
  { label: 'Crea productos con rubro, tipo, precio y foto', to: '/inventory/products' },
  { label: 'Carga stock con una compra inicial', to: '/inventory/purchases/add' },
  { label: 'Emite cotizaciones o registra ventas', to: '/inventory/quotations' },
  { label: 'Controla existencias con Kardex y reportes', to: '/inventory/reports' },
]

const guides = [
  {
    title: 'Primeros pasos',
    tag: 'Inicio',
    summary: 'Orden recomendado para dejar una empresa lista para operar.',
    steps: [
      'Completa la informacion de la compania para que documentos y reportes salgan con datos correctos.',
      'Crea al menos una tienda o almacen. Si manejas ubicaciones internas, crea tambien estantes.',
      'Registra proveedores, clientes y productos antes de iniciar movimientos.',
      'Haz una compra inicial para cargar stock real.',
      'Revisa el dashboard para confirmar ventas, compras, stock y alertas.',
    ],
  },
  {
    title: 'Configurar compania',
    tag: 'Admin',
    summary: 'Datos legales, logo, IGV, bancos y redes sociales.',
    steps: [
      'Ingresa a Seguridad > Compania.',
      'Registra razon social, RUC, direccion, telefonos, correo y pagina web.',
      'Sube el logo de la empresa para usarlo en documentos como cotizaciones.',
      'Agrega cuentas bancarias para mostrarlas al cliente cuando corresponda.',
      'Verifica el porcentaje de IGV antes de emitir documentos comerciales.',
    ],
  },
  {
    title: 'Productos',
    tag: 'Catalogos',
    summary: 'Como crear productos ordenados para todos los rubros.',
    steps: [
      'Usa un SKU unico para identificar el producto.',
      'Define rubro, tipo, modelo, unidad, costo, precio de venta y stock minimo.',
      'Sube una foto clara; el sistema la optimiza y guarda por compania.',
      'Agrega caracteristicas como talla, color, marca o medida cuando el producto tenga variantes.',
      'Activa o desactiva IGV segun corresponda al producto o servicio.',
    ],
  },
  {
    title: 'Compras y stock',
    tag: 'Procesos',
    summary: 'Como ingresa inventario y como se actualizan existencias.',
    steps: [
      'Registra una compra seleccionando proveedor, ubicacion y estante.',
      'Agrega productos, cantidades y costos unitarios.',
      'Al guardar, el stock aumenta automaticamente en la ubicacion indicada.',
      'Cada ingreso genera movimiento de Kardex para trazabilidad.',
      'Usa el reporte de reposicion para detectar productos bajo minimo.',
    ],
  },
  {
    title: 'Ventas',
    tag: 'Procesos',
    summary: 'Flujo para preventa, venta directa y cierre de venta.',
    steps: [
      'Crea una venta directa o aprueba una cotizacion para convertirla en preventa.',
      'Selecciona productos con stock disponible.',
      'Al cerrar la venta se descuenta inventario y se registra salida en Kardex.',
      'Si corresponde, genera boleta o factura desde la venta.',
      'Revisa el reporte de ventas para medir total vendido, clientes y vendedores.',
    ],
  },
  {
    title: 'Cotizaciones',
    tag: 'Comercial',
    summary: 'Como preparar una propuesta para el cliente.',
    steps: [
      'Selecciona cliente, vendedor, moneda, forma de pago y fecha de entrega.',
      'Agrega productos con cantidades, precios y afectacion de IGV.',
      'Descarga el PDF con los datos y logo de la compania.',
      'Envia la cotizacion por WhatsApp cuando el cliente tenga telefono registrado.',
      'Aprueba la cotizacion para pasarla al proceso de venta.',
    ],
  },
  {
    title: 'Kardex',
    tag: 'Control',
    summary: 'Trazabilidad completa de entradas, salidas y ajustes.',
    steps: [
      'Cada compra genera entrada de inventario.',
      'Cada venta cerrada genera salida.',
      'Cada traslado genera salida en origen y entrada en destino.',
      'Filtra por producto o ubicacion para investigar diferencias.',
      'Usa Kardex como soporte para auditoria y control de inventario.',
    ],
  },
  {
    title: 'Reportes',
    tag: 'Analisis',
    summary: 'Informacion para tomar decisiones operativas.',
    steps: [
      'Ventas: revisa total vendido, preventas, clientes y vendedores.',
      'Compras: controla compras por proveedor y periodo.',
      'Valorizacion: calcula el valor del inventario por costo.',
      'Reposicion: detecta bajo stock y sugerencia de compra.',
      'Rotacion, antiguedad y margen ayudan a mejorar rentabilidad.',
    ],
  },
  {
    title: 'Fotos y respaldos',
    tag: 'Archivos',
    summary: 'Como se guardan las imagenes de productos.',
    steps: [
      'Las fotos se comprimen antes de subir para evitar archivos pesados.',
      'Cada empresa guarda sus imagenes en su propia carpeta.',
      'El formato fisico es uploads/codigo-compania/products/foto.jpg.',
      'Para backup, respalda la base de datos y la carpeta uploads.',
      'Si migras de servidor, copia tambien uploads para conservar thumbnails.',
    ],
  },
]

const faqs = [
  {
    question: 'Por que no veo stock despues de crear un producto?',
    answer: 'Crear un producto solo registra el catalogo. El stock aparece cuando haces una compra, traslado o ajuste que cargue existencias.',
  },
  {
    question: 'Puedo vender sin stock?',
    answer: 'El sistema evita cerrar ventas sin stock suficiente para mantener control real del inventario.',
  },
  {
    question: 'Que debo respaldar?',
    answer: 'Respalda la base SQL Server y la carpeta uploads, porque alli quedan fotos y otros archivos cargados por empresa.',
  },
  {
    question: 'Quien debe configurar la compania?',
    answer: 'El usuario admin de la empresa. Es importante hacerlo antes de emitir cotizaciones o documentos.',
  },
]

function GuideCard({ guide }) {
  return (
    <Box bg="white" borderWidth="1px" borderRadius="md" p={4} boxShadow="sm">
      <Flex justify="space-between" align="start" gap={3} mb={2}>
        <Heading size="sm">{guide.title}</Heading>
        <Badge colorScheme="blue" flexShrink={0}>{guide.tag}</Badge>
      </Flex>
      <Text color="gray.600" fontSize="sm" mb={3}>{guide.summary}</Text>
      <UnorderedList spacing={2} color="gray.700" fontSize="sm" pl={2}>
        {guide.steps.map((step) => <ListItem key={step}>{step}</ListItem>)}
      </UnorderedList>
    </Box>
  )
}

export default function HelpCenter() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const normalizedSearch = search.trim().toLowerCase()
  const filteredGuides = useMemo(() => {
    if (!normalizedSearch) return guides
    return guides.filter((guide) => (
      `${guide.title} ${guide.tag} ${guide.summary} ${guide.steps.join(' ')}`
        .toLowerCase()
        .includes(normalizedSearch)
    ))
  }, [normalizedSearch])

  return (
    <Box>
      <Flex
        bg="white"
        borderWidth="1px"
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
          <Text color="gray.500" fontSize="sm">Manual en pantalla</Text>
          <Heading size={{ base: 'md', md: 'lg' }} mt={1}>Centro de Ayuda</Heading>
          <Text color="gray.600" mt={2}>Guia practica para operar inventario, compras, ventas, cotizaciones y reportes.</Text>
        </Box>
        <Flex align="center" gap={2} bg="gray.50" borderWidth="1px" borderRadius="md" px={3} minW={{ base: '100%', md: '340px' }}>
          <SearchIcon color="gray.500" />
          <Input variant="unstyled" placeholder="Buscar ayuda" value={search} onChange={(e) => setSearch(e.target.value)} py={3} />
        </Flex>
      </Flex>

      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={4} mb={5}>
        <Box bg="white" borderWidth="1px" borderRadius="md" p={4} boxShadow="sm" gridColumn={{ base: 'auto', xl: 'span 1' }}>
          <Heading size="sm" mb={3}>Primer recorrido recomendado</Heading>
          <VStack align="stretch" spacing={3}>
            {quickStart.map((item, index) => (
              <Flex key={item.label} justify="space-between" align="center" gap={3} borderBottomWidth={index === quickStart.length - 1 ? 0 : '1px'} borderColor="gray.100" pb={index === quickStart.length - 1 ? 0 : 3}>
                <Flex gap={3} align="center" minW={0}>
                  <CheckCircleIcon color="green.500" flexShrink={0} />
                  <Text fontSize="sm" fontWeight="medium">{item.label}</Text>
                </Flex>
                <Button size="xs" variant="outline" rightIcon={<ArrowForwardIcon />} onClick={() => navigate(item.to)}>
                  Ir
                </Button>
              </Flex>
            ))}
          </VStack>
        </Box>

        <Box bg="white" borderWidth="1px" borderRadius="md" p={4} boxShadow="sm" gridColumn={{ base: 'auto', xl: 'span 2' }}>
          <Heading size="sm" mb={3}>Preguntas frecuentes</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            {faqs.map((item) => (
              <Box key={item.question} borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                <Text fontWeight="semibold" fontSize="sm">{item.question}</Text>
                <Text color="gray.600" fontSize="sm" mt={1}>{item.answer}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2, '2xl': 3 }} spacing={4}>
        {filteredGuides.map((guide) => <GuideCard key={guide.title} guide={guide} />)}
      </SimpleGrid>

      {!filteredGuides.length && (
        <Box bg="white" borderWidth="1px" borderRadius="md" p={6} textAlign="center">
          <Text color="gray.600">No encontramos una guia con ese texto.</Text>
        </Box>
      )}
    </Box>
  )
}
