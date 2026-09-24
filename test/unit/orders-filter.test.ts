import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMigrationRepository } from '../../src/shared/persistence/in-memory-migration-repository.js';
import type { MigrationItem } from '../../src/shared/domain/types.js';

describe('Orders Filter - Sem Programação', () => {
  let repository: InMemoryMigrationRepository;

  beforeEach(() => {
    repository = new InMemoryMigrationRepository();
  });

  it('deve filtrar corretamente OSs sem programação (UNSCHEDULED)', async () => {
    const maId = 'MA-TEST-01';

    const item1: MigrationItem = {
      id: 'ITEM-1',
      maId,
      lotId: 'LOT-1',
      customerId: 'CUST-1',
      externalCustomerId: 'EXT-1',
      subscriptionId: 'SUB-1',
      customerName: 'Cliente Agendado',
      rawAddress: 'Rua A, 1',
      cep: '24000-000',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Origem',
      originBoxId: 'BOX-ORIG-1',
      ontSerialOriginal: 'SN001',
      ontSerialEffective: 'SN001',
      osId: 'OS-001',
      saId: 'SA-001',
      migrationStatus: 'SCHEDULED',
      scheduledDate: '2026-09-25',
      technicianId: 'Carlos',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const item2: MigrationItem = {
      id: 'ITEM-2',
      maId,
      lotId: 'LOT-1',
      customerId: 'CUST-2',
      externalCustomerId: 'EXT-2',
      subscriptionId: 'SUB-2',
      customerName: 'Cliente Sem Programação',
      rawAddress: 'Rua B, 2',
      cep: '24000-000',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Origem',
      originBoxId: 'BOX-ORIG-1',
      ontSerialOriginal: 'SN002',
      ontSerialEffective: 'SN002',
      osId: 'OS-002',
      saId: 'SA-002',
      migrationStatus: 'OS_CREATED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const item3: MigrationItem = {
      id: 'ITEM-3',
      maId,
      lotId: 'LOT-1',
      customerId: 'CUST-3',
      externalCustomerId: 'EXT-3',
      subscriptionId: 'SUB-3',
      customerName: 'Cliente Sem OS (Inviável)',
      rawAddress: 'Rua C, 3',
      cep: '24000-000',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Origem',
      originBoxId: 'BOX-ORIG-1',
      ontSerialOriginal: 'SN003',
      ontSerialEffective: 'SN003',
      migrationStatus: 'NOT_VIABLE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repository.createItems([item1, item2, item3]);

    const all = await repository.listItems({ maId });
    expect(all.total).toBe(3);

    const unscheduled = await repository.listItems({ maId, status: 'UNSCHEDULED' });
    expect(unscheduled.total).toBe(1);
    expect(unscheduled.items[0].id).toBe('ITEM-2');
    expect(unscheduled.items[0].osId).toBe('OS-002');
  });

  it('deve retornar apenas clientes com ordens abertas na Nio quando hasOs for true, excluindo exceções', async () => {
    const maId = 'MA-TEST-02';

    const itemOk: MigrationItem = {
      id: 'ITEM-10',
      maId,
      lotId: 'LOT-1',
      customerId: 'CUST-10',
      externalCustomerId: 'EXT-10',
      subscriptionId: 'SUB-10',
      customerName: 'Cliente Com OS',
      rawAddress: 'Rua Valida, 10',
      cep: '24000-000',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Origem',
      originBoxId: 'BOX-1',
      ontSerialOriginal: 'SN010',
      ontSerialEffective: 'SN010',
      osId: 'OS-010',
      crmOrderId: 'CRM-010',
      saId: 'SA-010',
      migrationStatus: 'OS_CREATED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const itemAddressCritique: MigrationItem = {
      id: 'ITEM-11',
      maId,
      lotId: 'LOT-1',
      customerId: 'CUST-11',
      externalCustomerId: 'EXT-11',
      subscriptionId: 'SUB-11',
      customerName: 'Cliente Crítica Endereço',
      rawAddress: 'Rua Desconhecida, S/N',
      cep: '99999-999',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Origem',
      originBoxId: 'BOX-1',
      ontSerialOriginal: 'SN011',
      ontSerialEffective: 'SN011',
      migrationStatus: 'ADDRESS_EXCEPTION',
      errorStage: 'TRIAGEM',
      errorDescription: 'Endereço não localizado',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const itemNotViable: MigrationItem = {
      id: 'ITEM-12',
      maId,
      lotId: 'LOT-1',
      customerId: 'CUST-12',
      externalCustomerId: 'EXT-12',
      subscriptionId: 'SUB-12',
      customerName: 'Cliente Inviável',
      rawAddress: 'Rua Longe, 999',
      cep: '24000-000',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Origem',
      originBoxId: 'BOX-1',
      ontSerialOriginal: 'SN012',
      ontSerialEffective: 'SN012',
      migrationStatus: 'NOT_VIABLE',
      errorStage: 'TRIAGEM',
      errorDescription: 'Fora do alcance de CDO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repository.createItems([itemOk, itemAddressCritique, itemNotViable]);

    const res = await repository.listItems({ maId, hasOs: true });
    expect(res.total).toBe(1);
    expect(res.items.length).toBe(1);
    expect(res.items[0].id).toBe('ITEM-10');
    expect(res.items[0].osId).toBe('OS-010');
  });
});
