import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    private safeUser;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
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
    refresh(refreshToken: string | undefined): Promise<{
        accessToken: string;
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
    me(id: string): Promise<{
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
