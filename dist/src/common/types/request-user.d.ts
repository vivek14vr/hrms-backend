import { UserRole } from '@prisma/client';
export interface RequestUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    employeeId?: string | null;
}
