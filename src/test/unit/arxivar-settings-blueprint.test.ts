import { describe, it, expect } from 'vitest';
import { ARXIVAR_SETTINGS_BLUEPRINT } from '@/lib/data-models/blueprints/arxivar-settings';

describe('ARXIVAR_SETTINGS_BLUEPRINT', () => {
  it('is a channel-scoped, server-only single-record config', () => {
    const d = ARXIVAR_SETTINGS_BLUEPRINT.definition;
    expect(ARXIVAR_SETTINGS_BLUEPRINT.id).toBe('arxivar_settings');
    expect(d.slug).toBe('arxivar_settings');
    expect(d.relation).toBe('channel');
    expect(d.cardinality).toBe('single');
    expect(d.readable_by_end_user).toBe(false);
  });

  it('exposes the connection + credential fields', () => {
    const slugs = ARXIVAR_SETTINGS_BLUEPRINT.definition.fields.map((f) => f.slug);
    expect(slugs).toEqual(['enabled', 'api_url', 'api_user', 'api_password']);
  });
});
