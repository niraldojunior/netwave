import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { MigrationApi } from '../services/api';
import type { MigrationLot } from '../types';
import {
  UploadCloud,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Play,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface ImportPageProps {
  maId?: string;
  onNavigate?: (tab: string) => void;
}

export default function ImportPage({ maId, onNavigate }: ImportPageProps) {
  const [lots, setLots] = useState<MigrationLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingLotId, setProcessingLotId] = useState<string | null>(null);

  // Modal de Importação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('lote_clientes_ma.csv');
  const [showPreview, setShowPreview] = useState(false);

  const fetchLots = async () => {
    setLoading(true);
    try {
      const data = await MigrationApi.listLots(maId);
      setLots(data);
    } catch (e) {
      console.error('Falha ao listar lotes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
  }, [maId]);

  // Download do arquivo CSV de exemplo
  const handleDownloadSampleCsv = () => {
    const sampleContent = `externalCustomerId,customerName,rawAddress,cep,city,state,ontSerial,originProvider,originBoxId
CUST-RJ-901,Maria Aparecida Silva,"Rua Coronel Moreira Cesar, 102",24230-050,Niterói,RJ,ALCLB440192,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-902,João Pedro Santos,"Rua Coronel Moreira Cesar, 104",24230-050,Niterói,RJ,ALCLB440193,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-903,Ana Claudia Oliveira,"Rua Coronel Moreira Cesar, 110",24230-050,Niterói,RJ,ALCLB440194,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-904,Carlos Eduardo Rocha,"Rua Coronel Moreira Cesar, 118",24230-050,Niterói,RJ,ALCLB440195,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-905,Fernanda Costa Lima,"Rua Coronel Moreira Cesar, 122",24230-050,Niterói,RJ,ALCLB440196,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-906,Roberto Mendes Souza,"Rua Coronel Moreira Cesar, 130",24230-050,Niterói,RJ,ALCLB440197,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-907,Juliana Martins Dias,"Rua Coronel Moreira Cesar, 134",24230-050,Niterói,RJ,ALCLB440198,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-908,Lucas Ferreira Gomes,"Rua Coronel Moreira Cesar, 140",24230-050,Niterói,RJ,ALCLB440199,Fibrasul,CDO-FIBRASUL-01`;

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_clientes_netwave.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const loadSampleData = () => {
    setFileName('amostra_cdo_icarai.csv');
    setCsvText(`externalCustomerId,customerName,rawAddress,cep,city,state,ontSerial,originProvider,originBoxId
CUST-RJ-901,Maria Aparecida Silva,"Rua Coronel Moreira Cesar, 102",24230-050,Niterói,RJ,ALCLB440192,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-902,João Pedro Santos,"Rua Coronel Moreira Cesar, 104",24230-050,Niterói,RJ,ALCLB440193,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-903,Ana Claudia Oliveira,"Rua Coronel Moreira Cesar, 110",24230-050,Niterói,RJ,ALCLB440194,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-904,Carlos Eduardo Rocha,"Rua Coronel Moreira Cesar, 118",24230-050,Niterói,RJ,ALCLB440195,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-905,Fernanda Costa Lima,"Rua Coronel Moreira Cesar, 122",24230-050,Niterói,RJ,ALCLB440196,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-906,Roberto Mendes Souza,"Rua Coronel Moreira Cesar, 130",24230-050,Niterói,RJ,ALCLB440197,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-907,Juliana Martins Dias,"Rua Coronel Moreira Cesar, 134",24230-050,Niterói,RJ,ALCLB440198,Fibrasul,CDO-FIBRASUL-01
CUST-RJ-908,Lucas Ferreira Gomes,"Rua Coronel Moreira Cesar, 140",24230-050,Niterói,RJ,ALCLB440199,Fibrasul,CDO-FIBRASUL-01`);
  };

  const handleProcessImport = async () => {
    if (!maId) return alert('Selecione uma onda de migração no topo antes de importar.');
    if (!csvText.trim()) return alert('Selecione um arquivo CSV ou carregue a amostra de clientes.');

    setUploading(true);
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length <= 1) throw new Error('O CSV precisa conter cabeçalho e ao menos uma linha de dados.');

      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] || '';
        });
        rows.push(obj);
      }

      const lot = await MigrationApi.uploadLot({
        maId,
        fileName,
        actor: 'OPERATOR_WEB',
        rows,
      });

      setCsvText('');
      setIsModalOpen(false);
      alert(`Lote ${lot.id} importado com sucesso! Recebidos ${lot.totalRecords} registros (${lot.validRecords} válidos).`);
      await fetchLots();
    } catch (err: any) {
      alert(`Erro na importação: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Disparo manual de esteira para lote
  const handleProcessPipeline = async (lot: MigrationLot) => {
    if (!maId) return;
    setProcessingLotId(lot.id);
    try {
      await MigrationApi.prepareItems({ maId, lotId: lot.id });
      await fetchLots();
    } catch (err: any) {
      alert(`Falha ao processar esteira do lote ${lot.id}: ${err.message}`);
    } finally {
      setProcessingLotId(null);
    }
  };

  // Helper para renderizar os 5 status do lote
  const renderLotStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
      case 'PENDING':
        return <Badge tone="blue" dot>Recebido</Badge>;
      case 'SANITIZING':
      case 'PREPARING':
      case 'PROCESSING':
        return <Badge tone="amber" dot>Higienizando</Badge>;
      case 'ANALYZING_VIABILITY':
        return <Badge tone="purple" dot>Análise Viabilidade</Badge>;
      case 'OPENING_OS':
        return <Badge tone="brand" dot>Em Abertura de OS's</Badge>;
      case 'COMPLETED':
        return <Badge tone="green" dot>Finalizado</Badge>;
      case 'FAILED':
        return <Badge tone="red" dot>Falhou</Badge>;
      default:
        return <Badge tone="neutral" dot>{status}</Badge>;
    }
  };

  const parsedRowCount = csvText.trim()
    ? Math.max(0, csvText.trim().split('\n').filter((l) => l.trim().length > 0).length - 1)
    : 0;

  return (
    <div className="p-6 space-y-6 w-full max-w-full">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#2E2D39]">Importação Lotes de Clientes</h1>
        <p className="text-xs text-[#8A8899]">
          Carga de clientes da base adquirida via arquivo CSV, controle de esteira e processamento no CRM.
        </p>
      </div>

      {/* SESSÃO 1: Barra de Ações (Download CSV de Exemplo e Importar Lote) */}
      <div className="bg-white rounded-xl border border-[#E9E8F2] p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-[#FFF9D2] border border-[#FFE766] flex items-center justify-center text-[#9A7D00] flex-shrink-0">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#2E2D39]">Arquivo Modelo para Importação</div>
            <div className="text-xs text-[#8A8899]">
              Baixe a planilha modelo (.csv) com os cabeçalhos esperados pela esteira de migração ou realize o upload de um novo lote.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-shrink-0">
          <Button
            variant="outline"
            size="md"
            onClick={handleDownloadSampleCsv}
            className="flex items-center gap-2 border-[#D7D5E5] text-[#2E2D39] hover:bg-[#F8F7FC]"
          >
            <Download size={15} />
            Baixar CSV de Exemplo
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setCsvText('');
              setFileName('lote_clientes_ma.csv');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <UploadCloud size={16} />
            Importar Novo Lote
          </Button>
        </div>
      </div>

      {/* SESSÃO 2: Tabela de Histórico de Importação de Lotes (Full-Width) */}
      <Card
        title="Histórico de Importação de Lotes"
        subtitle="Acompanhe o processamento dos arquivos e carga no CRM: higienização, viabilidade e abertura de OSs"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLots}
            loading={loading}
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        }
        noPadding
      >
        <div className="overflow-x-auto w-full">
          <table className="vt-table w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap min-w-[140px]">ID Lote</th>
                <th className="min-w-[200px]">Nome do Arquivo</th>
                <th className="whitespace-nowrap min-w-[130px]">Importação</th>
                <th className="!text-center whitespace-nowrap min-w-[90px]" style={{ textAlign: 'center' }}>Total</th>
                <th className="!text-center whitespace-nowrap min-w-[90px]" style={{ textAlign: 'center' }}>Válidos</th>
                <th className="!text-center whitespace-nowrap min-w-[90px]" style={{ textAlign: 'center' }}>Duplicados</th>
                <th className="!text-center whitespace-nowrap min-w-[90px]" style={{ textAlign: 'center' }}>Rejeitados</th>
                <th className="!text-center whitespace-nowrap min-w-[170px]" style={{ textAlign: 'center' }}>Status</th>
                <th className="!text-center whitespace-nowrap min-w-[140px]" style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && lots.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-xs text-[#8A8899]">
                    Carregando histórico de lotes...
                  </td>
                </tr>
              ) : lots.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-xs text-[#8A8899]">
                    Nenhum lote importado ainda para esta onda. Clique em &quot;Importar Novo Lote&quot; acima para iniciar.
                  </td>
                </tr>
              ) : (
                lots.map((lot) => {
                  const isProcessing = processingLotId === lot.id;
                  const isCompleted = lot.importStatus === 'COMPLETED';

                  return (
                    <tr key={lot.id} className="hover:bg-[#F8F7FC] transition-colors">
                      <td className="font-mono text-xs font-bold text-[#2E2D39] whitespace-nowrap">
                        {lot.id}
                      </td>
                      <td className="text-xs text-[#514F66] truncate max-w-[240px]" title={lot.fileName}>
                        <div className="flex items-center gap-1.5">
                          <FileText size={13} className="text-[#8A8899] flex-shrink-0" />
                          <span className="font-medium">{lot.fileName}</span>
                        </div>
                      </td>
                      <td className="text-xs text-[#8A8899] whitespace-nowrap">
                        {new Date(lot.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="!text-center font-medium text-xs whitespace-nowrap text-[#2E2D39]" style={{ textAlign: 'center' }}>
                        {lot.totalRecords.toLocaleString('pt-BR')}
                      </td>
                      <td className="!text-center text-xs font-semibold text-emerald-700 whitespace-nowrap" style={{ textAlign: 'center' }}>
                        {lot.validRecords.toLocaleString('pt-BR')}
                      </td>
                      <td className="!text-center text-xs text-amber-600 font-medium whitespace-nowrap" style={{ textAlign: 'center' }}>
                        {lot.duplicateRecords.toLocaleString('pt-BR')}
                      </td>
                      <td className="!text-center text-xs text-rose-600 font-medium whitespace-nowrap" style={{ textAlign: 'center' }}>
                        {lot.rejectedRecords.toLocaleString('pt-BR')}
                      </td>
                      <td className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>
                        {renderLotStatusBadge(lot.importStatus)}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {!isCompleted ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleProcessPipeline(lot)}
                              loading={isProcessing}
                              className="text-xs py-1 px-2.5 h-7"
                              title="Processar higienização, viabilidade e abertura de OS no CRM"
                            >
                              <Play size={11} className="mr-1 fill-current" />
                              Processar
                            </Button>
                          ) : (
                            <span className="inline-flex items-center text-[11px] text-emerald-700 font-semibold px-2 py-0.5 bg-emerald-50 rounded">
                              <CheckCircle2 size={12} className="mr-1" />
                              Carga OK
                            </span>
                          )}

                          {onNavigate && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onNavigate('triagem')}
                              className="text-xs py-1 px-2 h-7 text-[#514F66] border-[#D7D5E5]"
                              title="Ver exceções deste lote na Qualificação"
                            >
                              Qualificação
                              <ArrowRight size={11} className="ml-1" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DE IMPORTAÇÃO DE NOVO LOTE */}
      {isModalOpen && (
        <Modal
          title={
            <div className="flex items-center gap-2">
              <UploadCloud size={18} className="text-[#FFD919]" />
              <span>Importar Novo Lote de Clientes</span>
            </div>
          }
          width={620}
          onClose={() => {
            if (!uploading) setIsModalOpen(false);
          }}
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-[#8A8899]">
                {parsedRowCount > 0 ? (
                  <span className="font-semibold text-emerald-700">
                    {parsedRowCount.toLocaleString('pt-BR')} registros detectados
                  </span>
                ) : (
                  <span>Nenhum cliente carregado</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleProcessImport}
                  loading={uploading}
                  disabled={!csvText.trim()}
                >
                  <UploadCloud size={15} />
                  Processar Importação
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1.5">
                Arquivo CSV de Clientes
              </label>
              <div className="border border-dashed border-[#D7D5E5] rounded-lg p-4 bg-[#FAFAFB] hover:bg-[#F8F7FC] transition-colors">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-[#514F66] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#FFD919] file:text-[#181919] hover:file:bg-[#FFE047] cursor-pointer"
                />
                <p className="text-[11px] text-[#8A8899] mt-2">
                  Formato esperado: CSV delimitado por vírgula com cabeçalho contendo identificador, endereço e serial da ONT.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={loadSampleData}
                className="text-xs text-[#9A7D00] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet size={13} />
                Carregar Amostra para Teste (8 clientes)
              </button>

              {csvText.trim() && (
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-[#514F66] hover:underline cursor-pointer"
                >
                  {showPreview ? 'Ocultar Prévia do CSV' : 'Exibir Prévia do CSV'}
                </button>
              )}
            </div>

            {showPreview && (
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1.5">
                  Conteúdo do CSV ({fileName})
                </label>
                <textarea
                  rows={8}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Cole o CSV com cabeçalho aqui..."
                  className="w-full text-[11px] font-mono p-2.5 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
                />
              </div>
            )}

            <div className="bg-[#F8F7FC] border border-[#E9E8F2] rounded-md p-3 text-xs text-[#514F66] flex items-start gap-2.5">
              <AlertCircle size={15} className="text-[#8A8899] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#2E2D39]">Fluxo de Esteira:</span> Ao importar o arquivo, o lote é registrado como <span className="font-semibold text-blue-600">Recebido</span>. Em seguida, os clientes passam automaticamente por <span className="font-semibold text-amber-600">Higienização</span>, <span className="font-semibold text-purple-600">Análise de Viabilidade</span> e <span className="font-semibold text-[#9A7D00]">Abertura de OS</span> no CRM.
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
