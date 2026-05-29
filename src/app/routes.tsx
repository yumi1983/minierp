import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/shared/components/layout/AppShell'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { CompanyPage } from '@/features/company/CompanyPage'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { SuppliersPage } from '@/features/suppliers/SuppliersPage'
import { PurchasesPage } from '@/features/purchases/PurchasesPage'
import { SalesPage } from '@/features/sales/SalesPage'
import { ReceivablesPage } from '@/features/receivables/ReceivablesPage'
import { SupplierPaymentsPage } from '@/features/supplier-payments/SupplierPaymentsPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { CashRegisterPage } from '@/features/cash-register/CashRegisterPage'
import { UsersPage } from '@/features/users/UsersPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'


export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/inventory', element: <InventoryPage /> },
          { path: '/purchases', element: <PurchasesPage /> },
          { path: '/suppliers', element: <SuppliersPage /> },
          { path: '/supplier-payments', element: <SupplierPaymentsPage /> },
          { path: '/customers', element: <CustomersPage /> },
          { path: '/sales', element: <SalesPage /> },
          { path: '/receivables', element: <ReceivablesPage /> },
          { path: '/cash-register', element: <CashRegisterPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/company', element: <CompanyPage /> },
          { path: '/catalog', element: <CatalogPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
], { basename: import.meta.env.BASE_URL })
