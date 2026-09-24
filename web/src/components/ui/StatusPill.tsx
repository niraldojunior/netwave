import React from 'react';
import Badge, { type BadgeTone } from './Badge';
import type { MigrationStatus, ScheduleStatus } from '../../types';

export default function StatusPill({
  status,
}: {
  status: MigrationStatus | ScheduleStatus | string;
}) {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    // MigrationStatus
    IMPORTED: { label: 'Importado', tone: 'neutral' },
    PREPARING: { label: 'Preparando', tone: 'blue' },
    ADDRESS_EXCEPTION: { label: 'Exceção Endereço', tone: 'red' },
    NOT_VIABLE: { label: 'Inviável', tone: 'red' },
    READY: { label: 'Pronto (Viável)', tone: 'green' },
    AUTHORIZED: { label: 'Autorizado', tone: 'purple' },
    OS_CREATING: { label: 'Criando OS', tone: 'blue' },
    OS_CREATED: { label: 'OS Criada', tone: 'brand' },
    SCHEDULED: { label: 'Programado', tone: 'purple' },
    IN_FIELD: { label: 'Em Campo', tone: 'brand' },
    SERIAL_EXCEPTION: { label: 'Exceção Serial', tone: 'red' },
    ACTIVATING: { label: 'Ativando (Cutover)', tone: 'blue' },
    MIGRATED: { label: 'Migrado OK', tone: 'green' },
    MIGRATION_FAILED: { label: 'Falha Cutover', tone: 'red' },
    ROLLBACK_REQUESTED: { label: 'Rollback Solicitado', tone: 'amber' },
    ROLLBACK_IN_PROGRESS: { label: 'Rollback em Andamento', tone: 'amber' },
    ROLLED_BACK: { label: 'Revertido Origem', tone: 'neutral' },

    // ScheduleStatus
    AVAILABLE: { label: 'Disponível', tone: 'neutral' },
    IN_PROGRESS: { label: 'Em Execução', tone: 'brand' },
    COMPLETED: { label: 'Concluído', tone: 'green' },
    BLOCKED: { label: 'Bloqueado', tone: 'red' },

    // Decommission
    NOT_READY: { label: 'Não Elegível', tone: 'neutral' },
    PARTIALLY_MIGRATED: { label: 'Parcialmente Migrada', tone: 'amber' },
    READY_FOR_RELEASE: { label: 'Liberável (100% OK)', tone: 'green' },
    BLOCKED_BY_ROLLBACK: { label: 'Bloqueada por Rollback', tone: 'red' },
    RELEASED: { label: 'Desmobilizada', tone: 'neutral' },
  };

  const item = map[status] || { label: status, tone: 'neutral' as BadgeTone };
  return (
    <Badge tone={item.tone} dot={['IN_FIELD', 'ACTIVATING', 'PREPARING'].includes(status)}>
      {item.label}
    </Badge>
  );
}
