const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function getOrCreateSettingsSheet() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Settings");
    sheet.appendRow(["Key", "Value"]);
    sheet.appendRow(["Password", "admin123"]);
    const defaultProjects = [
      { id: "CaNhan", name: "Cá nhân", icon: "person-outline" },
      { id: "CongTy", name: "Công ty", icon: "business-outline" },
      { id: "DuAnA", name: "Dự án A", icon: "folder-outline" },
      { id: "DuAnB", name: "Dự án B", icon: "folder-open-outline" },
      { id: "TaiChinh", name: "Tài chính", icon: "wallet-outline" },
      { id: "GhiChu", name: "Ghi chú", icon: "document-text-outline" },
      { id: "Inbox", name: "Hộp thư đến", icon: "mail-unread-outline" }
    ];
    sheet.appendRow(["Projects", JSON.stringify(defaultProjects)]);
  }
  return sheet;
}

function generateUUID() {
  return 'id-' + new Date().getTime() + '-' + Math.floor(Math.random() * 10000);
}

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "get_settings") {
    const sheet = getOrCreateSettingsSheet();
    const data = sheet.getDataRange().getValues();
    let settings = {};
    for (let i = 1; i < data.length; i++) {
      settings[data[i][0]] = data[i][1];
    }
    return ContentService.createTextOutput(JSON.stringify(settings)).setMimeType(ContentService.MimeType.JSON);
  }

  const sheetName = e.parameter.sheet;
  if (!sheetName) return ContentService.createTextOutput(JSON.stringify({error: "Thiếu tên sheet"})).setMimeType(ContentService.MimeType.JSON);
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({error: "Không tìm thấy trang tính"})).setMimeType(ContentService.MimeType.JSON);
  
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  if (!e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({error: "No post data"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  
  if (action === "update_settings") {
    const sheet = getOrCreateSettingsSheet();
    const settings = params.settings;
    sheet.clear();
    sheet.appendRow(["Key", "Value"]);
    for (const key in settings) {
      sheet.appendRow([key, settings[key]]);
    }
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "create_sheet") {
    let newSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(params.sheet);
    if (newSheet) {
      return ContentService.createTextOutput(JSON.stringify({error: "Trang tính đã tồn tại"})).setMimeType(ContentService.MimeType.JSON);
    }
    newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(params.sheet);
    if (params.headers && params.headers.length > 0) {
      let finalHeaders = [...params.headers];
      if (!finalHeaders.includes('ID')) finalHeaders.unshift('ID');
      newSheet.appendRow(finalHeaders);
    }
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }
  
  const sheetName = params.sheet;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({error: "Không tìm thấy trang tính"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "add") {
    let headers = [];
    if (sheet.getLastColumn() > 0) {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      // Tự động kiểm tra và thêm cột mới nếu có trường dữ liệu chưa tồn tại trong header
      let newHeaders = [];
      Object.keys(params.data).forEach(key => {
          if (!headers.includes(key)) {
              headers.push(key);
              newHeaders.push(key);
          }
      });
      // Cập nhật lại hàng đầu tiên (Header) trên Sheet nếu có cột mới
      if (newHeaders.length > 0) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    } else {
      // Nếu sheet trống hoàn toàn, tự động tạo headers từ dữ liệu gửi lên
      headers = Object.keys(params.data);
      if (!headers.includes('ID')) headers.unshift('ID'); // Đảm bảo luôn có cột ID
      sheet.appendRow(headers);
    }
    
    // Auto generate ID if 'ID' column exists but no data passed
    const idIndex = headers.findIndex(h => String(h).toUpperCase() === 'ID');
    if (idIndex !== -1 && !params.data[headers[idIndex]]) {
      params.data[headers[idIndex]] = generateUUID();
    }
    
    const newRow = headers.map(h => params.data[h] !== undefined ? params.data[h] : "");
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({success: true, id: idIndex !== -1 ? params.data[headers[idIndex]] : null})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "update_row") {
    const idColumnName = params.idColumn || 'ID';
    const idValue = params.idValue;
    const updateData = params.updateData; // { "Trạng thái": "Hoàn thành", ... }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf(idColumnName);
    
    if (idColIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({error: "Không tìm thấy cột ID trong sheet"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] === idValue) {
        rowIndex = i + 1; // 1-based index in Sheets, +1 because data array is 0-based and we skipped header
        break;
      }
    }
    
    if (rowIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({error: "Không tìm thấy bản ghi với ID cung cấp"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update specific cells
    for (const key in updateData) {
      const colIndex = headers.indexOf(key);
      if (colIndex !== -1) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(updateData[key]);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "delete_row") {
    const idColumnName = params.idColumn || 'ID';
    const idValue = params.idValue;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf(idColumnName);
    
    if (idColIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({error: "Không tìm thấy cột ID trong sheet"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] === idValue) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({error: "Không tìm thấy bản ghi với ID cung cấp"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    sheet.deleteRow(rowIndex);
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: "Hành động không được hỗ trợ"})).setMimeType(ContentService.MimeType.JSON);
}
