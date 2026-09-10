import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
export class CreateAttendanceDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsDateString() date!: string;
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsNumber() @Min(0) workHours?: number;
  @IsEnum(AttendanceStatus) status!: AttendanceStatus;
  @IsOptional() @IsString() notes?: string;
}
