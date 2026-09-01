import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Brand, ServiceType } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
  addEmitter as addEmitterRemote,
  removeEmitter as removeEmitterRemote,
  updateEmitterFiscalData as updateEmitterFiscalDataRemote,
  fetchEmitters,
  fetchEmitterMapping,
  upsertEmitterMapping,
  emitterKey,
  type LiveEmitter,
  type EmitterMappingEntry,
} from '@/lib/liveEmitters'

export type EligibleServiceType = Exclude<ServiceType, 'consolidado'>
export type SendChannel = 'whatsapp' | 'email'

export type EmitterCnpj = LiveEmitter
export type { EmitterMappingEntry }
export { emitterKey }

export interface AppSettings {
  serviceEligibility: Record<EligibleServiceType, boolean>
  sendChannel: SendChannel
  emitters: EmitterCnpj[]
  emitterMapping: Record<string, EmitterMappingEntry>
}

interface SettingsContextValue extends AppSettings {
  toggleServiceEligibility: (service: EligibleServiceType) => void
  setSendChannel: (channel: SendChannel) => void
  addEmitter: (razaoSocial: string, cnpj: string) => void
  removeEmitter: (id: string) => void
  updateEmitterFiscalData: (
    id: string,
    patch: Partial<Pick<EmitterCnpj, 'inscricaoMunicipal' | 'codigoMunicipio' | 'optanteSimplesNacional'>>,
  ) => void
  setEmitterMapping: (marca: Brand, service: EligibleServiceType, emitterId: string | null) => void
  setEmitterItemListaServico: (marca: Brand, service: EligibleServiceType, value: string) => void
  setEmitterIssRetido: (marca: Brand, service: EligibleServiceType, issRetido: boolean) => void
  emitterFor: (marca: Brand, service: EligibleServiceType) => EmitterCnpj | null
}

const EMPTY_MAPPING_ENTRY: EmitterMappingEntry = { emitterId: null, itemListaServico: null, issRetido: false }

