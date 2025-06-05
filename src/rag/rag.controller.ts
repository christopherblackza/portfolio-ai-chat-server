import { Controller, Post, Body } from '@nestjs/common';
import { RagService } from './rag.service';


@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ask')
  async askQuestion(@Body('question') question: string) {
    return this.ragService.processQuestion(question);
  }
}
