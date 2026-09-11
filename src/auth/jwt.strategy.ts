import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UsersService } from '../users/users.service';
import { createEmptyPagePermissions, PagePermissionsMap } from './page-keys';
import { GranularPermissionsMap } from './student-permission-keys';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // Only sub/email come from the token itself. role/pagePermissions/
  // granularPermissions are re-read from the DB on every request — not
  // trusted from the (possibly hours-old) token payload — so a permission
  // change, role change, or deactivation made by an admin takes effect on
  // the user's very next request, without them needing to log out/in.
  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    pagePermissions?: PagePermissionsMap;
    granularPermissions?: GranularPermissionsMap;
  }) {
    const snapshot = await this.usersService.getAuthSnapshot(payload.sub);

    if (!snapshot) {
      throw new UnauthorizedException(
        'Your session is no longer valid. Please log in again.',
      );
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: snapshot.role,
      pagePermissions: snapshot.pagePermissions || createEmptyPagePermissions(),
      granularPermissions: snapshot.granularPermissions,
    };
  }
}
