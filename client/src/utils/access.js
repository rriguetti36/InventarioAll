export const roleLabels = {
  admin: 'Admin',
  user: 'Usuario',
  admin_tienda: 'Admin Tienda',
  comercial: 'Comercial',
  vendedor_tienda: 'Vendedor Tienda',
}

export const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Usuario' },
  { value: 'admin_tienda', label: 'Admin Tienda' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'vendedor_tienda', label: 'Vendedor Tienda' },
]

export const storeScopedRoles = ['admin_tienda', 'vendedor_tienda']

export function canAccess(user, section) {
  const role = user?.role || 'user'
  if (role === 'admin') return true

  const permissions = {
    user: ['dashboard'],
    admin_tienda: ['dashboard', 'stock', 'sales', 'quotations', 'customers', 'paymentMethods', 'kardex'],
    comercial: ['dashboard', 'stock', 'quotations', 'paymentMethods', 'kardex'],
    vendedor_tienda: ['dashboard', 'stock', 'sales', 'quotations', 'customers', 'kardex'],
  }

  return (permissions[role] || []).includes(section)
}
