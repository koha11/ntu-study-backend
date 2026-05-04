import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        APP_PORT: Joi.number().default(3000),
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        DB_SYNCHRONIZE: Joi.boolean().default(false),
        DB_LOGGING: Joi.boolean().default(false),
        DB_SSL: Joi.boolean()
          .truthy('true')
          .truthy('1')
          .falsy('false')
          .falsy('0')
          .default(false),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.number().default(3600),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().required(),
        MAIL_HOST: Joi.string().optional(),
        MAIL_PORT: Joi.number().default(587),
        MAIL_USER: Joi.string().optional(),
        MAIL_PASSWORD: Joi.string().optional(),
        MAIL_FROM: Joi.string().optional(),
        FRONTEND_URL: Joi.string().optional(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
  ],
})
export class AppConfigModule {}
