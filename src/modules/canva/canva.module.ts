import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { CanvaAuthController } from './canva-auth.controller';
import { CanvaOAuthSessionStore } from './canva-oauth-session.store';
import { CanvaService } from './canva.service';

@Module({
  imports: [ConfigModule, UsersModule, AuthModule],
  controllers: [CanvaAuthController],
  providers: [CanvaService, CanvaOAuthSessionStore],
  exports: [CanvaService],
})
export class CanvaModule {}
