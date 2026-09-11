import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateScheduleDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MinLength(1) @MaxLength(100) timezone!: string;
  @IsIn(['Monday – Friday', 'Sunday – Thursday', 'Monday – Saturday']) workWeek!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) shiftStart!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) shiftEnd!: string;
  @IsInt() @Min(0) @Max(240) graceMinutes!: number;
  @IsInt() @Min(1) @Max(1440) overtimeAfterMinutes!: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
