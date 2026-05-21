import { Component, OnInit } from '@angular/core';
import { AdminService, TableInfo } from '../../services/admin.service';
import { PopupService } from '../../services/popup.service';

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

  constructor(private adminService: AdminService, private popupService: PopupService) {}

  ngOnInit(): void {
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
        this.tableData = res;
        this.isLoading = false;
      },
      error: (err) => {
        this.popupService.showError(`Lỗi khi lấy dữ liệu bảng ${this.activeTable?.name}`, 'Lỗi');
        this.isLoading = false;
      }
    });
  }

  saveRow(item: any) {
    if (!this.activeTable) return;
    const primaryCol = this.activeTable.columns.find(c => c.isPrimary);
    if (!primaryCol) {
      this.popupService.showError('Bảng không có khóa chính', 'Lỗi');
      return;
    }
    
    const id = item[primaryCol.name];
    
    // Call update API
    this.adminService.updateData(this.activeTable.name, id, item).subscribe({
      next: () => {
        this.popupService.showSuccess('Lưu thành công', 'Cập nhật DB');
      },
      error: (err) => {
        this.popupService.showError('Lỗi cập nhật', 'Lỗi');
      }
    });
  }

  deleteRow(item: any) {
    if (!this.activeTable || !confirm('Cảnh báo: Hành động này không thể hoàn tác. Bạn có chắc muốn xóa?')) return;
    
    const primaryCol = this.activeTable.columns.find(c => c.isPrimary);
    if (!primaryCol) return;
    
    const id = item[primaryCol.name];
    this.adminService.deleteData(this.activeTable.name, id).subscribe({
      next: () => {
        this.popupService.showSuccess('Đã xóa', 'Thành công');
        this.loadTableData();
      },
      error: (err) => {
        this.popupService.showError('Không thể xóa dữ liệu', 'Lỗi');
      }
    });
  }
}
