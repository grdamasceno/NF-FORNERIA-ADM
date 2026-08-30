import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Brand, ServiceType } from '@/types'
import { supabase } from '@/lib/supabase'

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

// `serviceEligibility` é a única fatia deste contexto que já persiste de
// verdade (tabela `nf_forneria.service_eligibility`, RLS aberto pra anon —
// decisão explícita do usuário em 2026-08-30, ver migration 0005). O resto
// (canal de envio, CNPJs emissores e mapeamento marca×serviço) continua em
// memória — reseta ao recarregar. Ver TODO.md → "Inventário de dados
// fixos/fictícios".
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

  useEffect(() => {
    let cancelled = false
    supabase
      .from('service_eligibility')
      .select('service_type, enabled')
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        setServiceEligibility((prev) => {
          const next = { ...prev }
          for (const row of data as Array<{ service_type: EligibleServiceType; enabled: boolean }>) {
            next[row.service_type] = row.enabled
          }
          return next
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<SettingsContextValue>(
    () => ({
      serviceEligibility,
      sendChannel,
      emitters,
      emitterMapping,
      toggleServiceEligibility: (service) => {
        setServiceEligibility((prev) => {
          const enabled = !prev[service]
          supabase
            .from('service_eligibility')
            .update({ enabled, updated_at: new Date().toISOString() })
            .eq('service_type', service)
            .then(({ error }) => {
              if (error) console.error('Falha ao salvar elegibilidade de serviço:', error.message)
            })
          return { ...prev, [service]: enabled }
        })
      },
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
