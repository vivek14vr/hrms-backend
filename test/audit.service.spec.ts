import { AuditService } from '../src/audit/audit.service';

describe('AuditService', () => {
  it('stores actor, request, entity, and metadata details', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const service = new AuditService({ auditEvent: { create } } as never);

    await service.record({ actorUserId: 'user-1', action: 'USER_UPDATED', entityType: 'User', entityId: 'user-2', requestId: 'request-1', metadata: { fields: ['name'] } });

    expect(create).toHaveBeenCalledWith({ data: { actorUserId: 'user-1', action: 'USER_UPDATED', entityType: 'User', entityId: 'user-2', requestId: 'request-1', metadata: { fields: ['name'] } } });
  });
});
