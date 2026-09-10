import { PaymentStatus } from '@prisma/client';
export declare class CreateSalarySlipDto {
    month: number;
    year: number;
    basicSalary: number;
    houseRentAllowance?: number;
    transportAllowance?: number;
    performanceBonus?: number;
    providentFund?: number;
    professionalTax?: number;
    incomeTax?: number;
    otherDeductions?: number;
    paymentStatus?: PaymentStatus;
    paymentDate?: string | null;
}
