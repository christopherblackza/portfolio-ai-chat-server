import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {


    constructor(

    )  {
        // Add any additional logic
    }

  @Get()
  checkHealth() {
    // You can add additional logic here if needed, like database checks



    return {
      status: 'ok',
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
    };
  }
}