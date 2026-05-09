import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { Department, Employee, EmployeeStatus, RefreshToken, Role, RoleName, User } from '../entities';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Department, Role, User, Employee, RefreshToken],
  synchronize: false,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('Connected to database');

  // ── 1. Roles ────────────────────────────────────────
  const roleData: { name: RoleName; description: string; permissions: string[] }[] = [
    {
      name: RoleName.ADMIN,
      description: 'ผู้ดูแลระบบ มีสิทธิ์ทุกอย่าง',
      permissions: ['*'],
    },
    {
      name: RoleName.HR,
      description: 'ฝ่ายทรัพยากรบุคคล',
      permissions: [
        'employee:read', 'employee:write',
        'leave:read', 'leave:approve',
        'payroll:read',
        'attendance:read',
      ],
    },
    {
      name: RoleName.MANAGER,
      description: 'ผู้จัดการ',
      permissions: [
        'employee:read',
        'leave:read', 'leave:approve',
        'attendance:read',
        'payroll:read',
      ],
    },
    {
      name: RoleName.FINANCE,
      description: 'ฝ่ายการเงิน',
      permissions: [
        'payroll:read', 'payroll:write',
        'expense:read', 'expense:approve',
      ],
    },
    {
      name: RoleName.EMPLOYEE,
      description: 'พนักงานทั่วไป',
      permissions: [
        'leave:read', 'leave:write',
        'attendance:read',
        'payroll:read:own',
        'expense:write',
      ],
    },
  ];

  const roleRepo = AppDataSource.getRepository(Role);
  const roles: Record<RoleName, Role> = {} as Record<RoleName, Role>;

  for (const data of roleData) {
    let role = await roleRepo.findOne({ where: { name: data.name } });
    if (!role) {
      role = await roleRepo.save(roleRepo.create(data));
      console.log(`  Created role: ${data.name}`);
    } else {
      await roleRepo.update(role.id, { permissions: data.permissions });
      console.log(`  Updated role: ${data.name}`);
    }
    roles[data.name] = role;
  }

  // ── 2. Admin user ────────────────────────────────────
  const userRepo = AppDataSource.getRepository(User);
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@erp.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@1234';

  let adminUser = await userRepo.findOne({ where: { email: adminEmail } });
  if (!adminUser) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    adminUser = await userRepo.save(
      userRepo.create({
        email: adminEmail,
        passwordHash,
        role: roles[RoleName.ADMIN],
        isActive: true,
      }),
    );
    console.log(`  Created admin user: ${adminEmail}`);
  } else {
    console.log(`  Admin user already exists: ${adminEmail}`);
  }

  // ── 3. Admin Employee record ─────────────────────────
  const employeeRepo = AppDataSource.getRepository(Employee);
  const deptRepo = AppDataSource.getRepository(Department);

  let itDept = await deptRepo.findOne({ where: { code: 'IT' } });
  if (!itDept) {
    itDept = await deptRepo.save(
      deptRepo.create({ name: 'Information Technology', code: 'IT' }),
    );
    console.log('  Created IT department');
  }

  const existingEmployee = await employeeRepo.findOne({ where: { user: { id: adminUser.id } } });
  if (!existingEmployee) {
    await employeeRepo.save(
      employeeRepo.create({
        employeeCode: 'EMP0001',
        user: adminUser,
        firstNameTh: 'ผู้ดูแล',
        lastNameTh: 'ระบบ',
        firstNameEn: 'System',
        lastNameEn: 'Admin',
        department: itDept,
        position: 'System Administrator',
        salary: 0,
        startDate: new Date(),
        status: EmployeeStatus.ACTIVE,
      }),
    );
    console.log('  Created admin employee record');
  }

  await AppDataSource.destroy();
  console.log('\nSeed completed successfully');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
