import { useState } from 'react'
import type { LiveUnit } from '@/types'
import { updateUnit, type UnitEditableFields } from '@/lib/liveUnits'

interface EditUnitModalProps {
  unit: LiveUnit
  onClose: () => void
  onSaved: (unit: LiveUnit) => void
}

// Campos "essenciais" pedidos: CNPJ + endereço estruturado (logradouro,
// número, bairro, CEP, código do município, UF) + contato — é o mínimo pro
// tomador da NFS-e (ver seção 8 do MD / integração Focus NFe). Código do
// município ainda é preenchido à mão (não deriva automaticamente de
// cidade/UF ainda — ver TODO.md).
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
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof UnitEditableFields>(key: K, value: UnitEditableFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
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
        className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-card bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-navy">Editar {unit.name}</h3>
          <span className="rounded-[7px] bg-[#eef1f4] px-2 py-1 text-[11px] font-bold text-faint">{unit.marca}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome (fantasia)" value={form.name} onChange={(v) => set('name', v)} />
          <Field
            label="Razão social"
            value={form.razaoSocial ?? ''}
            onChange={(v) => set('razaoSocial', v)}
            placeholder="Ex: Forneria Bangu Pizzaria e Restaurante LTDA - EPP"
          />
          <Field label="CNPJ" value={form.cnpj ?? ''} onChange={(v) => set('cnpj', v)} placeholder="00.000.000/0000-00" />
          <Field label="Telefone" value={form.telefone ?? ''} onChange={(v) => set('telefone', v)} placeholder="(21) 90000-0000" />
          <Field label="E-mail" value={form.email ?? ''} onChange={(v) => set('email', v)} full />

          <Field label="Logradouro" value={form.logradouro ?? ''} onChange={(v) => set('logradouro', v)} />
          <Field label="Número" value={form.numero ?? ''} onChange={(v) => set('numero', v)} />
          <Field label="Bairro" value={form.bairro ?? ''} onChange={(v) => set('bairro', v)} />
          <Field label="CEP" value={form.cep ?? ''} onChange={(v) => set('cep', v)} placeholder="00000-000" />
          <Field label="Cidade" value={form.cidade ?? ''} onChange={(v) => set('cidade', v)} />
          <Field label="Estado" value={form.estado ?? ''} onChange={(v) => set('estado', v)} />
          <Field label="UF" value={form.uf ?? ''} onChange={(v) => set('uf', v.toUpperCase().slice(0, 2))} placeholder="RJ" />
          <Field
            label="Código do município (IBGE)"
            value={form.codigoMunicipio ?? ''}
            onChange={(v) => set('codigoMunicipio', v)}
            placeholder="3304557"
          />

          <Field label="Endereço (exibição)" value={form.endereco ?? ''} onChange={(v) => set('endereco', v)} full />
          <Field label="Horário" value={form.horario ?? ''} onChange={(v) => set('horario', v)} full />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => set('active', !form.active)}
            className={`rounded-[8px] px-3 py-[7px] text-[12px] font-bold ${form.active ? 'bg-green-soft text-green' : 'bg-[#eef1f4] text-faint'}`}
          >
            {form.active ? 'Ativa' : 'Inativa'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-[9px] border border-line px-4 py-[9px] text-[12.5px] font-bold text-navy">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-[9px] bg-orange px-4 py-[9px] text-[12.5px] font-bold text-white disabled:opacity-50"
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
  full,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  full?: boolean
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? 'col-span-2' : ''}`}>
      <span className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
      />
    </label>
  )
}
