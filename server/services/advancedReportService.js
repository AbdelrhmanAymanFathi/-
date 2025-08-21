const XLSX = require('xlsx');
const db = require('../database');
const logger = require('../utils/logger');

class AdvancedReportService {
  /**
   * Generate comprehensive report based on period type
   * @param {string} periodType - 'daily', 'weekly', 'monthly', 'yearly'
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} filters - Additional filters
   * @returns {Promise<Object>} - Report data
   */
  async generatePeriodReport(periodType, startDate, endDate, filters = {}) {
    try {
      const reportData = {
        period: {
          type: periodType,
          start: startDate,
          end: endDate
        },
        summary: {},
        details: {},
        charts: {},
        generated_at: new Date()
      };

      // Generate summary statistics
      reportData.summary = await this.generateSummary(startDate, endDate, filters);

      // Generate period breakdown
      reportData.details = await this.generatePeriodBreakdown(periodType, startDate, endDate, filters);

      // Generate chart data
      reportData.charts = await this.generateChartData(periodType, startDate, endDate, filters);

      logger.info(`Generated ${periodType} report from ${startDate} to ${endDate}`);
      return reportData;

    } catch (error) {
      logger.error('Error generating period report:', error);
      throw error;
    }
  }

  /**
   * Generate summary statistics
   */
  async generateSummary(startDate, endDate, filters) {
    let query = db('deliveries')
      .whereBetween('date', [startDate, endDate]);

    // Apply filters
    if (filters.contractor_id) {
      query = query.where('contractor_id', filters.contractor_id);
    }
    if (filters.supplier_id) {
      query = query.where('supplier_id', filters.supplier_id);
    }

    const summary = await query
      .select(
        db.raw('COUNT(*) as total_deliveries'),
        db.raw('SUM(volume) as total_volume'),
        db.raw('SUM(gross_value) as total_gross_value'),
        db.raw('SUM(net_value) as total_net_value'),
        db.raw('SUM(discount) as total_discount'),
        db.raw('AVG(unit_price) as avg_unit_price'),
        db.raw('COUNT(DISTINCT supplier_id) as unique_suppliers'),
        db.raw('COUNT(DISTINCT contractor_id) as unique_contractors'),
        db.raw('COUNT(DISTINCT vehicle_no) as unique_vehicles')
      )
      .first();

    return {
      total_deliveries: parseInt(summary.total_deliveries) || 0,
      total_volume: parseFloat(summary.total_volume) || 0,
      total_gross_value: parseFloat(summary.total_gross_value) || 0,
      total_net_value: parseFloat(summary.total_net_value) || 0,
      total_discount: parseFloat(summary.total_discount) || 0,
      avg_unit_price: parseFloat(summary.avg_unit_price) || 0,
      unique_suppliers: parseInt(summary.unique_suppliers) || 0,
      unique_contractors: parseInt(summary.unique_contractors) || 0,
      unique_vehicles: parseInt(summary.unique_vehicles) || 0
    };
  }

