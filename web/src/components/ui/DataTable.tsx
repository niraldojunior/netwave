import React, { type ReactNode } from 'react';
import Button from './Button';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  cellClassName?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: ReactNode;
  loading?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = 'Nenhum item encontrado.',
  loading = false,
  total,
  page = 1,
  pageSize = 50,
  onPageChange,
}: DataTableProps<T>) {
  const totalPages = total !== undefined ? Math.ceil(total / pageSize) : 1;

  return (
    <div className="vt-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="vt-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.headerClassName}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-[#8A8899]">
                  <span className="inline-block w-5 h-5 border-2 border-[#8A8899] border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                  Carregando registros...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-[#8A8899] text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={col.cellClassName}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total !== undefined && total > 0 && onPageChange && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E8E8EE] bg-[#FAFAFB] text-xs text-[#514F66]">
          <div>
            Mostrando <b>{((page - 1) * pageSize + 1).toLocaleString('pt-BR')}</b> a{' '}
            <b>{Math.min(page * pageSize, total).toLocaleString('pt-BR')}</b> de{' '}
            <b>{total.toLocaleString('pt-BR')}</b> registros
          </div>
          <div className="flex items-center gap-1.5">
            {totalPages > 2 && (
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(1)}
                title="Primeira página"
                className="px-2"
              >
                «
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <span className="px-2 font-medium">
              Página {page} de {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Próxima
            </Button>
            {totalPages > 2 && (
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(totalPages)}
                title="Última página"
                className="px-2"
              >
                »
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
