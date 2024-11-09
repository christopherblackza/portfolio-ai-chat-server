import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';


@Module({
  imports: [],
  controllers: [PdfController, HealthController],
  providers: [PdfService],
})
export class AppModule {}