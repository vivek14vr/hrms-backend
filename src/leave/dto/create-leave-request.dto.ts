import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString() leaveTypeId!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
