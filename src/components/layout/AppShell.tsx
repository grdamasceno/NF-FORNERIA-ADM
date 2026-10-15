import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { CobrandBar } from './CobrandBar'

const COLLAPSE_KEY = 'nf-forneria-sidebar-collapsed'

// Preferência só de exibição (recolher/expandir o menu) — fica no
// localStorage do navegador, não precisa ir pro banco.
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      // navegação privada ou storage bloqueado — segue sem persistir
    }
  }, [collapsed])

  return (
    <div
      className={`grid min-h-screen transition-[grid-template-columns] duration-200 max-[1080px]:grid-cols-1 ${
        collapsed ? 'grid-cols-[76px_1fr]' : 'grid-cols-[248px_1fr]'
      }`}
    >
      <div className="max-[1080px]:hidden">
        <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
      </div>
      <main className="max-w-[1380px] px-7 pb-10 pt-[22px] max-[560px]:px-3.5 max-[560px]:pb-9">
        <CobrandBar />
        <Outlet />
      </main>
    </div>
  )
}
