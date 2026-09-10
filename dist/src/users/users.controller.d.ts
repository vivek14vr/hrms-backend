import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { StatusDto } from './dto/status.dto';
export declare class UsersController {
    private readonly users;
    constructor(users: UsersService);
    findAll(search?: string, role?: string): Promise<any[]>;
    create(dto: CreateUserDto): Promise<any>;
    update(id: string, dto: UpdateUserDto): Promise<any>;
    updateStatus(id: string, dto: StatusDto): Promise<any>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
