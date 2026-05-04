import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findById(id: string, includeHidden = false): Promise<User | null> {
    if (includeHidden) {
      return this.usersRepository.findOne({
        where: { id },
        select: [
          'id',
          'email',
          'full_name',
          'avatar_url',
          'role',
          'google_access_token',
          'google_refresh_token',
          'token_expires_at',
          'drive_total_quota',
          'drive_used_quota',
          'quota_last_updated',
          'is_active',
          'notification_enabled',
          'last_login_at',
          'canva_access_token',
          'canva_refresh_token',
          'canva_token_expires_at',
          'created_at',
          'updated_at',
        ],
      });
    }
    return this.findOne(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async findDriveQuotaByUserId(
    id: string,
  ): Promise<
    Pick<User, 'drive_total_quota' | 'drive_used_quota' | 'quota_last_updated'> | null
  > {
    return this.usersRepository.findOne({
      where: { id },
      select: ['id', 'drive_total_quota', 'drive_used_quota', 'quota_last_updated'],
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, userData);
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
  }

  /** Reserved for opaque refresh-token storage if added later; revocation uses `refresh_token_version`. */
  async updateRefreshToken(_id: string, _hashedToken: string | null): Promise<void> {
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
