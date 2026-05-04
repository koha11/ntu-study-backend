/** Matches JwtStrategy.validate() return shape */
export interface JwtRequestUser {
  id: string;
  email?: string;
}
