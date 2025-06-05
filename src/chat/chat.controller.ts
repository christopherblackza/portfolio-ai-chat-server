import {
  Controller,
  Post,
  Req,
  Res,
  Options,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { Request, Response } from 'express';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Options()
  options(@Res() res: Response) {
    return res.status(HttpStatus.NO_CONTENT).set(corsHeaders).send();
  }

  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response) {
    try {
      const body = req.body;
      const { messages } = body;

      const stream = await this.chatService.processChat(messages);

      res.writeHead(200, {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Handle the ReadableStream properly
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Decode the Uint8Array to string
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (streamError) {
        console.error('Stream reading error:', streamError);
      } finally {
        reader.releaseLock();
        res.end();
      }
    } catch (error) {
      console.error('Error processing request', error);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .set(corsHeaders)
        .json({ error: 'Something went wrong' });
    }
  }
}
