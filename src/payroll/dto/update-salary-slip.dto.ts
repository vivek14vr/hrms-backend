import { PartialType } from '@nestjs/swagger';
import { CreateSalarySlipDto } from './create-salary-slip.dto';
export class UpdateSalarySlipDto extends PartialType(CreateSalarySlipDto) {}
