import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust proxy — needed for @nestjs/throttler to correctly read client IP
  // behind reverse proxies (nginx, Cloudflare, etc.)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // ── Security Headers (Helmet) ────────────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  app.use(
    helmet({
      // Deny framing from other origins (clickjacking protection)
      frameguard: { action: 'sameorigin' },
      // Prevent MIME type sniffing
      noSniff: true,
      // Force HTTPS (only enable in production)
      hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // needed for inline styles in React
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", frontendUrl],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'", frontendUrl],
          formAction: ["'self'"],
          upgradeInsecureRequests:
            process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      // Allow embedding/loading resources from any origin
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Disable x-powered-by header (hides Express/NestJS)
      hidePoweredBy: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // ── Global Validation Pipe ──────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // Strip unknown properties
      forbidNonWhitelisted: true, // Reject requests with unknown properties
      transform: true,            // Auto-transform payloads to DTO types
      stopAtFirstError: false,    // Return all errors at once
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
