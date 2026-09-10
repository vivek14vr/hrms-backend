import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user';
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    summary(user: RequestUser): Promise<{
        totalEmployees: number;
        activeEmployees: number;
        employeesOnLeave: number;
        attendancePercentage: number;
        monthlyPayrollTotal: number;
        pendingPayroll: number;
    }>;
    attendanceTrend(user: RequestUser, months?: number): Promise<{
        month: string;
        attendance: number;
    }[]>;
    departmentHeadcount(): Promise<{
        department: string;
        count: number;
    }[]>;
    recentActivity(user: RequestUser): Promise<{
        id: string;
        type: string;
        title: string;
        description: string;
        time: Date;
        tone: string;
    }[]>;
}
