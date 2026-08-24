import { Route, Routes } from 'react-router-dom'
import { SettingsProvider } from '@/context/SettingsContext'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { Franquias } from '@/pages/Franquias'
import { Faturamento } from '@/pages/Faturamento'
import { Relatorios } from '@/pages/Relatorios'
import { Configuracoes } from '@/pages/Configuracoes'

export default function App() {
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
