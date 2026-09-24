import dotenv from 'dotenv';
dotenv.config();

import { MigrationService } from '../src/modules/migration-service.js';
import { getMigrationRepository } from '../src/shared/persistence/database-factory.js';
import { createLogger } from '../src/shared/logging/logger.js';

const logger = createLogger('info');
const repo = getMigrationRepository();
const service = new MigrationService({ repository: repo, logger });

async function seed() {
  logger.info({}, 'Iniciando carga de dados de demonstração no netWave...');

  // 1. M&A
  const ma = await service.createMa({
    name: 'M&A Fibrasul RJ',
    originProvider: 'Fibrasul Telecom',
    description: 'Aquisição da base regional de Niterói e São Gonçalo',
    startDate: '2026-09-01',
    uf: 'RJ',
    actor: 'SEED_SCRIPT',
  });

  // 2. Técnicos de Campo
  const tech1 = await service.createTechnician({
    maId: ma.id,
    externalTechId: 'TECH-CARLOS-MENDES',
    name: 'Carlos Mendes',
    vendorCompany: 'Conecta Telecom',
    city: 'Niterói',
    uf: 'RJ',
    dailyCapacity: 8,
  });

  const tech2 = await service.createTechnician({
    maId: ma.id,
    externalTechId: 'TECH-ROBERTO-LIMA',
    name: 'Roberto Lima',
    vendorCompany: 'Telemont Engenharia',
    city: 'Niterói',
    uf: 'RJ',
    dailyCapacity: 8,
  });

  // 3. Clientes da CDO-RJ-1048 (Icaraí - 8 clientes)
  const rows = [
    {
      externalCustomerId: 'CUST-ICARAI-101',
      customerName: 'Mariana Duarte Alencar',
      rawAddress: 'Rua Coronel Moreira Cesar, 102, Icaraí',
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: 'ALCLB440192',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
    },
    {
      externalCustomerId: 'CUST-ICARAI-102',
      customerName: 'João Pedro Silveira',
      rawAddress: 'Rua Coronel Moreira Cesar, 104, Icaraí',
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: 'ALCLB440193',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
    },
    {
      externalCustomerId: 'CUST-ICARAI-103',
      customerName: 'Ana Claudia Rocha',
      rawAddress: 'Rua Coronel Moreira Cesar, 110, Icaraí',
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: 'ALCLB440194',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
    },
    {
      externalCustomerId: 'CUST-ICARAI-104',
      customerName: 'Carlos Eduardo Nogueira',
      rawAddress: 'Rua Coronel Moreira Cesar, 118, Icaraí',
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: 'ALCLB440195',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
    },
    {
      externalCustomerId: 'CUST-ICARAI-105',
      customerName: 'Fernanda Costa Lima',
      rawAddress: 'Rua Coronel Moreira Cesar, 122, Icaraí',
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: 'ALCLB440196',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
    },
    {
      externalCustomerId: 'CUST-ICARAI-106',
      customerName: 'Roberto Mendes Souza',
      rawAddress: 'Rua Coronel Moreira Cesar, 130, Icaraí',
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: 'ALCLB440197',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
    },
    {
      externalCustomerId: 'CUST-ICARAI-107',
      customerName: 'Juliana Martins Dias',
      rawAddress: 'Rua Coronel Moreira Cesar, 134, Icaraí',
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: 'ALCLB440198',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
    },
    {
      externalCustomerId: 'CUST-ICARAI-108',
      customerName: 'Lucas Ferreira Gomes',
      rawAddress: 'Rua Coronel Moreira Cesar, 140, Icaraí',
      cep: '24230-050',
      city: 'Niterói',
      state: 'RJ',
      ontSerial: 'ALCLB440199',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
    },
  ];

  await service.importCustomerLot({
    maId: ma.id,
    fileName: 'cdo_icarai_lote1.csv',
    actor: 'SEED_SCRIPT',
    rows,
  });

  // 4. Preparar e Viabilizar
  await service.prepareItems({ maId: ma.id });

  // 5. Autorizar Abertura Massiva de OS (1:1:1)
  await service.authorizeAndCreateOrders({
    maId: ma.id,
    actor: 'SEED_SCRIPT',
  });

  // 6. Programar CDO para Carlos Mendes
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const schedDate = tomorrow.toISOString().substring(0, 10);

  // Vincular à CDO-RJ-1048
  const items = await repo.getItemsByOriginBox('CDO-FIBRASUL-01');
  for (const it of items) {
    await repo.updateItem(it.id, {
      targetBoxId: 'CDO-RJ-1048',
      targetBoxType: 'CDO',
    });
  }

  await repo.saveBoxSchedule({
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

  await service.scheduleBox({
    maId: ma.id,
    targetBoxId: 'CDO-RJ-1048',
    scheduledDate: schedDate,
    technicianId: tech1.id,
    actor: 'SEED_SCRIPT',
  });

  logger.info({ maId: ma.id }, 'Carga de demonstração concluída com sucesso!');
}

seed().catch(console.error);
