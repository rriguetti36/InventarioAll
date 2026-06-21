export const roleLabels = {
  admin: 'Admin',
  user: 'Usuario',
  admin_tienda: 'Admin Tienda',
  administrativo: 'Administrativo',
  operativo: 'Operativo',
  comercial: 'Comercial',
  vendedor_tienda: 'Vendedor Tienda',
}

export const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Usuario' },
  { value: 'admin_tienda', label: 'Admin Tienda' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'operativo', label: 'Operativo' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'vendedor_tienda', label: 'Vendedor Tienda' },
]

export const storeScopedRoles = ['admin_tienda', 'vendedor_tienda']

const inventorySections = [
  'products',
  'customers',
  'suppliers',
  'locations',
  'shelves',
  'stock',
  'purchases',
  'sales',
  'transfers',
  'quotations',
  'kardex',
  'paymentMethods',
  'reports',
  'reportSummary',
  'reportSales',
  'reportPurchases',
  'reportKardex',
  'reportValuation',
  'reportReplenishment',
  'reportRotation',
  'reportAging',
  'reportTransfers',
  'reportMargin',
]

function moduleAllows(user, section) {
  if (!user?.companySlug) return true
  const modules = user.modules || {}
  if (section === 'pos') return Boolean(modules.pos)
  if (inventorySections.includes(section)) return Boolean(modules.inventory)
  return true
}

export function canAccess(user, section) {
  const role = user?.role || 'user'
  if (!moduleAllows(user, section)) return false
  if (role === 'admin') return true

  const permissions = {
    user: ['dashboard'],
    admin_tienda: ['dashboard', 'pos', 'shelves', 'customers', 'stock', 'sales', 'transfers', 'quotations', 'kardex', 'reports', 'reportSales', 'reportKardex', 'reportTransfers'],
    administrativo: ['dashboard', 'pos', 'products', 'customers', 'suppliers', 'locations', 'shelves', 'stock', 'purchases', 'sales', 'transfers', 'quotations', 'kardex', 'reports', 'reportSummary', 'reportSales', 'reportPurchases', 'reportKardex', 'reportValuation', 'reportReplenishment', 'reportRotation', 'reportAging', 'reportTransfers', 'reportMargin'],
    operativo: ['dashboard', 'products', 'customers', 'suppliers', 'locations', 'shelves', 'stock', 'purchases', 'transfers', 'kardex', 'reports', 'reportPurchases', 'reportKardex', 'reportValuation', 'reportReplenishment', 'reportRotation', 'reportAging', 'reportTransfers', 'reportMargin'],
    comercial: ['dashboard', 'customers', 'quotations'],
    vendedor_tienda: ['dashboard', 'pos', 'customers', 'sales', 'quotations'],
  }

  return (permissions[role] || []).includes(section)
}
