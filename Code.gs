/**
 * Google Apps Script Backend for Resort Management
 * 
 * Instructions:
 * 1. Open your Google Sheet (ID: 18enn4tE_3yCxfYha-qha6_S7ifzZ2ulRX8bnPhQrweQ)
 * 2. Go to Extensions > Apps Script
 * 3. Replace the content of Code.gs with this code.
 * 4. Deploy as a Web App (Execute as: Me, Who has access: Anyone)
 */

const SPREADSHEET_ID = '18enn4tE_3yCxfYha-qha6_S7ifzZ2ulRX8bnPhQrweQ';

function doGet(e) {
  // Support JSON API requests for the external dashboard
  if (e && e.parameter && e.parameter.action === 'getData') {
    const data = getData();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Default: Serve the HTML Web App
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Luxe Resort Management')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fetches all data from the spreadsheet for the dashboard
 */
function getData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const getSheetData = (name) => {
    try {
      const sheet = ss.getSheetByName(name);
      if (!sheet) return [];
      return sheet.getDataRange().getValues();
    } catch (e) {
      console.error('Error reading sheet ' + name + ': ' + e.message);
      return [];
    }
  };
  
  return {
    bookings: getSheetData('Bookings'),
    promos: getSheetData('Promos'),
    rooms: getSheetData('Rooms')
  };
}

/**
 * Appends a new booking to the Bookings sheet
 */
function addBooking(formData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Bookings');
  
  if (!sheet) throw new Error('Bookings sheet not found');
  
  // Columns: สถานะ, วันที่จอง, ชื่อลูกค้า, เบอร์โทร, ห้องที่จอง, เช็คอิน, เช็คเอาท์, ยอดเงิน, สถานะห้อง, หลักฐาน (Slip), หมายเหตุ, แหล่งที่มา, UserID LINE, facebookId
  const row = [
    'โอนแล้ว',
    new Date(),
    formData.guestName,
    formData.phone,
    formData.roomType,
    formData.checkIn,
    formData.checkOut,
    formData.amount,
    'จองแล้ว',
    '',
    'On-site booking',
    'Web App',
    '',
    ''
  ];
  
  sheet.appendRow(row);
  return { success: true };
}
