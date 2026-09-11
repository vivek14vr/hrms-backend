import { IsEnum } from 'class-validator';
import { PayrollRunStatus } from '@prisma/client';

export class UpdatePayrollRunStatusDto {
  @IsEnum(PayrollRunStatus) status!: PayrollRunStatus;
}
