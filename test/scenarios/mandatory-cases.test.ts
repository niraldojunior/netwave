import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMigrationRepository } from '../../src/shared/persistence/in-memory-migration-repository.js';
import { MigrationService } from '../../src/modules/migration-service.js';

describe('netWave Mandatory Operational Scenarios', () => {
  let repository: InMemoryMigrationRepository;
  let service: MigrationService;

  beforeEach(async () => {
    repository = new InMemoryMigrationRepository();
    service = new MigrationService({ repository });
  });

  // -------------------------------------------------------------------
  // Caso 1: 1.000 clientes autorizados na Triagem
  // Esperado: 1.000 OSs individuais, 1.000 SAs individuais abertos automaticamente
  // -------------------------------------------------------------------
  it('Caso 1: Deve criar 1.000 OSs e 1.000 SAs individuais para 1.000 clientes autorizados', async () => {
    const ma = await service.createMa({
      name: 'M&A Fibrasul',
      originProvider: 'Fibrasul Telecom',
      startDate: '2026-09-01',
      uf: 'RJ',
    });

    // Gerar 1000 clientes em lote
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      externalCustomerId: `CUST-EXT-${10000 + i}`,
      customerId: `CRM-NIO-${10000 + i}`,
      customerName: `Cliente Teste ${i}`,
      rawAddress: `Rua das Flores, ${i}, Centro`,
      cep: '24000-000',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: `ALCLB${100000 + i}`,
      originProvider: 'Fibrasul',
      originBoxId: `CDO-FIBRASUL-${Math.floor(i / 10)}`,
    }));

    const lot = await service.importCustomerLot({
      maId: ma.id,
      fileName: 'lote_1000.csv',
      actor: 'TEST_AGENT',
      rows,
    });

    expect(lot.validRecords).toBe(1000);

    // Triagem dos 1000 clientes: higienização, viabilidade e abertura automática 1:1:1
    const prepResult = await service.prepareItems({ maId: ma.id });
    expect(prepResult.ready).toBe(1000);

    // Validar granularidade estrita: cada cliente deve ter sua própria OS e SA
    const allItems = await repository.listItems({ maId: ma.id, limit: 1000 });
    const osIds = new Set<string>();
    const saIds = new Set<string>();

    for (const item of allItems.items) {
      expect(item.migrationStatus).toBe('OS_CREATED');
      expect(item.osId).toBeDefined();
      expect(item.saId).toBeDefined();
      expect(item.crmOrderId).toBeDefined();
      expect(item.osId).toMatch(/^OS-VT-/);
      expect(item.saId).toMatch(/^SA-VT-/);

      osIds.add(item.osId!);
      saIds.add(item.saId!);
    }

    // Nenhuma OS ou SA pode ser compartilhada!
    expect(osIds.size).toBe(1000);
    expect(saIds.size).toBe(1000);
  });

  // -------------------------------------------------------------------
  // Caso 2: 999 OSs criadas com sucesso, 1 falha
  // Esperado: 999 SUCCESS, 1 FAILED. Retentativa processa apenas a falha.
  // -------------------------------------------------------------------
  it('Caso 2: Partial failure (999 sucesso / 1 falha) e retentativa isolada do cliente com falha', async () => {
    const ma = await service.createMa({
      name: 'M&A SulTelecom',
      originProvider: 'SulTelecom',
      startDate: '2026-09-01',
      uf: 'PR',
    });

    // 10 clientes para teste representativo (9 sucessos, 1 falha induzida)
    const rows = Array.from({ length: 10 }, (_, i) => ({
      externalCustomerId: i === 9 ? 'FAIL_OS_CUSTOMER' : `CUST-SUL-${i}`,
      customerId: i === 9 ? 'FAIL_OS_999' : `CRM-SUL-${i}`,
      customerName: `Cliente ${i}`,
      rawAddress: `Av Batel, ${i}`,
      cep: '80000-000',
      city: 'Curitiba',
      state: 'PR',
      ontSerial: `HWTC${10000 + i}`,
      originProvider: 'SulTelecom',
      originBoxId: 'CDO-SUL-01',
    }));

    await service.importCustomerLot({
      maId: ma.id,
      fileName: 'lote_com_falha.csv',
      actor: 'TEST_AGENT',
      rows,
    });

    // Triagem: 9 devem obter OS automaticamente, 1 deve falhar na abertura
    const prepResult = await service.prepareItems({ maId: ma.id });
    expect(prepResult.ready).toBe(9);

    // O cliente 9 deve ter permanecido em READY com registro de erro
    const failedItem = await repository.getItemByExternalId(ma.id, 'FAIL_OS_CUSTOMER');
    expect(failedItem).toBeDefined();
    expect(failedItem!.migrationStatus).toBe('READY');
    expect(failedItem!.errorCode).toBe('SALESFORCE_REJECTED');

    // Os 9 clientes concluídos devem estar intactos em OS_CREATED
    const successItem = await repository.getItemByExternalId(ma.id, 'CUST-SUL-0');
    expect(successItem!.migrationStatus).toBe('OS_CREATED');
    expect(successItem!.osId).toBeDefined();

    // Corrige a causa do cliente que falhou (retira trigger de erro) e reexecuta somente ele
    await repository.updateItem(failedItem!.id, {
      customerId: 'CRM-SUL-CORRECTED',
      errorStage: undefined,
      errorCode: undefined,
    });

    // Retentativa isolada através de nova autorização
    const retryBatch = await service.authorizeAndCreateOrders({
      maId: ma.id,
      itemIds: [failedItem!.id],
      actor: 'OPERATOR',
    });

    expect(retryBatch.totalCustomers).toBe(1);
    expect(retryBatch.successCount).toBe(1);
    expect(retryBatch.failedCount).toBe(0);

    const retestedItem = await repository.getItemById(failedItem!.id);
    expect(retestedItem!.migrationStatus).toBe('OS_CREATED');
    expect(retestedItem!.osId).toBeDefined();
  });

  // -------------------------------------------------------------------
  // Caso 3: CDO de 8 clientes com OS aberta
  // Esperado: 8 clientes, 8 OSs, AVAILABLE -> após agendamento vira SCHEDULED
  // -------------------------------------------------------------------
  it('Caso 3: CDO com 8 clientes e OS aberta transiciona de AVAILABLE para SCHEDULED', async () => {
    const ma = await service.createMa({
      name: 'M&A Leste',
      originProvider: 'Leste Fibra',
      startDate: '2026-09-01',
      uf: 'RJ',
    });

    const tech = await service.createTechnician({
      maId: ma.id,
      externalTechId: 'TECH-CARLOS-MENDES',
      name: 'Carlos Mendes',
      vendorCompany: 'Prestadora Rede Conecta',
      city: 'Niterói',
      uf: 'RJ',
    });

    // 8 clientes vinculados à mesma CDO alvo
    const rows = Array.from({ length: 8 }, (_, i) => ({
      externalCustomerId: `CUST-ICARAI-${i}`,
      customerName: `Morador ${i}`,
      rawAddress: `Rua Moreira Cesar, ${i * 10}, Icaraí`,
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: `ZTEG${20000 + i}`,
      originProvider: 'Leste Fibra',
      originBoxId: 'CDO-LESTE-01',
    }));

    await service.importCustomerLot({
      maId: ma.id,
      fileName: 'cdo_icarai_8.csv',
      actor: 'TEST',
      rows,
    });

    // Triagem: viabiliza e abre OS automaticamente
    await service.prepareItems({ maId: ma.id });

    // Forçar a mesma CDO alvo para os 8
    const items = (await repository.listItems({ maId: ma.id })).items;
    for (const item of items) {
      await repository.updateItem(item.id, {
        targetBoxId: 'CDO-RJ-1048',
        targetBoxType: 'CDO',
      });
    }

    // Criar / Registrar agendamento da caixa
    await repository.saveBoxSchedule({
      id: 'SCHED-CDO-RJ-1048',
      maId: ma.id,
      targetBoxId: 'CDO-RJ-1048',
      targetBoxType: 'CDO',
      municipality: 'Niterói',
      neighborhood: 'Icaraí',
      totalCustomers: 8,
      totalOrders: 8,
      scheduleStatus: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      createdBy: 'SYSTEM',
      updatedAt: new Date().toISOString(),
      updatedBy: 'SYSTEM',
    });

    const preSchedule = await repository.getBoxSchedule(ma.id, 'CDO-RJ-1048');
    expect(preSchedule!.scheduleStatus).toBe('AVAILABLE');

    // Executar agendamento
    const scheduled = await service.scheduleBox({
      maId: ma.id,
      targetBoxId: 'CDO-RJ-1048',
      scheduledDate: '2026-09-23',
      technicianId: tech.id,
      actor: 'OPERATOR_SCHEDULER',
    });

    expect(scheduled.scheduleStatus).toBe('SCHEDULED');
    expect(scheduled.scheduledDate).toBe('2026-09-23');
    expect(scheduled.technicianId).toBe(tech.id);

    // Todos os 8 itens devem estar com status SCHEDULED
    const scheduledItems = await repository.getItemsByBox('CDO-RJ-1048');
    expect(scheduledItems.length).toBe(8);
    for (const item of scheduledItems) {
      expect(item.migrationStatus).toBe('SCHEDULED');
      expect(item.scheduledDate).toBe('2026-09-23');
      expect(item.technicianId).toBe(tech.id);
    }
  });

  // -------------------------------------------------------------------
  // Caso 4: Reprogramação de Campo
  // Esperado: Altera data, altera técnico, atualiza WFM, registra histórico em NW_BOX_SCHEDULE_HISTORY
  // -------------------------------------------------------------------
  it('Caso 4: Reprogramação registra auditoria em NW_BOX_SCHEDULE_HISTORY e atualiza técnico/data', async () => {
    const ma = await service.createMa({
      name: 'M&A Rio',
      originProvider: 'RioFibra',
      startDate: '2026-09-01',
      uf: 'RJ',
    });

    const tech1 = await service.createTechnician({
      maId: ma.id,
      externalTechId: 'TECH-1',
      name: 'Técnico Um',
      vendorCompany: 'Conecta',
      city: 'Rio de Janeiro',
      uf: 'RJ',
    });

    const tech2 = await service.createTechnician({
      maId: ma.id,
      externalTechId: 'TECH-2',
      name: 'Técnico Dois',
      vendorCompany: 'Telemont',
      city: 'Rio de Janeiro',
      uf: 'RJ',
    });

    await repository.saveBoxSchedule({
      id: 'SCHED-CDOI-RJ-1091',
      maId: ma.id,
      targetBoxId: 'CDOI-RJ-1091',
      targetBoxType: 'CDOI',
      municipality: 'Niterói',
      neighborhood: 'Santa Rosa',
      totalCustomers: 6,
      totalOrders: 6,
      scheduleStatus: 'SCHEDULED',
      scheduledDate: '2026-09-23',
      technicianId: tech1.id,
      createdAt: new Date().toISOString(),
      createdBy: 'OPERATOR',
      updatedAt: new Date().toISOString(),
      updatedBy: 'OPERATOR',
    });

    // Reprogramar para nova data e novo técnico
    const rescheduled = await service.scheduleBox({
      maId: ma.id,
      targetBoxId: 'CDOI-RJ-1091',
      scheduledDate: '2026-09-25',
      technicianId: tech2.id,
      actor: 'DISPATCHER_USER',
    });

    expect(rescheduled.scheduledDate).toBe('2026-09-25');
    expect(rescheduled.technicianId).toBe(tech2.id);

    // Histórico de reprogramação deve ter sido gerado
    const histories = await repository.getScheduleHistory(rescheduled.id);
    expect(histories.length).toBe(1);
    expect(histories[0].oldDate).toBe('2026-09-23');
    expect(histories[0].newDate).toBe('2026-09-25');
    expect(histories[0].oldTechnicianId).toBe(tech1.id);
    expect(histories[0].newTechnicianId).toBe(tech2.id);
    expect(histories[0].changedBy).toBe('DISPATCHER_USER');
  });

  // -------------------------------------------------------------------
  // Caso 5: Serial divergente em campo
  // Esperado: Preserva serial original, atualiza serial efetivo, grava em NW_SERIAL_CHANGE
  // -------------------------------------------------------------------
  it('Caso 5: Correção de serial divergente preserva original e audita alteração', async () => {
    const ma = await service.createMa({
      name: 'M&A Sudeste',
      originProvider: 'Sudeste Net',
      startDate: '2026-09-01',
      uf: 'SP',
    });

    await service.importCustomerLot({
      maId: ma.id,
      fileName: 'santos.csv',
      actor: 'TEST',
      rows: [
        {
          externalCustomerId: 'CUST-SP-99',
          customerName: 'Dona Maria',
          rawAddress: 'Av Ana Costa, 50',
          cep: '11060-000',
          city: 'Santos',
          state: 'SP',
          ontSerial: 'SERIAL_ORIGINAL_LOT_123',
          originProvider: 'Sudeste Net',
          originBoxId: 'CDO-SP-01',
        },
      ],
    });

    const item = (await repository.listItems({ maId: ma.id })).items[0];
    expect(item.ontSerialOriginal).toBe('SERIAL_ORIGINAL_LOT_123');
    expect(item.ontSerialEffective).toBe('SERIAL_ORIGINAL_LOT_123');

    // Técnico em campo encontra ONT trocada anteriormente
    const updated = await service.overrideSerial({
      itemId: item.id,
      newSerial: 'SERIAL_FISICO_CAMPO_999',
      reason: 'PREVIOUS_ONT_REPLACEMENT',
      observation: 'Cliente informou troca de modem pelo provedor anterior em 2025',
      actor: 'TECNICO_CAMPO_JOAO',
    });

    expect(updated.ontSerialOriginal).toBe('SERIAL_ORIGINAL_LOT_123'); // NUNCA DESTRUIR!
    expect(updated.ontSerialEffective).toBe('SERIAL_FISICO_CAMPO_999');

    // Valida auditoria em NW_SERIAL_CHANGE
    const changes = await repository.listSerialChanges(item.id);
    expect(changes.length).toBe(1);
    expect(changes[0].originalSerial).toBe('SERIAL_ORIGINAL_LOT_123');
    expect(changes[0].newSerial).toBe('SERIAL_FISICO_CAMPO_999');
    expect(changes[0].reason).toBe('PREVIOUS_ONT_REPLACEMENT');
    expect(changes[0].changedBy).toBe('TECNICO_CAMPO_JOAO');
  });

  // -------------------------------------------------------------------
  // Caso 6: Falha em um cutover de 8 clientes (7 MIGRATED, 1 MIGRATION_FAILED)
  // Esperado: 7 MIGRATED, 1 MIGRATION_FAILED. NUNCA desfazer os 7 concluídos.
  // -------------------------------------------------------------------
  it('Caso 6: Cutover com falha isolada (7 MIGRATED / 1 MIGRATION_FAILED) preserva concluídos', async () => {
    const ma = await service.createMa({
      name: 'M&A Minas',
      originProvider: 'MinasFibra',
      startDate: '2026-09-01',
      uf: 'MG',
    });

    // 8 clientes, sendo que o último falhará no diagnóstico óptico
    const rows = Array.from({ length: 8 }, (_, i) => ({
      externalCustomerId: `CUST-BH-${i}`,
      customerName: `Cliente BH ${i}`,
      rawAddress: `Av Afonso Pena, ${i * 100}`,
      cep: '30130-000',
      city: 'Belo Horizonte',
      state: 'MG',
      ontSerial: i === 7 ? 'FAIL_CUTOVER_SERIAL_07' : `ALCLB_BH_${i}`,
      originProvider: 'MinasFibra',
      originBoxId: 'BOX-MINAS-01',
    }));

    await service.importCustomerLot({
      maId: ma.id,
      fileName: 'bh_8.csv',
      actor: 'TEST',
      rows,
    });

    // Triagem: viabiliza e abre OS automaticamente
    await service.prepareItems({ maId: ma.id });

    // Forçar box alvo para os 8
    const items = (await repository.listItems({ maId: ma.id })).items;
    for (const item of items) {
      await repository.updateItem(item.id, {
        targetBoxId: 'CDO-MG-2001',
        targetBoxType: 'CDO',
      });
    }

    // Executar Cutover massivo para a CDO-MG-2001
    const cutoverBatch = await service.executeCutover({
      maId: ma.id,
      targetBoxId: 'CDO-MG-2001',
      actor: 'OPERATOR_CUTOVER',
    });

    expect(cutoverBatch.totalItems).toBe(8);
    expect(cutoverBatch.successCount).toBe(7);
    expect(cutoverBatch.failedCount).toBe(1);
    expect(cutoverBatch.status).toBe('PARTIALLY_FAILED');

    // Verificar os 7 migrados
    const boxItems = await repository.getItemsByBox('CDO-MG-2001');
    const migratedItems = boxItems.filter((i) => i.migrationStatus === 'MIGRATED');
    const failedItems = boxItems.filter((i) => i.migrationStatus === 'MIGRATION_FAILED');

    expect(migratedItems.length).toBe(7);
    expect(failedItems.length).toBe(1);

    // O item com falha deve registrar o motivo específico e estágio
    expect(failedItems[0].ontSerialEffective).toBe('FAIL_CUTOVER_SERIAL_07');
    expect(failedItems[0].errorCode).toBe('ONT_NOT_DISCOVERED');
    expect(failedItems[0].errorStage).toBe('DIAGNOSING_ONT');

    // NUNCA desfazer os 7 concluídos
    for (const migrated of migratedItems) {
      expect(migrated.migratedAt).toBeDefined();
    }

    // A caixa de origem NÃO pode ser liberada ainda pois tem 1 item pendente/com falha
    const decomms = await service.listDecommissionBoxes(ma.id);
    const originBox = decomms.find((b) => b.originBoxId === 'BOX-MINAS-01');
    expect(originBox).toBeDefined();
    expect(originBox!.releaseStatus).toBe('PARTIALLY_MIGRATED');
    expect(originBox!.migratedCustomers).toBe(7);
    expect(originBox!.pendingCustomers).toBe(1);
  });
});
