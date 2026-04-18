import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/drive'],
      passReqToCallback: false,
    } as any);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // TODO: Implement Google OAuth validation and user sync
    const user = {
      email: profile.emails[0].value,
      full_name: profile.displayName,
      avatar_url: profile.photos[0]?.value,
      google_access_token: accessToken,
      google_refresh_token: refreshToken,
    };
    done(null, user);
  }
}
