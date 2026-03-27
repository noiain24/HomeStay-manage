import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const DEFAULT_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "18enn4tE_3yCxfYha-qha6_S7ifzZ2ulRX8bnPhQrweQ";

// Helper to get spreadsheet ID from request
const getSpreadsheetId = (req: express.Request) => {
  return (req.headers['x-spreadsheet-id'] as string) || DEFAULT_SPREADSHEET_ID;
};

// Google Sheets Auth Helper
const getSheetsClient = async () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    return null;
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

// API Routes
app.get("/api/data", async (req, res) => {
  try {
    const spreadsheetId = getSpreadsheetId(req);
    const sheets = await getSheetsClient();
    if (!sheets) {
      console.warn("Google Sheets credentials missing. Using mock data.");
      return res.json(getMockData());
    }

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];

    const findSheet = (keywords: string[]) => 
      sheetNames.find(name => keywords.some(k => name.toLowerCase().includes(k.toLowerCase())));

    const actualNames = {
      bookings: findSheet(["Bookings", "Booking", "Reservation"]),
      promos: findSheet(["Promotions", "Promos", "Promotion", "Offer", "Discount"]),
      rooms: findSheet(["Rooms", "Room", "Accommodation", "Catalog"]),
      settings: findSheet(["Setting", "Settings", "Config"])
    };

    const results: any = { bookings: [], promos: [], rooms: [], settings: [] };
    const fetchPromises = Object.entries(actualNames).map(async ([key, sheetName]) => {
      if (!sheetName) return;
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: `${sheetName}!A:N`,
        });
        results[key] = response.data.values || [];
      } catch (err: any) {
        console.error(`Error fetching sheet ${sheetName}:`, err.message);
      }
    });

    await Promise.all(fetchPromises);
    
    res.json({
      ...results,
      spreadsheetId: spreadsheetId,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      actualSheetNames: actualNames
    });
  } catch (error: any) {
    console.error("Error fetching sheets data:", error.message || error);
    const status = error.code || 500;
    const message = error.message || "Failed to fetch data";
    
    if (status === 403) {
      res.status(403).json({ error: "Permission denied", details: "Please share the spreadsheet with the service account email." });
    } else if (status === 404) {
      res.status(404).json({ error: "Spreadsheet not found", details: "The provided Spreadsheet ID is invalid." });
    } else {
      res.status(status).json({ error: message, details: error.message || String(error) });
    }
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const spreadsheetId = getSpreadsheetId(req);
    const sheets = await getSheetsClient();
    if (!sheets) return res.status(400).json({ error: "Google Sheets credentials missing." });

    const { guestName, phone, roomType, checkIn, checkOut, amount, promoCode, discountApplied, originalAmount } = req.body;
    
    const values = [[
      "โอนแล้ว", 
      new Date().toISOString().split('T')[0], 
      guestName, 
      phone, 
      roomType, 
      checkIn, 
      checkOut, 
      amount, 
      "จองแล้ว", 
      "", 
      "On-site booking", 
      "Web Dashboard", 
      "", 
      "",
      promoCode || "",
      discountApplied || 0,
      originalAmount || amount
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: "Bookings!A:Q",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add booking", details: error.message || String(error) });
  }
});

app.post("/api/rooms/new", async (req, res) => {
  try {
    const spreadsheetId = getSpreadsheetId(req);
    const sheets = await getSheetsClient();
    if (!sheets) return res.status(400).json({ error: "Google Sheets credentials missing." });

    const { id, name, capacity, price, status, imageUrl, description, amenities } = req.body;
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId });
    const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];
    const sheetName = sheetNames.find(name => ["Rooms", "Room", "Accommodation", "Catalog"].some(k => name.toLowerCase().includes(k.toLowerCase())));

    if (!sheetName) return res.status(404).json({ error: "Rooms sheet not found" });

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[id || `R${Math.floor(Math.random() * 1000)}`, name, description, amenities, price, status, imageUrl, capacity]]
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add room", details: error.message || String(error) });
  }
});

