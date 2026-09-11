import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHolidayDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsDateString() date!: string;
}
