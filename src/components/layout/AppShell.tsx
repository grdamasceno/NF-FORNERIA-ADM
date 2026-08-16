import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { CobrandBar } from './CobrandBar'

export function AppShell() {
  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr] max-[1080px]:grid-cols-1">
      <div className="max-[1080px]:hidden">
        <Sidebar />
      </div>
      <main className="max-w-[1380px] px-7 pb-10 pt-[22px] max-[560px]:px-3.5 max-[560px]:pb-9">
        <CobrandBar />
        <Outlet />
      </main>
    </div>
  )
}
