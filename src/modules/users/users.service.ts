import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  async findOne(_id: string): Promise<User> {
    // TODO: Implement find user by id
    throw new Error('Not implemented');
  }

  async findByEmail(_email: string): Promise<User> {
    // TODO: Implement find user by email
    throw new Error('Not implemented');
  }

  async create(_userData: Partial<User>): Promise<User> {
    // TODO: Implement create user
    throw new Error('Not implemented');
  }

  async update(_id: string, _userData: Partial<User>): Promise<User> {
    // TODO: Implement update user
    throw new Error('Not implemented');
  }

  async updateLastLogin(_id: string): Promise<void> {
    // TODO: Implement update last login
  }

  async updateDriveQuota(
    _id: string,
    _totalQuota: number,
    _usedQuota: number,
  ): Promise<void> {
    // TODO: Implement update drive quota
  }
}
