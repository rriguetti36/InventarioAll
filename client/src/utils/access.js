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

const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''

export const appMode =
  host.includes('inventpos.') || host.includes('invenpos.') ? 'inventpos'
    : host.includes('pos.') ? 'pos'
      : 'inventarios'

export function modulesForAppMode(mode = appMode) {
  if (mode === 'pos') return { inventory: false, pos: true }
  if (mode === 'inventpos') return { inventory: true, pos: true }
  return { inventory: true, pos: false }
}

export function planForAppMode(mode = appMode) {
  if (mode === 'pos') return 'pos'
  if (mode === 'inventpos') return 'invenpos'
  return 'inventory'
}

export function isPosStoreAdmin(user) {
  const modules = user?.modules || {}
  return user?.role === 'admin_tienda' && Boolean(modules.pos) && !modules.inventory
}

export function isAdminLike(user) {
  return user?.role === 'admin' || isPosStoreAdmin(user)
}

export function roleOptionsForAppMode(mode = appMode) {
  if (mode === 'pos') {
    return roleOptions.filter((role) => ['admin_tienda', 'vendedor_tienda'].includes(role.value))
  }
  return roleOptions
}

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

function appModeAllows(section) {
  if (appMode === 'inventpos') return true
  if (appMode === 'pos') return ['pos', 'locations', 'products', 'stock'].includes(section)
  if (appMode === 'inventarios') return section !== 'pos'
  return true
}

function moduleAllows(user, section) {
  if (!user?.companySlug) return true
  const modules = user.modules || {}
  if (section === 'pos') return Boolean(modules.pos)
  if (modules.pos && ['products', 'locations', 'stock'].includes(section)) return true
  if (inventorySections.includes(section)) return Boolean(modules.inventory)
  return true
}

export function canAccess(user, section) {
  const role = user?.role || 'user'
  if (!appModeAllows(section)) return false
  if (!moduleAllows(user, section)) return false
  if (isAdminLike(user)) return true

  const permissions = {
    user: ['dashboard'],
    admin_tienda: ['dashboard', 'pos', 'shelves', 'customers', 'stock', 'sales', 'transfers', 'quotations', 'kardex', 'reports', 'reportSales', 'reportKardex', 'reportTransfers'],
    administrativo: ['dashboard', 'pos', 'products', 'customers', 'suppliers', 'locations', 'shelves', 'stock', 'purchases', 'sales', 'transfers', 'quotations', 'kardex', 'reports', 'reportSummary', 'reportSales', 'reportPurchases', 'reportKardex', 'reportValuation', 'reportReplenishment', 'reportRotation', 'reportAging', 'reportTransfers', 'reportMargin'],
    operativo: ['dashboard', 'products', 'customers', 'suppliers', 'locations', 'shelves', 'stock', 'purchases', 'transfers', 'kardex', 'reports', 'reportPurchases', 'reportKardex', 'reportValuation', 'reportReplenishment', 'reportRotation', 'reportAging', 'reportTransfers', 'reportMargin'],
    comercial: ['dashboard', 'customers', 'quotations'],
    vendedor_tienda: appMode === 'pos' ? ['pos'] : ['dashboard', 'pos', 'customers', 'sales', 'quotations'],
  }

  return (permissions[role] || []).includes(section)
}
