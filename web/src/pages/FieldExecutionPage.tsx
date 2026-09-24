import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Modal from '../components/ui/Modal';
import { MigrationApi } from '../services/api';
import type { MigrationItem } from '../types';
import { Edit2, RefreshCw } from 'lucide-react';

export default function FieldExecutionPage({ maId }: { maId?: string }) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Serial Correction Modal
  const [serialModalItem, setSerialModalItem] = useState<MigrationItem | null>(null);
  const [newSerial, setNewSerial] = useState('');
  const [reason, setReason] = useState('SOURCE_DATA_MISMATCH');
  const [observation, setObservation] = useState('');
  const [savingSerial, setSavingSerial] = useState(false);

  const fetchFieldItems = async () => {
    setLoading(true);
    try {
      const data = await MigrationApi.listItems({
        maId,
        limit: 100,
      });
      const fieldList = data.items.filter((i) =>
        ['SCHEDULED', 'IN_FIELD', 'SERIAL_EXCEPTION', 'MIGRATION_FAILED'].includes(i.migrationStatus),
      );
      setItems(fieldList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFieldItems();
  }, [maId]);

  const openSerialModal = (item: MigrationItem) => {
    setSerialModalItem(item);
    setNewSerial('');
    setReason('SOURCE_DATA_MISMATCH');
    setObservation('');
  };

  const handleSaveSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialModalItem || !newSerial.trim()) return;

    setSavingSerial(true);
    try {
      await MigrationApi.overrideSerial(serialModalItem.id, {
        newSerial: newSerial.trim().toUpperCase(),
        reason,
        observation,
      });
      alert(`Serial atualizado para ${newSerial.toUpperCase()} com sucesso! Original preservado.`);
      setSerialModalItem(null);
      fetchFieldItems();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingSerial(false);
    }
  };

  const columns: DataTableColumn<MigrationItem>[] = [
    {
      key: 'customer',
      header: 'Cliente / Endereço',
      render: (r) => (
        <div>
          <div className="font-semibold text-xs text-[#2E2D39]">{r.customerName}</div>
          <div className="text-[11px] text-[#514F66] truncate max-w-[200px]">{r.rawAddress}</div>
        </div>
      ),
    },
    {
      key: 'cdo',
      header: 'CDO / HC',
      render: (r) => (
        <div>
          <span className="font-mono font-bold text-xs text-[#2E2D39]">{r.targetBoxId}</span>
          <div className="text-[10px] text-[#8A8899]">{r.targetHcId}</div>
        </div>
      ),
    },
    {
      key: 'tech',
      header: 'Técnico Responsável',
      render: (r) => (
        <div className="text-xs font-medium text-[#2E2D39]">
          {r.technicianId || 'Não atribuído'}
        </div>
      ),
    },
    {
      key: 'serial',
      header: 'Serial ONT (Original / Efetivo)',
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-bold text-[#2E2D39]">{r.ontSerialEffective}</div>
          {r.ontSerialEffective !== r.ontSerialOriginal ? (
            <span className="text-[10px] text-amber-600 font-medium">
              Original: {r.ontSerialOriginal}
            </span>
          ) : (
            <span className="text-[10px] text-[#8A8899]">Original do M&A</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status de Campo',
      render: (r) => <StatusPill status={r.migrationStatus} />,
    },
    {
      key: 'action',
      header: 'Ação do Técnico',
      render: (r) => (
        <Button variant="outline" size="sm" onClick={() => openSerialModal(r)}>
          <Edit2 size={12} /> Corrigir Serial
        </Button>
      ),
      cellClassName: 'text-right',
      headerClassName: 'text-right',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E2D39]">Execução e Atendimento em Campo</h1>
          <p className="text-xs text-[#8A8899]">
            Acompanhamento das atividades de transposição física e controle de divergência de seriais de ONT
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFieldItems}>
          <RefreshCw size={14} /> Atualizar
        </Button>
      </div>

      {/* Table */}
      <Card
        title="Ordens em Campo & Programadas"
        subtitle="Controle individualizado por cliente e suporte a override controlado de serial de ONT"
        noPadding
      >
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="Nenhuma ordem programada ou em campo no momento."
        />
      </Card>

      {/* Serial Override Modal */}
      {serialModalItem && (
        <Modal
          title="Corrigir Serial da ONT em Campo"
          onClose={() => setSerialModalItem(null)}
        >
          <form onSubmit={handleSaveSerial} className="space-y-4">
            <div className="p-3 bg-[#FAFAFB] border border-[#E8E8EE] rounded text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#8A8899]">Cliente:</span>
                <span className="font-semibold text-[#2E2D39]">{serialModalItem.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8899]">Serial Original (M&A):</span>
                <span className="font-mono font-bold text-[#514F66]">
                  {serialModalItem.ontSerialOriginal}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8899]">Serial Efetivo Atual:</span>
                <span className="font-mono font-bold text-[#2E2D39]">
                  {serialModalItem.ontSerialEffective}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Novo Serial Físico Encontrado na Casa
              </label>
              <input
                type="text"
                required
                placeholder="Ex: ALCLB998877"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">Motivo da Divergência</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              >
                <option value="SOURCE_DATA_MISMATCH">Divergência na Base da Operadora de Origem</option>
                <option value="PREVIOUS_ONT_REPLACEMENT">Troca Física Anterior Realizada no Cliente</option>
                <option value="IMPORT_DATA_ERROR">Erro Estrutural na Importação do Lote</option>
                <option value="OTHER">Outro Motivo Operacional</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">Observações do Técnico</label>
              <textarea
                rows={3}
                placeholder="Detalhes adicionais coletados em campo..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>

            <div className="p-2.5 bg-[#FEF7DC] border border-[#FFE047] rounded text-[11px] text-[#856404]">
              <b>Regra de Auditoria:</b> O serial original da importação <u>nunca será destruído</u> e ficará
              armazenado em <code className="font-mono">ontSerialOriginal</code>. O evento será registrado em{' '}
              <code className="font-mono">NW_SERIAL_CHANGE</code>.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setSerialModalItem(null)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" loading={savingSerial}>
                Confirmar Correção
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
