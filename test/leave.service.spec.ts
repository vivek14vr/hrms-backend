import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { LeaveRequestStatus, UserRole } from '@prisma/client';
import { LeaveService } from '../src/leave/leave.service';

const employee = { id: 'user-1', name: 'Ava', email: 'ava@example.com', role: UserRole.EMPLOYEE, employeeId: 'employee-1' };
const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null };

describe('LeaveService', () => {
  it('calculates inclusive business days and creates a pending request', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'leave-1', days: 5 });
    const service = new LeaveService({ leaveType: { findUnique: jest.fn().mockResolvedValue({ id: 'type-1', active: true, annualAllowance: 20 }) }, leaveRequest: { findFirst: jest.fn().mockResolvedValue(null), create }, holiday: { findMany: jest.fn().mockResolvedValue([]) }, workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ workWeek: 'Monday – Friday' }) } } as never);

    await service.createRequest({ leaveTypeId: 'type-1', startDate: '2026-09-14', endDate: '2026-09-18', reason: 'Family event' }, employee);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ employeeId: 'employee-1', days: 5, startDate: expect.any(Date), endDate: expect.any(Date), status: LeaveRequestStatus.PENDING }) }));
  });

  it('rejects invalid and overlapping leave requests', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'existing' });
    const service = new LeaveService({ leaveType: { findUnique: jest.fn().mockResolvedValue({ id: 'type-1', active: true, annualAllowance: 20 }) }, leaveRequest: { findFirst, create: jest.fn() }, holiday: { findMany: jest.fn().mockResolvedValue([]) }, workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ workWeek: 'Monday – Friday' }) } } as never);

    await expect(service.createRequest({ leaveTypeId: 'type-1', startDate: '2026-09-19', endDate: '2026-09-20', reason: 'Weekend only' }, employee)).rejects.toThrow(BadRequestException);
    await expect(service.createRequest({ leaveTypeId: 'type-1', startDate: '2026-09-14', endDate: '2026-09-18', reason: 'Overlapping request' }, employee)).rejects.toThrow(ConflictException);
  });

  it('uses the employee schedule work week for leave days', async () => {
    const service = new LeaveService({
      leaveType: { findUnique: jest.fn().mockResolvedValue({ id: 'type-1', active: true, annualAllowance: 20 }) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ workWeek: 'Monday – Friday' }) },
      employee: { findUnique: jest.fn().mockResolvedValue({ schedule: { workWeek: 'Sunday – Thursday', active: true } }) },
      leaveRequest: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    } as never);

    await expect(service.createRequest({ leaveTypeId: 'type-1', startDate: '2026-09-18', endDate: '2026-09-19', reason: 'Weekend event' }, employee)).rejects.toThrow(BadRequestException);
  });

  it('approves a request and atomically consumes a new yearly balance', async () => {
    const request = { id: 'leave-1', employeeId: 'employee-1', leaveTypeId: 'type-1', startDate: new Date('2026-09-14T00:00:00.000Z'), days: 5, status: LeaveRequestStatus.PENDING, leaveType: { annualAllowance: 20 } };
    const transaction = {
      leaveRequest: { findUnique: jest.fn().mockResolvedValue(request), update: jest.fn().mockResolvedValue({ ...request, status: LeaveRequestStatus.APPROVED }) },
      leaveBalance: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const prisma = { workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) }, $transaction: jest.fn((callback: (db: typeof transaction) => unknown) => callback(transaction)) };
    const service = new LeaveService(prisma as never);

    await expect(service.reviewRequest('leave-1', LeaveRequestStatus.APPROVED, 'Approved', admin)).resolves.toMatchObject({ status: LeaveRequestStatus.APPROVED });
    expect(transaction.leaveBalance.create).toHaveBeenCalledWith({ data: { employeeId: 'employee-1', leaveTypeId: 'type-1', year: 2026, allocated: 20, used: 5 } });
  });

  it('rejects approval when the existing balance is insufficient', async () => {
    const transaction = {
      leaveRequest: { findUnique: jest.fn().mockResolvedValue({ id: 'leave-1', employeeId: 'employee-1', leaveTypeId: 'type-1', startDate: new Date('2026-09-14T00:00:00.000Z'), days: 5, status: LeaveRequestStatus.PENDING, leaveType: { annualAllowance: 20 } }) },
      leaveBalance: { findUnique: jest.fn().mockResolvedValue({ id: 'balance-1', allocated: 4, used: 4 }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new LeaveService({ workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) }, $transaction: jest.fn((callback: (db: typeof transaction) => unknown) => callback(transaction)) } as never);

    await expect(service.reviewRequest('leave-1', LeaveRequestStatus.APPROVED, undefined, admin)).rejects.toThrow(ConflictException);
  });

  it('cancels only the employee-owned pending request atomically', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      leaveRequest: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ employeeId: 'employee-1', status: LeaveRequestStatus.PENDING })
          .mockResolvedValueOnce({ id: 'leave-1', status: LeaveRequestStatus.CANCELLED }),
        updateMany,
      },
    };
    const service = new LeaveService({ workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) }, $transaction: jest.fn((callback: (db: typeof transaction) => unknown) => callback(transaction)) } as never);

    await expect(service.cancelRequest('leave-1', employee)).resolves.toMatchObject({ status: LeaveRequestStatus.CANCELLED });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'leave-1', employeeId: 'employee-1', status: LeaveRequestStatus.PENDING }, data: { status: LeaveRequestStatus.CANCELLED } });
  });

  it('cancels future approved leave and restores the consumed balance', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      leaveRequest: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ employeeId: 'employee-1', status: LeaveRequestStatus.APPROVED, startDate: new Date('2099-01-05T00:00:00.000Z'), days: 5, leaveTypeId: 'type-1' })
          .mockResolvedValueOnce({ id: 'leave-1', status: LeaveRequestStatus.CANCELLED }),
        updateMany,
      },
      leaveBalance: {
        findUnique: jest.fn().mockResolvedValue({ id: 'balance-1', used: 5 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new LeaveService({ workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) }, $transaction: jest.fn((callback: (db: typeof transaction) => unknown) => callback(transaction)) } as never);

    await expect(service.cancelRequest('leave-1', employee)).resolves.toMatchObject({ status: LeaveRequestStatus.CANCELLED });
    expect(transaction.leaveBalance.updateMany).toHaveBeenCalledWith({ where: { id: 'balance-1', used: { gte: 5 } }, data: { used: { decrement: 5 } } });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'leave-1', employeeId: 'employee-1', status: { in: [LeaveRequestStatus.APPROVED] } }, data: { status: LeaveRequestStatus.CANCELLED } });
  });

  it('does not cancel approved leave after it has started', async () => {
    const transaction = { leaveRequest: { findUnique: jest.fn().mockResolvedValue({ employeeId: 'employee-1', status: LeaveRequestStatus.APPROVED, startDate: new Date('2026-01-01T00:00:00.000Z'), days: 5, leaveTypeId: 'type-1' }), updateMany: jest.fn() } };
    const service = new LeaveService({ workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) }, $transaction: jest.fn((callback: (db: typeof transaction) => unknown) => callback(transaction)) } as never);

    await expect(service.cancelRequest('leave-1', employee)).rejects.toThrow(ConflictException);
    expect(transaction.leaveRequest.updateMany).not.toHaveBeenCalled();
  });

  it('allows only employees to submit self-service leave', async () => {
    const service = new LeaveService({} as never);

    await expect(service.createRequest({ leaveTypeId: 'type-1', startDate: '2026-09-14', endDate: '2026-09-14', reason: 'Personal day' }, admin)).rejects.toThrow(ForbiddenException);
  });
});
