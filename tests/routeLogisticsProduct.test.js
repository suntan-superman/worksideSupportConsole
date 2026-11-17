import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Route Logistics support product compatibility', () => {
  const source = fs.readFileSync(path.resolve('src/main.js'), 'utf8');

  it('includes Route Logistics in fallback product selection', () => {
    expect(source).toContain('{ id: "route-logistics", label: "Route Logistics" }');
  });

  it('renders the intended product identifier as Route Logistics', () => {
    expect(source).toContain('if (key === "route-logistics") return "Route Logistics";');
  });
});
