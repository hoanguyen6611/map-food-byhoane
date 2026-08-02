import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Requires a valid, non-expired access token; populates `request.user` with
// a RequestUser (see auth.types.ts). Apply to any authenticated route.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
