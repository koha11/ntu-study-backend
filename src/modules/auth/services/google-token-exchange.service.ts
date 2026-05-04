import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

/**
 * Extracted Google user profile from ID token verification
 */
export interface GoogleUserProfile {
  email: string;
  full_name: string;
  avatar_url?: string;
  google_access_token: string;
  google_refresh_token?: string;
  token_expires_at?: Date;
}

/**
 * Service to exchange Google authorization code for tokens and verify identity
 * Implements server-side code exchange with PKCE verification
 */
@Injectable()
export class GoogleTokenExchangeService {
  private oauth2Client: OAuth2Client;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const rawRedirect = this.configService.get<string>('GOOGLE_CALLBACK_URL');
    const redirectUri = rawRedirect?.trim();

    if (!clientId || !clientSecret) {
      throw new Error(
        'Google OAuth credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)',
      );
    }
    if (!redirectUri) {
      throw new Error('GOOGLE_CALLBACK_URL is not configured');
    }

    // Must match exactly what the SPA sends as redirect_uri when starting OAuth + Google Console.
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  /**
   * Exchange authorization code for Google tokens and verify PKCE
   * @param code Authorization code from Google OAuth
   * @param codeVerifier PKCE code verifier to verify code_challenge
   * @returns Verified Google user profile with tokens
   * @throws BadRequestException if code or code_verifier is invalid
   * @throws UnauthorizedException if token verification fails
   */
  async exchangeCodeAndVerify(
    code: string,
    codeVerifier: string,
  ): Promise<GoogleUserProfile> {
    try {
      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken({
        code,
        codeVerifier, // Verify PKCE code_verifier
      });

      if (!tokens.id_token) {
        throw new UnauthorizedException(
          'No ID token received from Google. Cannot verify user identity.',
        );
      }

      // Verify ID token signature and extract claims
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException(
          'Failed to extract payload from ID token',
        );
      }

      // Require email claim (federated identity anchor)
      const email = payload.email;
      if (!email) {
        throw new UnauthorizedException(
          'Email claim missing from Google ID token. Cannot proceed without email.',
        );
      }

      // Extract user profile fields
      const googleProfile: GoogleUserProfile = {
        email,
        full_name: payload.name || 'Google User',
        avatar_url: payload.picture,
        google_access_token: tokens.access_token || '',
        google_refresh_token: tokens.refresh_token || undefined,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
      };

      return googleProfile;
    } catch (error) {
      // Distinguish between client errors and server errors
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Google API errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        // Invalid code or PKCE mismatch
        if (
          errorMessage.includes('invalid_grant') ||
          errorMessage.includes('code already redeemed')
        ) {
          throw new UnauthorizedException(
            'Invalid or expired authorization code. User must re-authenticate.',
          );
        }

        if (errorMessage.includes('invalid_code_verifier')) {
          throw new BadRequestException(
            'PKCE code_verifier validation failed. Code challenge mismatch.',
          );
        }

        if (errorMessage.includes('invalid')) {
          throw new BadRequestException(`Google OAuth error: ${error.message}`);
        }
      }

      // Generic server error
      throw new Error(
        `Failed to exchange Google authorization code: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Obtain a new access token using the user's Google refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expiry_date?: Date;
  }> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const access = await this.oauth2Client.getAccessToken();
    const token = access.token;
    if (!token) {
      throw new UnauthorizedException(
        'Failed to refresh Google access token. Sign in with Google again.',
      );
    }
    const creds = this.oauth2Client.credentials;
    return {
      access_token: token,
      expiry_date: creds.expiry_date
        ? new Date(creds.expiry_date)
        : undefined,
    };
  }
}
