// src/constants/menu.js

export const MENU_ITEMS = [
  { label: 'Pedidos', path: '/orders', permission: null },  // visible para cualquier autenticado

  { label: 'Productos', path: '/products', permission: null },  // GET abierto a cualquier autenticado
  
  { label: 'Inventario', path: '/inventory', permission: 'inventory:ver' },
  
  { label: 'Empresas', path: '/companies', permission: 'company:ver' },
  
  { label: 'Cuentas bancarias', path: '/banks-accounts', permission: 'bank_account:ver' },
  
  // { label: 'Pagos', path: '/payments', permission: 'payment:ver' },
  // { label: 'Mis pagos', path: '/my-payments', permission: 'payment:ver_propio' },


  // { label: 'Transporte', path: '/assignments', permission: 'assignment:ver' },

  // { label: 'Guías de despacho', path: '/dispatch-guides', permission: 'dispatch_guide:ver' },

  // { label: 'Vehículos', path: '/vehicles', permission: 'vehicle:ver' },
  // { label: 'Transportistas', path: '/carriers', permission: 'carrier:ver' },


  // { label: 'Documentos', path: '/documents', permission: 'document:ver' },


  // { label: 'Lista negra', path: '/document-blacklist', permission: 'blacklist:gestionar' },

  // { label: 'Usuarios', path: '/users', permission: 'user:gestionar' },
]