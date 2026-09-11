import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeaveRequestStatus } from '@prisma/client';

export class ReviewLeaveRequestDto {
  @IsEnum(LeaveRequestStatus) status!: LeaveRequestStatus;
  @IsOptional() @IsString() @MaxLength(500) reviewNotes?: string;
}
