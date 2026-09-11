import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttendanceCorrectionStatus } from '@prisma/client';

export class ReviewAttendanceCorrectionDto {
  @IsEnum(AttendanceCorrectionStatus) status!: AttendanceCorrectionStatus;
  @IsOptional() @IsString() @MaxLength(500) reviewNotes?: string;
}
