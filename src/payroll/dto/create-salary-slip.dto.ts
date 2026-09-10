import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
export class CreateSalarySlipDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @Type(() => Number) @IsInt() @Min(2020) year!: number;
  @Type(() => Number) @IsNumber() @Min(0) basicSalary!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) houseRentAllowance?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportAllowance?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) performanceBonus?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) providentFund?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) professionalTax?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) incomeTax?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherDeductions?: number;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @IsDateString() paymentDate?: string | null;
}
