const XLSX = require('xlsx');
const XLSXCalc = require('xlsx-calc');
const multer = require('multer');
const path = require('path');
const db = require('../database');
const logger = require('../utils/logger');
const recomputeService = require('./recomputeService');

class ExcelImportService {
  constructor() {
    this.setupStorage();
  }

  /**
   * Setup multer storage for file uploads
   */
  setupStorage() {
    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_PATH || './uploads');
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

    this.upload = multer({
      storage: this.storage,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
        }
      }
    });
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware() {
    return this.upload.single('excel_file');
  }

  /**
   * Analyze Excel file and return preview with column mapping
   * @param {string} filePath - Path to uploaded file
   * @returns {Object} - Analysis result with preview and mapping
   */
  async analyzeFile(filePath) {
    try {
      // Read the workbook
      const workbook = XLSX.readFile(filePath);
      const analysis = {
        sheets: [],
        totalSheets: workbook.SheetNames.length
      };

      // Analyze each sheet
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = this.analyzeSheet(worksheet, sheetName);
        analysis.sheets.push(sheetData);
      }

      logger.info(`Analyzed Excel file: ${filePath}`, { sheets: analysis.totalSheets });
      return analysis;

    } catch (error) {
      logger.error('Error analyzing Excel file:', error);
      throw new Error(`Failed to analyze Excel file: ${error.message}`);
    }
  }

  /**
   * Analyze a single worksheet
   * @param {Object} worksheet - XLSX worksheet object
   * @param {string} sheetName - Name of the sheet
   * @returns {Object} - Sheet analysis
   */
  analyzeSheet(worksheet, sheetName) {
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      return {
        name: sheetName,
        rows: 0,
        columns: [],
        preview: [],
        hasData: false
      };
    }

    // Detect header row (first non-empty row)
    let headerRowIndex = 0;
    for (let i = 0; i < jsonData.length; i++) {
      if (jsonData[i].some(cell => cell !== null && cell !== undefined && cell !== '')) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = jsonData[headerRowIndex] || [];
    const dataRows = jsonData.slice(headerRowIndex + 1);

    // Generate column mapping suggestions
    const columns = headers.map((header, index) => {
      const suggestedField = this.suggestFieldMapping(header);
      return {
        excel_column: header || `Column_${index + 1}`,
        suggested_field: suggestedField.field,
        field_type: suggestedField.type,
        transform_rule: suggestedField.transform,
        required: suggestedField.required,
        notes: suggestedField.notes
      };
    });

    // Generate preview (first 10 rows after normalization)
    const preview = dataRows.slice(0, 10).map((row, index) => {
      const normalizedRow = {};
      headers.forEach((header, colIndex) => {
        const value = row[colIndex];
        normalizedRow[header || `Column_${colIndex + 1}`] = this.normalizeValue(value);
      });
      return {
        row_index: headerRowIndex + index + 2, // Excel row number (1-based)
        data: normalizedRow
      };
    });

    return {
      name: sheetName,
      rows: dataRows.length,
      columns,
      preview,
      hasData: dataRows.length > 0,
      headerRowIndex: headerRowIndex + 1
    };
  }

  /**
   * Suggest field mapping based on column header
   * @param {string} header - Column header text
   * @returns {Object} - Mapping suggestion
   */
  suggestFieldMapping(header) {
    if (!header) return { field: 'unknown', type: 'text', transform: 'none', required: false, notes: 'Unnamed column' };

    const headerLower = header.toString().toLowerCase();
    
    // Date fields
    if (headerLower.includes('date') || headerLower.includes('تاريخ')) {
      return { field: 'date', type: 'date', transform: 'iso_date', required: true, notes: 'Date field' };
    }
    
    // Volume fields
    if (headerLower.includes('volume') || headerLower.includes('كمية') || headerLower.includes('حجم')) {
      return { field: 'volume', type: 'decimal', transform: 'numeric', required: false, notes: 'Volume/quantity field' };
    }
    
    // Price fields
    if (headerLower.includes('price') || headerLower.includes('سعر') || headerLower.includes('تكلفة')) {
      return { field: 'unit_price', type: 'decimal', transform: 'currency', required: false, notes: 'Unit price field' };
    }
    
    // Value fields
    if (headerLower.includes('value') || headerLower.includes('قيمة') || headerLower.includes('مبلغ')) {
      if (headerLower.includes('gross') || headerLower.includes('إجمالي')) {
        return { field: 'gross_value', type: 'decimal', transform: 'currency', required: false, notes: 'Gross value field' };
      }
      if (headerLower.includes('net') || headerLower.includes('صافي')) {
        return { field: 'net_value', type: 'decimal', transform: 'currency', required: false, notes: 'Net value field' };
      }
      return { field: 'gross_value', type: 'decimal', transform: 'currency', required: false, notes: 'Value field' };
    }
    
    // Discount fields
    if (headerLower.includes('discount') || headerLower.includes('خصم') || headerLower.includes('تخفيض')) {
      return { field: 'discount', type: 'decimal', transform: 'currency', required: false, notes: 'Discount field' };
    }
    
    // Description fields
    if (headerLower.includes('description') || headerLower.includes('وصف') || headerLower.includes('تفاصيل')) {
      return { field: 'item_description', type: 'text', transform: 'trim', required: false, notes: 'Item description field' };
    }
    
    // Voucher fields
    if (headerLower.includes('voucher') || headerLower.includes('قسيمة') || headerLower.includes('رقم')) {
      return { field: 'company_voucher_no', type: 'text', transform: 'trim', required: false, notes: 'Voucher number field' };
    }
    
    // Vehicle fields
    if (headerLower.includes('vehicle') || headerLower.includes('مركبة') || headerLower.includes('سيارة')) {
      return { field: 'vehicle_no', type: 'text', transform: 'trim', required: false, notes: 'Vehicle number field' };
    }
    
    // Default mapping
    return { field: 'unknown', type: 'text', transform: 'none', required: false, notes: 'Unmapped column' };
  }

  /**
   * Normalize cell value based on type
   * @param {*} value - Raw cell value
   * @returns {*} - Normalized value
   */
  normalizeValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Convert to string for processing
    const strValue = value.toString().trim();
    
    // Handle dates
    if (this.isDate(strValue)) {
      return this.normalizeDate(strValue);
    }
    
    // Handle numbers
    if (this.isNumeric(strValue)) {
      return this.normalizeNumber(strValue);
    }
    
    // Handle text
    return this.normalizeText(strValue);
  }

  /**
   * Check if value is a date
   * @param {string} value - Value to check
   * @returns {boolean} - True if date
   */
  isDate(value) {
    const date = new Date(value);
    return !isNaN(date.getTime()) && value.length > 0;
  }

  /**
   * Normalize date to ISO format
   * @param {string} value - Date string
   * @returns {string} - ISO date string (YYYY-MM-DD)
   */
  normalizeDate(value) {
    const date = new Date(value);
    return date.toISOString().split('T')[0];
  }

  /**
   * Check if value is numeric
   * @param {string} value - Value to check
   * @returns {boolean} - True if numeric
   */
  isNumeric(value) {
    return !isNaN(value) && !isNaN(parseFloat(value));
  }

  /**
   * Normalize number value
   * @param {string} value - Number string
   * @returns {number} - Normalized number
   */
  normalizeNumber(value) {
    // Remove currency symbols and commas
    const cleanValue = value.replace(/[^\d.-]/g, '');
    return parseFloat(cleanValue);
  }

  /**
   * Normalize text value
   * @param {string} value - Text string
   * @returns {string} - Normalized text
   */
  normalizeText(value) {
    // Trim whitespace and normalize Arabic characters
    return value.trim();
  }

  /**
   * Import data using the provided mapping
   * @param {string} filePath - Path to Excel file
   * @param {Object} mapping - Column mapping configuration
   * @param {number} userId - User ID performing the import
   * @returns {Object} - Import result
   */
  async importData(filePath, mapping, userId) {
    try {
      // Create import batch record
      const batchId = await this.createImportBatch(filePath, userId, mapping);
      
      // Read and process the file
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[mapping.sheetName];
      
      // Convert to JSON with headers
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Process data rows
      const results = await this.processDataRows(jsonData, mapping, batchId, userId);
      
      // Update batch status
      await this.updateImportBatch(batchId, 'completed', results);
      
      logger.info(`Import completed for batch ${batchId}`, results);
      return results;

    } catch (error) {
      logger.error('Error during import:', error);
      throw error;
    }
  }

  /**
   * Process data rows and insert into database
   * @param {Array} jsonData - JSON data from Excel
   * @param {Object} mapping - Column mapping
   * @param {number} batchId - Import batch ID
   * @param {number} userId - User ID
   * @returns {Object} - Processing results
   */
  async processDataRows(jsonData, mapping, batchId, userId) {
    const results = {
      total: 0,
      imported: 0,
      conflicts: 0,
      errors: 0
    };

    const headerRowIndex = mapping.headerRowIndex - 1;
    const dataRows = jsonData.slice(headerRowIndex + 1);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowIndex = headerRowIndex + i + 2; // Excel row number

      try {
        // Map row data according to mapping
        const mappedData = this.mapRowData(row, mapping, rowIndex);
        
        // Validate required fields
        if (!this.validateRequiredFields(mappedData, mapping)) {
          await this.recordConflict(batchId, rowIndex, 'missing_required', 'Required fields missing', mappedData);
          results.conflicts++;
          continue;
        }

        // Check for duplicates
        if (await this.isDuplicate(mappedData)) {
          await this.recordConflict(batchId, rowIndex, 'duplicate_voucher', 'Duplicate voucher number', mappedData);
          results.conflicts++;
          continue;
        }

        // Insert delivery record
        const deliveryId = await this.insertDelivery(mappedData, userId, mapping.sheetName, rowIndex);
        
        // Recompute dependent fields
        await recomputeService.recomputeDependentFields(deliveryId);
        
        results.imported++;

      } catch (error) {
        logger.error(`Error processing row ${rowIndex}:`, error);
        await this.recordConflict(batchId, rowIndex, 'invalid_data', error.message, { row_data: row });
        results.errors++;
      }

      results.total++;
    }

    return results;
  }

  /**
   * Map row data according to column mapping
   * @param {Array} row - Raw row data
   * @param {Object} mapping - Column mapping
   * @param {number} rowIndex - Excel row index
   * @returns {Object} - Mapped data
   */
  mapRowData(row, mapping, rowIndex) {
    const mappedData = {
      source_sheet: mapping.sheetName,
      original_row_index: rowIndex
    };

    mapping.columns.forEach((columnMapping, index) => {
      if (columnMapping.suggested_field !== 'unknown') {
        const value = row[index];
        const normalizedValue = this.applyTransform(value, columnMapping.transform);
        mappedData[columnMapping.suggested_field] = normalizedValue;
      }
    });

    return mappedData;
  }

  /**
   * Apply transformation to a value
   * @param {*} value - Raw value
   * @param {string} transform - Transformation type
   * @returns {*} - Transformed value
   */
  applyTransform(value, transform) {
    switch (transform) {
      case 'iso_date':
        return this.normalizeDate(value);
      case 'numeric':
        return this.normalizeNumber(value);
      case 'currency':
        return this.normalizeNumber(value);
      case 'trim':
        return this.normalizeText(value);
      default:
        return value;
    }
  }

  /**
   * Validate required fields
   * @param {Object} data - Mapped data
   * @param {Object} mapping - Column mapping
   * @returns {boolean} - True if valid
   */
  validateRequiredFields(data, mapping) {
    const requiredFields = mapping.columns
      .filter(col => col.required)
      .map(col => col.suggested_field);

    return requiredFields.every(field => 
      data[field] !== null && data[field] !== undefined && data[field] !== ''
    );
  }

  /**
   * Check if delivery is duplicate
   * @param {Object} data - Delivery data
   * @returns {boolean} - True if duplicate
   */
  async isDuplicate(data) {
    if (!data.company_voucher_no) return false;
    
    const existing = await db('deliveries')
      .where('company_voucher_no', data.company_voucher_no)
      .first();
    
    return !!existing;
  }

  /**
   * Insert delivery record
   * @param {Object} data - Delivery data
   * @param {number} userId - User ID
   * @param {string} sheetName - Source sheet name
   * @param {number} rowIndex - Excel row index
   * @returns {number} - Inserted delivery ID
   */
  async insertDelivery(data, userId, sheetName, rowIndex) {
    const [deliveryId] = await db('deliveries').insert({
      ...data,
      created_by: userId,
      created_at: new Date()
    });

    return deliveryId;
  }

  /**
   * Record import conflict
   * @param {number} batchId - Import batch ID
   * @param {number} rowIndex - Excel row index
   * @param {string} reason - Conflict reason
   * @param {string} details - Conflict details
   * @param {Object} originalData - Original row data
   */
  async recordConflict(batchId, rowIndex, reason, details, originalData) {
    await db('import_conflicts').insert({
      batch_id: batchId,
      delivery_row: rowIndex,
      reason,
      details,
      original_data: JSON.stringify(originalData),
      status: 'pending'
    });
  }

  /**
   * Create import batch record
   * @param {string} filePath - File path
   * @param {number} userId - User ID
   * @param {Object} mapping - Column mapping
   * @returns {number} - Batch ID
   */
  async createImportBatch(filePath, userId, mapping) {
    const [batchId] = await db('import_batches').insert({
      filename: path.basename(filePath),
      status: 'processing',
      created_by: userId,
      mapping_config: JSON.stringify(mapping)
    });

    return batchId;
  }

  /**
   * Update import batch status
   * @param {number} batchId - Batch ID
   * @param {string} status - New status
   * @param {Object} results - Import results
   */
  async updateImportBatch(batchId, status, results) {
    await db('import_batches')
      .where('id', batchId)
      .update({
        status,
        total_rows: results.total,
        imported_rows: results.imported,
        conflict_rows: results.conflicts,
        updated_at: new Date()
      });
  }
}

module.exports = new ExcelImportService();

