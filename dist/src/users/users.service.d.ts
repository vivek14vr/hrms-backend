import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private safe;
    findAll(search?: string, role?: string): Promise<any[]>;
    create(dto: CreateUserDto): Promise<any>;
    update(id: string, dto: UpdateUserDto): Promise<any>;
    updateStatus(id: string, isActive: boolean): Promise<any>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
    private assertExists;
}
