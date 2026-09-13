import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const corsOrigins = config.get<string>('CORS_ORIGINS', '');
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',') : true,
    credentials: true,
  });

  // Not gated behind NODE_ENV — this is a public read API (see
  // docs/05-system-architecture.md) with no admin/internal-only endpoints
  // that would make its docs sensitive to expose in production.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('The Food Map of Vietnam API')
    .setDescription(
      'REST API for the restaurant discovery/review platform — consumed by the mobile app, admin web, and public web. ' +
        'Most endpoints under /me and /admin require a JWT bearer token from POST /auth/login; use the Authorize button below with the accessToken it returns.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  Logger.log(`Food Map of Vietnam API listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger docs available at /docs`, 'Bootstrap');
}
void bootstrap();
