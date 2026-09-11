import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class CreateAttendanceCorrectionDto {
  @IsDateString() date!: string;
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(24) workHours?: number;
  @IsEnum(AttendanceStatus) status!: AttendanceStatus;
  @IsString() @MinLength(3) reason!: string;
}
