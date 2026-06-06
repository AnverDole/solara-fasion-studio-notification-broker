import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

import { AuthenticatedSocketUser } from './notification-instance.types';

type JwtPayload = {
  sub?: string;
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

@Injectable()
export class NotificationAuthService {
  private readonly jwtSecret = process.env.JWT_ACCESS_TOKEN_SECRET ?? '';

  verifyHandshakeToken(token: unknown): AuthenticatedSocketUser {
    if (!this.jwtSecret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    if (typeof token !== 'string' || !token.trim()) {
      throw new UnauthorizedException('Authentication token is required');
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;

      const userId = decoded.sub ?? decoded.id;

      if (!userId) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      return {
        id: userId,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
      };
    } catch {
      throw new UnauthorizedException('Invalid authentication token');
    }
  }
}
