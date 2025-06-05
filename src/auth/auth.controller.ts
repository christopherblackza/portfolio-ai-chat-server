import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('anonymous')
  @ApiOperation({ summary: 'Sign in anonymously' })
  @ApiResponse({ status: 200, description: 'Successfully signed in anonymously' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async signInAnonymously() {
    try {
      const result = await this.authService.signInAnonymously();
      
      // Generate a random username
      const adjectives = ['Cool', 'Swift', 'Bright', 'Bold', 'Quick', 'Smart', 'Wise', 'Calm', 'Sharp', 'Brave'];
      const nouns = ['Tiger', 'Eagle', 'Wolf', 'Fox', 'Bear', 'Lion', 'Hawk', 'Shark', 'Falcon', 'Panther'];
      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomNumber = Math.floor(Math.random() * 1000);
      const randomUsername = `${randomAdjective}${randomNoun}${randomNumber}`;
      
      return {
        success: true,
        user: {
          ...result.user,
          username: randomUsername
        },
        session: result.session,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh session token' })
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Successfully refreshed session' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async refreshSession(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const result = await this.authService.refreshSession(body.refreshToken);
      return {
        success: true,
        user: result.user,
        session: result.session,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('signout')
  @ApiOperation({ summary: 'Sign out user' })
  @ApiBody({ schema: { properties: { accessToken: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Successfully signed out' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async signOut(@Body() body: { accessToken: string }) {
    if (!body.accessToken) {
      throw new BadRequestException('Access token is required');
    }

    try {
      await this.authService.signOut(body.accessToken);
      return {
        success: true,
        message: 'Successfully signed out',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}