// `serviceEligibility`, `emitters` e `emitterMapping` (CNPJ emissor, item da
// LC 116/2003 e retenção de ISS por marca×serviço) persistem de verdade em
// `nf_forneria.emitters`/`emitter_mapping`, com RLS por organização
// (migration 0007) — igual `lib/liveUnits.ts`. Só `sendChannel` continua em
// memória (ver TODO.md → "Inventário de dados fixos/fictícios").
const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()

  const [serviceEligibility, setServiceEligibility] = useState<Record<EligibleServiceType, boolean>>({
    call_center: true,
    royalties: true,
    marketing: true,
  })
  const [sendChannel, setSendChannel] = useState<SendChannel>('whatsapp')
  const [emitters, setEmitters] = useState<EmitterCnpj[]>([])
  const [emitterMapping, setEmitterMappingState] = useState<Record<string, EmitterMappingEntry>>({})
  const [tenantIdByBrand, setTenantIdByBrand] = useState<Partial<Record<Brand, string>>>({})
  // `superadmin` não tem organização fixa (enxerga todas, via RLS). Hoje só
  // existe uma organização de verdade ("Grupo Original"), então usamos a
  // primeira encontrada como padrão pra ele conseguir configurar algo — até
  // existir a tela de trocar/gerenciar organizações (ver TODO.md).
  const [fallbackOrganizationId, setFallbackOrganizationId] = useState<string | null>(null)
  const organizationId = profile?.organizationId ?? fallbackOrganizationId

  useEffect(() => {
    if (profile?.organizationId || profile?.role !== 'superadmin') return
    let cancelled = false
    supabase
      .from('organizations')
      .select('id')
      .order('created_at')
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled || error || !data?.[0]) return
        setFallbackOrganizationId(data[0].id)
      })
    return () => {
      cancelled = true
    }
  }, [profile?.organizationId, profile?.role])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false

    supabase
      .from('service_eligibility')
      .select('service_type, enabled')
      .eq('organization_id', organizationId)
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

    fetchEmitters()
      .then((rows) => {
        if (!cancelled) setEmitters(rows)
      })
      .catch((err) => console.error('Falha ao carregar CNPJs emissores:', err.message))

    fetchEmitterMapping()
      .then(({ mapping, tenantIdByBrand }) => {
        if (cancelled) return
        setEmitterMappingState(mapping)
        setTenantIdByBrand(tenantIdByBrand)
      })
      .catch((err) => console.error('Falha ao carregar mapeamento de emissores:', err.message))

    return () => {
      cancelled = true
    }
  }, [organizationId])

  const value = useMemo<SettingsContextValue>(
    () => ({
      serviceEligibility,
      sendChannel,
      emitters,
      emitterMapping,
      toggleServiceEligibility: (service) => {
        setServiceEligibility((prev) => {
          const enabled = !prev[service]
          if (organizationId) {
            supabase
              .from('service_eligibility')
              .update({ enabled, updated_at: new Date().toISOString() })
              .eq('organization_id', organizationId)
              .eq('service_type', service)
              .then(({ error }) => {
                if (error) console.error('Falha ao salvar elegibilidade de serviço:', error.message)
              })
          }
          return { ...prev, [service]: enabled }
        })
      },
      setSendChannel,
      addEmitter: (razaoSocial, cnpj) => {
        if (!razaoSocial.trim() || !cnpj.trim()) return
        if (!organizationId) {
          console.error('Falha ao cadastrar CNPJ emissor: usuário sem organização (superadmin ainda não escolheu uma).')
          return
        }
        addEmitterRemote(razaoSocial.trim(), cnpj.trim(), organizationId)
          .then((created) =>
            setEmitters((prev) => [...prev, created].sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial))),
          )
          .catch((err) => console.error('Falha ao cadastrar CNPJ emissor:', err.message))
      },
      updateEmitterFiscalData: (id, patch) => {
        setEmitters((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
        updateEmitterFiscalDataRemote(id, patch).catch((err) =>
          console.error('Falha ao salvar dado fiscal do emissor:', err.message),
        )
      },
      removeEmitter: (id) => {
        setEmitters((prev) => prev.filter((e) => e.id !== id))
        setEmitterMappingState((prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([k, v]) => [k, v.emitterId === id ? { ...v, emitterId: null } : v]),
          ),
        )
        removeEmitterRemote(id).catch((err) => console.error('Falha ao remover CNPJ emissor:', err.message))
      },
      setEmitterMapping: (marca, service, emitterId) => {
        const key = emitterKey(marca, service)
        setEmitterMappingState((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_MAPPING_ENTRY), emitterId } }))
        const tenantId = tenantIdByBrand[marca]
        if (tenantId) {
          upsertEmitterMapping({ tenantId, service, emitterId }).catch((err) =>
            console.error('Falha ao salvar emissor do serviço:', err.message),
          )
        }
      },
      setEmitterItemListaServico: (marca, service, valueText) => {
        const key = emitterKey(marca, service)
        const itemListaServico = valueText.trim() || null
        setEmitterMappingState((prev) => ({
          ...prev,
          [key]: { ...(prev[key] ?? EMPTY_MAPPING_ENTRY), itemListaServico },
        }))
        const tenantId = tenantIdByBrand[marca]
        if (tenantId) {
          upsertEmitterMapping({ tenantId, service, itemListaServico }).catch((err) =>
            console.error('Falha ao salvar item da lista de serviço:', err.message),
          )
        }
      },
      setEmitterIssRetido: (marca, service, issRetido) => {
        const key = emitterKey(marca, service)
        setEmitterMappingState((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_MAPPING_ENTRY), issRetido } }))
        const tenantId = tenantIdByBrand[marca]
        if (tenantId) {
          upsertEmitterMapping({ tenantId, service, issRetido }).catch((err) =>
            console.error('Falha ao salvar retenção de ISS:', err.message),
          )
        }
      },
      emitterFor: (marca, service) =>
        emitters.find((e) => e.id === emitterMapping[emitterKey(marca, service)]?.emitterId) ?? null,
    }),
    [serviceEligibility, sendChannel, emitters, emitterMapping, organizationId, tenantIdByBrand],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings precisa estar dentro de <SettingsProvider>')
  return ctx
}
