import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ping')
@Controller('ping')
export class PingController {
  @Get()
  @ApiOperation({ summary: 'Ping server for health check' })
  @ApiResponse({ status: 200, description: 'Server is responding', schema: { properties: { status: { type: 'string' }, timestamp: { type: 'string' } } } })
  ping(): { status: string; timestamp: string } {
    return {
      status: 'pong',
      timestamp: new Date().toISOString(),
    };
  }
}