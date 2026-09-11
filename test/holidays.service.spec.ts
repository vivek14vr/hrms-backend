import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { HolidaysService } from '../src/holidays/holidays.service';

const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null };

describe('HolidaysService', () => {
  it('normalizes holiday names and date-only values', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'holiday-1', name: 'Founders Day' });
    const service = new HolidaysService({ holiday: { create } } as never);

    await service.create({ name: ' Founders Day ', date: '2026-01-01' }, admin);

    expect(create).toHaveBeenCalledWith({ data: { name: 'Founders Day', date: new Date('2026-01-01T00:00:00.000Z') } });
  });

  it('maps duplicate dates to a conflict response', async () => {
    const create = jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.15.0' }));
    const service = new HolidaysService({ holiday: { create } } as never);

    await expect(service.create({ name: 'New Year', date: '2026-01-01' }, admin)).rejects.toThrow(ConflictException);
  });

  it('blocks employees from managing the calendar', async () => {
    const service = new HolidaysService({} as never);

    await expect(service.create({ name: 'Holiday', date: '2026-01-01' }, { ...admin, role: UserRole.EMPLOYEE })).rejects.toThrow(ForbiddenException);
  });
});
