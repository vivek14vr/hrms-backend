import { EmploymentStatus, EmploymentType } from '@prisma/client';
export declare class CreateEmployeeDto {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    department: string;
    designation: string;
    employmentType: EmploymentType;
    employmentStatus?: EmploymentStatus;
    joiningDate: string;
    managerName?: string;
    location?: string;
    baseSalary: number;
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
}
