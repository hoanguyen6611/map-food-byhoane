import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AdminUserListItemDto, ApiErrorResponse, AuthResponse, Paginated } from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Covers the Admin User Management gap-fix described in
// admin-user.service.ts's doc comment (PRD §10.11 + the Security
// Checklist's "moderator blocked from admin-only actions (user ban, role
// change)" item, both never implemented by an earlier module).
describe('Admin User Management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const authBody = (res: request.Response) => res.body as AuthResponse;
  const errorBody = (res: request.Response) => res.body as ApiErrorResponse;

  async function registerAs(role: 'admin' | 'moderator' | 'user'): Promise<{ token: string; userId: string; email: string }> {
    const email = uniqueEmail(role);
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const userId = authBody(reg).user.id;

    if (role !== 'user') {
      const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.user.update({ where: { id: userId }, data: { roleId: roleRow.id } });
    }

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { token: authBody(login).accessToken, userId, email };
  }

  it('rejects a plain user from every admin/users route', async () => {
    const plain = await registerAs('user');
    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${plain.token}`)
      .expect(403);
  });

  it('lets both admin and moderator list users, filterable by search', async () => {
    const admin = await registerAs('admin');
    const moderator = await registerAs('moderator');
    const target = await registerAs('user');

    for (const actor of [admin, moderator]) {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .query({ search: target.email })
        .set('Authorization', `Bearer ${actor.token}`)
        .expect(200);
      const body = res.body as Paginated<AdminUserListItemDto>;
      expect(body.items.some((u) => u.id === target.userId)).toBe(true);
    }
  });

  it('blocks moderator from suspend/reactivate/role-change (403), admin succeeds, AuditLog written', async () => {
    const admin = await registerAs('admin');
    const moderator = await registerAs('moderator');
    const target = await registerAs('user');

    const blockedSuspend = await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/suspend`)
      .set('Authorization', `Bearer ${moderator.token}`)
      .expect(403);
    expect(errorBody(blockedSuspend).message).toContain('không có quyền');

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/role`)
      .set('Authorization', `Bearer ${moderator.token}`)
      .send({ roleCode: 'admin' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/suspend`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);

    const suspended = await prisma.user.findUniqueOrThrow({ where: { id: target.userId } });
    expect(suspended.status).toBe('suspended');

    // Suspended accounts must be blocked from logging in immediately.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: target.email, password: 'password123' })
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/reactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    const reactivated = await prisma.user.findUniqueOrThrow({ where: { id: target.userId } });
    expect(reactivated.status).toBe('active');

    const auditActions = await prisma.auditLog.findMany({
      where: { targetType: 'user', targetId: target.userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(auditActions.map((a) => a.action)).toEqual(['user.suspend', 'user.reactivate']);
    expect(auditActions.every((a) => a.actorId === admin.userId)).toBe(true);
  });

  it('changes a role as admin, and blocks an admin from changing their own role', async () => {
    const admin = await registerAs('admin');
    const target = await registerAs('user');

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ roleCode: 'moderator' })
      .expect(204);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: target.userId }, include: { role: true } });
    expect(updated.role.code).toBe('moderator');

    const selfChange = await request(app.getHttpServer())
      .patch(`/admin/users/${admin.userId}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ roleCode: 'user' })
      .expect(400);
    expect(errorBody(selfChange).message).toContain('tự thay đổi');
  });

  it('404s suspending/role-changing a nonexistent user', async () => {
    const admin = await registerAs('admin');
    await request(app.getHttpServer())
      .patch('/admin/users/00000000-0000-0000-0000-000000000000/suspend')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch('/admin/users/00000000-0000-0000-0000-000000000000/role')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ roleCode: 'moderator' })
      .expect(404);
  });
});
