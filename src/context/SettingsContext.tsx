import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Brand, ServiceType } from '@/types'

export type EligibleServiceType = Exclude<ServiceType, 'consolidado'>
export type SendChannel = 'whatsapp' | 'email'

export interface EmitterCnpj {
  id: string
  razaoSocial: string
  cnpj: string
}

// Chave do mapeamento marca+serviço -> emissor. Um serviço pode ter CNPJs
// diferentes por marca (ex: Royalties) ou o mesmo CNPJ pras duas (ex: Call
// Center, quando é uma operação compartilhada entre as marcas).
export function emitterKey(marca: Brand, service: EligibleServiceType): string {
  return `${marca}:${service}`
}

export interface AppSettings {
  serviceEligibility: Record<EligibleServiceType, boolean>
  sendChannel: SendChannel
  emitters: EmitterCnpj[]
  emitterMapping: Record<string, string | null>
}

interface SettingsContextValue extends AppSettings {
  toggleServiceEligibility: (service: EligibleServiceType) => void
  setSendChannel: (channel: SendChannel) => void
  addEmitter: (razaoSocial: string, cnpj: string) => void
  removeEmitter: (id: string) => void
  setEmitterMapping: (marca: Brand, service: EligibleServiceType, emitterId: string | null) => void
  emitterFor: (marca: Brand, service: EligibleServiceType) => EmitterCnpj | null
}

const DEFAULT_EMITTERS: EmitterCnpj[] = [
  { id: 'em-forneria-franquias', razaoSocial: 'Forneria Original Franquias LTDA', cnpj: '34.104.005/0001-86' },
  { id: 'em-theduck-franquias', razaoSocial: 'The Duck Franquias LTDA', cnpj: '62.588.733/0001-46' },
  { id: 'em-forneria-callcenter', razaoSocial: 'Forneria Original Callcenter LTDA', cnpj: '34.104.037/0001-81' },
]

const DEFAULT_MAPPING: Record<string, string | null> = {
  [emitterKey('Forneria', 'royalties')]: 'em-forneria-franquias',
  [emitterKey('The Duck', 'royalties')]: 'em-theduck-franquias',
  [emitterKey('Forneria', 'call_center')]: 'em-forneria-callcenter',
  [emitterKey('The Duck', 'call_center')]: 'em-forneria-callcenter',
  [emitterKey('Forneria', 'marketing')]: null,
  [emitterKey('The Duck', 'marketing')]: null,
}

// Configurações em memória (não persistidas — reseta ao recarregar a
// página). Ver TODO.md → "Inventário de dados fixos/fictícios". Controla:
// - quais serviços (Call Center/Royalties/Marketing) geram NFS-e ao emitir
//   (tela Faturamento → "Emitir nota fiscal por unidade");
// - por qual canal o botão "Enviar" dessa mesma tela dispara;
// - qual CNPJ emite a nota de cada serviço, por marca (cadastro de
//   CNPJs + mapeamento marca×serviço → CNPJ).
const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [serviceEligibility, setServiceEligibility] = useState<Record<EligibleServiceType, boolean>>({
    call_center: true,
    royalties: true,
    marketing: true,
  })
  const [sendChannel, setSendChannel] = useState<SendChannel>('whatsapp')
  const [emitters, setEmitters] = useState<EmitterCnpj[]>(DEFAULT_EMITTERS)
  const [emitterMapping, setEmitterMappingState] = useState<Record<string, string | null>>(DEFAULT_MAPPING)

  const value = useMemo<SettingsContextValue>(
    () => ({
      serviceEligibility,
      sendChannel,
      emitters,
      emitterMapping,
      toggleServiceEligibility: (service) => setServiceEligibility((prev) => ({ ...prev, [service]: !prev[service] })),
      setSendChannel,
      addEmitter: (razaoSocial, cnpj) =>
        setEmitters((prev) => [...prev, { id: crypto.randomUUID(), razaoSocial: razaoSocial.trim(), cnpj: cnpj.trim() }]),
      removeEmitter: (id) => {
        setEmitters((prev) => prev.filter((e) => e.id !== id))
        setEmitterMappingState((prev) =>
          Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v === id ? null : v])),
        )
      },
      setEmitterMapping: (marca, service, emitterId) =>
        setEmitterMappingState((prev) => ({ ...prev, [emitterKey(marca, service)]: emitterId })),
      emitterFor: (marca, service) => emitters.find((e) => e.id === emitterMapping[emitterKey(marca, service)]) ?? null,
    }),
    [serviceEligibility, sendChannel, emitters, emitterMapping],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings precisa estar dentro de <SettingsProvider>')
  return ctx
}
