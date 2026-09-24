import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Modal from '../components/ui/Modal';
import { MigrationApi } from '../services/api';
import type { MigrationItem } from '../types';
import {
  Search,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  CheckCircle,
  Calendar,
  Layers,
  MapPin,
  HardHat,
  RotateCcw,
} from 'lucide-react';

interface OrdersPageProps {
  maId?: string;
  onNavigate?: (tab: any) => void;
}

export default function OrdersPage({ maId, onNavigate }: OrdersPageProps) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<MigrationItem | null>(null);

  const pageSize = 50;

  const fetchItems = async () => {
    if (!maId) return;
    setLoading(true);
    try {
      const data = await MigrationApi.listItems({
        maId,
        status: statusFilter || undefined,
        search: search || undefined,
        hasOs: true,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      // Apenas clientes com ordens abertas na Nio (nunca críticas de endereço ou viabilidade)
      const validOrders = data.items.filter(
        (i) =>
          (!!i.osId || !!i.crmOrderId) &&
          !['ADDRESS_EXCEPTION', 'NOT_VIABLE', 'IMPORTED', 'PREPARING'].includes(i.migrationStatus)
      );
      setItems(validOrders);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [maId, statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchItems();
  };

  const columns: DataTableColumn<MigrationItem>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      render: (r) => (
        <div>
          <div className="font-semibold text-xs text-[#2E2D39]">{r.customerName}</div>
          <div className="text-[11px] font-mono text-[#8A8899]">{r.externalCustomerId || r.customerId}</div>
        </div>
      ),
    },
    {
      key: 'os',
      header: 'OS NIO',
      render: (r) =>
        r.osId ? (
          <span className="font-mono text-xs font-bold text-blue-700">{r.osId}</span>
        ) : (
          <span className="text-[#8A8899] text-xs italic">Não criada</span>
        ),
    },
    {
      key: 'sa',
      header: 'SA',
      render: (r) =>
        r.saId ? (
          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
            {r.saId}
          </span>
        ) : (
          <span className="text-[#8A8899] text-xs italic">-</span>
        ),
    },
    {
      key: 'serial',
      header: 'Serial ONT',
      render: (r) => (
        <div>
          <span className="font-mono text-xs font-semibold text-[#2E2D39]">{r.ontSerialEffective}</span>
          {r.ontSerialEffective !== r.ontSerialOriginal && (
            <div className="text-[10px] text-amber-600 font-bold">Corrigido em campo</div>
          )}
        </div>
      ),
    },
    {
      key: 'cdo',
      header: 'CDO V.tal Alvo',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
          {r.targetBoxId || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusPill status={r.migrationStatus} />,
    },
    {
      key: 'schedule',
      header: 'Programação',
      render: (r) =>
        r.scheduledDate ? (
          <div>
            <div className="text-xs font-semibold text-[#2E2D39]">{r.scheduledDate}</div>
            <div className="text-[10px] text-[#8A8899]">{r.technicianId || 'Técnico de Campo'}</div>
          </div>
        ) : (
          <span className="text-[#8A8899] text-xs italic">Não agendado</span>
        ),
    },
    {
      key: 'actions',
      header: 'Detalhes',
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelectedItem(r)}
          className="text-xs p-1 px-2"
          title="Ver rastreabilidade 1:1:1"
        >
          <Eye size={13} className="mr-1" />
          Ver
        </Button>
      ),
    },
  ];

  if (!maId) {
    return (
      <div className="p-8 text-center text-[#8A8899]">
        Selecione um M&A no topo para consultar a gestão de ordens de serviço.
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
            <h1 className="text-xl font-bold text-[#2E2D39]">Ordens de Migração</h1>
          </div>
          <p className="text-xs text-[#8A8899] mt-1">
            Consulta individualizada e rastreamento de ordens geradas nos sistemas V.tal e CRM Nio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchItems} loading={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card
        title="Ordens de Migração em Andamento"
        subtitle={`Total de ${total} registros encontrados`}
      >
        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, OS, SA, CDO ou serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="vt-input pl-8 text-xs w-full"
            />
          </form>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
            {[
              { label: 'Todos', value: '' },
              { label: 'A Programar', value: 'OS_CREATED' },
              { label: 'Programado', value: 'SCHEDULED' },
              { label: 'Em Campo', value: 'IN_FIELD' },
              { label: 'Migrado OK', value: 'MIGRATED' },
              { label: 'Exceção Serial', value: 'SERIAL_EXCEPTION' },
              { label: 'Rollback', value: 'ROLLBACK_REQUESTED' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setStatusFilter(f.value);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === f.value
                    ? 'bg-[#2E2D39] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="Nenhuma ordem encontrada para os filtros aplicados."
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
        />
      </Card>

      {/* Item Detail Modal */}
      {selectedItem && (
        <Modal
          title={`Rastreabilidade 1:1:1 — ${selectedItem.customerName}`}
          onClose={() => setSelectedItem(null)}
        >
          <div className="space-y-4 text-xs">
            {/* Grid 1: Identifiers */}
            <div className="bg-[#FAFAFC] p-3 rounded border border-[#E9E8F2] space-y-2">
              <div className="font-bold text-[#2E2D39] uppercase text-[11px] tracking-wide border-b pb-1">
                Identificadores e Correlações de Sistemas
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#8A8899] block">ID Interno netWave:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.id}</span>
                </div>
                <div>
                  <span className="text-[#8A8899] block">Matrícula Cliente (M&A):</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.externalCustomerId}</span>
                </div>
                <div>
                  <span className="text-[#8A8899] block">OS NIO:</span>
                  <span className="font-mono font-bold text-blue-700">{selectedItem.osId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#8A8899] block">SA:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedItem.saId || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Grid 2: Physical & Infrastructure */}
            <div className="bg-[#FAFAFC] p-3 rounded border border-[#E9E8F2] space-y-2">
              <div className="font-bold text-[#2E2D39] uppercase text-[11px] tracking-wide border-b pb-1">
                Infraestrutura Física & Rede Neutra
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#8A8899] block">Caixa de Origem (M&A):</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedItem.originBoxId}</span>
                </div>
                <div>
                  <span className="text-[#8A8899] block">CDO V.tal Alvo:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedItem.targetBoxId || 'Aguardando'}</span>
                </div>
                <div>
                  <span className="text-[#8A8899] block">Serial ONT Original (Recebido):</span>
                  <span className="font-mono text-slate-700">{selectedItem.ontSerialOriginal}</span>
                </div>
                <div>
                  <span className="text-[#8A8899] block">Serial ONT Efetivo (Campo):</span>
                  <span className="font-mono font-bold text-emerald-700">{selectedItem.ontSerialEffective}</span>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-[#FAFAFC] p-3 rounded border border-[#E9E8F2] space-y-1">
              <div className="font-bold text-[#2E2D39] uppercase text-[11px] tracking-wide">
                Endereço Higienizado
              </div>
              <div className="text-slate-800 font-medium">{selectedItem.rawAddress}</div>
              <div className="text-slate-500 text-[11px]">
                {selectedItem.city} - {selectedItem.stateOrUf} | CEP: {selectedItem.cep}
              </div>
            </div>

            {/* Status and Errors */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border">
              <div>
                <span className="text-slate-500 block text-[11px]">Status Atual:</span>
                <StatusPill status={selectedItem.migrationStatus} />
              </div>
              {selectedItem.errorDescription && (
                <div className="text-right">
                  <span className="text-rose-600 font-semibold block text-[11px]">Mensagem de Erro:</span>
                  <span className="text-rose-700">{selectedItem.errorDescription}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedItem(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
