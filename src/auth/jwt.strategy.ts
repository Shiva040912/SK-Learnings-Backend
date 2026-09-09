import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { createEmptyPagePermissions, PagePermissionsMap } from './page-keys';
import {
  GranularPermissionsMap,
  normalizeGranularPermissions,
} from './student-permission-keys';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: {
    sub: string;
    email: string;
    role: string;
    pagePermissions?: PagePermissionsMap;
    granularPermissions?: GranularPermissionsMap;
  }) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      pagePermissions: payload.pagePermissions || createEmptyPagePermissions(),
      granularPermissions: normalizeGranularPermissions(
        payload.granularPermissions,
      ),
    };
  }
}
