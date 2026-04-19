import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const result = controller.getHealth();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
    });

    it('should return status as "ok"', () => {
      const result = controller.getHealth();

      expect(result.status).toBe('ok');
    });

    it('should return a valid ISO timestamp', () => {
      const result = controller.getHealth();

      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should return a positive uptime number', () => {
      const result = controller.getHealth();

      expect(result.uptime).toBeGreaterThan(0);
      expect(typeof result.uptime).toBe('number');
    });
  });
});

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return an object with status, timestamp, and uptime', () => {
      const result = service.getHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
    });

    it('should always return status "ok"', () => {
      const result = service.getHealth();

      expect(result.status).toBe('ok');
    });

    it('should return current timestamp in ISO format', () => {
      const result = service.getHealth();
      const now = new Date();

      expect(result.timestamp).toBeDefined();
      const resultDate = new Date(result.timestamp);
      const difference = now.getTime() - resultDate.getTime();

      expect(difference).toBeGreaterThanOrEqual(0);
      expect(difference).toBeLessThan(100); // Should be within 100ms
    });

    it('should return process uptime in seconds', () => {
      const result = service.getHealth();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThan(0);
    });
  });
});
