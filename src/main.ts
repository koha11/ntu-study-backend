import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppDataSource } from './database/data-source';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  // Swagger/OpenAPI Configuration
  const config = new DocumentBuilder()
    .setTitle('NTU Study Backend API')
    .setDescription(
      'Backend API for NTU Study Group Management System with Google OAuth, task management, flashcards, and collaboration features.',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'System health check')
    .addTag('Auth', 'Authentication and authorization')
    .addTag('Users', 'User profiles and management')
    .addTag('Groups', 'Study group management')
    .addTag('Invitations', 'Group invitations')
    .addTag('Tasks', 'Task management')
    .addTag('Flashcards', 'Flashcard sets and study')
    .addTag('Contributions', 'Peer ratings and evaluations')
    .addTag('Notifications', 'User notifications')
    .addTag('Audit Logs', 'Activity logging')
    .addTag('Google Drive', 'Google Drive integration')
    .addTag('Admin', 'Admin controls')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customCss: `
      .swagger-ui .topbar {
        background-color: #1976d2;
      }
      .swagger-ui .info .title {
        color: #1976d2;
      }
    `,
    customSiteTitle: 'NTU Study API Documentation',
  });

  await app.listen(port);

  console.log(`[App] NestJS application is running on port ${port}`);
  console.log(
    `[Docs] Swagger UI available at http://localhost:${port}/api/docs`,
  );

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    console.log(
      `\n[Shutdown] Received ${signal}, starting graceful shutdown...`,
    );

    try {
      // Revert migrations on shutdown (if enabled)
      if (
        process.env.REVERT_MIGRATIONS_ON_SHUTDOWN === 'true' &&
        AppDataSource.isInitialized
      ) {
        console.log('[Migration] Reverting migrations...');
        await AppDataSource.undoLastMigration();
        console.log('[Migration] Migrations reverted successfully');
      }
    } catch (error) {
      console.error('[Migration] Error reverting migrations:', error);
    }

    try {
      await app.close();
      console.log('[App] Application closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('[App] Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[App] Fatal error during bootstrap:', err);
  process.exit(1);
});
