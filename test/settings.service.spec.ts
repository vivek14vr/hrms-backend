import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SettingsService } from '../src/settings/settings.service';

const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null };
const defaultsForTest = { id: 'workspace-settings', name: 'PeopleOS Demo', timezone: 'Asia/Kolkata', currency: 'INR', workWeek: 'Monday – Friday', shiftStart: '09:00', shiftEnd: '18:00', graceMinutes: 15, overtimeAfterMinutes: 480 };

describe('SettingsService', () => {
  it('normalizes and persists supported workspace defaults', async () => {
    const update = jest.fn().mockResolvedValue({ ...defaultsForTest, name: 'Acme HR', currency: 'USD' });
    const prisma = { workspaceSettings: { upsert: jest.fn().mockResolvedValue(defaultsForTest), update } };
    const service = new SettingsService(prisma as never);

    await service.update({ name: ' Acme HR ', timezone: 'Europe/London', currency: 'usd' }, admin);

    expect(update).toHaveBeenCalledWith({ where: { id: 'workspace-settings' }, data: { name: 'Acme HR', timezone: 'Europe/London', currency: 'USD', workWeek: 'Monday – Friday', shiftStart: '09:00', shiftEnd: '18:00', graceMinutes: 15, overtimeAfterMinutes: 480 } });
  });

  it('rejects invalid timezones before writing', async () => {
    const update = jest.fn();
    const service = new SettingsService({ workspaceSettings: { upsert: jest.fn().mockResolvedValue(defaultsForTest), update } } as never);

    await expect(service.update({ timezone: 'Not/A_Timezone' }, admin)).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('allows only HR and administrators to update settings', async () => {
    const service = new SettingsService({} as never);

    await expect(service.update({}, { ...admin, role: UserRole.EMPLOYEE })).rejects.toThrow(ForbiddenException);
  });
});
