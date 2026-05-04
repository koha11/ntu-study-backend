import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for Google OAuth callback endpoint (frontend-driven PKCE flow)
 * Frontend sends authorization code and PKCE code_verifier via query params
 */
export class GoogleCallbackDto {
  @IsNotEmpty({ message: 'Authorization code is required' })
  @IsString({ message: 'Code must be a string' })
  code!: string;

  @IsNotEmpty({ message: 'PKCE code_verifier is required' })
  @IsString({ message: 'Code verifier must be a string' })
  code_verifier!: string;
}

/**
 * Response DTO for Google OAuth callback
 * Returns only user_id when verification succeeds
 */
export class GoogleCallbackResponseDto {
  user_id!: string;
}
