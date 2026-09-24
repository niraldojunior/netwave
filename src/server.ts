import http from 'node:http';
import { URL } from 'node:url';
import { MigrationService } from './modules/migration-service.js';
import { getMigrationRepository } from './shared/persistence/database-factory.js';
import { AppError } from './shared/errors/app-error.js';
import { createLogger } from './shared/logging/logger.js';

export const createServer = (service?: MigrationService): http.Server => {
  const logger = createLogger(process.env.LOG_LEVEL || 'info');
  const migrationService = service ?? new MigrationService({ repository: getMigrationRepository(), logger });

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const host = req.headers.host || 'localhost:4001';
    const parsedUrl = new URL(req.url || '/', `http://${host}`);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    const sendJson = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const parseBody = async (): Promise<any> => {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(new AppError('Payload JSON inválido', 400));
          }
        });
        req.on('error', reject);
      });
    };

    try {
      // -------------------------------------------------------------
      // Health check
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/health' && method === 'GET') {
        sendJson(200, { status: 'healthy', timestamp: new Date().toISOString(), app: 'v-tal-netwave' });
        return;
      }

      // -------------------------------------------------------------
      // Dashboard Metrics
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/metrics/dashboard' && method === 'GET') {
        const maId = parsedUrl.searchParams.get('maId') || undefined;
        const metrics = await migrationService.getDashboardMetrics(maId);
        sendJson(200, metrics);
        return;
      }

      if (pathname === '/api/v1/migration/metrics/strategic-overview' && method === 'GET') {
        const overview = await migrationService.getStrategicOverview();
        sendJson(200, overview);
        return;
      }

      // -------------------------------------------------------------
      // M&A Setup
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/ma') {
        if (method === 'GET') {
          const list = await migrationService.listMas();
          sendJson(200, list);
          return;
        }
        if (method === 'POST') {
          const body = await parseBody();
          const ma = await migrationService.createMa(body);
          sendJson(201, ma);
          return;
        }
      }

      if (pathname.startsWith('/api/v1/migration/ma/')) {
        const id = pathname.split('/')[5];
        if (!id) {
          sendJson(400, { error: 'ID de M&A inválido' });
          return;
        }
        if (method === 'GET') {
          const ma = await migrationService.getMaById(id);
          if (!ma) {
            sendJson(404, { error: 'M&A não encontrado' });
            return;
          }
          sendJson(200, ma);
          return;
        }
        if (method === 'PUT') {
          const body = await parseBody();
          const updated = await migrationService.updateMa(id, body, body.actor || 'OPERATOR');
          sendJson(200, updated);
          return;
        }
        if (method === 'DELETE') {
          await migrationService.deleteMa(id, 'OPERATOR');
          sendJson(200, { success: true });
          return;
        }
      }

      // -------------------------------------------------------------
      // Technicians
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/technicians') {
        if (method === 'GET') {
          const maId = parsedUrl.searchParams.get('maId') || '';
          const list = await migrationService.listTechnicians(maId);
          sendJson(200, list);
          return;
        }
        if (method === 'POST') {
          const body = await parseBody();
          const tech = await migrationService.createTechnician(body);
          sendJson(201, tech);
          return;
        }
      }

      if (pathname.startsWith('/api/v1/migration/technicians/')) {
        const id = pathname.split('/')[5];
        if (!id) {
          sendJson(400, { error: 'ID de Técnico inválido' });
          return;
        }
        if (method === 'PUT' || method === 'PATCH') {
          const body = await parseBody();
          const updated = await migrationService.updateTechnician(id, body, body.actor || 'OPERATOR');
          sendJson(200, updated);
          return;
        }
      }

      // -------------------------------------------------------------
      // Lots & Import
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/lots/upload' && method === 'POST') {
        const body = await parseBody();
        const lot = await migrationService.importCustomerLot(body);
        sendJson(201, lot);
        return;
      }

      if (pathname === '/api/v1/migration/lots' && method === 'GET') {
        const maId = parsedUrl.searchParams.get('maId') || undefined;
        const lots = await migrationService.listLots(maId);
        sendJson(200, lots);
        return;
      }

      // -------------------------------------------------------------
      // Migration Items (List & Filter)
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/items' && method === 'GET') {
        const repo = getMigrationRepository();
        const maId = parsedUrl.searchParams.get('maId') || undefined;
        const lotId = parsedUrl.searchParams.get('lotId') || undefined;
        const status = parsedUrl.searchParams.get('status') || undefined;
        const targetBoxId = parsedUrl.searchParams.get('targetBoxId') || undefined;
        const originBoxId = parsedUrl.searchParams.get('originBoxId') || undefined;
        const municipality = parsedUrl.searchParams.get('municipality') || undefined;
        const neighborhood = parsedUrl.searchParams.get('neighborhood') || undefined;
        const search = parsedUrl.searchParams.get('search') || undefined;
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
        const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);
        const hasOsParam = parsedUrl.searchParams.get('hasOs');
        const hasOs = hasOsParam === 'true' ? true : hasOsParam === 'false' ? false : undefined;

        const resData = await repo.listItems({
          maId,
          lotId,
          status,
          targetBoxId,
          originBoxId,
          municipality,
          neighborhood,
          search,
          limit,
          offset,
          hasOs,
        });
        sendJson(200, resData);
        return;
      }

      if (pathname.startsWith('/api/v1/migration/items/') && pathname.endsWith('/serial') && method === 'PATCH') {
        const parts = pathname.split('/');
        const itemId = parts[5] || '';
        const body = await parseBody();
        const updated = await migrationService.overrideSerial({
          itemId,
          newSerial: body.newSerial,
          reason: body.reason,
          observation: body.observation,
          actor: body.actor || 'OPERATOR',
        });
        sendJson(200, updated);
        return;
      }

      if (pathname.startsWith('/api/v1/migration/items/') && pathname.endsWith('/address') && method === 'PATCH') {
        const parts = pathname.split('/');
        const itemId = parts[5] || '';
        const body = await parseBody();
        const updated = await migrationService.updateItemAddress({
          itemId,
          rawAddress: body.rawAddress,
          cep: body.cep,
          city: body.city,
          stateOrUf: body.stateOrUf,
          actor: body.actor || 'OPERATOR',
        });
        sendJson(200, updated);
        return;
      }

      if (pathname.startsWith('/api/v1/migration/items/') && pathname.endsWith('/retry') && method === 'POST') {
        const parts = pathname.split('/');
        const itemId = parts[5] || '';
        const body = await parseBody();
        const result = await migrationService.retryItem(itemId, body.actor || 'OPERATOR');
        sendJson(200, result);
        return;
      }

      if (pathname.startsWith('/api/v1/migration/items/') && pathname.endsWith('/rollback') && method === 'POST') {
        const parts = pathname.split('/');
        const itemId = parts[5] || '';
        const body = await parseBody();
        const result = await migrationService.requestRollback({
          itemId,
          reason: body.reason || 'FALHA_PERSISTENTE_CAMPO',
          actor: body.actor || 'OPERATOR',
        });
        sendJson(200, result);
        return;
      }

      // Single item detail
      if (pathname.startsWith('/api/v1/migration/items/') && method === 'GET') {
        const parts = pathname.split('/');
        const itemId = parts[5] || '';
        const repo = getMigrationRepository();
        const item = await repo.getItemById(itemId);
        if (!item) {
          sendJson(404, { error: 'Item não encontrado' });
          return;
        }
        sendJson(200, item);
        return;
      }

      // -------------------------------------------------------------
      // Preparation Pipeline
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/items/prepare' && method === 'POST') {
        const body = await parseBody();
        const result = await migrationService.prepareItems({
          maId: body.maId,
          itemIds: body.itemIds,
          lotId: body.lotId,
        });
        sendJson(200, result);
        return;
      }

      // -------------------------------------------------------------
      // OS Batch (1:1:1 Authorization)
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/os/batches') {
        if (method === 'POST') {
          const body = await parseBody();
          const batch = await migrationService.authorizeAndCreateOrders({
            maId: body.maId,
            itemIds: body.itemIds,
            actor: body.actor || 'OPERATOR',
          });
          sendJson(201, batch);
          return;
        }
      }

      // -------------------------------------------------------------
      // Field Scheduling (Boxes CDO/CDOI)
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/box-schedules') {
        if (method === 'GET') {
          const repo = getMigrationRepository();
          const maId = parsedUrl.searchParams.get('maId') || undefined;
          const municipality = parsedUrl.searchParams.get('municipality') || undefined;
          const neighborhood = parsedUrl.searchParams.get('neighborhood') || undefined;
          const search = parsedUrl.searchParams.get('search') || undefined;
          const status = parsedUrl.searchParams.get('status') || undefined;
          const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
          const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

          const list = await repo.listBoxSchedules({
            maId,
            municipality,
            neighborhood,
            search,
            status,
            limit,
            offset,
          });
          sendJson(200, list);
          return;
        }
        if (method === 'POST') {
          const body = await parseBody();
          const scheduled = await migrationService.scheduleBox({
            maId: body.maId,
            targetBoxId: body.targetBoxId,
            scheduledDate: body.scheduledDate,
            technicianId: body.technicianId,
            actor: body.actor || 'OPERATOR',
          });
          sendJson(200, scheduled);
          return;
        }
      }

      if (pathname === '/api/v1/migration/box-schedules/cancel' && method === 'POST') {
        const body = await parseBody();
        const cancelled = await migrationService.cancelBoxSchedule({
          scheduleId: body.scheduleId,
          actor: body.actor || 'OPERATOR',
        });
        sendJson(200, cancelled);
        return;
      }

      // -------------------------------------------------------------
      // Cutover
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/cutovers' && method === 'POST') {
        const body = await parseBody();
        const batch = await migrationService.executeCutover({
          maId: body.maId,
          targetBoxId: body.targetBoxId,
          itemIds: body.itemIds,
          actor: body.actor || 'OPERATOR',
        });
        sendJson(201, batch);
        return;
      }

      // -------------------------------------------------------------
      // Decommissioning
      // -------------------------------------------------------------
      if (pathname === '/api/v1/migration/decommission/boxes' && method === 'GET') {
        const maId = parsedUrl.searchParams.get('maId') || undefined;
        const boxes = await migrationService.listDecommissionBoxes(maId);
        sendJson(200, boxes);
        return;
      }

      sendJson(404, { error: `Rota não encontrada: ${method} ${pathname}` });
    } catch (err: any) {
      logger.error(err, `Erro na requisição ${method} ${pathname}`);
      const status = err.statusCode || 500;
      sendJson(status, {
        error: err.message || 'Erro interno no servidor',
        code: err.code || 'INTERNAL_SERVER_ERROR',
        details: err.details,
      });
    }
  });

  return server;
};
