import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/supabase/supabase.service';
import { SanitizePipe } from './../src/common/pipes/sanitize.pipe';
import { AttendanceStatus } from './../src/modules/attendance/dto/bulk-attendance.dto';

describe('Attendance (e2e)', () => {
  let app: INestApplication<App>;

  const mockGetUser = jest.fn();

  // Constants for valid UUIDs to satisfy class-validator
  const VALID_SCHEDULE_ID = '47d7c674-d4b9-4a0b-85cd-a5796245037d';
  const VALID_STUDENT_ID = 'fa85b509-f538-4e1b-b2b9-e160a2b0e671';
  const VALID_TEACHER_ID = 'da85b509-f538-4e1b-b2b9-e160a2b0e672';

  // Dynamic responses for E2E tests
  let userProfileResponse: any = { data: null, error: null };
  let scheduleResponse: any = { data: null, error: null };
  let previousRecordsResponse: any = { data: [], error: null };
  let existingRecordResponse: any = { data: null, error: null };
  let insertRecordResponse: any = { data: null, error: null };

  const mockSupabaseClient = {
    auth: {
      getUser: mockGetUser,
    },
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
        if (tableName === 'users') return userProfileResponse;
        if (tableName === 'schedules') return scheduleResponse;
        if (tableName === 'attendance_records') return insertRecordResponse;
        return { data: null, error: null };
      });

      queryBuilder.maybeSingle = jest.fn().mockImplementation(async () => {
        if (tableName === 'attendance_records') return existingRecordResponse;
        return { data: null, error: null };
      });

      queryBuilder.then = jest.fn().mockImplementation((onfulfilled) => {
        let response = { data: null as any, error: null as any };
        if (tableName === 'attendance_records') response = previousRecordsResponse;
        return Promise.resolve(response).then(onfulfilled);
      });

      return queryBuilder;
    }),
  };

  const mockSupabaseService = {
    getClient: () => mockSupabaseClient,
  };

  beforeEach(async () => {
    // Reset defaults before each test
    userProfileResponse = { data: null, error: null };
    scheduleResponse = { data: null, error: null };
    previousRecordsResponse = { data: [], error: null };
    existingRecordResponse = { data: null, error: null };
    insertRecordResponse = { data: null, error: null };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new SanitizePipe(),
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/attendance/bulk', () => {
    it('should return 401 Unauthorized if no authorization header is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/attendance/bulk')
        .send({
          scheduleId: VALID_SCHEDULE_ID,
          date: '2026-05-20',
          records: [],
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Token de autorización no provisto');
    });

    it('should return 401 Unauthorized if token format is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/attendance/bulk')
        .set('Authorization', 'InvalidToken')
        .send({
          scheduleId: VALID_SCHEDULE_ID,
          date: '2026-05-20',
          records: [],
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Formato de token de autorización inválido');
    });

    it('should return 403 Forbidden if user is a student', async () => {
      // 1. Mock authentication as a student
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: VALID_STUDENT_ID, email: 'student@mail.com' } },
        error: null,
      });

      // 2. Mock user profile retrieval to return student role
      userProfileResponse = {
        data: {
          id: VALID_STUDENT_ID,
          email: 'student@mail.com',
          role_id: 'estudiante',
          role: { id: 'estudiante', name: 'Estudiante' },
        },
        error: null,
      };

      const response = await request(app.getHttpServer())
        .post('/api/attendance/bulk')
        .set('Authorization', 'Bearer student-token')
        .send({
          scheduleId: VALID_SCHEDULE_ID,
          date: '2026-05-20',
          records: [{ studentId: VALID_STUDENT_ID, status: AttendanceStatus.PRESENTE }],
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Acceso denegado');
    });

    it('should return 201 Created and successfully process the bulk request when user is a teacher', async () => {
      // 1. Mock authentication as a teacher
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: VALID_TEACHER_ID, email: 'teacher@mail.com' } },
        error: null,
      });

      // 2. Mock user profile retrieval to return teacher role
      userProfileResponse = {
        data: {
          id: VALID_TEACHER_ID,
          email: 'teacher@mail.com',
          role_id: 'docente',
          role: { id: 'docente', name: 'Docente' },
        },
        error: null,
      };

      // 3. Mock schedule lookup inside AttendanceService
      scheduleResponse = {
        data: {
          start_time: '08:00:00',
          tolerance_minutes: 15,
        },
        error: null,
      };

      // 4. Mock select previous records (bulk) - returns empty array
      previousRecordsResponse = { data: [], error: null };

      // 5. Mock lookup inside the record processing loop
      existingRecordResponse = { data: null, error: null };

      // 6. Mock insert new record
      insertRecordResponse = {
        data: { id: 'record-abc-123' },
        error: null,
      };

      const response = await request(app.getHttpServer())
        .post('/api/attendance/bulk')
        .set('Authorization', 'Bearer teacher-token')
        .send({
          scheduleId: VALID_SCHEDULE_ID,
          date: '2026-05-20',
          records: [{ studentId: VALID_STUDENT_ID, status: AttendanceStatus.PRESENTE }],
        });

      expect(response.status).toBe(200);
      expect(response.body.processedRecordsCount).toBe(1);
      expect(response.body.records[0].status).toBe(AttendanceStatus.PRESENTE);
    });

    it('should automatically sanitize XSS input inside the payload body', async () => {
      // 1. Mock authentication as a teacher
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: VALID_TEACHER_ID, email: 'teacher@mail.com' } },
        error: null,
      });

      // 2. Mock user profile retrieval to return teacher role
      userProfileResponse = {
        data: {
          id: VALID_TEACHER_ID,
          email: 'teacher@mail.com',
          role_id: 'docente',
          role: { id: 'docente', name: 'Docente' },
        },
        error: null,
      };

      // 3. Mock schedule lookup inside AttendanceService
      scheduleResponse = {
        data: {
          start_time: '08:00:00',
          tolerance_minutes: 15,
        },
        error: null,
      };

      // 4. Mock select previous records (bulk)
      previousRecordsResponse = { data: [], error: null };

      // 5. Mock lookup inside the record processing loop
      existingRecordResponse = { data: null, error: null };

      // 6. Mock insert new record
      insertRecordResponse = {
        data: { id: 'record-abc-123' },
        error: null,
      };

      // Send payload containing XSS attempt in scheduleId
      // The SanitizePipe will strip "<script>alert("hack")</script>" completely, leaving a clean VALID_SCHEDULE_ID.
      // This will then successfully pass the IsUUID validation in BulkAttendanceDto!
      const response = await request(app.getHttpServer())
        .post('/api/attendance/bulk')
        .set('Authorization', 'Bearer teacher-token')
        .send({
          scheduleId: `<script>alert("hack")</script>${VALID_SCHEDULE_ID}`,
          date: '2026-05-20',
          records: [{ studentId: VALID_STUDENT_ID, status: AttendanceStatus.PRESENTE }],
        });

      // If sanitization works perfectly, it gets sanitized to VALID_SCHEDULE_ID, satisfies UUID, and returns 200
      expect(response.status).toBe(200);
      expect(response.body.processedRecordsCount).toBe(1);
    });
  });
});
