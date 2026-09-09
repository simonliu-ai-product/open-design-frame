import type { ServerResponse } from 'node:http';
import type { Connect } from 'vite';
import { OpsError } from '../ops/index.ts';

export function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

export function readJson(req: Connect.IncomingMessage, limit = 1_000_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) reject(new Error('body too large'));
      else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('body is not JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function readBytes(req: Connect.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) reject(new Error('file is too large'));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * One place that turns a refusal into a response.
 *
 * The operations are shared with the MCP server, so they raise rather than
 * write status codes; this is where the HTTP half of that contract lives.
 */
export async function send(res: ServerResponse, work: () => Promise<unknown>): Promise<void> {
  try {
    json(res, 200, await work());
  } catch (err) {
    if (err instanceof OpsError) return json(res, err.status, { error: err.message });
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
