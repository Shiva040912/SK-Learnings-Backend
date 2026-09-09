import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// WhatsApp isn't a frontend page (no /whatsapp route/screen exists), so it
// isn't part of the page-permission checkbox list — it stays admin-only,
// same as before the permission system existed.
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('test-template')
  sendTestTemplate(
    @Req() req: { user?: { role?: string } },

    @Body()
    body: {
      phone: string;
      templateName: string;
      bodyParameters?: string[];
    },
  ) {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Administrator access required');
    }

    return this.whatsappService.sendTestTemplate(body);
  }
}
