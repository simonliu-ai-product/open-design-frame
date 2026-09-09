/**
 * What can be done to a frame's folder on disk.
 *
 * Each of these changes the set of frames or what a frame is called, which the
 * viewer learns about from the generated module list — so the dev server
 * reloads the page rather than these returning something to patch state with.
 */
async function post(path: string, init: RequestInit): Promise<string | null> {
  const res = await fetch(`/__frames${path}`, init);
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return res.ok ? null : (body.error ?? `${init.method} /__frames${path} → ${res.status}`);
}

export function renameFrame(id: string, name: string): Promise<string | null> {
  return post(`/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function duplicateFrame(id: string): Promise<string | null> {
  return post(`/${id}/duplicate`, { method: 'POST' });
}

export function deleteFrame(id: string): Promise<string | null> {
  return post(`/${id}`, { method: 'DELETE' });
}
