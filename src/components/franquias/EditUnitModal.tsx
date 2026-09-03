import { useState } from 'react'
import type { LiveUnit } from '@/types'
import { updateUnit, type UnitEditableFields } from '@/lib/liveUnits'

interface EditUnitModalProps {
  unit: LiveUnit
  onClose: () => void
  onSaved: (unit: LiveUnit) => void
}

const UF_TO_ESTADO: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
}

interface ViaCepResponse {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  ibge?: string
}

// Campos "essenciais" pedidos: CNPJ + endereço estruturado (logradouro,
// número, bairro, CEP, código do município, UF) + contato — é o mínimo pro
// tomador da NFS-e (ver seção 8 do MD / integração Focus NFe). CEP dispara
// busca automática (ViaCEP) que já preenche logradouro/bairro/cidade/UF/
// código do município — o usuário só confirma e completa o número.
export function EditUnitModal({ unit, onClose, onSaved }: EditUnitModalProps) {
  const [form, setForm] = useState<UnitEditableFields>({
    name: unit.name,
    razaoSocial: unit.razaoSocial ?? '',
    cnpj: unit.cnpj ?? '',
    active: unit.active,
    cidade: unit.cidade ?? '',
    estado: unit.estado ?? '',
    uf: unit.uf ?? '',
    endereco: unit.endereco ?? '',
    logradouro: unit.logradouro ?? '',
    numero: unit.numero ?? '',
    bairro: unit.bairro ?? '',
    cep: unit.cep ?? '',
    codigoMunicipio: unit.codigoMunicipio ?? '',
    telefone: unit.telefone ?? '',
    email: unit.email ?? '',
    horario: unit.horario ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof UnitEditableFields>(key: K, value: UnitEditableFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCepChange(rawCep: string) {
    set('cep', rawCep)
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data: ViaCepResponse = await resp.json()
      if (data.erro) return
      setForm((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
        estado: data.uf ? (UF_TO_ESTADO[data.uf] ?? prev.estado) : prev.estado,
        codigoMunicipio: data.ibge || prev.codigoMunicipio,
      }))
    } catch {
      // busca falhou (rede, CEP inexistente) — usuário continua podendo
      // preencher os campos à mão, não é bloqueante
    } finally {
      setCepLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const normalized: UnitEditableFields = {
        ...form,
        razaoSocial: form.razaoSocial?.trim() || null,
        cnpj: form.cnpj?.trim() || null,
        cidade: form.cidade?.trim() || null,
        estado: form.estado?.trim() || null,
        uf: form.uf?.trim() || null,
        endereco: form.endereco?.trim() || null,
        logradouro: form.logradouro?.trim() || null,
        numero: form.numero?.trim() || null,
        bairro: form.bairro?.trim() || null,
        cep: form.cep?.trim() || null,
        codigoMunicipio: form.codigoMunicipio?.trim() || null,
        telefone: form.telefone?.trim() || null,
        email: form.email?.trim() || null,
        horario: form.horario?.trim() || null,
      }
      await updateUnit(unit.id, normalized)
      onSaved({ ...unit, ...normalized })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-card border border-line bg-card p-5 shadow-[0_2px_6px_rgba(15,23,42,0.07)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-navy">Editar {unit.name}</h3>
          <span className="rounded-[7px] bg-[#eef1f4] px-2 py-1 text-[11px] font-bold text-faint">{unit.marca}</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nome (fantasia)" value={form.name} onChange={(v) => set('name', v)} />
            <Field
              label="Razão social"
              value={form.razaoSocial ?? ''}
              onChange={(v) => set('razaoSocial', v)}
              placeholder="Ex: Forneria Bangu Pizzaria e Restaurante LTDA"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="CNPJ" value={form.cnpj ?? ''} onChange={(v) => set('cnpj', v)} placeholder="00.000.000/0000-00" />
            <Field label="Telefone" value={form.telefone ?? ''} onChange={(v) => set('telefone', v)} placeholder="(21) 90000-0000" />
            <Field label="E-mail" value={form.email ?? ''} onChange={(v) => set('email', v)} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Logradouro" value={form.logradouro ?? ''} onChange={(v) => set('logradouro', v)} />
            <Field label="Número" value={form.numero ?? ''} onChange={(v) => set('numero', v)} />
            <Field label="Bairro" value={form.bairro ?? ''} onChange={(v) => set('bairro', v)} />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Field
              label={cepLoading ? 'CEP (buscando…)' : 'CEP'}
              value={form.cep ?? ''}
              onChange={handleCepChange}
              placeholder="00000-000"
            />
            <Field label="Cidade" value={form.cidade ?? ''} onChange={(v) => set('cidade', v)} />
            <Field label="Estado" value={form.estado ?? ''} onChange={(v) => set('estado', v)} />
            <Field label="UF" value={form.uf ?? ''} onChange={(v) => set('uf', v.toUpperCase().slice(0, 2))} placeholder="RJ" />
          </div>

          <Field
            label="Código do município (IBGE)"
            value={form.codigoMunicipio ?? ''}
            onChange={(v) => set('codigoMunicipio', v)}
            placeholder="3304557"
          />
          <Field label="Endereço (exibição)" value={form.endereco ?? ''} onChange={(v) => set('endereco', v)} />
          <Field label="Horário" value={form.horario ?? ''} onChange={(v) => set('horario', v)} />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => set('active', !form.active)}
            className={`rounded-[8px] px-3 py-[6px] text-[12px] font-bold ${form.active ? 'bg-green-soft text-green' : 'bg-[#eef1f4] text-faint'}`}
          >
            {form.active ? 'Ativa' : 'Inativa'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-[9px] border border-line px-4 py-[8px] text-[12px] font-bold text-navy">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-[9px] bg-orange px-4 py-[8px] text-[12px] font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-[12px] font-semibold text-red">{error}</p>}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9.5px] font-bold uppercase tracking-[.05em] text-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-[7px] border border-line bg-white px-[8px] py-[5px] text-[12px] text-navy placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-orange-soft"
      />
    </label>
  )
}
