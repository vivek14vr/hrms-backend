import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { EmployeesService } from '../src/employees/employees.service';

describe('Employee self-service', () => {
  it('only updates the authenticated employee profile fields', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'employee-1' });
    const service = new EmployeesService({ employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }), update } } as never);

    await service.updateSelf({ id: 'user-1', name: 'Ava', email: 'ava@example.com', role: UserRole.EMPLOYEE, employeeId: 'employee-1' }, { phone: ' +1 123 ', address: ' 1 People Street ' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'employee-1' }, data: { phone: '+1 123', avatarUrl: undefined, address: '1 People Street', emergencyContactName: undefined, emergencyContactPhone: undefined } }));
  });

  it('rejects self-service updates for non-employees', async () => {
    const service = new EmployeesService({ employee: { findUnique: jest.fn(), update: jest.fn() } } as never);

    await expect(service.updateSelf({ id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null }, {})).rejects.toThrow(ForbiddenException);
  });
});
