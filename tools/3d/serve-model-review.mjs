import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const projectRoot = process.cwd();
const port = Number.parseInt(process.env.REVIEW_PORT ?? '4318', 10);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

async function existingFile(candidate) {
  try {
    await access(candidate);
    const fileStats = await stat(candidate);
    return fileStats.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host}`).pathname);
  const safePath = requestPath.replace(/^\/+/, '').replaceAll('..', '');
  const publicCandidate = path.join(projectRoot, 'public', safePath);
  const distCandidate = path.join(projectRoot, 'dist', safePath);
  const filePath = await existingFile(distCandidate)
    ?? await existingFile(publicCandidate)
    ?? await existingFile(path.join(projectRoot, 'dist', 'index.html'));
  if (!filePath) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`model review server: http://127.0.0.1:${port}`);
});
