import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { AttendanceStatus } from './dto/bulk-attendance.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let auditService: jest.Mocked<AuditService>;

  // Variables for dynamic query resolution
  let scheduleResponse: any = { data: null, error: null };
  let studentsResponse: any = { data: [], error: null };
  let attendanceRecordsResponse: any = { data: [], error: null };
  let tardinessResponse: any = { data: null, error: null };
  let insertRecordResponse: any = { data: null, error: null };

  const mockSupabaseClient = {
    from: jest.fn().mockImplementation((tableName) => {
      const queryBuilder: any = {};
      
      queryBuilder.select = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.insert = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.update = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.delete = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.eq = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.in = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.order = jest.fn().mockReturnValue(queryBuilder);
      
      queryBuilder.single = jest.fn().mockImplementation(async () => {
        if (tableName === 'schedules') return scheduleResponse;
        if (tableName === 'attendance_records') return insertRecordResponse;
        return { data: null, error: null };
      });
      
      queryBuilder.maybeSingle = jest.fn().mockImplementation(async () => {
        if (tableName === 'tardiness') return tardinessResponse;
        if (tableName === 'attendance_records') return tardinessResponse;
        return { data: null, error: null };
      });

      queryBuilder.then = jest.fn().mockImplementation((onfulfilled) => {
        let response = { data: null, error: null };
        if (tableName === 'users') response = studentsResponse;
        if (tableName === 'attendance_records') response = attendanceRecordsResponse;
        return Promise.resolve(response).then(onfulfilled);
      });

      return queryBuilder;
    }),
  };

  beforeEach(async () => {
    // Reset defaults before each test
    scheduleResponse = { data: null, error: null };
    studentsResponse = { data: [], error: null };
    attendanceRecordsResponse = { data: [], error: null };
    tardinessResponse = { data: null, error: null };
    insertRecordResponse = { data: null, error: null };

    const mockSupabaseServiceProvider = {
      provide: SupabaseService,
      useValue: {
        getClient: jest.fn().mockReturnValue(mockSupabaseClient),
      },
    };

    const mockNotificationsServiceProvider = {
      provide: NotificationsService,
      useValue: {
        triggerCriticalAttendanceAlert: jest.fn().mockResolvedValue(true),
      },
    };

    const mockAuditServiceProvider = {
      provide: AuditService,
      useValue: {
        writeLog: jest.fn().mockResolvedValue(true),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        mockSupabaseServiceProvider,
        mockNotificationsServiceProvider,
        mockAuditServiceProvider,
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    supabaseService = module.get(SupabaseService) as any;
    notificationsService = module.get(NotificationsService) as any;
    auditService = module.get(AuditService) as any;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStudentsForSchedule', () => {
    it('should throw NotFoundException if schedule does not exist', async () => {
      scheduleResponse = { data: null, error: { message: 'Not found' } };

      await expect(
        service.getStudentsForSchedule('schedule-id-123', '2026-05-20'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if subject does not exist on schedule', async () => {
      scheduleResponse = { data: { id: 'sch-123' }, error: null };

      await expect(
        service.getStudentsForSchedule('schedule-id-123', '2026-05-20'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should correctly cross-reference students and existing attendance records', async () => {
      scheduleResponse = {
        data: {
          id: 'sch-123',
          day_of_week: 1,
          start_time: '08:00:00',
          end_time: '10:00:00',
          tolerance_minutes: 15,
          classroom: { name: 'Aula 101' },
          subject: {
            id: 'sub-456',
            name: 'Matemáticas',
            code: 'MAT101',
            career_id: 'career-789',
          },
        },
        error: null,
      };

      studentsResponse = {
        data: [
          { id: 'stud-1', first_name: 'Juan', last_name: 'Pérez', email: 'juan@mail.com', career_id: 'career-789' },
          { id: 'stud-2', first_name: 'Maria', last_name: 'Gómez', email: 'maria@mail.com', career_id: 'career-789' },
        ],
        error: null,
      };

      attendanceRecordsResponse = {
        data: [
          {
            id: 'rec-1',
            schedule_id: 'sch-123',
            student_id: 'stud-1',
            date: '2026-05-20',
            status: 'presente',
            registered_by: 'teacher-123',
            registered_at: '2026-05-20T08:05:00Z',
            tardiness: null,
            justifications: null,
          },
        ],
        error: null,
      };

      const result = await service.getStudentsForSchedule('sch-123', '2026-05-20');

      expect(result).toBeDefined();
      expect(result.students).toHaveLength(2);
      expect(result.students[0].attendance).not.toBeNull();
      expect(result.students[0].attendance?.status).toBe('presente');
      expect(result.students[1].attendance).toBeNull();
    });
  });

  describe('registerBulkAttendance', () => {
    it('should throw NotFoundException if schedule does not exist', async () => {
      scheduleResponse = { data: null, error: { message: 'Schedule not found' } };

      await expect(
        service.registerBulkAttendance(
          { scheduleId: 'sch-invalid', date: '2026-05-20', records: [] },
          'teacher-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should process Presente correctly (inserts new record, writes audit)', async () => {
      scheduleResponse = {
        data: {
          start_time: '08:00:00',
          tolerance_minutes: 15,
        },
        error: null,
      };

      // Search existing record returns null (maybeSingle)
      tardinessResponse = { data: null, error: null };
      // Insert new record returns id (single)
      insertRecordResponse = { data: { id: 'new-rec-id' }, error: null };

      const dto = {
        scheduleId: 'sch-123',
        date: '2026-05-20',
        records: [{ studentId: 'stud-1', status: AttendanceStatus.PRESENTE }],
      };

      const result = await service.registerBulkAttendance(dto, 'teacher-123');

      expect(result).toBeDefined();
      expect(result.processedRecordsCount).toBe(1);
      expect(result.records[0].status).toBe(AttendanceStatus.PRESENTE);
      expect(auditService.writeLog).toHaveBeenCalled();
    });

    it('should convert TARDE to AUSENTE if delay exceeds tolerance', async () => {
      scheduleResponse = {
        data: {
          start_time: '08:00:00',
          tolerance_minutes: 15,
        },
        error: null,
      };

      tardinessResponse = { data: null, error: null };
      insertRecordResponse = { data: { id: 'new-rec-id' }, error: null };

      const dto = {
        scheduleId: 'sch-123',
        date: '2026-05-20',
        records: [{ studentId: 'stud-1', status: AttendanceStatus.TARDE, delayMinutes: 20 }], // 20 > 15
      };

      const result = await service.registerBulkAttendance(dto, 'teacher-123');

      expect(result.records[0].status).toBe(AttendanceStatus.AUSENTE);
      expect(result.records[0].delayMinutes).toBeNull();
    });

    it('should keep TARDE if delay is within tolerance', async () => {
      scheduleResponse = {
        data: {
          start_time: '08:00:00',
          tolerance_minutes: 15,
        },
        error: null,
      };

      tardinessResponse = { data: null, error: null };
      insertRecordResponse = { data: { id: 'new-rec-id' }, error: null };

      const dto = {
        scheduleId: 'sch-123',
        date: '2026-05-20',
        records: [{ studentId: 'stud-1', status: AttendanceStatus.TARDE, delayMinutes: 10 }], // 10 <= 15
      };

      const result = await service.registerBulkAttendance(dto, 'teacher-123');

      expect(result.records[0].status).toBe(AttendanceStatus.TARDE);
      expect(result.records[0].delayMinutes).toBe(10);
    });
  });

  describe('checkAndTriggerAlerts', () => {
    it('should trigger alert if attendance rate is below 80%', async () => {
      scheduleResponse = {
        data: {
          subject_id: 'sub-123',
          start_time: '08:00:00',
          tolerance_minutes: 15,
        },
        error: null,
      };

      // Mock list of schedules for this subject
      const schedulesList = [{ id: 'sch-123' }, { id: 'sch-456' }];
      // Mock historical attendance records
      const historicalRecords = [
        { status: 'ausente' },
        { status: 'ausente' },
        { status: 'presente' },
        { status: 'presente' },
      ];

      // Custom mock for the specific checkAndTriggerAlerts queries
      mockSupabaseClient.from = jest.fn().mockImplementation((tableName) => {
        const queryBuilder: any = {};
        queryBuilder.select = jest.fn().mockReturnValue(queryBuilder);
        queryBuilder.insert = jest.fn().mockReturnValue(queryBuilder);
        queryBuilder.update = jest.fn().mockReturnValue(queryBuilder);
        queryBuilder.delete = jest.fn().mockReturnValue(queryBuilder);
        queryBuilder.eq = jest.fn().mockReturnValue(queryBuilder);
        queryBuilder.in = jest.fn().mockReturnValue(queryBuilder);
        queryBuilder.order = jest.fn().mockReturnValue(queryBuilder);
        
        queryBuilder.single = jest.fn().mockImplementation(async () => {
          if (tableName === 'schedules') return scheduleResponse;
          if (tableName === 'attendance_records') return { data: { id: 'new-rec-id' }, error: null };
          return { data: null, error: null };
        });
        
        queryBuilder.maybeSingle = jest.fn().mockImplementation(async () => {
          return { data: null, error: null };
        });

        queryBuilder.then = jest.fn().mockImplementation((onfulfilled) => {
          let response = { data: null as any, error: null as any };
          if (tableName === 'schedules') response = { data: schedulesList, error: null };
          if (tableName === 'attendance_records') response = { data: historicalRecords, error: null };
          return Promise.resolve(response).then(onfulfilled);
        });

        return queryBuilder;
      });

      const dto = {
        scheduleId: 'sch-123',
        date: '2026-05-20',
        records: [{ studentId: 'stud-1', status: AttendanceStatus.AUSENTE }],
      };

      await service.registerBulkAttendance(dto, 'teacher-123');

      // We wait for the asynchronous checkAndTriggerAlerts to resolve
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(notificationsService.triggerCriticalAttendanceAlert).toHaveBeenCalledWith(
        'stud-1',
        'sub-123',
        50,
      );
    });
  });
});
