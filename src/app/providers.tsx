import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { AuthProvider } from '@/core/auth/AuthProvider'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { router } from './routes'

export function AppProviders() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: 'text-sm',
            duration: 3000,
          }}
        />
      </AuthProvider>
    </TooltipProvider>
  )
}
