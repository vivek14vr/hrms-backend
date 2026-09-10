import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestUser } from '../common/types/request-user';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    login(dto: LoginDto, response: Response): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
            employeeId: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        employee: {
            email: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            employeeCode: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            avatarUrl: string | null;
            department: string;
            designation: string;
            employmentType: import("@prisma/client").$Enums.EmploymentType;
            employmentStatus: import("@prisma/client").$Enums.EmploymentStatus;
            joiningDate: Date;
            managerName: string | null;
            location: string | null;
            dateOfBirth: Date | null;
            address: string | null;
            emergencyContactName: string | null;
            emergencyContactPhone: string | null;
            baseSalary: import("@prisma/client/runtime/library").Decimal;
        } | null;
    }>;
    logout(response: Response): {
        success: boolean;
    };
    me(user: RequestUser): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
            employeeId: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        employee: {
            email: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            employeeCode: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            avatarUrl: string | null;
            department: string;
            designation: string;
            employmentType: import("@prisma/client").$Enums.EmploymentType;
            employmentStatus: import("@prisma/client").$Enums.EmploymentStatus;
            joiningDate: Date;
            managerName: string | null;
            location: string | null;
            dateOfBirth: Date | null;
            address: string | null;
            emergencyContactName: string | null;
            emergencyContactPhone: string | null;
            baseSalary: import("@prisma/client/runtime/library").Decimal;
        } | null;
    }>;
    refresh(request: Request, response: Response): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
            employeeId: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        employee: {
            email: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            employeeCode: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            avatarUrl: string | null;
            department: string;
            designation: string;
            employmentType: import("@prisma/client").$Enums.EmploymentType;
            employmentStatus: import("@prisma/client").$Enums.EmploymentStatus;
            joiningDate: Date;
            managerName: string | null;
            location: string | null;
            dateOfBirth: Date | null;
            address: string | null;
            emergencyContactName: string | null;
            emergencyContactPhone: string | null;
            baseSalary: import("@prisma/client/runtime/library").Decimal;
        } | null;
    }>;
}
