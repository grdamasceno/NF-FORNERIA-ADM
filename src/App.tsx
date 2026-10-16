import { Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Franquias } from '@/pages/Franquias'
import { Faturamento } from '@/pages/Faturamento'
import { PreencherValores } from '@/pages/PreencherValores'
import { PreencherPublico } from '@/pages/PreencherPublico'
import { RedefinirSenha } from '@/pages/RedefinirSenha'
import { Relatorios } from '@/pages/Relatorios'
import { Configuracoes } from '@/pages/Configuracoes'
import { Usuarios } from '@/pages/Usuarios'

// A partir da migration 0007, o app exige sessão real (Supabase Auth) —
// sem ela, RLS bloqueia praticamente tudo. `Gate` decide entre spinner,
// tela de login ou o app de verdade, conforme `AuthContext`.
function Gate() {
  const { session, loading, profile, profileLoading, signOut } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-[13px] text-muted">Carregando…</div>
  }

  if (!session) {
    return <Login />
  }

  if (profileLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-[13px] text-muted">Carregando…</div>
  }

  // Sessão válida (e-mail/senha corretos), mas sem perfil cadastrado nesse
  // app — essa instância de Auth é compartilhada com outros sistemas da
  // OnChannel, então uma conta de outro app consegue autenticar aqui sem
  // nunca ter sido de fato cadastrada no NF-FORNERIA-ADM. Sem essa checagem,
  // a pessoa entrava e via um painel incompleto/vazio em vez de um aviso
  // claro (achado real, 2026-10-16).
  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
        <p className="max-w-[360px] text-[14px] font-semibold text-navy">
          Seu login é válido, mas essa conta não tem acesso configurado neste painel. Fala com um administrador pra te cadastrar
          aqui.
        </p>
        <button
          onClick={() => signOut()}
          className="rounded-[11px] border border-line bg-card px-4 py-[9px] text-[12.5px] font-bold text-navy"
        >
          Sair
        </button>
      </div>
    )
  }

  return (
    <SettingsProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="franquias" element={<Franquias />} />
          <Route path="faturamento" element={<Faturamento />} />
          <Route path="faturamento/preencher" element={<PreencherValores />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="usuarios" element={<Usuarios />} />
        </Route>
      </Routes>
    </SettingsProvider>
  )
}

// Rota pública fica fora do AuthProvider/Gate de propósito — precisa
// funcionar sem sessão nenhuma, acessada só por quem tem o token do link
// (ver supabase/functions/public-fill-values).
export default function App() {
  return (
    <Routes>
      <Route path="/preencher-publico/:token" element={<PreencherPublico />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route
        path="*"
        element={
          <AuthProvider>
            <Gate />
          </AuthProvider>
        }
      />
    </Routes>
  )
}
