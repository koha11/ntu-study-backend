import { Module } from '@nestjs/common';
import { GoogleContactsController } from './google-contacts.controller';
import { GoogleContactsService } from './google-contacts.service';
import { UsersModule } from '@modules/users/users.module';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [GoogleContactsController],
  providers: [GoogleContactsService],
})
export class GoogleContactsModule {}
