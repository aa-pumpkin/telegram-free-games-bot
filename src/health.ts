import { createServer, type Server } from 'node:http';
import type { Logger } from './logger.js';

export function startHealthServer(port: number, logger: Logger): Server {
  const server = createServer((request, response) => {
    if (request.url === '/health' || request.url === '/') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'ok' }));
    } else {
      response.writeHead(404).end();
    }
  });
  server.listen(port, '0.0.0.0', () => logger.info({ port }, 'Healthcheck-сервер запущен'));
  return server;
}
