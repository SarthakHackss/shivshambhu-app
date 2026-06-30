import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fileUpload from "express-fileupload";
import { exec } from "child_process";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());

// --- SUPABASE STORAGE BACKUP CONFIGURATION ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const bucketName = "database-bucket";

// Auto-create bucket if not exists
async function createBucketIfNotExist() {
  if (!supabaseUrl || !supabaseKey) return;
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: bucketName,
        name: bucketName,
        public: false
      })
    });
    if (res.ok) {
      console.log(`[Backup] Created private storage bucket: ${bucketName}`);
    }
  } catch (err) {
    // Fail silently if bucket already exists
  }
}

// Download database backup on startup
async function downloadDatabase(dbPath) {
  if (!supabaseUrl || !supabaseKey) return;
  await createBucketIfNotExist();
  console.log("[Backup] Checking for database backup on Supabase...");
  try {
    const url = `${supabaseUrl}/storage/v1/object/authenticated/${bucketName}/database.sqlite`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey
      }
    });

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(dbPath, Buffer.from(buffer));
      console.log("[Backup] Successfully downloaded database backup from Supabase!");
    } else {
      console.log("[Backup] No backup found on Supabase. Using local database.");
    }
  } catch (err) {
    console.error("[Backup] Download backup failed:", err.message);
  }
}

// Upload database backup (debounced)
let backupTimeout = null;
function triggerBackup(dbPath) {
  if (!supabaseUrl || !supabaseKey) return;
  if (backupTimeout) clearTimeout(backupTimeout);
  backupTimeout = setTimeout(() => {
    console.log("[Backup] Uploading database backup to Supabase Storage...");
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      const url = `${supabaseUrl}/storage/v1/object/${bucketName}/database.sqlite`;
      
      fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          "Content-Type": "application/octet-stream"
        },
        body: fileBuffer
      }).then(res => {
        if (res.ok) {
          console.log("[Backup] Database backup uploaded successfully!");
        } else {
          res.text().then(errMsg => {
            console.error("[Backup] Failed to upload database backup:", errMsg);
          });
        }
      }).catch(err => {
        console.error("[Backup] Backup upload fetch error:", err.message);
      });
    } catch (err) {
      console.error("[Backup] Backup file read error:", err.message);
    }
  }, 5000); // 5s debounce
}

// Connect to SQLite Database
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "database.sqlite");

// Auto-seed database from app bundle if volume path is empty
if (process.env.DATABASE_PATH && !fs.existsSync(dbPath)) {
  console.log(`[Database] Database file not found at: ${dbPath}. Seeding with default data...`);
  try {
    const defaultDbPath = path.join(__dirname, "database.sqlite");
    if (fs.existsSync(defaultDbPath)) {
      const targetDir = path.dirname(dbPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(defaultDbPath, dbPath);
      console.log(`[Database] Seed successful! Database file copied to: ${dbPath}`);
    } else {
      console.warn(`[Database] Default seed database not found at: ${defaultDbPath}`);
    }
  } catch (copyErr) {
    console.error(`[Database] Seeding failed:`, copyErr.message);
  }
}

// Download Supabase backup first on startup
if (supabaseUrl && supabaseKey) {
  await downloadDatabase(dbPath);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database at:", dbPath);
  }
});

// Helper wrapper to run database queries with Promises
const dbQuery = {
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else {
          triggerBackup(dbPath);
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  },
};

// --- API ENDPOINTS ---

