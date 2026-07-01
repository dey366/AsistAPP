import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ForbiddenException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/supabase/supabase.service';
import { SanitizePipe } from './../src/common/pipes/sanitize.pipe';

describe('Security Audit & RBAC Controls (e2e)', () => {
  let app: INestApplication<App>;

  const mockGetUser = jest.fn();

  // Test entities matching UUID v4 requirements
  const STUDENT_ID_A = 'a888b509-f538-4e1b-b2b9-e160a2b0e671';
  const STUDENT_ID_B = 'b888b509-f538-4e1b-b2b9-e160a2b0e672';
  const ADMIN_ID = 'da85b509-f538-4e1b-b2b9-e160a2b0e670';

  let userProfileResponse: any = { data: null, error: null };
  let reportsResponse: any = { data: null, error: null };

  const mockSupabaseClient = {
    auth: {
      getUser: mockGetUser,
      admin: {
        createUser: jest.fn().mockImplementation(async (userData) => {
          return {
            data: {
              user: {
                id: 'new-user-uuid',
                email: userData.email,
                user_metadata: userData.user_metadata,
              }
            },
            error: null
          };
        })
      }
    },
    from: jest.fn().mockImplementation((tableName) => {
      const queryBuilder: any = {};
      queryBuilder.select = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.insert = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.eq = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.single = jest.fn().mockImplementation(async () => {
        if (tableName === 'users') return userProfileResponse;
        if (tableName === 'subjects') return { data: { id: 'subj-123', name: 'Security 101' }, error: null };
        return { data: null, error: null };
      });
      queryBuilder.then = jest.fn().mockImplementation((onfulfilled) => {
        let response = { data: null as any, error: null as any };
        if (tableName === 'attendance_records') response = reportsResponse;
        return Promise.resolve(response).then(onfulfilled);
      });
      return queryBuilder;
    }),
  };

  const mockSupabaseService = {
    getClient: () => mockSupabaseClient,
  };

  beforeEach(async () => {
    userProfileResponse = { data: null, error: null };
    reportsResponse = { data: [], error: null };

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
      }),
    );
    await app.init();

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Privilege Escalation Barriers (RBAC)', () => {
    it('should reject access to admin endpoints when role is estudiante (403)', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: STUDENT_ID_A, email: 'studentA@asistapp.com' } },
        error: null,
      });

      userProfileResponse = {
        data: {
          id: STUDENT_ID_A,
          email: 'studentA@asistapp.com',
          role_id: 'estudiante',
        },
        error: null,
      };

      const response = await request(app.getHttpServer())
        .get('/api/auth/admin-only')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Acceso denegado');
    });

    it('should grant access to admin endpoints when role is admin (200)', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: ADMIN_ID, email: 'admin@asistapp.com' } },
        error: null,
      });

      userProfileResponse = {
        data: {
          id: ADMIN_ID,
          email: 'admin@asistapp.com',
          role_id: 'admin',
        },
        error: null,
      };

      const response = await request(app.getHttpServer())
        .get('/api/auth/admin-only')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });
  });

  describe('JWT Validation & Manipulation Safeguards', () => {
    it('should block manipulated / empty tokens immediately with 401', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token signature' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer manipulated.signature.token');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Token de sesión inválido o expirado');
    });
  });

  describe('SQL Injection & Input Sanitization', () => {
    it('should strip potential script / SQL injection tags in parameters and inputs via SanitizePipe', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: ADMIN_ID, email: 'admin@asistapp.com' } },
        error: null,
      });

      userProfileResponse = {
        data: {
          id: ADMIN_ID,
          email: 'admin@asistapp.com',
          role_id: 'admin',
        },
        error: null,
      };

      // Payload representing a potential HTML/XSS injection on user creation fields
      const maliciousUserPayload = {
        email: 'attacker@asistapp.com',
        first_name: '<script>alert("xss")</script>Alejandro',
        last_name: '<img src=x onerror=alert(1)>Silva',
        role_id: 'estudiante',
      };

      // Since we mocked Supabase createUser internally, we verify that the pipeline executes
      // The validation should compile properly and sanitize inputs before reaching the controller
      const response = await request(app.getHttpServer())
        .post('/api/auth/users')
        .set('Authorization', 'Bearer admin-token')
        .send(maliciousUserPayload);

      // The validation pipe or sanitization pipe runs. If sanitization is perfect:
      // It processes it successfully or filters out scripts.
      // (Mocked Supabase createUser would fail if it's not a real cloud env, but we are testing that the request isn't executing raw script)
      expect(response.status).toBe(201);
      expect(response.body.user.first_name).toBe('Alejandro');
      expect(response.body.user.last_name).toBe('Silva');
    });
  });
});
