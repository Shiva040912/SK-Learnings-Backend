import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app =
    await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  app.use(
    json({
      limit: '10mb',
    }),
  );

  app.use(
    urlencoded({
      limit: '10mb',
      extended: true,
    }),
  );

  app.enableCors({
    origin: (
      origin,
      callback,
    ) => {
      const allowedOrigins = [
        'http://localhost:5173',
        'https://sk-learning-frontend.vercel.app',
        'https://sk-learning-frontend.shivaarun0071.workers.dev',
        'https://sk-learnings-frontend.web.app',
      ];

      if (!origin) {
        return callback(null, true);
      }

      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(
          'Not allowed by CORS',
        ),
        false,
      );
    },

    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;

  try {
    await app.listen(port);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException)?.code === 'EADDRINUSE'
    ) {
      // eslint-disable-next-line no-console
      console.error(
        `\nPort ${port} is already in use by another process.\n` +
          'This is almost always a previous backend instance (or another app) ' +
          'still running from an earlier session that was never stopped.\n' +
          'Stop that process first, then run this command again. ' +
          'This app will not kill it automatically.\n' +
          '  Windows (PowerShell): Get-NetTCPConnection -LocalPort ' +
          `${port} -State Listen | Select-Object OwningProcess\n` +
          '                        Stop-Process -Id <OwningProcess>\n',
      );
      process.exit(1);
    }

    throw error;
  }
}

bootstrap();