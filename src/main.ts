import './config/env'; // Must be first import
import { NestFactory } from '@nestjs/core';
import * as bodyParser from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  app.enableCors({
    origin: '*', // Allow all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Session-Id']
  });

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Portfolio AI Chat Server')
    .setDescription('API documentation for the Portfolio AI Chat Server with PDF processing and authentication')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('pdf', 'PDF processing endpoints')
    .addTag('health', 'Health check endpoints')
    .addTag('ping', 'Ping endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  console.log(`Server is running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api`);
  await app.listen(port);
}
bootstrap();
