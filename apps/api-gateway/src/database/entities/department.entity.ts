import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, unique: true })
  code: string;

  @ManyToOne(() => Department, (dept) => dept.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Department | null;

  @OneToMany(() => Department, (dept) => dept.parent)
  children: Department[];

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
