import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentStatus, PayrollRunStatus, Prisma, UserRole } from '@prisma/client';
import { PayrollService } from '../src/payroll/payroll.service';

describe('PayrollService', () => {
  const admin = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, employeeId: null };
  const currentSlip = {
    id: 'slip-1', employeeId: 'employee-1', month: 9, year: 2026,
    basicSalary: 1000, houseRentAllowance: 200, transportAllowance: 100, performanceBonus: 50,
    providentFund: 100, professionalTax: 10, incomeTax: 50, otherDeductions: 20,
    grossSalary: 1350, totalDeductions: 180, netSalary: 1170, paymentStatus: PaymentStatus.PENDING, paymentDate: null,
  };

  it('recomputes payroll totals and stores derived values', async () => {
    const create = jest.fn().mockResolvedValue(currentSlip);
    const service = new PayrollService({ employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) }, payrollRun: { findUnique: jest.fn().mockResolvedValue(null) }, salarySlip: { create } } as never);

    await service.create('employee-1', {
      month: 9, year: 2026, basicSalary: 1000, houseRentAllowance: 200, transportAllowance: 100,
      performanceBonus: 50, providentFund: 100, professionalTax: 10, incomeTax: 50, otherDeductions: 20,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ grossSalary: 1350, totalDeductions: 180, netSalary: 1170 }) }));
  });

  it('uses the latest effective compensation when basic salary is omitted', async () => {
    const create = jest.fn().mockResolvedValue(currentSlip);
    const service = new PayrollService({
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1', baseSalary: 1000 }) },
      compensationHistory: { findFirst: jest.fn().mockResolvedValue({ baseSalary: 2500 }) },
      payrollRun: { findUnique: jest.fn().mockResolvedValue(null) },
      salarySlip: { create },
    } as never);

    await service.create('employee-1', { month: 9, year: 2026 });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ basicSalary: 2500 }) }));
  });

  it('rejects deductions greater than gross pay before writing', async () => {
    const create = jest.fn();
    const service = new PayrollService({ employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) }, payrollRun: { findUnique: jest.fn().mockResolvedValue(null) }, salarySlip: { create } } as never);

    await expect(service.create('employee-1', { month: 9, year: 2026, basicSalary: 1000, otherDeductions: 5000 })).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects negative or non-finite amounts in direct service calls', async () => {
    const service = new PayrollService({ employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) }, payrollRun: { findUnique: jest.fn().mockResolvedValue(null) }, salarySlip: { create: jest.fn() } } as never);

    await expect(service.create('employee-1', { month: 9, year: 2026, basicSalary: -1 } as never)).rejects.toThrow(BadRequestException);
    await expect(service.create('employee-1', { month: 9, year: 2026, basicSalary: Number.NaN } as never)).rejects.toThrow(BadRequestException);
  });

  it('recomputes totals when an existing slip is updated', async () => {
    const update = jest.fn().mockResolvedValue(currentSlip);
    const service = new PayrollService({ salarySlip: { findUnique: jest.fn().mockResolvedValue(currentSlip), update }, payrollRun: { findUnique: jest.fn().mockResolvedValue(null) } } as never);

    await service.update('slip-1', { otherDeductions: 30 });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalDeductions: 190, netSalary: 1160 }) }));
  });

  it('maps duplicate periods to a conflict response', async () => {
    const create = jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.15.0' }));
    const service = new PayrollService({ employee: { findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }) }, payrollRun: { findUnique: jest.fn().mockResolvedValue(null) }, salarySlip: { create } } as never);

    await expect(service.create('employee-1', { month: 9, year: 2026, basicSalary: 1000 })).rejects.toThrow(ConflictException);
  });

  it('advances a run through the next valid lifecycle state', async () => {
    const transaction = {
      payrollRun: {
        findUnique: jest.fn().mockResolvedValue({ id: 'run-1', status: PayrollRunStatus.DRAFT, slipCount: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'run-1', status: PayrollRunStatus.REVIEW, totalGross: 1000, totalDeductions: 100, totalNet: 900 }),
      },
      salarySlip: { updateMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (db: typeof transaction) => unknown) => callback(transaction)) };
    const service = new PayrollService(prisma as never);

    await service.updateRunStatus('run-1', PayrollRunStatus.REVIEW, admin);

    expect(transaction.payrollRun.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'run-1' }, data: expect.objectContaining({ status: PayrollRunStatus.REVIEW }) }));
  });

  it('rejects edits to salary slips after their run is approved', async () => {
    const current = { ...currentSlip, payrollRunId: 'run-1', payrollRun: { id: 'run-1', status: PayrollRunStatus.APPROVED } };
    const update = jest.fn();
    const service = new PayrollService({ salarySlip: { findUnique: jest.fn().mockResolvedValue(current), update }, payrollRun: { findUnique: jest.fn() } } as never);

    await expect(service.update('slip-1', { otherDeductions: 30 })).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });
});
