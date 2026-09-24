import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './server.js';
import { createLogger } from './shared/logging/logger.js';

const logger = createLogger(process.env.LOG_LEVEL || 'info');
const port = parseInt(process.env.PORT || '4001', 10);

const server = createServer();

server.listen(port, '0.0.0.0', () => {
  logger.info({ port }, `netWave backend rodando em http://localhost:${port}`);
});

process.on('SIGTERM', () => {
  logger.info({}, 'Recebido SIGTERM, encerrando servidor netWave...');
  server.close(() => process.exit(0));
});
