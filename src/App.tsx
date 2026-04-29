import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'

import Index from '@/pages/Index'
import Auth from '@/pages/Auth'
import Profile from '@/pages/Profile'
import Book from '@/pages/Book'
import RidePage from '@/pages/Ride'
import Track from '@/pages/Track'
import History from '@/pages/History'
import Wallet from '@/pages/Wallet'
import Install from '@/pages/Install'
import DriverRegister from '@/pages/driver/Register'
import DriverDashboard from '@/pages/driver/Dashboard'
import Admin from '@/pages/Admin'

function ProtectedRoute({ children, allowedRoles }: {
  children: React.ReactNode
  allowedRoles?: ('passenger' | 'driver' | 'admin')[]
}) {
  const { user, role, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>
  if (!user) return <Navigate to="/auth" replace />
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/track/:token" element={<Track />} />
        <Route path="/install" element={<Install />} />

        {/* Passager */}
        <Route path="/book" element={<ProtectedRoute allowedRoles={['passenger', 'admin']}><Book /></ProtectedRoute>} />
        <Route path="/ride/:id" element={<ProtectedRoute><RidePage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Chauffeur */}
        <Route path="/driver/register" element={<ProtectedRoute><DriverRegister /></ProtectedRoute>} />
        <Route path="/driver/dashboard" element={<ProtectedRoute allowedRoles={['driver', 'admin']}><DriverDashboard /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Admin /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
