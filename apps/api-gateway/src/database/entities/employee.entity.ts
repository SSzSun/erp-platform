import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Department } from './department.entity';

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RESIGNED = 'resigned',
  TERMINATED = 'terminated',
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_code', length: 20, unique: true })
  employeeCode: string;

  @OneToOne(() => User, (user) => user.employee)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'first_name_th', length: 100 })
  firstNameTh: string;

  @Column({ name: 'last_name_th', length: 100 })
  lastNameTh: string;

  @Column({ name: 'first_name_en', length: 100 })
  firstNameEn: string;

  @Column({ name: 'last_name_en', length: 100 })
  lastNameEn: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @Column({ length: 100, nullable: true })
  position: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  salary: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.ACTIVE,
  })
  status: EmployeeStatus;

  @Column({ name: 'phone_number', length: 20, nullable: true })
  phoneNumber: string | null;

  @Column({ name: 'national_id', length: 13, nullable: true, select: false })
  nationalId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
