import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const useSsl = configService.get<boolean>('DB_SSL') === true;
        const { ssl: _s, extra: _e, entities: _entityGlob, ...rest } =
          dataSourceOptions as TypeOrmModuleOptions & {
            ssl?: unknown;
            extra?: unknown;
            entities?: unknown;
          };
        return {
          ...rest,
          // Glob-based entity paths are unreliable on Windows; load entities from
          // TypeOrmModule.forFeature() in each feature module instead.
          autoLoadEntities: true,
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: configService.get<number>('DB_PORT') || 5432,
          username: configService.get<string>('DB_USER') || 'postgres',
          password: configService.get<string>('DB_PASSWORD') || 'postgres',
          database: configService.get<string>('DB_NAME') || 'ntu_study',
          logging: configService.get<string>('DB_LOGGING') === 'true',
          ...(useSsl
            ? {
                ssl: { rejectUnauthorized: false },
                extra: {
                  ssl: { rejectUnauthorized: false },
                },
              }
            : { ssl: false }),
        } as TypeOrmModuleOptions;
      },
    }),
  ],
})
export class DatabaseModule {}
