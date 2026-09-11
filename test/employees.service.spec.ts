import { BadRequestException } from '@nestjs/common';
import { EmploymentType, UserRole } from '@prisma/client';
import { EmployeesService } from '../src/employees/employees.service';

describe('EmployeesService', () => {
  it('persists supported profile fields as normalized values', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'employee-1' });
    const transaction = { employeeCodeSequence: { update: jest.fn().mockResolvedValue({ nextValue: 7 }) }, employee: { create } };
    const service = new EmployeesService({ $transaction: jest.fn((callback) => callback(transaction)) } as never);

    await service.create({ firstName: ' Ava ', lastName: ' Sharma ', email: ' AVA@EXAMPLE.COM ', department: ' Engineering ', designation: ' Engineer ', employmentType: EmploymentType.FULL_TIME, joiningDate: '2026-01-02', dateOfBirth: '1990-03-04', avatarUrl: 'https://example.com/avatar.png', address: ' 1 People Street ', emergencyContactName: ' Contact ', emergencyContactPhone: ' +1 123 ', baseSalary: 1000 });

    expect(transaction.employeeCodeSequence.update).toHaveBeenCalledWith({ where: { id: 'employee-code' }, data: { nextValue: { increment: 1 } } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ employeeCode: 'PO-0006', firstName: 'Ava', lastName: 'Sharma', email: 'ava@example.com', dateOfBirth: expect.any(Date), avatarUrl: 'https://example.com/avatar.png', address: '1 People Street', emergencyContactName: 'Contact', emergencyContactPhone: '+1 123' }) }));
  });

  it('rejects invalid direct-service dates', async () => {
    const transaction = { employeeCodeSequence: { update: jest.fn().mockResolvedValue({ nextValue: 1 }) }, employee: { create: jest.fn() } };
    const service = new EmployeesService({ $transaction: jest.fn((callback) => callback(transaction)) } as never);

    await expect(service.create({ firstName: 'Ava', lastName: 'Sharma', email: 'ava@example.com', department: 'Engineering', designation: 'Engineer', employmentType: EmploymentType.FULL_TIME, joiningDate: 'not-a-date', baseSalary: 1000 })).rejects.toThrow(BadRequestException);
  });

  it('validates and persists a real manager relationship', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'employee-2' });
    const transaction = { employeeCodeSequence: { update: jest.fn().mockResolvedValue({ nextValue: 2 }) }, employee: { findFirst: jest.fn().mockResolvedValue({ id: 'manager-1' }), create } };
    const service = new EmployeesService({ $transaction: jest.fn((callback) => callback(transaction)) } as never);

    await service.create({ firstName: 'Ava', lastName: 'Sharma', email: 'ava@example.com', department: 'Engineering', designation: 'Engineer', employmentType: EmploymentType.FULL_TIME, joiningDate: '2026-01-02', baseSalary: 1000, managerId: 'manager-1' });

    expect(transaction.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'manager-1', employmentStatus: { in: ['ACTIVE', 'ON_LEAVE'] } } }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ manager: { connect: { id: 'manager-1' } } }) }));
  });

  it('rejects a self-manager assignment', async () => {
    const service = new EmployeesService({ employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) } } as never);

    await expect(service.update('employee-1', { managerId: 'employee-1' }, { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null })).rejects.toThrow(BadRequestException);
  });

  it('records a compensation change and updates current salary when effective', async () => {
    const transaction = {
      compensationHistory: { create: jest.fn().mockResolvedValue({ id: 'compensation-1' }) },
      employee: { update: jest.fn() },
    };
    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const service = new EmployeesService(prisma as never);

    await service.addCompensationHistory('employee-1', { effectiveFrom: '2026-01-01', baseSalary: 2500, reason: 'Promotion' }, { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null });

    expect(transaction.compensationHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ employeeId: 'employee-1', effectiveFrom: new Date('2026-01-01'), reason: 'Promotion' }) }));
    expect(transaction.employee.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'employee-1' }, data: { baseSalary: expect.anything() } }));
  });

  it('adds history when the employee update changes salary', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'employee-1' });
    const service = new EmployeesService({ employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1', baseSalary: 1000 }), update } } as never);

    await service.update('employee-1', { baseSalary: 1200, compensationEffectiveFrom: '2026-10-01', compensationReason: 'Annual review' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ compensationHistory: { create: expect.objectContaining({ effectiveFrom: new Date('2026-10-01'), reason: 'Annual review' }) } }) }));
  });
});
