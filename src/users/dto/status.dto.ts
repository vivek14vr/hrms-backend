import { IsBoolean } from 'class-validator';
export class StatusDto { @IsBoolean() isActive!: boolean; }
