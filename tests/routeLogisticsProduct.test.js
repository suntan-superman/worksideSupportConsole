import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('../src/services/api.js', () => ({ request: requestMock }));
import { listSupportSessions } from '../src/services/chat.js';

describe('Route Logistics support product compatibility', () => {
  const source = fs.readFileSync(path.resolve('src/main.js'), 'utf8');

  it('includes Route Logistics in fallback product selection', () => {
    expect(source).toContain('{ id: "route-logistics", label: "Route Logistics" }');
  });

  it('renders the intended product identifier as Route Logistics', () => {
    expect(source).toContain('if (key === "route-logistics") return "Route Logistics";');
  });

  it('keeps Route Logistics conversations separate from Merxus results', async () => {
    requestMock.mockResolvedValueOnce({
      sessions: [
        { id: 'route-1', product: 'route_logistics', status: 'active_ai' },
        { id: 'merxus-1', product: 'merxus', status: 'active_ai' },
      ],
    });

    const sessions = await listSupportSessions({ product: 'route-logistics' });

    expect(requestMock).toHaveBeenCalledWith(
      '/support/sessions',
      expect.objectContaining({ query: expect.objectContaining({ product: 'route-logistics' }) }),
    );
    expect(sessions.map((session) => session.id)).toEqual(['route-1']);
  });
});
