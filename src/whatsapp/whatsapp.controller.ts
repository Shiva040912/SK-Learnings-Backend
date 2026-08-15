import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(
    private readonly whatsappService:
      WhatsappService,
  ) {}

  @Post('test-template')
  sendTestTemplate(
    @Body()
    body: {
      phone: string;
      templateName: string;
      bodyParameters?: string[];
    },
  ) {
    return this.whatsappService.sendTestTemplate(
      body,
    );
  }
}