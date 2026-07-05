import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SanitizePipe } from './common/pipes/sanitize.pipe';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Prefijo global para la API
  app.setGlobalPrefix('api');

  // Habilitar CORS para el frontend
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validaciones y sanitizaciones globales
  app.useGlobalPipes(
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('AsistApp API')
    .setDescription('Especificación de la API para el control de asistencia académica (AsistApp).')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa tu token Bearer JWT de Supabase',
        in: 'header',
      },
      'JWT-auth', // Nombre de la referencia de seguridad
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`🚀 AsistApp Backend ejecutándose en: http://localhost:${port}/api`);
  logger.log(`📄 Documentación de Swagger disponible en: http://localhost:${port}/api/docs`);
}
bootstrap();

