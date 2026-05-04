import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { UsersService } from '@modules/users/users.service';
import { UserRole } from '@common/enums';

/**
 * Passport Google OAuth Strategy for server-side redirect-based authentication flow
 * Handles the callback when users return from Google OAuth consent
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.activity.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/contacts.other.readonly',
      ],
      passReqToCallback: false,
    } as any);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      // Extract email from Google profile
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('No email found in Google profile'), undefined);
      }

      // Use unified user upsert logic via AuthService
      // For Passport flow, we don't have authorization code, so we directly upsert via email + token
      let user = await this.usersService.findByEmail(email);

      if (user) {
        // Existing user: update Google tokens
        user = await this.usersService.update(user.id, {
          google_access_token: accessToken,
          google_refresh_token: refreshToken,
          avatar_url: profile.photos?.[0]?.value,
          last_login_at: new Date(),
        });
      } else {
        // New user: create with default role
        user = await this.usersService.create({
          email,
          full_name: profile.displayName || 'Google User',
          avatar_url: profile.photos?.[0]?.value,
          google_access_token: accessToken,
          google_refresh_token: refreshToken,
          role: UserRole.USER,
          is_active: true,
          notification_enabled: true,
          last_login_at: new Date(),
        });
      }

      // Return user object with id for Passport serialization
      done(null, { id: user.id, email: user.email });
    } catch (error) {
      done(error);
    }
  }
}
