import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/health/health.module';

describe('HealthController', () => {
  it('reports database readiness', async () => {
    const controller = new HealthController({ $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as never);
    await expect(controller.check()).resolves.toMatchObject({ status: 'ok', database: 'up' });
  });

  it('returns service unavailable when the database check fails', async () => {
    const controller = new HealthController({ $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')) } as never);
    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
