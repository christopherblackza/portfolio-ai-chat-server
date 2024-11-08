import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import * as pdf from 'pdf-parse';

import { PdfService } from './pdf.service';

@Controller('pdf')
export class PdfController {


  constructor(private readonly pdfService: PdfService) { }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },  // Limit file size to 10MB
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<{ fileId: string }> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Parse the PDF to extract text
    const pdfBuffer = file.buffer;
    const data = await pdf(pdfBuffer);
    
    // Generate a unique fileId and store the text in cache
    const fileId = await this.pdfService.storePdfText(data.text);
    
    return { fileId };  // Return the fileId for future reference
  }
  @Post('question')
  async askQuestion(@Body() body: { fileId: string; question: string }) {
    if (!body.fileId || !body.question) {
      throw new BadRequestException('FileId and question are required');
    }

    const answer = await this.pdfService.answerQuestionFromCache(
      body.fileId,
      body.question
    );
    return { answer };
  }
}