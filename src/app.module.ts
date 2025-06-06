import { Module } from '@nestjs/common';

import { HealthController } from './health/health.controller';
import { PdfController } from './pdf/pdf.controller';
import { PdfService } from './pdf/pdf.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { PingController } from './ping/ping.controller';
import { ChatModule } from './chat/chat.module';
import { RagController } from './rag/rag.controller';
import { RagService } from './rag/rag.service';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    ChatModule,
    RagModule
  ],
  controllers: [PdfController, HealthController, AuthController, PingController],
  providers: [PdfService, AuthService],
})
export class AppModule {}