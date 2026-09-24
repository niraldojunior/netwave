import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import { MigrationApi } from '../services/api';
import type { Technician } from '../types';
import { UserCheck, Plus, RefreshCw, Search, Edit2 } from 'lucide-react';

interface TechniciansPageProps {
  maId?: string;
}

export default function TechniciansPage({ maId }: { maId?: string }) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [techForm, setTechForm] = useState({
    externalTechId: '',
    name: '',
    vendorCompany: '',
  });

  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [editTechForm, setEditTechForm] = useState<{
    externalTechId: string;
    name: string;
    vendorCompany: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    externalTechId: '',
    name: '',
    vendorCompany: '',
    status: 'ACTIVE',
  });

  const fetchTechnicians = async () => {
    if (!maId) {
      setTechnicians([]);
      return;
    }
    setLoading(true);
    try {
      const data = await MigrationApi.listTechnicians(maId);
      setTechnicians(data);
    } catch (e) {
      console.error('Falha ao carregar técnicos de campo', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchTechnicians();
  }, [maId]);

  const handleCreateTech = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maId) return alert('Selecione um M&A no topo antes de cadastrar técnicos.');
    try {
      await MigrationApi.createTechnician({ ...techForm, maId });
      setIsTechModalOpen(false);
      setTechForm({
        externalTechId: '',
        name: '',
        vendorCompany: '',
      });
      await fetchTechnicians();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredTechnicians = technicians.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.externalTechId.toLowerCase().includes(q) ||
      t.vendorCompany.toLowerCase().includes(q)
    );
  });

  const pagedTechnicians = filteredTechnicians.slice((page - 1) * pageSize, page * pageSize);

  const handleOpenEditTech = (tech: Technician) => {
    setEditingTech(tech);
    setEditTechForm({
      externalTechId: tech.externalTechId,
      name: tech.name,
      vendorCompany: tech.vendorCompany,
      status: tech.status,
    });
  };

  const handleUpdateTech = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTech) return;
    try {
      await MigrationApi.updateTechnician(editingTech.id, editTechForm);
      setEditingTech(null);
      await fetchTechnicians();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const techColumns: DataTableColumn<Technician>[] = [
    {
      key: 'id',
      header: 'Matrícula',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
          {r.externalTechId}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Nome do Técnico',
      render: (r) => <span className="font-semibold text-xs text-[#2E2D39]">{r.name}</span>,
    },
    {
      key: 'vendorCompany',
      header: 'Empresa Prestadora',
      render: (r) => <span className="text-xs text-[#514F66]">{r.vendorCompany}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'ACTIVE' ? 'green' : 'neutral'}>{r.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenEditTech(r)}
            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Editar Técnico"
          >
            <Edit2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (!maId) {
    return (
      <div className="p-8 text-center text-[#8A8899]">
        Selecione um M&A no topo para visualizar e cadastrar a equipe de técnicos de campo.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Operacional
            </span>
            <h1 className="text-xl font-bold text-[#2E2D39]">Gestão de Técnicos</h1>
          </div>
          <p className="text-xs text-[#8A8899] mt-1">
            Pool de técnicos de campo dedicados à operação de migração física do M&A ativo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTechnicians} loading={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsTechModalOpen(true)}>
            <Plus size={14} className="mr-1" />
            Adicionar Técnico
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card
        title="Equipe Técnica de Campo"
        subtitle="Técnicos habilitados para atendimento e execução de ordens nas CDOs"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, matrícula ou empresa..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="vt-input pl-8 text-xs w-full"
            />
          </div>
          <div className="text-xs text-[#8A8899]">
            Total: {filteredTechnicians.length} técnicos {search.trim() ? 'encontrados' : 'cadastrados'}
          </div>
        </div>

        <DataTable
          columns={techColumns}
          rows={pagedTechnicians}
          rowKey={(r) => r.id}
          loading={loading}
          total={filteredTechnicians.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          emptyMessage="Nenhum técnico cadastrado para a onda selecionada. Clique em 'Adicionar Técnico' para cadastrar."
        />
      </Card>

      {/* Modal Novo Técnico */}
      {isTechModalOpen && (
        <Modal title="Cadastrar Técnico de Campo" onClose={() => setIsTechModalOpen(false)}>
          <form onSubmit={handleCreateTech} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1">
                  Matrícula
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: TECH-4091"
                  value={techForm.externalTechId}
                  onChange={(e) => setTechForm({ ...techForm, externalTechId: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-mono p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Mendes"
                  value={techForm.name}
                  onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
                  className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Empresa Prestadora de Serviço
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Conecta Telecom"
                value={techForm.vendorCompany}
                onChange={(e) => setTechForm({ ...techForm, vendorCompany: e.target.value })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setIsTechModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                Cadastrar Técnico
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Editar Técnico */}
      {editingTech && (
        <Modal title={`Editar Técnico: ${editingTech.name}`} onClose={() => setEditingTech(null)}>
          <form onSubmit={handleUpdateTech} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1">
                  Matrícula
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: TECH-4091"
                  value={editTechForm.externalTechId}
                  onChange={(e) => setEditTechForm({ ...editTechForm, externalTechId: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-mono p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Mendes"
                  value={editTechForm.name}
                  onChange={(e) => setEditTechForm({ ...editTechForm, name: e.target.value })}
                  className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Empresa Prestadora de Serviço
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Conecta Telecom"
                value={editTechForm.vendorCompany}
                onChange={(e) => setEditTechForm({ ...editTechForm, vendorCompany: e.target.value })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Status
              </label>
              <select
                required
                value={editTechForm.status}
                onChange={(e) => setEditTechForm({ ...editTechForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none font-medium"
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setEditingTech(null)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                Atualizar Técnico
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
