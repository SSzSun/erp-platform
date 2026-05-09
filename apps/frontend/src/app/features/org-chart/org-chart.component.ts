import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { environment } from '../../../environments/environment';

interface DeptNode {
  id: string; name: string; code: string;
  parentId: string | null; managerId: string | null;
  isActive: boolean; children: DeptNode[]; headCount?: number;
}

@Component({
  selector: 'app-org-chart',
  standalone: true,
  imports: [DragDropModule, NgTemplateOutlet, FormsModule],
  template: `
    <div class="flex items-start justify-between mb-5">
      <div>
        <h2 class="text-xl font-bold text-gray-800">ผังองค์กร</h2>
        <p class="text-sm text-gray-400 mt-0.5">ลากเพื่อย้ายแผนก</p>
      </div>
      <button (click)="showAddModal.set(true)"
        class="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700
               text-white text-sm font-semibold rounded-lg transition">
        + เพิ่มแผนก
      </button>
    </div>

    @if (loading()) {
      <div class="flex items-center justify-center py-20">
        <div class="w-10 h-10 border-[3px] border-gray-200 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    } @else {
      <div class="overflow-x-auto pb-6">
        <div class="flex gap-6 min-w-max pt-2">
          @for (root of roots(); track root.id) {
            <ng-container [ngTemplateOutlet]="nodeTree" [ngTemplateOutletContext]="{ $implicit: root, depth: 0 }"/>
          }
        </div>
      </div>
    }

    <!-- Recursive node template -->
    <ng-template #nodeTree let-node let-depth="depth">
      <div class="flex flex-col items-center">
        <!-- Card -->
        <div cdkDrag
          class="relative group bg-white border-2 rounded-xl shadow-sm px-4 py-3 w-44 cursor-grab
                 active:cursor-grabbing hover:shadow-md hover:border-primary-300 transition"
          [class]="depth === 0 ? 'border-primary-400 bg-primary-50/30' : 'border-gray-200'">
          <div cdkDragHandle class="absolute top-1.5 right-1.5 text-gray-300 group-hover:text-gray-400 text-xs">⠿</div>
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-base mb-2"
               [class]="depth === 0 ? 'bg-primary-100' : 'bg-gray-100'">🏢</div>
          <p class="font-semibold text-gray-800 text-sm leading-tight truncate">{{ node.name }}</p>
          <p class="text-xs text-gray-400 mt-0.5">{{ node.code }}</p>
          @if (node.headCount) {
            <p class="text-xs text-primary-600 font-medium mt-1.5">👤 {{ node.headCount }} คน</p>
          }
          <button (click)="deleteNode(node)"
            class="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full
                   hidden group-hover:flex items-center justify-center shadow">×</button>
        </div>

        <!-- Children branch -->
        @if (node.children?.length) {
          <div class="w-px h-5 bg-gray-200"></div>
          <!-- Horizontal bar -->
          <div class="relative flex gap-4 items-start">
            @if (node.children.length > 1) {
              <div class="absolute top-0 left-0 right-0 h-px bg-gray-200"></div>
            }
            @for (child of node.children; track child.id) {
              <div class="flex flex-col items-center">
                <div class="w-px h-5 bg-gray-200"></div>
                <ng-container [ngTemplateOutlet]="nodeTree" [ngTemplateOutletContext]="{ $implicit: child, depth: depth+1 }"/>
              </div>
            }
          </div>
        }
      </div>
    </ng-template>

    <!-- Add modal -->
    @if (showAddModal()) {
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" (click.self)="showAddModal.set(false)">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
          <h3 class="font-bold text-gray-800 text-lg">เพิ่มแผนกใหม่</h3>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-600">ชื่อแผนก</label>
            <input [(ngModel)]="newName" placeholder="เช่น ฝ่ายบัญชี"
              class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-400"/>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-600">รหัสแผนก</label>
            <input [(ngModel)]="newCode" placeholder="เช่น ACC"
              class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-400"/>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-600">แผนกต้นสังกัด</label>
            <select [(ngModel)]="newParentId"
              class="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-400">
              <option value="">— ไม่มี (top-level) —</option>
              @for (d of flatDepts(); track d.id) {
                <option [value]="d.id">{{ d.name }}</option>
              }
            </select>
          </div>
          <div class="flex gap-2 mt-1">
            <button (click)="showAddModal.set(false)"
              class="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
            <button (click)="addDept()"
              class="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold">บันทึก</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class OrgChartComponent implements OnInit {
  private readonly http = inject(HttpClient);

  depts        = signal<DeptNode[]>([]);
  loading      = signal(true);
  showAddModal = signal(false);
  newName = ''; newCode = ''; newParentId = '';

  roots     = computed(() => this.depts().filter(d => !d.parentId));
  flatDepts = computed(() => { const f: DeptNode[] = []; const t = (ns: DeptNode[]) => ns.forEach(n => { f.push(n); t(n.children); }); t(this.depts()); return f; });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<DeptNode[]>(`${environment.apiUrl}/departments/tree`).subscribe({
      next: tree => { this.depts.set(tree); this.loading.set(false); },
      error: ()  => { this.depts.set(this.mockData()); this.loading.set(false); },
    });
  }

  onDrop(_event: CdkDragDrop<DeptNode[]>) {}

  addDept() {
    if (!this.newName || !this.newCode) return;
    this.http.post<DeptNode>(`${environment.apiUrl}/departments`, {
      name: this.newName, code: this.newCode, parentId: this.newParentId || null,
    }).subscribe({ next: () => { this.load(); this.showAddModal.set(false); this.newName=''; this.newCode=''; this.newParentId=''; }, error:()=>{} });
  }

  deleteNode(node: DeptNode) {
    if (!confirm(`ลบแผนก "${node.name}"?`)) return;
    this.http.delete(`${environment.apiUrl}/departments/${node.id}`)
      .subscribe({ next: () => this.load(), error:()=>{} });
  }

  private mockData(): DeptNode[] {
    return [{ id:'1', name:'บริษัท ERP จำกัด', code:'HEAD', parentId:null, managerId:null, isActive:true, headCount:120, children:[
      { id:'2', name:'ฝ่ายบุคคล', code:'HR', parentId:'1', managerId:null, isActive:true, headCount:12, children:[
        { id:'5', name:'งานสรรหา', code:'HR-REC', parentId:'2', managerId:null, isActive:true, headCount:4, children:[] },
        { id:'6', name:'งานฝึกอบรม', code:'HR-TRN', parentId:'2', managerId:null, isActive:true, headCount:3, children:[] },
      ]},
      { id:'3', name:'ฝ่ายบัญชี', code:'FIN', parentId:'1', managerId:null, isActive:true, headCount:15, children:[
        { id:'7', name:'บัญชีรับ-จ่าย', code:'FIN-AP', parentId:'3', managerId:null, isActive:true, headCount:6, children:[] },
      ]},
      { id:'4', name:'ฝ่าย IT', code:'IT', parentId:'1', managerId:null, isActive:true, headCount:20, children:[] },
    ]}];
  }
}
