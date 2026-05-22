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

  currentPage = 1;
  pageSize = 20;
  totalItems = 0;
  searchQuery = '';
  activeFilters: any = {};
  showFilterPanel = false;
  pageSizeOptions = [10, 20, 50, 100];

  dashboardStats: any = null;
  isSidebarCollapsed = false;
  selectedCellValue: { colName: string, value: string, isPrimary: boolean } | null = null;
  selectedRowItem: any = null;
  currentUser: User | null = null;

  isAddModalOpen = false;
  newRecord: any = {};
  selectedItemIds: Set<any> = new Set();
  foreignData: { [colName: string]: any[] } = {};

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
        this.showDashboard();
      },
      error: (err) => {
        this.popupService.showError('Không thể kết nối đến DB', 'Lỗi');
        this.isLoading = false;
      }
    });
  }

  showDashboard() {
    this.activeTable = null;
    this.isLoading = true;
    this.adminService.getDashboardStats().subscribe({
      next: (res) => {
        this.dashboardStats = res;
        this.isLoading = false;
      },
      error: (err) => {
        this.popupService.showError('Không thể lấy thống kê', 'Lỗi');
        this.isLoading = false;
      }
    });
  }

  getDashboardKeys(): string[] {
    return this.dashboardStats ? Object.keys(this.dashboardStats) : [];
  }

  selectTable(table: TableInfo) {
    this.activeTable = table;
    this.currentPage = 1;
    this.searchQuery = '';
    this.activeFilters = {};
    this.showFilterPanel = false;
    this.foreignData = {};
    this.loadTableData();
    this.loadForeignData();
  }

  loadTableData() {
    if (!this.activeTable) return;
    this.isLoading = true;
    this.selectedItemIds.clear();
    this.adminService.getTableData(this.activeTable.name, this.currentPage, this.pageSize, this.searchQuery, this.activeFilters).subscribe({
      next: (res) => {
        this.tableData = res.data;
        this.totalItems = res.total;
        this.isLoading = false;
      },
      error: (err) => {
        this.popupService.showError(`Lỗi khi lấy dữ liệu bảng ${this.activeTable?.name}`, 'Lỗi');
        this.isLoading = false;
      }
    });
  }

  loadForeignData() {
    if (!this.activeTable || !this.activeTable.relations) return;
    this.activeTable.relations.forEach(rel => {
       rel.joinColumns.forEach(colName => {
         this.adminService.getTableData(rel.targetTable, 1, 500).subscribe({
           next: (res) => {
             this.foreignData[colName] = res.data;
           }
         });
       });
    });
  }

  onSearch() {
    this.currentPage = 1;
    this.loadTableData();
  }

  toggleFilterPanel() {
    this.showFilterPanel = !this.showFilterPanel;
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadTableData();
  }

  clearFilters() {
    this.activeFilters = {};
    this.currentPage = 1;
    this.loadTableData();
  }

  onPageChange(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadTableData();
  }

  onPageSizeChange(event: any) {
    this.pageSize = parseInt(event.target.value, 10);
    this.currentPage = 1;
    this.loadTableData();
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize) || 1;
  }

  get pagesArray(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  confirmConfig: { action: 'save' | 'delete' | 'bulkDelete', message: string, data?: any } | null = null;

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
    } else if (this.confirmConfig.action === 'bulkDelete') {
      const ids = this.confirmConfig.data;
      if (!this.activeTable) return;
      this.adminService.batchDelete(this.activeTable.name, ids).subscribe({
        next: () => {
          this.popupService.showSuccess(`Đã xóa ${ids.length} bản ghi`, 'Thành công');
          this.selectedItemIds.clear();
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

  isSystemColumn(colName: string): boolean {
    const sysCols = ['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'create_time', 'update_time'];
    return sysCols.includes(colName);
  }

  openAddModal() {
    if (!this.activeTable) return;
    this.newRecord = {};
    this.activeTable.columns.forEach(col => {
      if (!this.isSystemColumn(col.name)) {
        this.newRecord[col.name] = '';
      }
    });
    this.isAddModalOpen = true;
  }

  closeAddModal() {
    this.isAddModalOpen = false;
  }

  saveNewRecord() {
    if (!this.activeTable) return;
    
    // Clean up empty fields so DB defaults are used and parse errors are avoided
    const payload: any = {};
    for (const key of Object.keys(this.newRecord)) {
      if (this.newRecord[key] !== '' && this.newRecord[key] !== null) {
        payload[key] = this.newRecord[key];
      }
    }
    
    this.adminService.insertData(this.activeTable.name, payload).subscribe({
      next: (res) => {
        this.popupService.showSuccess('Đã thêm mới bản ghi', 'Thành công');
        this.closeAddModal();
        this.loadTableData();
      },
      error: (err) => {
        const msg = Array.isArray(err.error?.message) ? err.error.message.join(', ') : err.error?.message || 'Lỗi thêm dữ liệu. Kiểm tra lại định dạng.';
        this.popupService.showError(msg, 'Lỗi');
      }
    });
  }

  getPrimaryKey(item: any): any {
    if (!this.activeTable) return null;
    const primaryCol = this.activeTable.columns.find(c => c.isPrimary);
    return primaryCol ? item[primaryCol.name] : null;
  }

  isForeignKey(colName: string): boolean {
    if (!this.activeTable || !this.activeTable.relations) return false;
    return this.activeTable.relations.some(rel => rel.joinColumns.includes(colName));
  }

  getForeignTableOptions(colName: string): any[] {
    return this.foreignData[colName] || [];
  }

  toggleSelection(item: any) {
    const pk = this.getPrimaryKey(item);
    if (pk == null) return;
    if (this.selectedItemIds.has(pk)) {
      this.selectedItemIds.delete(pk);
    } else {
      this.selectedItemIds.add(pk);
    }
  }

  isAllSelected(): boolean {
    if (this.tableData.length === 0) return false;
    return this.tableData.every(item => {
      const pk = this.getPrimaryKey(item);
      return pk != null && this.selectedItemIds.has(pk);
    });
  }

  toggleAllSelection() {
    if (this.isAllSelected()) {
      this.tableData.forEach(item => {
        const pk = this.getPrimaryKey(item);
        if (pk != null) this.selectedItemIds.delete(pk);
      });
    } else {
      this.tableData.forEach(item => {
        const pk = this.getPrimaryKey(item);
        if (pk != null) this.selectedItemIds.add(pk);
      });
    }
  }

  bulkDelete() {
    if (!this.activeTable || this.selectedItemIds.size === 0) return;
    this.confirmConfig = {
      action: 'bulkDelete',
      message: `Bạn có chắc muốn xóa ${this.selectedItemIds.size} bản ghi đã chọn? Hành động này không thể hoàn tác.`,
      data: Array.from(this.selectedItemIds)
    };
  }

  exportCSV() {
    if (!this.activeTable || this.tableData.length === 0) {
      this.popupService.showError('Không có dữ liệu để xuất', 'Lỗi');
      return;
    }
    
    this.isLoading = true;
    this.adminService.getTableData(this.activeTable.name, 1, 100000).subscribe({
      next: (res) => {
        const data = res.data;
        this.isLoading = false;
        if (data.length === 0) return;
        const columns = this.activeTable!.columns.map(c => c.name);
        const csvRows = [];
        csvRows.push(columns.join(','));
        
        for (const row of data) {
          const values = columns.map(col => {
            let val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
            val = val.replace(/"/g, '""');
            if (val.search(/("|,|\n)/g) >= 0) {
              val = `"${val}"`;
            }
            return val;
          });
          csvRows.push(values.join(','));
        }
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.activeTable!.name}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
      error: () => {
        this.isLoading = false;
        this.popupService.showError('Lỗi khi xuất dữ liệu', 'Lỗi');
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file || !this.activeTable) return;
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const csv = e.target.result;
      this.processCSVImport(csv);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  processCSVImport(csv: string) {
    if (!this.activeTable) return;
    const lines = csv.split(/\r\n|\n/);
    if (lines.length < 2) return;
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const regex = /(?:"([^"]*(?:""[^"]*)*)"|([^",\s]+|\s+)|(?=,)|(?=$))/g;
      const values = [];
      let match;
      while ((match = regex.exec(lines[i])) !== null) {
        if (match.index === regex.lastIndex) regex.lastIndex++;
        if (match[1] !== undefined) {
          values.push(match[1].replace(/""/g, '"'));
        } else if (match[2] !== undefined) {
          values.push(match[2]);
        } else {
          values.push('');
        }
      }
      
      // Clean up values length matching headers
      const cleanValues = values.filter((_, idx) => idx % 2 === 0);

      const obj: any = {};
      headers.forEach((header, index) => {
        if (index < cleanValues.length) {
            let val = cleanValues[index];
            if (val === '') obj[header] = null;
            else obj[header] = val;
        }
      });
      data.push(obj);
    }
    
    this.isLoading = true;
    this.adminService.batchInsert(this.activeTable.name, data).subscribe({
      next: (res) => {
        this.popupService.showSuccess(`Đã import ${res.count} bản ghi`, 'Thành công');
        this.loadTableData();
      },
      error: (err) => {
        this.popupService.showError('Lỗi import dữ liệu. Kiểm tra định dạng CSV.', 'Lỗi');
        this.isLoading = false;
      }
    });
  }
}
