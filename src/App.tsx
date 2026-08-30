import { Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Franquias } from '@/pages/Franquias'
import { Faturamento } from '@/pages/Faturamento'
import { Relatorios } from '@/pages/Relatorios'
import { Configuracoes } from '@/pages/Configuracoes'

// A partir da migration 0007, o app exige sessão real (Supabase Auth) —
// sem ela, RLS bloqueia praticamente tudo. `Gate` decide entre spinner,
// tela de login ou o app de verdade, conforme `AuthContext`.
function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-[13px] text-muted">Carregando…</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <SettingsProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="franquias" element={<Franquias />} />
          <Route path="faturamento" element={<Faturamento />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
      </Routes>
    </SettingsProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
