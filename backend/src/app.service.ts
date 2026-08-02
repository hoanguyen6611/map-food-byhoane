import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo(): string {
    return 'The Food Map of Vietnam API — see /health for status';
  }
}
