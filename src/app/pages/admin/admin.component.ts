import { Component, OnInit } from '@angular/core';
import { AdminService, TableInfo } from '../../services/admin.service';
import { PopupService } from '../../services/popup.service';
import { AuthService, User } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  tables: TableInfo[] = [];
  activeTable: TableInfo | null = null;
  tableData: any[] = [];
  isLoading = false;

  isSidebarCollapsed = false;
  selectedCellValue: { colName: string, value: string, isPrimary: boolean } | null = null;
  selectedRowItem: any = null;
  currentUser: User | null = null;

  constructor(
    private adminService: AdminService, 
    private popupService: PopupService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.loadTables();
  }

  loadTables() {
    this.isLoading = true;
    this.adminService.getTables().subscribe({
      next: (res) => {
        this.tables = res;
        this.isLoading = false;
        if (this.tables.length > 0) {
          this.selectTable(this.tables[0]);
        }
      },
      error: (err) => {
        this.popupService.showError('Không thể kết nối đến DB', 'Lỗi');
        this.isLoading = false;
      }
    });
  }

  selectTable(table: TableInfo) {
    this.activeTable = table;
    this.loadTableData();
  }

  loadTableData() {
    if (!this.activeTable) return;
    this.isLoading = true;
    this.adminService.getTableData(this.activeTable.name).subscribe({
      next: (res) => {
        this.tableData = this.sortData(res);
        this.isLoading = false;
      },
      error: (err) => {
        this.popupService.showError(`Lỗi khi lấy dữ liệu bảng ${this.activeTable?.name}`, 'Lỗi');
        this.isLoading = false;
      }
    });
  }

  sortData(data: any[]): any[] {
    if (!data || data.length === 0) return data;
    
    // Check for common date fields
    const dateFields = ['createdAt', 'created_at', 'create_time', 'createdDate'];
    const hasDate = dateFields.find(f => data[0] && data[0][f] !== undefined);
    
    if (hasDate) {
      return data.sort((a, b) => new Date(b[hasDate]).getTime() - new Date(a[hasDate]).getTime());
    }
    
    // If no date field, sort by primary key descending (usually ID)
    const primaryCol = this.activeTable?.columns.find(c => c.isPrimary);
    if (primaryCol) {
      const pk = primaryCol.name;
      if (data[0] && typeof data[0][pk] === 'number') {
        return data.sort((a, b) => b[pk] - a[pk]);
      }
    }
    
    return data;
  }

  confirmConfig: { action: 'save' | 'delete', message: string, data?: any } | null = null;

  saveCellValue() {
    if (!this.selectedCellValue || !this.selectedRowItem || !this.activeTable) return;
    this.confirmConfig = {
      action: 'save',
      message: `Bạn có chắc chắn muốn lưu thay đổi cho trường "${this.selectedCellValue.colName}" không?`
    };
  }

  deleteRow(item: any) {
    if (!this.activeTable) return;
    this.confirmConfig = {
      action: 'delete',
      message: 'Cảnh báo: Hành động này không thể hoàn tác. Bạn có chắc muốn xóa?',
      data: item
    };
  }

  cancelConfirm() {
    this.confirmConfig = null;
  }

  processConfirm() {
    if (!this.confirmConfig || !this.activeTable) return;
    
    if (this.confirmConfig.action === 'delete') {
      const item = this.confirmConfig.data;
      const primaryCol = this.activeTable.columns.find(c => c.isPrimary);
      if (!primaryCol) {
        this.confirmConfig = null;
        return;
      }
      
      const id = item[primaryCol.name];
      this.adminService.deleteData(this.activeTable.name, id).subscribe({
        next: () => {
          this.popupService.showSuccess('Đã xóa', 'Thành công');
          this.loadTableData();
          this.confirmConfig = null;
        },
        error: (err) => {
          this.popupService.showError('Không thể xóa dữ liệu', 'Lỗi');
          this.confirmConfig = null;
        }
      });
    } else if (this.confirmConfig.action === 'save') {
      if (!this.selectedCellValue || !this.selectedRowItem) return;
      
      // Cập nhật giá trị vào object dòng hiện tại
      this.selectedRowItem[this.selectedCellValue.colName] = this.selectedCellValue.value;
      
      const primaryCol = this.activeTable.columns.find(c => c.isPrimary);
      if (!primaryCol) {
        this.popupService.showError('Bảng không có khóa chính', 'Lỗi');
        this.confirmConfig = null;
        return;
      }
      
      const id = this.selectedRowItem[primaryCol.name];
      
      // Gọi API cập nhật
      this.adminService.updateData(this.activeTable.name, id, this.selectedRowItem).subscribe({
        next: () => {
          this.popupService.showSuccess('Lưu thành công', 'Cập nhật DB');
          this.closeCellValue();
          this.confirmConfig = null;
        },
        error: (err) => {
          this.popupService.showError('Lỗi cập nhật', 'Lỗi');
          this.confirmConfig = null;
        }
      });
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  isNewToday(item: any): boolean {
    const dateFields = ['createdAt', 'created_at', 'create_time', 'createdDate'];
    for (const field of dateFields) {
      if (item[field]) {
        const itemDate = new Date(item[field]);
        const today = new Date();
        if (itemDate.getDate() === today.getDate() &&
            itemDate.getMonth() === today.getMonth() &&
            itemDate.getFullYear() === today.getFullYear()) {
          return true;
        }
      }
    }
    return false;
  }

  isUserOnline(lastActiveAt: any): boolean {
    if (!lastActiveAt) return false;
    const lastActive = new Date(lastActiveAt).getTime();
    const now = Date.now();
    // Coi là online nếu có activity trong 5 phút gần đây (300000 ms)
    return (now - lastActive) < 300000;
  }

  formatDisplayValue(value: any): string {
    if (value === null || value === undefined) return '';
    
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      }
    }
    return String(value);
  }

  isCopied = false;

  openCellValue(colName: string, item: any, isPrimary: boolean) {
    this.selectedRowItem = item;
    this.selectedCellValue = { colName, value: item[colName] != null ? String(item[colName]) : '', isPrimary };
    this.isCopied = false;
  }

  closeCellValue() {
    this.selectedCellValue = null;
    this.selectedRowItem = null;
    this.isCopied = false;
  }

  onCopySuccess() {
    this.isCopied = true;
    setTimeout(() => {
      this.isCopied = false;
    }, 2000);
  }

  copyToClipboard(text: string) {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.onCopySuccess();
      }).catch(err => {
        this.popupService.showError('Không thể copy', 'Lỗi');
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        this.onCopySuccess();
      } catch (err) {
        this.popupService.showError('Không thể copy', 'Lỗi');
      }
      document.body.removeChild(textArea);
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