  /**
   * Generate period breakdown based on period type
   */
  async generatePeriodBreakdown(periodType, startDate, endDate, filters) {
    let dateFormat;
    let groupBy;

    switch (periodType) {
      case 'daily':
        dateFormat = 'DATE(date)';
        groupBy = 'DATE(date)';
        break;
      case 'weekly':
        dateFormat = 'strftime("%Y-W%W", date)';
        groupBy = 'strftime("%Y-W%W", date)';
        break;
      case 'monthly':
        dateFormat = 'strftime("%Y-%m", date)';
        groupBy = 'strftime("%Y-%m", date)';
        break;
      case 'yearly':
        dateFormat = 'strftime("%Y", date)';
        groupBy = 'strftime("%Y", date)';
        break;
      default:
        throw new Error('Invalid period type');
    }

    let query = db('deliveries')
      .whereBetween('date', [startDate, endDate]);

    // Apply filters
    if (filters.contractor_id) {
      query = query.where('contractor_id', filters.contractor_id);
    }
    if (filters.supplier_id) {
      query = query.where('supplier_id', filters.supplier_id);
    }

    const breakdown = await query
      .select(
        db.raw(`${dateFormat} as period`),
        db.raw('COUNT(*) as delivery_count'),
        db.raw('SUM(volume) as total_volume'),
        db.raw('SUM(gross_value) as total_gross_value'),
        db.raw('SUM(net_value) as total_net_value'),
        db.raw('SUM(discount) as total_discount'),
        db.raw('AVG(unit_price) as avg_unit_price')
      )
      .groupBy(groupBy)
      .orderBy('period', 'desc');

    return breakdown.map(row => ({
      period: row.period,
      delivery_count: parseInt(row.delivery_count) || 0,
      total_volume: parseFloat(row.total_volume) || 0,
      total_gross_value: parseFloat(row.total_gross_value) || 0,
      total_net_value: parseFloat(row.total_net_value) || 0,
      total_discount: parseFloat(row.total_discount) || 0,
      avg_unit_price: parseFloat(row.avg_unit_price) || 0
    }));
  }

  /**
   * Generate chart data for visualizations
   */
  async generateChartData(periodType, startDate, endDate, filters) {
    const charts = {};

    // Top suppliers chart
    let suppliersQuery = db('deliveries')
      .whereBetween('date', [startDate, endDate]);

    if (filters.contractor_id) {
      suppliersQuery = suppliersQuery.where('contractor_id', filters.contractor_id);
    }
    if (filters.supplier_id) {
      suppliersQuery = suppliersQuery.where('supplier_id', filters.supplier_id);
    }

    charts.top_suppliers = await suppliersQuery
      .select(
        'suppliers.name as supplier_name',
        db.raw('SUM(deliveries.volume) as total_volume'),
        db.raw('SUM(deliveries.net_value) as total_value'),
        db.raw('COUNT(*) as delivery_count')
      )
      .leftJoin('suppliers', 'deliveries.supplier_id', 'suppliers.id')
      .groupBy('suppliers.id', 'suppliers.name')
      .orderBy('total_value', 'desc')
      .limit(10);

    // Top contractors chart
    let contractorsQuery = db('deliveries')
      .whereBetween('date', [startDate, endDate]);

    if (filters.contractor_id) {
      contractorsQuery = contractorsQuery.where('contractor_id', filters.contractor_id);
    }
    if (filters.supplier_id) {
      contractorsQuery = contractorsQuery.where('supplier_id', filters.supplier_id);
    }

    charts.top_contractors = await contractorsQuery
      .select(
        'contractors.name as contractor_name',
        db.raw('SUM(deliveries.net_value) as total_value'),
        db.raw('COUNT(*) as delivery_count')
      )
      .leftJoin('contractors', 'deliveries.contractor_id', 'contractors.id')
      .groupBy('contractors.id', 'contractors.name')
      .orderBy('total_value', 'desc')
      .limit(10);

    // Vehicle performance chart
    let vehiclesQuery = db('deliveries')
      .whereBetween('date', [startDate, endDate])
      .whereNotNull('vehicle_no');

    if (filters.contractor_id) {
      vehiclesQuery = vehiclesQuery.where('contractor_id', filters.contractor_id);
    }
    if (filters.supplier_id) {
      vehiclesQuery = vehiclesQuery.where('supplier_id', filters.supplier_id);
    }

    charts.vehicle_performance = await vehiclesQuery
      .select(
        'vehicle_no',
        db.raw('COUNT(*) as delivery_count'),
        db.raw('SUM(volume) as total_volume'),
        db.raw('SUM(net_value) as total_value')
      )
      .groupBy('vehicle_no')
      .orderBy('total_value', 'desc')
      .limit(15);

    return charts;
  }

