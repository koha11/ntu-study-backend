import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';
import { DriveItem } from './entities/drive-item.entity';
import { GroupsModule } from '@modules/groups/groups.module';
import { UsersModule } from '@modules/users/users.module';
import { CommonModule } from '@common/common.module';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriveItem]),
    GroupsModule,
    UsersModule,
    CommonModule,
    AuthModule,
  ],
  controllers: [GoogleDriveController],
  providers: [GoogleDriveService],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}
