import { ModelRepresentation } from '../../core/api/api.types';
import { toAppModelReference } from './included-models-dialog';

describe('toAppModelReference', () => {
  it('stores the same summary fields as the original editor', () => {
    const model = {
      id: 'm1',
      name: 'Vacation',
      key: 'vacation',
      version: 3,
      modelType: 0,
      description: 'd',
      createdBy: 'admin',
      lastUpdatedBy: 'admin',
      lastUpdated: '2026-01-01T00:00:00.000+0000',
      stencilSet: 7,
    } as unknown as ModelRepresentation & { stencilSet?: number };
    expect(toAppModelReference(model)).toEqual({
      id: 'm1',
      name: 'Vacation',
      version: 3,
      modelType: 0,
      description: 'd',
      stencilSetId: 7,
      createdBy: 'admin',
      lastUpdatedBy: 'admin',
      lastUpdated: '2026-01-01T00:00:00.000+0000',
    });
  });
});
