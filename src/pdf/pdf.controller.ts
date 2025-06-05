import { Controller, Post, UploadedFile, UseInterceptors, Body, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';

import * as pdf from 'pdf-parse';
import { PdfService } from './pdf.service';

@ApiTags('pdf')
@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload PDF file for processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 200, description: 'PDF uploaded successfully' })
  @ApiResponse({ status: 400, description: 'No file uploaded' })
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<{ fileId: string }> {
    if (!file) {
      throw new Error('No file uploaded xD');
    }

    // Parse the PDF to extract text
    const pdfBuffer = file.buffer;
    const data = await pdf(pdfBuffer);
    
    // Generate a unique fileId and store the text in cache
    const fileId = await this.pdfService.storePdfText(data.text);
    
    return { fileId };  // Return the fileId for future reference
  }

  @Post('ask')
  @ApiOperation({ summary: 'Ask question about uploaded PDF' })
  @ApiBody({ schema: { properties: { fileId: { type: 'string' }, question: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Question answered successfully' })
  @ApiResponse({ status: 400, description: 'FileId and question are required' })
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