  /**
   * Export report to Excel format
   * @param {Object} reportData - Report data
   * @param {string} periodType - Period type
   * @returns {Buffer} - Excel file buffer
   */
  async exportToExcel(reportData, periodType) {
    try {
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summarySheet = this.createSummarySheet(reportData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص التقرير');

      // Period breakdown sheet
      const breakdownSheet = this.createBreakdownSheet(reportData, periodType);
      XLSX.utils.book_append_sheet(workbook, breakdownSheet, 'التفاصيل');

      // Top performers sheet
      const performersSheet = this.createPerformersSheet(reportData);
      XLSX.utils.book_append_sheet(workbook, performersSheet, 'أفضل الأداء');

      // Detailed data sheet
      const detailsSheet = await this.createDetailedDataSheet(reportData);
      XLSX.utils.book_append_sheet(workbook, detailsSheet, 'البيانات التفصيلية');

      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        compression: true
      });

      logger.info(`Excel report exported successfully for ${periodType} period`);
      return excelBuffer;

    } catch (error) {
      logger.error('Error exporting to Excel:', error);
      throw error;
    }
  }

  /**
   * Create summary sheet
   */
  createSummarySheet(reportData) {
    const summaryData = [
      ['تقرير التوريدات والنقل', '', '', '', ''],
      ['', '', '', '', ''],
      ['ملخص الفترة', '', '', '', ''],
      ['', '', '', '', ''],
      ['المؤشر', 'القيمة', 'الوحدة', 'ملاحظات', ''],
      ['إجمالي التوريدات', reportData.summary.total_deliveries, 'توريد', 'عدد التوريدات الكلي', ''],
      ['إجمالي الحجم', reportData.summary.total_volume, 'م3', 'إجمالي الحجم المستورد', ''],
      ['إجمالي القيمة الإجمالية', reportData.summary.total_gross_value, 'جنيه', 'قبل الخصم', ''],
      ['إجمالي الخصم', reportData.summary.total_discount, 'جنيه', 'إجمالي الخصومات', ''],
      ['إجمالي القيمة الصافية', reportData.summary.total_net_value, 'جنيه', 'بعد الخصم', ''],
      ['متوسط سعر الوحدة', reportData.summary.avg_unit_price, 'جنيه/م3', 'متوسط السعر', ''],
      ['عدد الموردين', reportData.summary.unique_suppliers, 'مورد', 'الموردين المختلفين', ''],
      ['عدد المقاولين', reportData.summary.unique_contractors, 'مقاول', 'المقاولين المختلفين', ''],
      ['عدد المركبات', reportData.summary.unique_vehicles, 'مركبة', 'المركبات المستخدمة', ''],
      ['', '', '', '', ''],
      ['معلومات التقرير', '', '', '', ''],
      ['نوع الفترة', reportData.period.type, '', '', ''],
      ['من تاريخ', reportData.period.start, '', '', ''],
      ['إلى تاريخ', reportData.period.end, '', '', ''],
      ['تاريخ الإنشاء', reportData.generated_at.toLocaleDateString('ar-EG'), '', '', ''],
      ['وقت الإنشاء', reportData.generated_at.toLocaleTimeString('ar-EG'), '', '', '']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Style the worksheet
    worksheet['!cols'] = [
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 30 },
      { width: 10 }
    ];

    return worksheet;
  }

  /**
   * Create period breakdown sheet
   */
  createBreakdownSheet(reportData, periodType) {
    const headers = [
      'الفترة',
      'عدد التوريدات',
      'إجمالي الحجم',
      'إجمالي القيمة الإجمالية',
      'إجمالي القيمة الصافية',
      'إجمالي الخصم',
      'متوسط سعر الوحدة'
    ];

    const data = [headers];
    
    reportData.details.forEach(row => {
      data.push([
        row.period,
        row.delivery_count,
        row.total_volume,
        row.total_gross_value,
        row.total_net_value,
        row.total_discount,
        row.avg_unit_price
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Style the worksheet
    worksheet['!cols'] = [
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 20 },
      { width: 20 },
      { width: 15 },
      { width: 20 }
    ];

    return worksheet;
  }

  /**
   * Create top performers sheet
   */
  createPerformersSheet(reportData) {
    const data = [
      ['أفضل الموردين', '', '', ''],
      ['المورد', 'إجمالي الحجم', 'إجمالي القيمة', 'عدد التوريدات'],
      ...reportData.charts.top_suppliers.map(supplier => [
        supplier.supplier_name,
        supplier.total_volume,
        supplier.total_value,
        supplier.delivery_count
      ]),
      ['', '', '', ''],
      ['أفضل المقاولين', '', '', ''],
      ['المقاول', 'إجمالي القيمة', 'عدد التوريدات', ''],
      ...reportData.charts.top_contractors.map(contractor => [
        contractor.contractor_name,
        contractor.total_value,
        contractor.delivery_count,
        ''
      ]),
      ['', '', '', ''],
      ['أداء المركبات', '', '', ''],
      ['رقم المركبة', 'عدد التوريدات', 'إجمالي الحجم', 'إجمالي القيمة'],
      ...reportData.charts.vehicle_performance.map(vehicle => [
        vehicle.vehicle_no,
        vehicle.delivery_count,
        vehicle.total_volume,
        vehicle.total_value
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Style the worksheet
    worksheet['!cols'] = [
      { width: 25 },
      { width: 20 },
      { width: 20 },
      { width: 20 }
    ];

    return worksheet;
  }

  /**
   * Create detailed data sheet
   */
  async createDetailedDataSheet(reportData) {
    // Get detailed delivery data
    let query = db('deliveries')
      .select(
        'deliveries.*',
        'contractors.name as contractor_name',
        'suppliers.name as supplier_name',
        'users.name as created_by_name'
      )
      .leftJoin('contractors', 'deliveries.contractor_id', 'contractors.id')
      .leftJoin('suppliers', 'deliveries.supplier_id', 'suppliers.id')
      .leftJoin('users', 'deliveries.created_by', 'users.id')
      .whereBetween('deliveries.date', [reportData.period.start, reportData.period.end])
      .orderBy('deliveries.date', 'desc');

    const deliveries = await query;

    const headers = [
      'التاريخ',
      'المقاول',
      'المورد',
      'رقم المركبة',
      'رقم القسيمة',
      'الحجم',
      'الوحدة',
      'سعر الوحدة',
      'القيمة الإجمالية',
      'الخصم',
      'القيمة الصافية',
      'وصف البند',
      'المصدر',
      'تم الإنشاء بواسطة',
      'تاريخ الإنشاء'
    ];

    const data = [headers];
    
    deliveries.forEach(delivery => {
      data.push([
        delivery.date,
        delivery.contractor_name || '',
        delivery.supplier_name || '',
        delivery.vehicle_no || '',
        delivery.company_voucher_no || '',
        delivery.volume || '',
        delivery.unit || '',
        delivery.unit_price || '',
        delivery.gross_value || '',
        delivery.discount || '',
        delivery.net_value || '',
        delivery.item_description || '',
        delivery.source_sheet || '',
        delivery.created_by_name || '',
        delivery.created_at
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Style the worksheet
    worksheet['!cols'] = [
      { width: 15 },
      { width: 25 },
      { width: 25 },
      { width: 15 },
      { width: 20 },
      { width: 15 },
      { width: 10 },
      { width: 15 },
      { width: 20 },
      { width: 15 },
      { width: 20 },
      { width: 30 },
      { width: 20 },
      { width: 25 },
      { width: 20 }
    ];

    return worksheet;
  }

  /**
   * Get available report periods
   */
  async getAvailablePeriods() {
    const periods = {
      daily: {
        name: 'يومي',
        description: 'تقرير يومي مفصل',
        max_days: 30
      },
      weekly: {
        name: 'أسبوعي',
        description: 'تقرير أسبوعي',
        max_days: 90
      },
      monthly: {
        name: 'شهري',
        description: 'تقرير شهري',
        max_days: 365
      },
      yearly: {
        name: 'سنوي',
        description: 'تقرير سنوي شامل',
        max_days: 3650
      }
    };

    return periods;
  }
}

module.exports = new AdvancedReportService();
