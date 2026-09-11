import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SchedulesService } from '../src/schedules/schedules.service';

const manager = { id: 'hr-1', name: 'HR', email: 'hr@example.com', role: UserRole.HR_MANAGER, employeeId: null };

describe('SchedulesService', () => {
  it('normalizes and creates a valid schedule', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'schedule-1', name: 'India shift' });
    const service = new SchedulesService({ workSchedule: { create } } as never);

    await service.create({ name: ' India shift ', timezone: 'Asia/Kolkata', workWeek: 'Monday – Friday', shiftStart: '09:00', shiftEnd: '18:00', graceMinutes: 15, overtimeAfterMinutes: 480 }, manager);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'India shift', timezone: 'Asia/Kolkata', active: true }) }));
  });

  it('rejects invalid schedules and non-manager writes', async () => {
    const service = new SchedulesService({ workSchedule: { create: jest.fn() } } as never);
    await expect(service.create({ name: 'Night', timezone: 'Not/AZone', workWeek: 'Monday – Friday', shiftStart: '22:00', shiftEnd: '06:00', graceMinutes: 15, overtimeAfterMinutes: 480 }, manager)).rejects.toThrow(BadRequestException);
    await expect(service.create({ name: 'Night', timezone: 'UTC', workWeek: 'Monday – Friday', shiftStart: '22:00', shiftEnd: '06:00', graceMinutes: 15, overtimeAfterMinutes: 480 }, { ...manager, role: UserRole.EMPLOYEE })).rejects.toThrow(ForbiddenException);
  });

  it('soft-deactivates a schedule', async () => {
    const current = { id: 'schedule-1', name: 'India shift', active: true };
    const update = jest.fn().mockResolvedValue({ ...current, active: false });
    const service = new SchedulesService({ workSchedule: { findUnique: jest.fn().mockResolvedValue(current), update } } as never);

    await service.remove('schedule-1', manager);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'schedule-1' }, data: { active: false } }));
  });
});