app.put("/api/rooms/:id", async (req, res) => {
  try {
    const spreadsheetId = getSpreadsheetId(req);
    const sheets = await getSheetsClient();
    if (!sheets) return res.status(400).json({ error: "Google Sheets credentials missing." });

    const { id } = req.params;
    const { name, capacity, price, status, imageUrl, description, amenities } = req.body;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId });
    const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];
    const sheetName = sheetNames.find(name => ["Rooms", "Room", "Accommodation", "Catalog"].some(k => name.toLowerCase().includes(k.toLowerCase())));

    if (!sheetName) return res.status(404).json({ error: "Rooms sheet not found" });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`,
    });
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id);

    if (rowIndex === -1) return res.status(404).json({ error: "Room not found" });

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A${rowIndex + 1}:H${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[id, name, description, amenities, price, status, imageUrl, capacity]]
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update room", details: error.message || String(error) });
  }
});

app.post("/api/promos", async (req, res) => {
  try {
    const spreadsheetId = getSpreadsheetId(req);
    const sheets = await getSheetsClient();
    if (!sheets) return res.status(400).json({ error: "Google Sheets credentials missing." });

    const { name, code, discount, startDate, endDate, status } = req.body;
    const values = [[name, discount, code, startDate, endDate, status]];

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId });
    const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];
    const sheetName = sheetNames.find(name => ["Promotions", "Promos", "Promotion", "Offer", "Discount"].some(k => name.toLowerCase().includes(k.toLowerCase())));

    if (!sheetName) return res.status(404).json({ error: "Promotions sheet not found" });

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:F`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add promo", details: error.message || String(error) });
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const spreadsheetId = getSpreadsheetId(req);
    const sheets = await getSheetsClient();
    if (!sheets) return res.status(400).json({ error: "Google Sheets credentials missing." });

    const settingsData = req.body;
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId });
    const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];
    const sheetName = sheetNames.find(name => ["Setting", "Settings", "Config"].some(k => name.toLowerCase().includes(k.toLowerCase())));

    if (!sheetName) return res.status(404).json({ error: "Settings sheet not found" });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!1:1`,
    });
    const headers = response.data.values?.[0] || [];
    if (headers.length === 0) return res.status(400).json({ error: "Settings sheet has no headers" });

    const values = [headers.map(header => settingsData[header] || "")];
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update settings", details: error.message || String(error) });
  }
});

function getMockData() {
  return {
    bookings: [
      ["สถานะ", "วันที่จอง", "ชื่อลูกค้า", "เบอร์โทร", "ห้องที่จอง", "เช็คอิน", "เช็คเอาท์", "ยอดเงิน", "สถานะห้อง", "หลักฐาน (Slip)", "หมายเหตุ", "แหล่งที่มา", "UserID LINE", "facebookId"],
      ["โอนแล้ว", "2024-03-20", "John Doe", "0812345678", "Deluxe Suite", "2024-03-24", "2024-03-26", "5000", "จองแล้ว", "", "", "Facebook", "", ""],
    ],
    promos: [
      ["Promo Name", "Discount", "CODE", "Start Date", "End Date", "Status"],
      ["Summer Sale", "20%", "SUMMER20", "2024-03-01", "2024-05-31", "Active"],
    ],
    rooms: [
      ["Room_ID", "Room_Name", "Description", "Amenities", "Price_Per_Night", "Status", "Image_URL", "People"],
      ["R01", "เอล เอสเปรันซ่า", "Description", "Amenities", "1,800", "Available", "https://picsum.photos/seed/room1/800/600", "2-3 คน"],
    ],
    settings: [
      ["Homestay_Name", "Homestay_Suffix", "Hero_Slogan_Top", "Hero_Description", "Contact_Phone", "Contact_Email", "Contact_Line_ID", "Contact_Facebook_URL", "Contact_Address", "Bank_Name", "Bank_Account_No", "Bank_Account_Name", "PromptPay_ID", "Theme_Preset", "Font_Style"],
      ["Loei", "HomeStay", "Slogan", "Description", "0824931531", "koporikkung@gmail.com", "koporik", "https://facebook.com/loei", "อ.ภูเรือ จ.เลย", "กสิกรไทย", "0713690716", "อิสยาห์ ดีตรุษ", "0824931531", "Forest", "Elegant"],
    ]
  };
}

export default app;
