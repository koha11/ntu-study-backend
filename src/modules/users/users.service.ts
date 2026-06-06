import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Role) private rolesRepository: Repository<Role>,
  ) {}

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: { role: true },
    });
  }

  async findById(id: string, _includeHidden?: boolean): Promise<User | null> {
    return this.findOne(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: { role: true },
    });
  }

  async findRoleByName(roleName: string): Promise<Role | null> {
    return this.rolesRepository.findOne({ where: { role_name: roleName } });
  }

  async findDriveQuotaByUserId(
    id: string,
  ): Promise<Pick<
    User,
    'drive_total_quota' | 'drive_used_quota' | 'quota_last_updated'
  > | null> {
    return this.usersRepository.findOne({
      where: { id },
      select: [
        'id',
        'drive_total_quota',
        'drive_used_quota',
        'quota_last_updated',
      ],
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    this.logger.log(`Creating user: ${userData.email ?? 'unknown'}`);
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, userData);
    this.logger.log(`User updated: ${id}`);
    const updatedUser = await this.findOne(id);
    if (!updatedUser) {
      throw new Error(`User with id ${id} not found after update`);
    }
    return updatedUser;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, {
      last_login_at: new Date(),
    });
  }

  /** Revokes all refresh JWTs for this user (session invalidation). */
  async incrementRefreshTokenVersion(id: string): Promise<void> {
    await this.usersRepository.increment({ id }, 'refresh_token_version', 1);
    this.logger.debug(`Refresh token version incremented for user ${id}`);
  }

  /** Reserved for opaque refresh-token storage if added later; revocation uses `refresh_token_version`. */
  async updateRefreshToken(
    _id: string,
    _hashedToken: string | null,
  ): Promise<void> {
    return Promise.resolve();
  }

  async updateDriveQuota(
    id: string,
    totalQuota: string,
    usedQuota: string,
  ): Promise<void> {
    await this.usersRepository.update(id, {
      drive_total_quota: totalQuota as unknown as number,
      drive_used_quota: usedQuota as unknown as number,
      quota_last_updated: new Date(),
    });
  }

  /** Updates measured Drive usage only (total cap is user-managed). */
  async updateDriveUsedQuota(id: string, usedQuota: string): Promise<void> {
    await this.usersRepository.update(id, {
      drive_used_quota: usedQuota as unknown as number,
      quota_last_updated: new Date(),
    });
  }
}
