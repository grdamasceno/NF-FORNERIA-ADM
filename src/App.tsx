import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { Franquias } from '@/pages/Franquias'
import { Faturamento } from '@/pages/Faturamento'
import { NotasFiscais } from '@/pages/NotasFiscais'
import { BoletosPix } from '@/pages/BoletosPix'
import { Envios } from '@/pages/Envios'
import { Relatorios } from '@/pages/Relatorios'
import { Configuracoes } from '@/pages/Configuracoes'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="franquias" element={<Franquias />} />
        <Route path="faturamento" element={<Faturamento />} />
        <Route path="notas-fiscais" element={<NotasFiscais />} />
        <Route path="boletos-pix" element={<BoletosPix />} />
        <Route path="envios" element={<Envios />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
    </Routes>
  )
}
