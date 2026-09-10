import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { EmploymentStatus, EmploymentType } from '@prisma/client';
export class CreateEmployeeDto {
  @IsString() @MinLength(1) firstName!: string; @IsString() @MinLength(1) lastName!: string; @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string; @IsString() department!: string; @IsString() designation!: string;
  @IsEnum(EmploymentType) employmentType!: EmploymentType; @IsOptional() @IsEnum(EmploymentStatus) employmentStatus?: EmploymentStatus;
  @IsDateString() joiningDate!: string; @IsOptional() @IsString() managerName?: string; @IsOptional() @IsString() location?: string;
  @IsNumber() @Min(1) baseSalary!: number; @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() emergencyContactName?: string; @IsOptional() @IsString() emergencyContactPhone?: string;
}