// 1. Dashboard Statistics
app.get("/api/dashboard", async (req, res) => {
  try {
    // Basic sums
    const supplyStats = await dbQuery.get(
      "SELECT SUM(total_amount) as total_revenue, SUM(tankers_supplied) as total_tankers, COUNT(DISTINCT date) as days_operated FROM daily_supply"
    );
    const expenseStats = await dbQuery.get(
      "SELECT SUM(amount) as total_expenses FROM expenses"
    );

    const totalRevenue = supplyStats.total_revenue || 0;
    const totalExpenses = expenseStats.total_expenses || 0;
    const netProfit = totalRevenue - totalExpenses;
    const profitPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const totalTankers = supplyStats.total_tankers || 0;
    const daysOperated = supplyStats.days_operated || 0;

    // Monthly trends (last 12 months)
    // We union the months from daily_supply and expenses to ensure we have all months represented
    const monthlySupply = await dbQuery.all(`
      SELECT strftime('%Y-%m', date) as month, SUM(total_amount) as revenue, SUM(tankers_supplied) as tankers 
      FROM daily_supply 
      GROUP BY month
    `);
    const monthlyExpenses = await dbQuery.all(`
      SELECT strftime('%Y-%m', date) as month, SUM(amount) as expenses 
      FROM expenses 
      GROUP BY month
    `);

    // Merge monthly data
    const monthMap = {};
    monthlySupply.forEach((m) => {
      monthMap[m.month] = { month: m.month, revenue: m.revenue || 0, expenses: 0, tankers: m.tankers || 0 };
    });
    monthlyExpenses.forEach((m) => {
      if (monthMap[m.month]) {
        monthMap[m.month].expenses = m.expenses || 0;
      } else {
        monthMap[m.month] = { month: m.month, revenue: 0, expenses: m.expenses || 0, tankers: 0 };
      }
    });

    const monthlyTrends = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Expense Breakdown
    const expenseBreakdown = await dbQuery.all(
      "SELECT category, SUM(amount) as total FROM expenses GROUP BY category ORDER BY total DESC"
    );

    // Top Clients
    const topClients = await dbQuery.all(`
      SELECT c.name as name, SUM(s.total_amount) as revenue, SUM(s.tankers_supplied) as tankers 
      FROM daily_supply s 
      JOIN clients c ON s.client_id = c.id 
      GROUP BY s.client_id 
      ORDER BY revenue DESC 
      LIMIT 5
    `);

    res.json({
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitPercentage,
        totalTankers,
        daysOperated,
      },
      monthlyTrends,
      expenseBreakdown,
      topClients,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Clients Routes
app.get("/api/clients", async (req, res) => {
  try {
    const clients = await dbQuery.all(`
      SELECT 
        c.id, 
        c.name, 
        c.location, 
        c.rate_per_tanker, 
        COUNT(s.id) as total_trips, 
        SUM(s.tankers_supplied) as total_tankers, 
        SUM(s.total_amount) as total_revenue, 
        SUM(CASE WHEN s.payment_status = 'UNPAID' THEN s.total_amount ELSE 0 END) as outstanding_balance
      FROM clients c 
      LEFT JOIN daily_supply s ON c.id = s.client_id 
      GROUP BY c.id 
      ORDER BY c.name ASC
    `);
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/clients", async (req, res) => {
  const { name, location, rate_per_tanker } = req.body;
  if (!name) return res.status(400).json({ error: "Client name is required" });

  try {
    const result = await dbQuery.run(
      "INSERT INTO clients (name, location, rate_per_tanker) VALUES (?, ?, ?)",
      [name, location || "", rate_per_tanker || 0]
    );
    const newClient = await dbQuery.get("SELECT * FROM clients WHERE id = ?", [result.id]);
    res.status(201).json(newClient);
  } catch (error) {
    if (error.message.includes("UNIQUE")) {
      res.status(400).json({ error: "A client with this name already exists" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.put("/api/clients/:id", async (req, res) => {
  const { name, location, rate_per_tanker } = req.body;
  const { id } = req.params;
  if (!name) return res.status(400).json({ error: "Client name is required" });

  try {
    await dbQuery.run(
      "UPDATE clients SET name = ?, location = ?, rate_per_tanker = ? WHERE id = ?",
      [name, location || "", rate_per_tanker || 0, id]
    );
    const updatedClient = await dbQuery.get("SELECT * FROM clients WHERE id = ?", [id]);
    res.json(updatedClient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/clients/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Check if client has supplies
    const supplyCheck = await dbQuery.get("SELECT COUNT(*) as count FROM daily_supply WHERE client_id = ?", [id]);
    if (supplyCheck.count > 0) {
      return res.status(400).json({
        error: "Cannot delete client. This client has daily supply logs attached to it.",
      });
    }
    await dbQuery.run("DELETE FROM clients WHERE id = ?", [id]);
    res.json({ message: "Client deleted successfully", id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Daily Supply Routes
app.get("/api/supply", async (req, res) => {
  try {
    const supply = await dbQuery.all(`
      SELECT 
        s.id, 
        s.date, 
        s.client_id, 
        c.name as client_name, 
        s.location, 
        s.tankers_supplied, 
        s.rate_per_tanker, 
        s.total_amount, 
        s.description, 
        s.payment_status 
      FROM daily_supply s 
      JOIN clients c ON s.client_id = c.id 
      ORDER BY s.date DESC, s.id DESC
    `);
    res.json(supply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/supply", async (req, res) => {
  const { date, client_id, location, tankers_supplied, rate_per_tanker, description, payment_status } = req.body;
  if (!date || !client_id || !tankers_supplied) {
    return res.status(400).json({ error: "Date, client, and tankers supplied are required" });
  }

  const rate = rate_per_tanker || 0;
  const tankers = tankers_supplied || 0;
  const total = rate * tankers;

  try {
    const result = await dbQuery.run(
      "INSERT INTO daily_supply (date, client_id, location, tankers_supplied, rate_per_tanker, total_amount, description, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [date, client_id, location || "", tankers, rate, total, description || "", payment_status || "UNPAID"]
    );
    const newSupply = await dbQuery.get(`
      SELECT s.*, c.name as client_name 
      FROM daily_supply s 
      JOIN clients c ON s.client_id = c.id 
      WHERE s.id = ?
    `, [result.id]);
    res.status(201).json(newSupply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/supply/:id", async (req, res) => {
  const { date, client_id, location, tankers_supplied, rate_per_tanker, description, payment_status } = req.body;
  const { id } = req.params;

  if (!date || !client_id || !tankers_supplied) {
    return res.status(400).json({ error: "Date, client, and tankers supplied are required" });
  }

  const rate = rate_per_tanker || 0;
  const tankers = tankers_supplied || 0;
  const total = rate * tankers;

  try {
    await dbQuery.run(
      "UPDATE daily_supply SET date = ?, client_id = ?, location = ?, tankers_supplied = ?, rate_per_tanker = ?, total_amount = ?, description = ?, payment_status = ? WHERE id = ?",
      [date, client_id, location || "", tankers, rate, total, description || "", payment_status || "UNPAID", id]
    );
    const updatedSupply = await dbQuery.get(`
      SELECT s.*, c.name as client_name 
      FROM daily_supply s 
      JOIN clients c ON s.client_id = c.id 
      WHERE s.id = ?
    `, [id]);
    res.json(updatedSupply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/supply/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await dbQuery.run("DELETE FROM daily_supply WHERE id = ?", [id]);
    res.json({ message: "Supply record deleted successfully", id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Expenses Routes
app.get("/api/expenses", async (req, res) => {
  try {
    const expenses = await dbQuery.all("SELECT id, date, category, amount, description FROM expenses ORDER BY date DESC, id DESC");
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/expenses", async (req, res) => {
  const { date, category, amount, description } = req.body;
  if (!date || !category || !amount) {
    return res.status(400).json({ error: "Date, category, and amount are required" });
  }

  try {
    const result = await dbQuery.run(
      "INSERT INTO expenses (date, category, amount, description) VALUES (?, ?, ?, ?)",
      [date, category, amount, description || ""]
    );
    const newExpense = await dbQuery.get("SELECT * FROM expenses WHERE id = ?", [result.id]);
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/expenses/:id", async (req, res) => {
  const { date, category, amount, description } = req.body;
  const { id } = req.params;

  if (!date || !category || !amount) {
    return res.status(400).json({ error: "Date, category, and amount are required" });
  }

  try {
    await dbQuery.run(
      "UPDATE expenses SET date = ?, category = ?, amount = ?, description = ? WHERE id = ?",
      [date, category, amount, description || "", id]
    );
    const updatedExpense = await dbQuery.get("SELECT * FROM expenses WHERE id = ?", [id]);
    res.json(updatedExpense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await dbQuery.run("DELETE FROM expenses WHERE id = ?", [id]);
    res.json({ message: "Expense record deleted successfully", id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Billing Route (Auto Bill Generation)
app.get("/api/billing", async (req, res) => {
  const { client_id, client_name, start_date, end_date } = req.query;

  if ((!client_id && !client_name) || !start_date || !end_date) {
    return res.status(400).json({ error: "client_id or client_name, and start_date, and end_date are required parameters" });
  }

  try {
    let clientsMatched = [];
    let isCombined = false;
    let queryName = "";

    if (client_id) {
      const client = await dbQuery.get("SELECT * FROM clients WHERE id = ?", [client_id]);
      if (client) {
        clientsMatched.push(client);
      }
    } else {
      queryName = client_name.trim();
      // Try exact match first
      const exactClient = await dbQuery.get("SELECT * FROM clients WHERE LOWER(name) = LOWER(?)", [queryName]);
      if (exactClient) {
        clientsMatched.push(exactClient);
      } else {
        // Try substring matching (e.g. for combined bills like AAKSHYA INFRAPROJECTS PVT LTD)
        let cleanName = queryName.toLowerCase();
        // Remove common suffixes to match better
        cleanName = cleanName.replace(/\s+pvt\.?\s*ltd\.?/g, "").replace(/\s+ltd\.?/g, "").trim();

        if (cleanName.length > 0) {
          const matched = await dbQuery.all(
            "SELECT * FROM clients WHERE LOWER(name) LIKE ? OR LOWER(name) LIKE ?",
            [`${cleanName}%`, `%${cleanName}%`]
          );
          clientsMatched = matched;
          if (clientsMatched.length > 1) {
            isCombined = true;
          }
        }
      }
    }

    if (clientsMatched.length === 0) {
      if (client_name) {
        return res.json({
          client: { id: 0, name: client_name, location: "", rate_per_tanker: 0 },
          startDate: start_date,
          endDate: end_date,
          items: [],
          summary: {
            totalTankers: 0,
            totalAmount: 0,
          },
        });
      }
      return res.status(404).json({ error: "Client not found" });
    }

    const clientIds = clientsMatched.map((c) => c.id);
    const placeholders = clientIds.map(() => "?").join(",");

    const items = await dbQuery.all(
      `SELECT s.id, s.date, s.location, s.tankers_supplied, s.rate_per_tanker, s.total_amount, s.description, s.payment_status, c.name as client_name 
       FROM daily_supply s 
       JOIN clients c ON s.client_id = c.id 
       WHERE s.client_id IN (${placeholders}) AND s.date >= ? AND s.date <= ? 
       ORDER BY s.date ASC, s.id ASC`,
      [...clientIds, start_date, end_date]
    );

    const totalTankers = items.reduce((sum, item) => sum + item.tankers_supplied, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.total_amount, 0);

    // Create client header profile
    let clientProfile;
    if (isCombined) {
      clientProfile = {
        id: 0,
        name: queryName.toUpperCase(),
        location: "MULTIPLE LOCATIONS",
        rate_per_tanker: 0,
        isCombined: true
      };
    } else {
      clientProfile = {
        ...clientsMatched[0],
        isCombined: false
      };
    }

    res.json({
      client: clientProfile,
      startDate: start_date,
      endDate: end_date,
      items,
      summary: {
        totalTankers,
        totalAmount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Excel Upload & Import Route
app.post("/api/import-excel", async (req, res) => {
  if (!req.files || !req.files.excelFile) {
    return res.status(400).json({ error: "No Excel file was uploaded." });
  }

  const excelFile = req.files.excelFile;
  const tempPath = path.join(__dirname, "temp_import.xlsx");

  excelFile.mv(tempPath, (err) => {
    if (err) {
      console.error("File move error:", err);
      return res.status(500).json({ error: "Failed to process uploaded file." });
    }

    // Detect if we should use python or python3 (Windows local uses python, non-Windows Linux/Docker uses python3)
    const pythonBin = process.platform === "win32" ? "python" : "python3";
    const pythonCmd = `${pythonBin} "${path.join(__dirname, "import_excel.py")}" "${tempPath}"`;
    console.log("Running command:", pythonCmd);

    exec(pythonCmd, (execErr, stdout, stderr) => {
      // Always cleanup the temp file
      fs.unlink(tempPath, (unlinkErr) => {
        if (unlinkErr) console.error("Temp file cleanup error:", unlinkErr);
      });

      if (execErr) {
        console.error("Python exec error:", execErr);
        console.error("Stderr:", stderr);
        const detailedError = (stderr || "").trim() || execErr.message;
        return res.status(500).json({ 
          error: `Failed to parse Excel sheet. Details: ${detailedError}` 
        });
      }

      console.log("Python stdout:", stdout);
      res.json({ success: true, message: "Data imported successfully!" });
    });
  });
});

// Serve Static Assets in Production
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// --- AUTOMATIC EXCEL FILE WATCHER (OneDrive Sync) ---
// Disabled: App is now transitioning to web-only data entry.
console.log("[Watcher] Local Excel file watcher is disabled.");

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
