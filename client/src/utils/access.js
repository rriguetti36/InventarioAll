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

export function canAccess(user, section) {
  const role = user?.role || 'user'
  if (role === 'admin') return true

  const permissions = {
    user: ['dashboard'],
    admin_tienda: ['dashboard', 'shelves', 'customers', 'stock', 'sales', 'transfers', 'quotations', 'kardex', 'reports', 'reportSales', 'reportKardex', 'reportTransfers'],
    administrativo: ['dashboard', 'products', 'customers', 'suppliers', 'locations', 'shelves', 'stock', 'purchases', 'sales', 'transfers', 'quotations', 'kardex', 'reports', 'reportSummary', 'reportSales', 'reportPurchases', 'reportKardex', 'reportValuation', 'reportReplenishment', 'reportRotation', 'reportAging', 'reportTransfers', 'reportMargin'],
    operativo: ['dashboard', 'products', 'customers', 'suppliers', 'locations', 'shelves', 'stock', 'purchases', 'transfers', 'kardex', 'reports', 'reportPurchases', 'reportKardex', 'reportValuation', 'reportReplenishment', 'reportRotation', 'reportAging', 'reportTransfers', 'reportMargin'],
    comercial: ['dashboard', 'customers', 'quotations'],
    vendedor_tienda: ['dashboard', 'customers', 'sales', 'quotations'],
  }

  return (permissions[role] || []).includes(section)
}
