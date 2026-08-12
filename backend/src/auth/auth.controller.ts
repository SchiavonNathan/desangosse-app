import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Rate limited to 5 attempts per minute per IP.
   * Protects against brute force attacks on credentials.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.username, body.password);

    if (!user) {
      // Generic error — do not reveal if username or password was wrong
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.authService.login(user);
  }
}
