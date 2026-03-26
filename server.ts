import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "18enn4tE_3yCxfYha-qha6_S7ifzZ2ulRX8bnPhQrweQ";

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
      const sheets = await getSheetsClient();
      if (!sheets) {
        console.warn("Google Sheets credentials missing. Using mock data.");
        return res.json(getMockData());
      }

      // 1. Get spreadsheet metadata to find actual sheet names
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];

      // 2. Map our expected keys to actual sheet names found in the spreadsheet
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
        if (!sheetName) {
          console.warn(`No sheet found for ${key}. Expected one of: ${key}`);
          return;
        }
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:N`, // Fetch a wide range
          });
          results[key] = response.data.values || [];
        } catch (err: any) {
          console.error(`Error fetching sheet ${sheetName}:`, err.message);
        }
      });

      await Promise.all(fetchPromises);
      
      res.json({
        ...results,
        spreadsheetId: SPREADSHEET_ID,
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        actualSheetNames: actualNames
      });
    } catch (error: any) {
      console.error("Error fetching sheets data:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Google API Error Data:", JSON.stringify(error.response.data, null, 2));
      }
      
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      res.status(500).json({ 
        error: "Failed to fetch data", 
        details: error.message || String(error),
        suggestion: `Please ensure the Google Sheet is shared with the service account email: ${email} and has 'Viewer' or 'Editor' permissions.`
      });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const sheets = await getSheetsClient();
      if (!sheets) {
        return res.status(400).json({ error: "Google Sheets credentials missing." });
      }

      const { guestName, phone, roomType, checkIn, checkOut, amount, promoCode, discountApplied, originalAmount } = req.body;
      
      // Columns: สถานะ, วันที่จอง, ชื่อลูกค้า, เบอร์โทร, ห้องที่จอง, เช็คอิน, เช็คเอาท์, ยอดเงิน, สถานะห้อง, หลักฐาน (Slip), หมายเหตุ, แหล่งที่มา, UserID LINE, facebookId, Promo Code, Discount, Original Price
      const values = [
        [
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
        ]
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Bookings!A:Q",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error appending booking:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Google API Error Data:", JSON.stringify(error.response.data, null, 2));
      }
      
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      res.status(500).json({ 
        error: "Failed to add booking", 
        details: error.message || String(error),
        suggestion: `Please ensure the Google Sheet is shared with the service account email: ${email} and has 'Editor' permissions.`
      });
    }
  });

  app.post("/api/rooms/new", async (req, res) => {
    try {
      const sheets = await getSheetsClient();
      if (!sheets) {
        return res.status(400).json({ error: "Google Sheets credentials missing." });
      }

      const { id, name, capacity, price, status, imageUrl, description, amenities } = req.body;

      // 1. Find the sheet name for rooms
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];
      const sheetName = sheetNames.find(name => ["Rooms", "Room", "Accommodation", "Catalog"].some(k => name.toLowerCase().includes(k.toLowerCase())));

      if (!sheetName) {
        return res.status(404).json({ error: "Rooms sheet not found" });
      }

      // 2. Append the new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:H`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[id || `R${Math.floor(Math.random() * 1000)}`, name, description, amenities, price, status, imageUrl, capacity]]
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error adding room:", error.message || error);
      res.status(500).json({ error: "Failed to add room", details: error.message || String(error) });
    }
  });

  app.put("/api/rooms/:id", async (req, res) => {
    try {
      const sheets = await getSheetsClient();
      if (!sheets) {
        return res.status(400).json({ error: "Google Sheets credentials missing." });
      }

      const { id } = req.params;
      const { name, capacity, price, status, imageUrl, description, amenities } = req.body;

      // 1. Find the sheet name for rooms
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];
      const sheetName = sheetNames.find(name => ["Rooms", "Room", "Accommodation", "Catalog"].some(k => name.toLowerCase().includes(k.toLowerCase())));

      if (!sheetName) {
        return res.status(404).json({ error: "Rooms sheet not found" });
      }

      // 2. Find the row index for the room ID
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:A`,
      });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ error: "Room not found" });
      }

      // 3. Update the row (Order: ID, Name, Description, Amenities, Price, Status, Image, Capacity)
      // Note: We use rowIndex + 1 because Sheets is 1-indexed
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A${rowIndex + 1}:H${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[id, name, description, amenities, price, status, imageUrl, capacity]]
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating room:", error.message || error);
      if (error.response && error.response.data) {
        console.error("Google API Error Data:", JSON.stringify(error.response.data, null, 2));
      }
      
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      res.status(500).json({ 
        error: "Failed to update room", 
        details: error.message || String(error),
        suggestion: `Please ensure the Google Sheet is shared with the service account email: ${email} and has 'Editor' permissions.`
      });
    }
  });

  app.post("/api/promos", async (req, res) => {
    try {
      const sheets = await getSheetsClient();
      if (!sheets) {
        return res.status(400).json({ error: "Google Sheets credentials missing." });
      }

      const { name, code, discount, startDate, endDate, status } = req.body;
      
      // Columns: Promo Name, Discount, CODE, Start Date, End Date, Status (6 columns as per user image)
      const values = [
        [name, discount, code, startDate, endDate, status]
      ];

      // 1. Find the sheet name for promos
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];
      const sheetName = sheetNames.find(name => ["Promotions", "Promos", "Promotion", "Offer", "Discount"].some(k => name.toLowerCase().includes(k.toLowerCase())));

      if (!sheetName) {
        return res.status(404).json({ error: "Promotions sheet not found" });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:F`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error appending promo:", error.message || error);
      res.status(500).json({ error: "Failed to add promo", details: error.message || String(error) });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const sheets = await getSheetsClient();
      if (!sheets) {
        return res.status(400).json({ error: "Google Sheets credentials missing." });
      }

      const settingsData = req.body;
      
      // 1. Find the sheet name for settings
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || "") || [];
      const sheetName = sheetNames.find(name => ["Setting", "Settings", "Config"].some(k => name.toLowerCase().includes(k.toLowerCase())));

      if (!sheetName) {
        return res.status(404).json({ error: "Settings sheet not found" });
      }

      // 2. Get the headers to know the order
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`,
      });
      const headers = response.data.values?.[0] || [];
      
      if (headers.length === 0) {
        return res.status(400).json({ error: "Settings sheet has no headers" });
      }

      // 3. Prepare the values based on headers
      const values = [headers.map(header => settingsData[header] || "")];

      // 4. Update the second row (assuming settings are in row 2)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating settings:", error.message || error);
      res.status(500).json({ error: "Failed to update settings", details: error.message || String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function getMockData() {
  return {
    bookings: [
      ["สถานะ", "วันที่จอง", "ชื่อลูกค้า", "เบอร์โทร", "ห้องที่จอง", "เช็คอิน", "เช็คเอาท์", "ยอดเงิน", "สถานะห้อง", "หลักฐาน (Slip)", "หมายเหตุ", "แหล่งที่มา", "UserID LINE", "facebookId"],
      ["โอนแล้ว", "2024-03-20", "John Doe", "0812345678", "Deluxe Suite", "2024-03-24", "2024-03-26", "5000", "จองแล้ว", "", "", "Facebook", "", ""],
      ["Pending", "2024-03-21", "Jane Smith", "0898765432", "Standard Room", "2024-03-25", "2024-03-27", "2400", "Reserved", "", "", "Line", "", ""],
      ["โอนแล้ว", "2024-03-22", "Alice Brown", "0855554444", "Villa", "2024-03-28", "2024-03-30", "12000", "Reserved", "", "", "Walk-in", "", ""],
    ],
    promos: [
      ["Promo Name", "Discount", "CODE", "Start Date", "End Date", "Status"],
      ["Summer Sale", "20%", "SUMMER20", "2024-03-01", "2024-05-31", "Active"],
      ["Early Bird", "15%", "EARLY15", "2024-01-01", "2024-12-31", "Active"],
    ],
    rooms: [
      ["Room_ID", "Room_Name", "Description", "Amenities", "Price_Per_Night", "Status", "Image_URL", "People"],
      ["R01", "เอล เอสเปรันซ่า - ริมโขง วอเตอร์ฟร้อนท์", "สัมผัสบรรยากาศความงามที่เงียบสงบของแม่น้ำโขงจากระเบียงส่วนตัว ห้องพักได้รับการออกแบบด้วยสไตล์เมดิเตอร์เรเนียนอันหรูหรา", "แอร์, เครื่องทำน้ำอุ่น, ชุดกาแฟดริปท้องถิ่น, Wi-Fi, อาหารเช้า", "1,800", "Available", "https://drive.google.com/uc?export=view&id=1v_O9TXxTMg0JHK8stw2ycTdB4eqixAqs", "2-3 คน"],
      ["R02", "กอดภูพาราไดซ์ - เทือกเขาความเงียบสงบ", "บ้านพักหินสไตล์คันทรี่โรแมนติกกลางขุนเขาและม่านหมอก ด้วยดีไซน์ที่เน้นความกลมกลืนกับธรรมชาติ", "แอร์, เครื่องทำน้ำอุ่น, ระเบียงชมดาวส่วนตัว, Wi-Fi, อาหารเช้า", "1,500", "Available", "https://picsum.photos/seed/room2/800/600", "2-3 คน"],
      ["R03", "คริสตัลฮิลล์ - โมเดิร์นซาลอนกลางหุบเขา", "โดดเด่นด้วยงานสถาปัตยกรรมร่วมสมัยที่เน้นการเปิดรับทัศนียภาพอันตระการตาของหุบเขา ภายในตกแต่งอย่างประณีต", "แอร์, เครื่องทำน้ำอุ่น, โต๊ะทำงานริมหน้าต่าง, Wi-Fi, อาหารเช้า", "1,300", "Available", "https://picsum.photos/seed/room3/800/600", "2-3 คน"],
    ],
    settings: [
      ["Homestay_Name", "Homestay_Suffix", "Hero_Slogan_Top", "Hero_Description", "Contact_Phone", "Contact_Email", "Contact_Line_ID", "Contact_Facebook_URL", "Contact_Address", "Bank_Name", "Bank_Account_No", "Bank_Account_Name", "PromptPay_ID", "Theme_Preset", "Font_Style"],
      ["Loei", "HomeStay", "สัมผัสศิลปะแห่งการใช้ชีวิตที่เรียบง่ายท่ามกลางทะเลหมอก", "หลีกหนีความวุ่นวาย มาสัมผัสอากาศบริสุทธิ์และวิถีชีวิตที่เรียบง่าย ณ จังหวัดเลย", "0824931531", "koporikkung@gmail.com", "koporik", "https://facebook.com/loei", "อ.ภูเรือ จ.เลย", "กสิกรไทย", "0713690716", "อิสยาห์ ดีตรุษ", "0824931531", "Forest", "Elegant"],
    ]
  };
}

startServer();
