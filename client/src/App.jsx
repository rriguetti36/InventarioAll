import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Box } from '@chakra-ui/react'
import Login from './pages/Login'
import RegisterCompany from './pages/RegisterCompany'
import CompanyAdmin from './pages/CompanyAdmin'
import Dashboard from './pages/Dashboard'
import CreateUser from './pages/CreateUser'
import UserList from './pages/UserList'
import {
  LocationForm,
  LocationList,
  CustomerForm,
  CustomerList,
  ProductForm,
  ProductList,
  PurchaseForm,
  PurchaseList,
  PaymentMethodForm,
  PaymentMethodList,
  QuotationForm,
  QuotationList,
  SaleForm,
  SaleList,
  ShelfForm,
  ShelfList,
  StockList,
  SupplierForm,
  SupplierList,
  KardexList,
  TransferForm,
  TransferList,
} from './pages/InventoryPages'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import RoleRoute from './components/RoleRoute'
import PlatformAdminRoute from './components/PlatformAdminRoute'
import DashboardLayout from './components/DashboardLayout'

export default function App(){
  return (
    <Box>
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/register-company" element={<RegisterCompany/>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><AdminRoute><DashboardLayout><UserList/></DashboardLayout></AdminRoute></ProtectedRoute>} />
        <Route path="/users/add" element={<ProtectedRoute><AdminRoute><DashboardLayout><CreateUser/></DashboardLayout></AdminRoute></ProtectedRoute>} />
        <Route path="/companies" element={<ProtectedRoute><PlatformAdminRoute><DashboardLayout><CompanyAdmin/></DashboardLayout></PlatformAdminRoute></ProtectedRoute>} />
        <Route path="/inventory/products" element={<ProtectedRoute><RoleRoute section="products"><DashboardLayout><ProductList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/products/add" element={<ProtectedRoute><RoleRoute section="products"><DashboardLayout><ProductForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/products/edit/:id" element={<ProtectedRoute><RoleRoute section="products"><DashboardLayout><ProductForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/suppliers" element={<ProtectedRoute><RoleRoute section="suppliers"><DashboardLayout><SupplierList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/suppliers/add" element={<ProtectedRoute><RoleRoute section="suppliers"><DashboardLayout><SupplierForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/suppliers/edit/:id" element={<ProtectedRoute><RoleRoute section="suppliers"><DashboardLayout><SupplierForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/customers" element={<ProtectedRoute><RoleRoute section="customers"><DashboardLayout><CustomerList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/customers/add" element={<ProtectedRoute><RoleRoute section="customers"><DashboardLayout><CustomerForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/customers/edit/:id" element={<ProtectedRoute><RoleRoute section="customers"><DashboardLayout><CustomerForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/quotations" element={<ProtectedRoute><RoleRoute section="quotations"><DashboardLayout><QuotationList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/quotations/add" element={<ProtectedRoute><RoleRoute section="quotations"><DashboardLayout><QuotationForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/quotations/edit/:id" element={<ProtectedRoute><RoleRoute section="quotations"><DashboardLayout><QuotationForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/payment-methods" element={<ProtectedRoute><RoleRoute section="paymentMethods"><DashboardLayout><PaymentMethodList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/payment-methods/add" element={<ProtectedRoute><RoleRoute section="paymentMethods"><DashboardLayout><PaymentMethodForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/payment-methods/edit/:id" element={<ProtectedRoute><RoleRoute section="paymentMethods"><DashboardLayout><PaymentMethodForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/locations" element={<ProtectedRoute><RoleRoute section="locations"><DashboardLayout><LocationList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/locations/add" element={<ProtectedRoute><RoleRoute section="locations"><DashboardLayout><LocationForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/locations/edit/:id" element={<ProtectedRoute><RoleRoute section="locations"><DashboardLayout><LocationForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/shelves" element={<ProtectedRoute><RoleRoute section="shelves"><DashboardLayout><ShelfList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/shelves/add" element={<ProtectedRoute><RoleRoute section="shelves"><DashboardLayout><ShelfForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/shelves/edit/:id" element={<ProtectedRoute><RoleRoute section="shelves"><DashboardLayout><ShelfForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/purchases" element={<ProtectedRoute><RoleRoute section="purchases"><DashboardLayout><PurchaseList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/purchases/add" element={<ProtectedRoute><RoleRoute section="purchases"><DashboardLayout><PurchaseForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/transfers" element={<ProtectedRoute><RoleRoute section="transfers"><DashboardLayout><TransferList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/transfers/add" element={<ProtectedRoute><RoleRoute section="transfers"><DashboardLayout><TransferForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/sales" element={<ProtectedRoute><RoleRoute section="sales"><DashboardLayout><SaleList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/sales/add" element={<ProtectedRoute><RoleRoute section="sales"><DashboardLayout><SaleForm/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/stock" element={<ProtectedRoute><RoleRoute section="stock"><DashboardLayout><StockList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
        <Route path="/inventory/kardex" element={<ProtectedRoute><RoleRoute section="kardex"><DashboardLayout><KardexList/></DashboardLayout></RoleRoute></ProtectedRoute>} />
      </Routes>
    </Box>
  )
}
