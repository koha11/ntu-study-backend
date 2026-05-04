import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'default-secret-for-dev',
    });
  }

  async validate(payload: {
    sub: string;
    email?: string;
    role?: string;
  }) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
