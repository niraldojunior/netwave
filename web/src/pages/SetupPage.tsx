import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import { MigrationApi } from '../services/api';
import type { Ma } from '../types';
import { BRAZILIAN_STATES } from '../constants/brazilian-states';
import { Plus, Edit2, Trash2, Search, RefreshCw, Building } from 'lucide-react';

export default function SetupPage({
  onRefreshMas,
}: {
  maId?: string;
  onRefreshMas: () => void;
}) {
  const [mas, setMas] = useState<Ma[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modals
  const [isMaModalOpen, setIsMaModalOpen] = useState(false);
  const [editingMa, setEditingMa] = useState<Ma | null>(null);

  // Forms
  const [maForm, setMaForm] = useState({
    name: '',
    originProvider: '',
    startDate: new Date().toISOString().substring(0, 10),
    uf: 'RJ',
    description: '',
    status: 'NEGOTIATION' as import('../types').MaStatus,
  });

  const [editMaForm, setEditMaForm] = useState({
    name: '',
    originProvider: '',
    startDate: '',
    uf: '',
    description: '',
    status: 'ACTIVE' as import('../types').MaStatus,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const masData = await MigrationApi.listMas();
      setMas(masData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await MigrationApi.createMa(maForm);
      setIsMaModalOpen(false);
      setMaForm({
        name: '',
        originProvider: '',
        startDate: new Date().toISOString().substring(0, 10),
        uf: 'RJ',
        description: '',
        status: 'NEGOTIATION',
      });
      await fetchData();
      onRefreshMas();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenEditMa = (ma: Ma) => {
    setEditingMa(ma);
    setEditMaForm({
      name: ma.name,
      originProvider: ma.originProvider,
      startDate: ma.startDate,
      uf: ma.uf,
      description: ma.description || '',
      status: ma.status,
    });
  };

  const handleUpdateMa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMa) return;
    try {
      await MigrationApi.updateMa(editingMa.id, editMaForm);
      setEditingMa(null);
      await fetchData();
      onRefreshMas();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteMa = async (ma: Ma) => {
    if (confirm(`Tem certeza que deseja cancelar a operação "${ma.name}"?`)) {
      try {
        await MigrationApi.deleteMa(ma.id);
        await fetchData();
        onRefreshMas();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const filteredMas = mas.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.originProvider.toLowerCase().includes(q) ||
      m.uf.toLowerCase().includes(q)
    );
  });

  const maColumns: DataTableColumn<Ma>[] = [
    { key: 'name', header: 'Operação M&A', render: (r) => <span className="font-semibold text-xs text-[#2E2D39]">{r.name}</span> },
    { key: 'originProvider', header: 'Provedor Origem', render: (r) => <span className="text-xs text-[#514F66]">{r.originProvider}</span> },
    { key: 'uf', header: 'UF', render: (r) => <Badge tone="neutral">{r.uf}</Badge> },
    { key: 'startDate', header: 'Data Início', render: (r) => <span className="text-xs text-[#514F66]">{r.startDate}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const toneMap: Record<string, 'green' | 'blue' | 'amber' | 'neutral' | 'red'> = {
          ACTIVE: 'green',
          NEGOTIATION: 'blue',
          PAUSED: 'amber',
          COMPLETED: 'neutral',
          CANCELLED: 'red',
          ARCHIVED: 'red',
        };
        const labelMap: Record<string, string> = {
          ACTIVE: 'Em Andamento',
          NEGOTIATION: 'Em Negociação',
          PAUSED: 'Pausado',
          COMPLETED: 'Concluído',
          CANCELLED: 'Cancelado',
          ARCHIVED: 'Cancelado',
        };
        return <Badge tone={toneMap[r.status] || 'neutral'}>{labelMap[r.status] || r.status}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenEditMa(r)}
            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Editar M&A"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDeleteMa(r)}
            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Cancelar Operação M&A"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFD919]/20 text-[#181919] border border-[#FFD919]/40">
              Estratégico
            </span>
            <h1 className="text-xl font-bold text-[#2E2D39]">Setup</h1>
          </div>
          <p className="text-xs text-[#8A8899] mt-1">
            Cadastro, edição, arquivamento e governança de operações adquiridas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} loading={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsMaModalOpen(true)}>
            <Plus size={14} /> Nova Onda de Migração
          </Button>
        </div>
      </div>

      {/* M&A Table Card */}
      <Card
        title="Ondas de Migração"
        subtitle="Bases adquiridas pela V.tal/Nio para migração física"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, provedor ou UF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="vt-input pl-8 text-xs w-full"
            />
          </div>
          <div className="text-xs text-[#8A8899]">
            Total: {mas.length} M&As cadastrados
          </div>
        </div>

        <DataTable
          columns={maColumns}
          rows={filteredMas}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="Nenhuma operação de M&A cadastrada."
        />
      </Card>

      {/* Modal Nova Onda de Migração */}
      {isMaModalOpen && (
        <Modal title="Cadastrar Nova Onda de Migração" onClose={() => setIsMaModalOpen(false)}>
          <form onSubmit={handleCreateMa} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#514F66] mb-1">Nome da Onda de Migração</label>
              <input
                type="text"
                required
                placeholder="Ex: M&A Fibrasul RJ"
                value={maForm.name}
                onChange={(e) => setMaForm({ ...maForm, name: e.target.value })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#514F66] mb-1">Provedor Regional de Origem</label>
              <input
                type="text"
                required
                placeholder="Ex: Fibrasul Telecom Ltda"
                value={maForm.originProvider}
                onChange={(e) => setMaForm({ ...maForm, originProvider: e.target.value })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1">UF Principal</label>
                <select
                  required
                  value={maForm.uf}
                  onChange={(e) => setMaForm({ ...maForm, uf: e.target.value })}
                  className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none font-bold"
                >
                  {BRAZILIAN_STATES.map((state) => (
                    <option key={state.uf} value={state.uf}>
                      {state.uf} - {state.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1">Data Início</label>
                <input
                  type="date"
                  required
                  value={maForm.startDate}
                  onChange={(e) => setMaForm({ ...maForm, startDate: e.target.value })}
                  className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#514F66] mb-1">Descrição / Observações (opcional)</label>
              <textarea
                rows={2}
                placeholder="Detalhes sobre a aquisição, escopo regional ou particularidades..."
                value={maForm.description}
                onChange={(e) => setMaForm({ ...maForm, description: e.target.value })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setIsMaModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                Salvar Onda de Migração
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Editar Onda de Migração */}
      {editingMa && (
        <Modal title={`Editar Onda de Migração: ${editingMa.name}`} onClose={() => setEditingMa(null)}>
          <form onSubmit={handleUpdateMa} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#514F66] mb-1">Nome da Onda de Migração</label>
              <input
                type="text"
                required
                value={editMaForm.name}
                onChange={(e) => setEditMaForm({ ...editMaForm, name: e.target.value })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#514F66] mb-1">Provedor Regional de Origem</label>
              <input
                type="text"
                required
                value={editMaForm.originProvider}
                onChange={(e) => setEditMaForm({ ...editMaForm, originProvider: e.target.value })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#514F66] mb-1">UF Principal</label>
                <select
                  required
                  value={editMaForm.uf}
                  onChange={(e) => setEditMaForm({ ...editMaForm, uf: e.target.value })}
                  className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none font-bold"
                >
                  {BRAZILIAN_STATES.map((state) => (
                    <option key={state.uf} value={state.uf}>
                      {state.uf} - {state.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#514F66] mb-1">Data Início</label>
                <input
                  type="date"
                  required
                  value={editMaForm.startDate}
                  onChange={(e) => setEditMaForm({ ...editMaForm, startDate: e.target.value })}
                  className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1">Status</label>
                <select
                  value={editMaForm.status}
                  onChange={(e) => setEditMaForm({ ...editMaForm, status: e.target.value as any })}
                  className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
                >
                  <option value="NEGOTIATION">Em Negociação</option>
                  <option value="ACTIVE">Em Andamento</option>
                  <option value="COMPLETED">Concluído</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#514F66] mb-1">Descrição / Observações</label>
              <textarea
                rows={2}
                value={editMaForm.description}
                onChange={(e) => setEditMaForm({ ...editMaForm, description: e.target.value })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setEditingMa(null)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                Atualizar Onda de Migração
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
