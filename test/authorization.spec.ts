import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { EmployeesService } from '../src/employees/employees.service';

describe('PeopleOS authorization boundaries', () => {
  it('rejects an employee when an admin-only role is required', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]) };
    const guard = new RolesGuard(reflector as never);
    const context = { getHandler: jest.fn(), getClass: jest.fn(), switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.EMPLOYEE } }) }) };
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('blocks an employee from reading another employee profile', async () => {
    const prisma = { employee: { findUnique: jest.fn() } };
    const employees = new EmployeesService(prisma as never);
    await expect(employees.findOne('employee-two', { id: 'u1', name: 'Ava', email: 'employee@peopleos.demo', role: UserRole.EMPLOYEE, employeeId: 'employee-one' })).rejects.toThrow(ForbiddenException);
    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
  });
});
