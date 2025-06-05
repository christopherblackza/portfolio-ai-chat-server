import { Controller, Post, Body, UseInterceptors, UploadedFile, Get, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { RagService } from './rag.service';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('rag')
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ask')
  @ApiOperation({ 
    summary: 'Ask a question using RAG with automatic session management', 
    description: 'Submit a question to get an AI-generated answer. The service automatically manages sessions per user.' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask',
          example: 'What technologies does Christopher work with?'
        },
        userId: {
          type: 'string',
          description: 'User ID for session management',
          example: '69b556da-343d-4ceb-a4c8-f8d752c2ecf3'
        }
      },
      required: ['question', 'userId']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'AI-generated answer with session information',
    schema: {
      type: 'object',
      properties: {
        answer: {
          type: 'string',
          example: 'Christopher is a full-stack developer who works with modern web technologies...'
        },
        sessionId: {
          type: 'string',
          example: 'uuid-string'
        }
      }
    }
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async askQuestion(@Body() body: { question: string; userId: string }) {
    return this.ragService.processQuestionWithAutoSession(body.question, body.userId);
  }

  @Post('sessions')
  @ApiOperation({ 
    summary: 'Create a new conversation session', 
    description: 'Create a new conversation session for a user' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID for the session',
          example: 'user123'
        },
        sessionName: {
          type: 'string',
          description: 'Optional name for the session',
          example: 'Tech Discussion'
        }
      }
    }
  })
  async createSession(@Body() body: { userId?: string; sessionName?: string }) {
    return this.ragService.createSession(body.userId, body.sessionName);
  }

  @Get('sessions/:userId')
  @ApiOperation({ 
    summary: 'Get user sessions', 
    description: 'Retrieve all conversation sessions for a user' 
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserSessions(@Param('userId') userId: string) {
    return this.ragService.getUserSessions(userId);
  }

  @Get('sessions/:sessionId/history')
  @ApiOperation({ 
    summary: 'Get conversation history', 
    description: 'Retrieve conversation history for a session' 
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async getConversationHistory(@Param('sessionId') sessionId: string) {
    return this.ragService.getConversationHistory(sessionId);
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ 
    summary: 'Delete a conversation session', 
    description: 'Delete a conversation session and its history' 
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async deleteSession(@Param('sessionId') sessionId: string) {
    return this.ragService.deleteSession(sessionId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ 
    summary: 'Upload and process PDF', 
    description: 'Upload a PDF file to be processed, embedded, and added to the knowledge base' 
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF file to upload and process'
        }
      },
      required: ['file']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'PDF processed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'PDF processed and embedded successfully'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid file format' })
  @ApiResponse({ status: 500, description: 'Processing failed' })
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    return this.ragService.processPdf(file);
  }
}
