import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { AttendanceService } from '../src/attendance/attendance.service';

const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null };

describe('AttendanceService', () => {
  it('rejects future attendance dates', async () => {
    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) },
      attendanceRecord: { findUnique: jest.fn() },
      workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
    };
    const service = new AttendanceService(prisma as never);
    const future = new Date(Date.now() + 86_400_000).toISOString();

    await expect(service.create({ employeeId: 'employee-1', date: future, status: AttendanceStatus.PRESENT, checkIn: future }, admin)).rejects.toThrow(BadRequestException);
    expect(prisma.attendanceRecord.findUnique).not.toHaveBeenCalled();
  });

  it('rejects check-out before check-in and duplicate dates', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) },
      attendanceRecord: { findUnique: jest.fn().mockResolvedValue({ id: 'existing-1' }), create: jest.fn() },
      workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
    };
    const service = new AttendanceService(prisma as never);

    await expect(service.create({ employeeId: 'employee-1', date, status: AttendanceStatus.PRESENT, checkIn: `${date}T10:00:00Z`, checkOut: `${date}T09:00:00Z` }, admin)).rejects.toThrow(BadRequestException);
    await expect(service.create({ employeeId: 'employee-1', date, status: AttendanceStatus.PRESENT, checkIn: `${date}T09:00:00Z` }, admin)).rejects.toThrow(ConflictException);
  });

  it('does not allow an employee to use admin attendance writes', async () => {
    const service = new AttendanceService({} as never);
    await expect(service.create({ date: new Date().toISOString(), status: AttendanceStatus.PRESENT }, { ...admin, role: UserRole.EMPLOYEE, employeeId: 'employee-1' })).rejects.toThrow(ForbiddenException);
  });

  it('calculates attendance against expected weekdays instead of existing rows', async () => {
    const service = new AttendanceService({ attendanceRecord: { findMany: jest.fn().mockResolvedValue([{ status: AttendanceStatus.PRESENT }]) }, holiday: { findMany: jest.fn().mockResolvedValue([{ date: new Date('2026-01-01T00:00:00.000Z') }]) }, workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ workWeek: 'Monday – Friday' }) } } as never);

    const summary = await service.summary({ ...admin, role: UserRole.EMPLOYEE, employeeId: 'employee-1' }, 1, 2026);

    expect(summary.expectedWorkingDays).toBe(21);
    expect(summary.attendancePercentage).toBe(5);
  });

  it('honors the configured Monday-Saturday work week', async () => {
    const service = new AttendanceService({
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ workWeek: 'Monday – Saturday' }) },
    } as never);

    const summary = await service.summary({ ...admin, role: UserRole.EMPLOYEE, employeeId: 'employee-1' }, 1, 2026);

    expect(summary.expectedWorkingDays).toBe(27);
  });

  it('uses the employee schedule work week for an employee summary', async () => {
    const service = new AttendanceService({
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC', workWeek: 'Monday – Friday' }) },
      employee: { findUnique: jest.fn().mockResolvedValue({ schedule: { timezone: 'UTC', workWeek: 'Monday – Saturday', active: true } }) },
    } as never);

    const summary = await service.summary({ ...admin, role: UserRole.EMPLOYEE, employeeId: 'employee-1' }, 1, 2026);

    expect(summary.expectedWorkingDays).toBe(27);
  });

  it('marks a clock-in late after the workspace shift grace period', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-11T04:16:00.000Z'));
    const create = jest.fn().mockResolvedValue({ id: 'attendance-1', status: AttendanceStatus.LATE });
    const service = new AttendanceService({
      workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata', shiftStart: '09:00', shiftEnd: '18:00', graceMinutes: 15, overtimeAfterMinutes: 480 }) },
      attendanceRecord: { findUnique: jest.fn().mockResolvedValue(null), create },
    } as never);

    try {
      await service.clockIn({ ...admin, role: UserRole.EMPLOYEE, employeeId: 'employee-1' });
    } finally {
      jest.useRealTimers();
    }

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: AttendanceStatus.LATE }) }));
  });

  it('uses an employee schedule before the workspace default', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-11T09:16:00.000Z'));
    const create = jest.fn().mockResolvedValue({ id: 'attendance-1', status: AttendanceStatus.LATE });
    const service = new AttendanceService({
      workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC', shiftStart: '08:00', shiftEnd: '17:00', graceMinutes: 120, overtimeAfterMinutes: 480 }) },
      employee: { findUnique: jest.fn().mockResolvedValue({ schedule: { timezone: 'UTC', shiftStart: '09:00', shiftEnd: '18:00', graceMinutes: 15, overtimeAfterMinutes: 480, active: true } }) },
      attendanceRecord: { findUnique: jest.fn().mockResolvedValue(null), create },
    } as never);

    try {
      await service.clockIn({ ...admin, role: UserRole.EMPLOYEE, employeeId: 'employee-1' });
    } finally {
      jest.useRealTimers();
    }

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: AttendanceStatus.LATE }) }));
  });

  it('keeps an overnight clock-out on the shift start date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-10T17:00:00.000Z'));
    const update = jest.fn().mockResolvedValue({ id: 'attendance-1' });
    const attendanceRecord = { findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'attendance-1', employeeId: 'employee-1', checkIn: new Date('2026-09-10T17:00:00.000Z'), checkOut: null }), create: jest.fn().mockResolvedValue({ id: 'attendance-1' }), update };
    const service = new AttendanceService({
      workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata', shiftStart: '22:00', shiftEnd: '06:00', graceMinutes: 15, overtimeAfterMinutes: 480 }) },
      employee: { findUnique: jest.fn().mockResolvedValue({ schedule: null }) },
      attendanceRecord,
    } as never);

    try {
      await service.clockIn({ ...admin, role: UserRole.EMPLOYEE, employeeId: 'employee-1' });
      jest.setSystemTime(new Date('2026-09-10T23:30:00.000Z'));
      await service.clockOut({ ...admin, role: UserRole.EMPLOYEE, employeeId: 'employee-1' });
    } finally {
      jest.useRealTimers();
    }

    expect(attendanceRecord.findUnique).toHaveBeenLastCalledWith({ where: { employeeId_date: { employeeId: 'employee-1', date: new Date('2026-09-10T00:00:00.000Z') } } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ checkOut: new Date('2026-09-10T23:30:00.000Z') }) }));
  });
});
