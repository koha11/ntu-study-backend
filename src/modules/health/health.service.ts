import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
