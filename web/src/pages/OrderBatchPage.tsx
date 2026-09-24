import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Badge from '../components/ui/Badge';
import { MigrationApi } from '../services/api';
import type { MigrationItem } from '../types';
import { Shield, Send, CheckCircle2, RefreshCw } from 'lucide-react';

export default function OrderBatchPage({ maId }: { maId?: string }) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);

  const fetchReadyItems = async () => {
    setLoading(true);
    try {
      const data = await MigrationApi.listItems({
        maId,
        status: 'READY',
        limit: 100,
      });
      setItems(data.items);
      setTotal(data.total);
      // Auto-select all by default
      setSelectedIds(new Set(data.items.map((i) => i.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyItems();
  }, [maId]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleAuthorizeOrders = async () => {
    if (!maId) return alert('Selecione um M&A no topo.');
    if (selectedIds.size === 0) return alert('Selecione ao menos um cliente.');

    setProcessing(true);
    try {
      const res = await MigrationApi.authorizeOsBatch({
        maId,
        itemIds: Array.from(selectedIds),
      });
      setBatchResult(res);
      fetchReadyItems();
    } catch (err: any) {
      alert(`Falha ao autorizar ordens: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const columns: DataTableColumn<MigrationItem>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={items.length > 0 && selectedIds.size === items.length}
          onChange={toggleSelectAll}
          className="rounded cursor-pointer"
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={() => toggleSelect(r.id)}
          className="rounded cursor-pointer"
        />
      ),
      cellClassName: 'w-10 text-center',
      headerClassName: 'w-10 text-center',
    },
    {
      key: 'customer',
      header: 'Cliente / CRM ID',
      render: (r) => (
        <div>
          <div className="font-semibold text-xs text-[#2E2D39]">{r.customerName}</div>
          <div className="text-[11px] font-mono text-[#8A8899]">{r.customerId}</div>
        </div>
      ),
    },
    {
      key: 'serial',
      header: 'Serial ONT Original',
      render: (r) => <span className="font-mono text-xs font-semibold text-[#2E2D39]">{r.ontSerialEffective}</span>,
    },
    {
      key: 'cdo',
      header: 'CDO / HC Destino',
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold text-[#2E2D39]">{r.targetBoxId}</div>
          <div className="text-[10px] text-[#8A8899]">{r.targetHcId}</div>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Município / Bairro',
      render: (r) => `${r.city} - ${r.neighborhood || 'Centro'}`,
    },
    {
      key: 'viability',
      header: 'Viabilidade Técnica',
      render: () => <Badge tone="green">VIÁVEL CONFIRMADO</Badge>,
    },
    {
      key: 'status',
      header: 'Status Atual',
      render: (r) => <StatusPill status={r.migrationStatus} />,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2E2D39]">Abertura Massiva Individual de OS (1:1:1)</h1>
          <p className="text-xs text-[#8A8899]">
            Disparo de comando massivo garantindo <b>1 Cliente = 1 OS = 1 SA</b> prontas para agendamento por CDO
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleAuthorizeOrders}
            loading={processing}
            disabled={selectedIds.size === 0}
          >
            <Send size={15} /> Autorizar e Criar {selectedIds.size} OSs & SAs
          </Button>
        </div>
      </div>

      {/* Mandatory Rule Banner */}
      <div className="p-4 bg-[#FEF7DC] border border-[#FFE047] rounded-lg text-xs text-[#856404] flex items-start gap-3">
        <Shield size={20} className="shrink-0 mt-0.5 text-[#9A7D00]" />
        <div>
          <b className="font-semibold">Regra Corporativa Mandatória — 1 Cliente = 1 OS = 1 SA:</b>
          <p className="mt-0.5 leading-relaxed">
            Mesmo quando autorizados em bloco, cada cliente gera sua própria OS no Salesforce e seu próprio SA no
            Fulfillment enriquecido com o serial validado da ONT. As ordens são geradas sem atribuição técnica inicial,
            aguardando a programação em lote por CDO/CDOI para o técnico de campo.
          </p>
        </div>
      </div>

      {/* Batch Result Feedback */}
      {batchResult && (
        <div className="p-4 bg-white border border-[#E8E8EE] rounded-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-[#10B981]" />
            <div>
              <div className="text-sm font-bold text-[#2E2D39]">
                Comando Executado: Lote {batchResult.id}
              </div>
              <div className="text-xs text-[#514F66]">
                {batchResult.successCount} ordens geradas com sucesso · {batchResult.failedCount} com falha
              </div>
            </div>
          </div>
          <Badge tone={batchResult.status === 'COMPLETED' ? 'green' : 'amber'}>
            {batchResult.status}
          </Badge>
        </div>
      )}

      {/* Table */}
      <Card
        title={`Clientes Elegíveis para Autorização (${total})`}
        subtitle="Apenas clientes com viabilidade técnica confirmada (READY) podem ter OS gerada"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#514F66]">
              Selecionados: <b>{selectedIds.size}</b>
            </span>
            <Button variant="ghost" size="sm" onClick={fetchReadyItems}>
              <RefreshCw size={14} />
            </Button>
          </div>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="Nenhum cliente em status READY aguardando abertura de OS."
        />
      </Card>
    </div>
  );
}
