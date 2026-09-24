import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMigrationRepository } from '../../src/shared/persistence/in-memory-migration-repository.js';
import { MigrationService } from '../../src/modules/migration-service.js';

describe('Technician Management', () => {
  let repository: InMemoryMigrationRepository;
  let service: MigrationService;

  beforeEach(async () => {
    repository = new InMemoryMigrationRepository();
    service = new MigrationService({ repository });
  });

  it('deve cadastrar e atualizar um técnico com sucesso', async () => {
    const ma = await service.createMa({
      name: 'M&A Teste',
      originProvider: 'Provedor Teste',
      startDate: '2026-09-01',
      uf: 'RJ',
    });

    const tech = await service.createTechnician({
      maId: ma.id,
      externalTechId: 'TECH-100',
      name: 'João Silva',
      vendorCompany: 'Alpha Telecom',
      city: 'Niterói',
      uf: 'RJ',
      dailyCapacity: 8,
    });

    expect(tech.name).toBe('João Silva');
    expect(tech.status).toBe('ACTIVE');

    const updated = await service.updateTechnician(
      tech.id,
      {
        name: 'João Silva Jr.',
        vendorCompany: 'Beta Telecom',
        city: 'São Gonçalo',
        uf: 'rj',
        dailyCapacity: 10,
        status: 'INACTIVE',
      },
      'TEST_OPERATOR'
    );

    expect(updated.name).toBe('João Silva Jr.');
    expect(updated.vendorCompany).toBe('Beta Telecom');
    expect(updated.city).toBe('São Gonçalo');
    expect(updated.uf).toBe('RJ');
    expect(updated.dailyCapacity).toBe(10);
    expect(updated.status).toBe('INACTIVE');

    // Verificar se no repositório persistiu
    const fetched = await repository.getTechnicianById(tech.id);
    expect(fetched?.name).toBe('João Silva Jr.');
    expect(fetched?.status).toBe('INACTIVE');
  });

  it('deve lançar erro ao atualizar técnico inexistente', async () => {
    await expect(
      service.updateTechnician('TECH-INEXISTENTE', { name: 'Novo Nome' })
    ).rejects.toThrow('não encontrado');
  });

  it('não deve permitir agendar CDO para técnico com status INACTIVE', async () => {
    const ma = await service.createMa({
      name: 'M&A Teste Inativo',
      originProvider: 'Provedor Teste',
      startDate: '2026-09-01',
      uf: 'RJ',
    });

    const tech = await service.createTechnician({
      maId: ma.id,
      externalTechId: 'TECH-INACTIVE',
      name: 'Técnico Inativo',
      vendorCompany: 'Alpha Telecom',
    });

    await service.updateTechnician(tech.id, { status: 'INACTIVE' });

    await repository.saveBoxSchedule({
      id: 'SCHED-TEST-01',
      maId: ma.id,
      targetBoxId: 'CDO-TEST-01',
      targetBoxType: 'CDO',
      municipality: 'Niterói',
      neighborhood: 'Icaraí',
      totalCustomers: 2,
      totalOrders: 2,
      scheduleStatus: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      createdBy: 'TEST',
      updatedAt: new Date().toISOString(),
      updatedBy: 'TEST',
    });

    await expect(
      service.scheduleBox({
        maId: ma.id,
        targetBoxId: 'CDO-TEST-01',
        scheduledDate: '2026-09-24',
        technicianId: tech.id,
      })
    ).rejects.toThrow('Apenas técnicos com status ATIVO podem receber agendamento de CDO');
  });
});
