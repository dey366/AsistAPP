import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { SupabaseService } from '../../supabase/supabase.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;
  let mockSupabaseService: any;

  beforeEach(async () => {
    mockSupabaseService = {
      getClient: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status ok when database is accessible', async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: [{ id: 'admin' }], error: null }),
      }),
    });

    mockSupabaseService.getClient.mockReturnValue({
      from: mockFrom,
    });

    const result = await controller.getHealth();

    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      database: 'connected',
    }));
    expect(mockFrom).toHaveBeenCalledWith('roles');
  });

  it('should throw ServiceUnavailableException when database select returns an error', async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      }),
    });

    mockSupabaseService.getClient.mockReturnValue({
      from: mockFrom,
    });

    await expect(controller.getHealth()).rejects.toThrow(ServiceUnavailableException);
  });

  it('should throw ServiceUnavailableException when database client throws an exception', async () => {
    mockSupabaseService.getClient.mockImplementation(() => {
      throw new Error('Connection refused');
    });

    await expect(controller.getHealth()).rejects.toThrow(ServiceUnavailableException);
  });
});
