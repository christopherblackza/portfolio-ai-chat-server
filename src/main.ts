import { NestFactory } from '@nestjs/core';
import * as bodyParser from 'body-parser';

import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  app.enableCors({
    origin: ['http://localhost:4200', 'https://christopherblack.dev'], // Replace with your Angular app's URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  console.log(`Server is running on port ${port}`);
  await app.listen(port);
}
bootstrap();
