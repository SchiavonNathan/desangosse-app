import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  username: true,
  role: true,
  fullName: true,
  email: true,
  phone: true,
};

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { username: 'asc' },
    });
  }

  async create(data: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, data: UpdateUserDto) {
    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });
  }

  delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}

