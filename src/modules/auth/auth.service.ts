import {
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@modules/users/users.service';
import { GoogleTokenExchangeService } from './services/google-token-exchange.service';
import { ConfigService } from '@nestjs/config';
import { LoginResponseDto } from './dto/login-response.dto';
import { User } from '@modules/users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly googleTokenExchange: GoogleTokenExchangeService,
    private readonly configService: ConfigService,
  ) {}

  private async getTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role?.role_name };
    const accessExpiry =
      this.configService.get<number>('JWT_EXPIRATION') ?? 3600;
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: accessExpiry,
    });
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_SECRET');
    const refreshExpiresNum = this.configService.get<number>(
      'JWT_REFRESH_EXPIRATION_SECONDS',
    );
    const refreshExpires = refreshExpiresNum ?? 60 * 60 * 24 * 7;
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, rv: user.refresh_token_version },
      {
        secret: refreshSecret,
        expiresIn: refreshExpires,
      },
    );
    return { accessToken, refreshToken };
  }

  async login(user: { id: string; email: string }): Promise<LoginResponseDto> {
    const full = await this.usersService.findOne(user.id);
    if (!full) {
      throw new UnauthorizedException('User not found');
    }
    const { accessToken, refreshToken } = await this.getTokens(full);
    this.logger.log(`User logged in: ${user.id} (${user.email})`);
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async loginByUserId(userId: string): Promise<LoginResponseDto> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const { accessToken, refreshToken } = await this.getTokens(user);
    this.logger.log(`User logged in by ID: ${userId}`);
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  /**
   * Handle Google OAuth flow: exchange code for tokens, verify identity, and upsert user
   */
  async googleAuth(payload: {
    code: string;
    code_verifier: string;
  }): Promise<string> {
    try {
      const googleProfile =
        await this.googleTokenExchange.exchangeCodeAndVerify(
          payload.code,
          payload.code_verifier,
        );

      let user = await this.usersService.findByEmail(googleProfile.email);

      if (user) {
        user = await this.usersService.update(user.id, {
          google_access_token: googleProfile.google_access_token,
          google_refresh_token: googleProfile.google_refresh_token,
          token_expires_at: googleProfile.token_expires_at,
          avatar_url: googleProfile.avatar_url,
          last_login_at: new Date(),
        });
      } else {
        const defaultRole = await this.usersService.findRoleByName('user');
        if (!defaultRole) {
          throw new InternalServerErrorException('Default role not found');
        }
        user = await this.usersService.create({
          email: googleProfile.email,
          full_name: googleProfile.full_name,
          avatar_url: googleProfile.avatar_url,
          google_access_token: googleProfile.google_access_token,
          google_refresh_token: googleProfile.google_refresh_token,
          token_expires_at: googleProfile.token_expires_at,
          role_id: defaultRole.id,
          is_active: true,
          notification_enabled: true,
          last_login_at: new Date(),
        });
      }

      this.logger.log(`Google OAuth completed for user ${user.id} (${googleProfile.email})`);
      return user.id;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof Error) {
        this.logger.error(`Google auth failed: ${error.message}`);
        throw new InternalServerErrorException(
          `Google authentication failed: ${error.message}`,
        );
      }
      this.logger.error('Google auth failed: unknown error');
      throw new InternalServerErrorException('Google authentication failed');
    }
  }

  async logout(user: { id: string }): Promise<void> {
    await this.usersService.incrementRefreshTokenVersion(user.id);
    this.logger.log(`User logged out: ${user.id}`);
  }

  async refreshToken(refreshTokenValue: string): Promise<LoginResponseDto> {
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_SECRET');
    let decoded: unknown;
    try {
      decoded = this.jwtService.verify(refreshTokenValue, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('sub' in decoded) ||
      typeof (decoded as { sub: unknown }).sub !== 'string'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const payload = decoded as { sub: string; rv?: unknown };
    const tokenRv = Number(payload.rv ?? 0);
    const userId = payload.sub;
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (tokenRv !== user.refresh_token_version) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    const { accessToken, refreshToken: newRefresh } =
      await this.getTokens(user);
    this.logger.log(`Token refreshed for user ${userId}`);
    return { access_token: accessToken, refresh_token: newRefresh };
  }
}
