import { DashboardService } from './dashboard.service';
import { RequestUser } from '../common/types/request-user';
export declare class DashboardController {
    private readonly dashboard;
    constructor(dashboard: DashboardService);
    summary(user: RequestUser): Promise<{
        totalEmployees: number;
        activeEmployees: number;
        employeesOnLeave: number;
        attendancePercentage: number;
        monthlyPayrollTotal: number;
        pendingPayroll: number;
    }>;
    trend(user: RequestUser, months?: string): Promise<{
        month: string;
        attendance: number;
    }[]>;
    headcount(): Promise<{
        department: string;
        count: number;
    }[]>;
    recent(user: RequestUser): Promise<{
        id: string;
        type: string;
        title: string;
        description: string;
        time: Date;
        tone: string;
    }[]>;
}
