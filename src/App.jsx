import React, { useState, useEffect } from "react";
import {
  Droplet,
  LayoutDashboard,
  Truck,
  Receipt,
  Users,
  Plus,
  Search,
  FileText,
  Edit2,
  Trash2,
  Printer,
  X,
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  ChevronRight,
  Check,
  AlertCircle,
  Upload
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardData, setDashboardData] = useState(null);
  const [clients, setClients] = useState([]);
  const [supplyLogs, setSupplyLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);

  // Search & Filter States
  const [supplySearch, setSupplySearch] = useState("");
  const [supplyFilterClient, setSupplyFilterClient] = useState("");
  const [supplyFilterPayment, setSupplyFilterPayment] = useState("");
  
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseFilterCategory, setExpenseFilterCategory] = useState("");

  const [clientSearch, setClientSearch] = useState("");

  // Modal States
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({ name: "", location: "", rate_per_tanker: "" });

  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [editingSupply, setEditingSupply] = useState(null);
  const [supplyForm, setSupplyForm] = useState({
    date: new Date().toISOString().split("T")[0],
    client_id: "",
    location: "",
    tankers_supplied: "",
    rate_per_tanker: "",
    description: "",
    payment_status: "UNPAID"
  });

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "",
    amount: "",
    description: ""
  });

  // Auto Bill / Invoice States
  const [billClientName, setBillClientName] = useState("");
  const [billStartDate, setBillStartDate] = useState("");
  const [billEndDate, setBillEndDate] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [billRecipient, setBillRecipient] = useState("गटविकास अधिकारी,\nपंचायत समिती , मुरुड");
  const [billSubject, setBillSubject] = useState("विषय - कोर्लई ख्रिस्ती समाज विहीर येथे पिण्याचे पाण्याचे बिल");
  const [billBody, setBillBody] = useState(
    "महाशय,\nवरील संदर्भीय विषयास अनुसरून आपणास सविनय निवेदन आहे की, आपल्या पंचायत समितीच्या आदेशानुसार व सूचनेनुसार टंचाईग्रस्त भागात/गावात (कोर्लई ख्रिस्ती पाडा) नागरिकांसाठी टँकरद्वारे सलग ६ दिवस पिण्याच्या पाण्याचा पुरवठा करण्यात आला आहे.\nसदर पाणीपुरवठ्याच्या बिलाचा तपशील खालीलप्रमाणे आहे:"
  );
  const [billSignatory, setBillSignatory] = useState("Bhagirath Patil");
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, clientsRes, supplyRes, expRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/clients"),
        fetch("/api/supply"),
        fetch("/api/expenses")
      ]);

      if (!dashRes.ok || !clientsRes.ok || !supplyRes.ok || !expRes.ok) {
        throw new Error("Failed to fetch data from the server");
      }

      const dashData = await dashRes.json();
      const clientsData = await clientsRes.json();
      const supplyData = await supplyRes.json();
      const expData = await expRes.json();

      setDashboardData(dashData);
      setClients(clientsData);
      setSupplyLogs(supplyData);
      setExpenses(expData);
      
      // Auto-set billing defaults
      if (clientsData.length > 0 && !billClientName) {
        setBillClientName(clientsData[0].name);
        // Default to last 30 days
        const end = new Date().toISOString().split("T")[0];
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        setBillStartDate(start);
        setBillEndDate(end);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("excelFile", file);

    setImporting(true);
    try {
      const res = await fetch("/api/import-excel", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to import Excel sheet");
      }

      alert("Data imported successfully! All records have been updated.");
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
      e.target.value = null;
    }
  };

  // Format Currency (Indian Rupees)
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Handle Client Submissions
  const handleClientSubmit = async (e) => {
    e.preventDefault();
    if (!clientForm.name) return;

    try {
      const url = editingClient ? `/api/clients/${editingClient.id}` : "/api/clients";
      const method = editingClient ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clientForm.name,
          location: clientForm.location,
          rate_per_tanker: parseFloat(clientForm.rate_per_tanker) || 0
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save client");
      }

      setShowClientModal(false);
      setEditingClient(null);
      setClientForm({ name: "", location: "", rate_per_tanker: "" });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete Client
  const handleDeleteClient = async (id) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete client");
      }
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Client Form Edit Load
  const startEditClient = (client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      location: client.location || "",
      rate_per_tanker: client.rate_per_tanker || ""
    });
    setShowClientModal(true);
  };

  // Handle Supply Submissions
  const handleSupplySubmit = async (e) => {
    e.preventDefault();
    if (!supplyForm.date || !supplyForm.client_id || !supplyForm.tankers_supplied) return;

    try {
      const url = editingSupply ? `/api/supply/${editingSupply.id}` : "/api/supply";
      const method = editingSupply ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: supplyForm.date,
          client_id: parseInt(supplyForm.client_id),
          location: supplyForm.location,
          tankers_supplied: parseInt(supplyForm.tankers_supplied),
          rate_per_tanker: parseFloat(supplyForm.rate_per_tanker) || 0,
          description: supplyForm.description,
          payment_status: supplyForm.payment_status
        })
      });

      if (!res.ok) throw new Error("Failed to save supply entry");

      setShowSupplyModal(false);
      setEditingSupply(null);
      setSupplyForm({
        date: new Date().toISOString().split("T")[0],
        client_id: "",
        location: "",
        tankers_supplied: "",
        rate_per_tanker: "",
        description: "",
        payment_status: "UNPAID"
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete Supply Log
  const handleDeleteSupply = async (id) => {
    if (!confirm("Are you sure you want to delete this supply entry?")) return;
    try {
      const res = await fetch(`/api/supply/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete supply record");
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Supply Form Edit Load
  const startEditSupply = (log) => {
    setEditingSupply(log);
    setSupplyForm({
      date: log.date,
      client_id: log.client_id.toString(),
      location: log.location || "",
      tankers_supplied: log.tankers_supplied.toString(),
      rate_per_tanker: log.rate_per_tanker.toString(),
      description: log.description || "",
      payment_status: log.payment_status || "UNPAID"
    });
    setShowSupplyModal(true);
  };

  // Auto-fill rate and location when client is chosen
  const handleSupplyClientChange = (clientId) => {
    const client = clients.find(c => c.id === parseInt(clientId));
    if (client) {
      setSupplyForm(prev => ({
        ...prev,
        client_id: clientId,
        location: client.location || "",
        rate_per_tanker: client.rate_per_tanker ? client.rate_per_tanker.toString() : ""
      }));
    } else {
      setSupplyForm(prev => ({ ...prev, client_id: clientId }));
    }
  };

  // Quick Payment status toggle
  const togglePaymentStatus = async (log) => {
    const nextStatus = log.payment_status === "PAID" ? "UNPAID" : "PAID";
    try {
      const res = await fetch(`/api/supply/${log.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...log,
          payment_status: nextStatus
        })
      });
      if (!res.ok) throw new Error("Failed to update status");
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Expense Submissions
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.date || !expenseForm.category || !expenseForm.amount) return;

    try {
      const url = editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses";
      const method = editingExpense ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: expenseForm.date,
          category: expenseForm.category,
          amount: parseFloat(expenseForm.amount),
          description: expenseForm.description
        })
      });

      if (!res.ok) throw new Error("Failed to save expense");

      setShowExpenseModal(false);
      setEditingExpense(null);
      setExpenseForm({
        date: new Date().toISOString().split("T")[0],
        category: "",
        amount: "",
        description: ""
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Expense Form Edit Load
  const startEditExpense = (exp) => {
    setEditingExpense(exp);
    setExpenseForm({
      date: exp.date,
      category: exp.category,
      amount: exp.amount.toString(),
      description: exp.description || ""
    });
    setShowExpenseModal(true);
  };

  // Generate Invoice
  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    if (!billClientName || !billStartDate || !billEndDate) return;

    setGeneratingInvoice(true);
    try {
      const res = await fetch(
        `/api/billing?client_name=${encodeURIComponent(billClientName)}&start_date=${billStartDate}&end_date=${billEndDate}`
      );
      if (!res.ok) throw new Error("Failed to fetch billing data");
      const data = await res.json();
      setInvoiceData(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Print Invoice trigger
  const handlePrintInvoice = () => {
    window.print();
  };

  // Filters
  const filteredSupplies = supplyLogs.filter((log) => {
    const matchSearch =
      log.client_name.toLowerCase().includes(supplySearch.toLowerCase()) ||
      (log.location && log.location.toLowerCase().includes(supplySearch.toLowerCase())) ||
      (log.description && log.description.toLowerCase().includes(supplySearch.toLowerCase()));
    const matchClient = supplyFilterClient ? log.client_id === parseInt(supplyFilterClient) : true;
    const matchPayment = supplyFilterPayment ? log.payment_status === supplyFilterPayment : true;
    return matchSearch && matchClient && matchPayment;
  });

  const filteredExpenses = expenses.filter((exp) => {
    const matchSearch =
      exp.category.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      (exp.description && exp.description.toLowerCase().includes(expenseSearch.toLowerCase()));
    const matchCategory = expenseFilterCategory ? exp.category === expenseFilterCategory : true;
    return matchSearch && matchCategory;
  });

  const filteredClients = clients.filter((c) => {
    return (
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.location && c.location.toLowerCase().includes(clientSearch.toLowerCase()))
    );
  });

  // Extract list of unique expense categories for filter dropdown
  const uniqueCategories = [...new Set(expenses.map(e => e.category))];

  if (loading && !dashboardData) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
        <Droplet size={48} className="sidebar-logo" style={{ color: "#06b6d4" }} />
        <h2 style={{ fontWeight: 600, color: "#94a3b8" }}>Loading Shivshambhu Tracker...</h2>
      </div>
    );
  }

  return (
    <div className="app-container">
      {importing && (
        <div className="modal-overlay" style={{ flexDirection: "column", gap: "1.5rem" }}>
          <div className="sidebar-logo" style={{ fontSize: "3rem", animation: "float 2s ease-in-out infinite" }}>💧</div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Importing Excel Data</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Parsing sheets and updating database, please wait...</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Droplet className="sidebar-logo" />
          <div>
            <h1 className="sidebar-title">Shivshambhu</h1>
            <div className="sidebar-subtitle">Jalapuravtha</div>
          </div>
        </div>

        <nav>
          <ul className="sidebar-menu">
            <li
              className={`menu-item ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </li>
            <li
              className={`menu-item ${activeTab === "supply" ? "active" : ""}`}
              onClick={() => setActiveTab("supply")}
            >
              <Truck size={20} />
              Daily Supply
            </li>
            <li
              className={`menu-item ${activeTab === "expenses" ? "active" : ""}`}
              onClick={() => setActiveTab("expenses")}
            >
              <Receipt size={20} />
              Expenses
            </li>
            <li
              className={`menu-item ${activeTab === "clients" ? "active" : ""}`}
              onClick={() => setActiveTab("clients")}
            >
              <Users size={20} />
              Clients List
            </li>
            <li
              className={`menu-item ${activeTab === "billing" ? "active" : ""}`}
              onClick={() => setActiveTab("billing")}
            >
              <FileText size={20} />
              Auto Bill
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label className="btn btn-secondary" style={{ width: "100%", fontSize: "0.75rem", padding: "0.5rem", borderStyle: "dashed", cursor: "pointer", display: "flex", gap: "0.4rem", justifyContent: "center", alignItems: "center" }}>
            <Upload size={14} /> Upload Excel File
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={handleExcelUpload}
            />
          </label>
          <div>
            <div>Shivshambhu App v1.0</div>
            <div style={{ fontSize: "0.65rem", marginTop: "4px" }}>Water Supply & Billing System</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {error && (
          <div className="glass" style={{ padding: "1rem 1.5rem", borderRadius: "10px", borderLeft: "4px solid var(--accent-red)", marginBottom: "2rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <AlertCircle style={{ color: "var(--accent-red)" }} />
            <div>
              <h4 style={{ fontWeight: 600 }}>Error connection failed</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{error}. Retrying automatically...</p>
            </div>
            <button className="btn btn-secondary" style={{ marginLeft: "auto", padding: "0.3rem 0.8rem", fontSize: "0.8rem" }} onClick={fetchData}>
              Retry Now
            </button>
          </div>
        )}

        {/* Dashboard View */}
        {activeTab === "dashboard" && dashboardData && (
          <>
            <header className="page-header">
              <div className="page-title">
                <h1>Business Dashboard</h1>
                <p>Welcome back! Here is a summary of Shivshambhu Jalapuravtha</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSupplyForm({
                    date: new Date().toISOString().split("T")[0],
                    client_id: clients[0]?.id.toString() || "",
                    location: clients[0]?.location || "",
                    tankers_supplied: "",
                    rate_per_tanker: clients[0]?.rate_per_tanker?.toString() || "",
                    description: "",
                    payment_status: "UNPAID"
                  });
                  setShowSupplyModal(true);
                }}
              >
                <Plus size={18} /> Add New Trip
              </button>
            </header>

            {/* KPI Stats */}
            <section className="stats-grid">
              <div className="glass kpi-card">
                <div className="kpi-header">
                  <span className="kpi-title">Total Revenue</span>
                  <div className="kpi-icon"><TrendingUp size={18} /></div>
                </div>
                <div className="kpi-value">{formatCurrency(dashboardData.summary.totalRevenue)}</div>
                <div className="kpi-subtext">Total earnings from water supply</div>
              </div>

              <div className="glass kpi-card expense">
                <div className="kpi-header">
                  <span className="kpi-title">Total Expenses</span>
                  <div className="kpi-icon" style={{ backgroundColor: "rgba(245, 158, 11, 0.05)" }}><DollarSign size={18} /></div>
                </div>
                <div className="kpi-value">{formatCurrency(dashboardData.summary.totalExpenses)}</div>
                <div className="kpi-subtext">Maintenance, diesel & helper costs</div>
              </div>

              <div className="glass kpi-card profit">
                <div className="kpi-header">
                  <span className="kpi-title">Net Profit</span>
                  <div className="kpi-icon" style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}><Check size={18} /></div>
                </div>
                <div className="kpi-value" style={{ color: "var(--accent-green)" }}>
                  {formatCurrency(dashboardData.summary.netProfit)}
                </div>
                <div className="kpi-subtext">Revenue minus business expenses</div>
              </div>

              <div className="glass kpi-card">
                <div className="kpi-header">
                  <span className="kpi-title">Profit Margin</span>
                  <div className="kpi-icon"><Layers size={18} /></div>
                </div>
                <div className="kpi-value">{dashboardData.summary.profitPercentage.toFixed(1)}%</div>
                <div className="kpi-subtext">Return rate on supply operations</div>
              </div>

              <div className="glass kpi-card">
                <div className="kpi-header">
                  <span className="kpi-title">Trips Done</span>
                  <div className="kpi-icon"><Truck size={18} /></div>
                </div>
                <div className="kpi-value">{dashboardData.summary.totalTankers} Tankers</div>
                <div className="kpi-subtext">Supplied over {dashboardData.summary.daysOperated} active days</div>
              </div>
            </section>

            {/* Charts Grid */}
            <section className="charts-grid">
              {/* Revenue vs Expenses Area Chart (SVG based) */}
              <div className="glass chart-card">
                <h3 className="chart-title">Revenue & Expenses Trend</h3>
                <div className="chart-container">
                  {dashboardData.monthlyTrends.length > 0 ? (
                    <MonthlyTrendChart trends={dashboardData.monthlyTrends} />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                      Not enough data to display trend chart
                    </div>
                  )}
                </div>
              </div>

              {/* Expense Categories breakdown */}
              <div className="glass chart-card">
                <h3 className="chart-title">Expense Breakdown</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto", maxHeight: "280px", paddingRight: "0.25rem" }}>
                  {dashboardData.expenseBreakdown.length > 0 ? (
                    (() => {
                      const totalExpenses = dashboardData.expenseBreakdown.reduce((sum, item) => sum + item.total, 0);
                      return dashboardData.expenseBreakdown.map((item, idx) => {
                        const pct = totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0;
                        return (
                          <div key={idx} style={{ fontSize: "0.85rem" }}>
                            <div style={{ display: "flex", justifyContent: "between", marginBottom: "0.25rem" }}>
                              <span style={{ fontWeight: 500 }}>{item.category}</span>
                              <span style={{ marginLeft: "auto", color: "var(--text-secondary)" }}>
                                {formatCurrency(item.total)} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div style={{ width: "100%", height: "6px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  background: `linear-gradient(90deg, var(--accent-yellow), var(--accent-red))`,
                                  borderRadius: "4px"
                                }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
                      No expenses logged yet
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Top Clients horizontal bar layout */}
            <section className="glass table-card" style={{ marginBottom: "2rem" }}>
              <h3 className="chart-title">Top Clients by Revenue</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {dashboardData.topClients.map((client, idx) => {
                  const maxRevenue = dashboardData.topClients[0]?.revenue || 1;
                  const pct = (client.revenue / maxRevenue) * 100;
                  return (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span style={{ width: "30px", fontWeight: 700, color: "var(--accent-cyan)", fontSize: "1.1rem" }}>#{idx + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "between", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                          <span style={{ fontWeight: 600 }}>{client.name}</span>
                          <span style={{ marginLeft: "auto", color: "var(--accent-cyan)", fontWeight: 600 }}>
                            {formatCurrency(client.revenue)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div style={{ flex: 1, height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, var(--accent-blue), var(--accent-cyan))",
                                borderRadius: "4px"
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: "70px", textAlign: "right" }}>
                            {client.tankers} tankers
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Daily Supply View */}
        {activeTab === "supply" && (
          <>
            <header className="page-header">
              <div className="page-title">
                <h1>Daily Supply Logs</h1>
                <p>Log and view daily water tanker supplies</p>
              </div>
              <button className="btn btn-primary" onClick={() => {
                setEditingSupply(null);
                setSupplyForm({
                  date: new Date().toISOString().split("T")[0],
                  client_id: clients[0]?.id.toString() || "",
                  location: clients[0]?.location || "",
                  tankers_supplied: "",
                  rate_per_tanker: clients[0]?.rate_per_tanker?.toString() || "",
                  description: "",
                  payment_status: "UNPAID"
                });
                setShowSupplyModal(true);
              }}>
                <Plus size={18} /> Record New Supply
              </button>
            </header>

            <section className="glass table-card">
              {/* Filters */}
              <div className="table-actions">
                <input
                  type="text"
                  placeholder="Search location, client, description..."
                  className="search-input"
                  value={supplySearch}
                  onChange={(e) => setSupplySearch(e.target.value)}
                />
                
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <select
                    className="search-input"
                    style={{ maxWidth: "180px" }}
                    value={supplyFilterClient}
                    onChange={(e) => setSupplyFilterClient(e.target.value)}
                  >
                    <option value="">All Clients</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    className="search-input"
                    style={{ maxWidth: "150px" }}
                    value={supplyFilterPayment}
                    onChange={(e) => setSupplyFilterPayment(e.target.value)}
                  >
                    <option value="">All Payments</option>
                    <option value="PAID">Paid</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Client Name</th>
                      <th>Delivery Location</th>
                      <th>Tankers</th>
                      <th>Rate</th>
                      <th>Total Amount</th>
                      <th>Description</th>
                      <th>Payment</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSupplies.length > 0 ? (
                      filteredSupplies.map((log) => (
                        <tr key={log.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{formatDate(log.date)}</td>
                          <td style={{ fontWeight: 600 }}>{log.client_name}</td>
                          <td>{log.location || <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>N/A</span>}</td>
                          <td style={{ fontWeight: 500 }}>{log.tankers_supplied}</td>
                          <td>{formatCurrency(log.rate_per_tanker)}</td>
                          <td style={{ fontWeight: 600, color: "var(--accent-cyan)" }}>{formatCurrency(log.total_amount)}</td>
                          <td>
                            <div style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.description}>
                              {log.description || <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No remarks</span>}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${log.payment_status.toLowerCase()}`}
                              style={{ cursor: "pointer" }}
                              onClick={() => togglePaymentStatus(log)}
                              title="Click to toggle payment status"
                            >
                              {log.payment_status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button className="btn-icon" style={{ marginRight: "0.5rem" }} onClick={() => startEditSupply(log)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="btn-icon delete" onClick={() => handleDeleteSupply(log.id)}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ textAlignment: "center", padding: "3rem", color: "var(--text-muted)" }}>
                          No matching supply logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Expenses View */}
        {activeTab === "expenses" && (
          <>
            <header className="page-header">
              <div className="page-title">
                <h1>Expense Tracker</h1>
                <p>Log and classify Shivshambhu business expenses</p>
              </div>
              <button className="btn btn-primary" onClick={() => {
                setEditingExpense(null);
                setExpenseForm({
                  date: new Date().toISOString().split("T")[0],
                  category: "",
                  amount: "",
                  description: ""
                });
                setShowExpenseModal(true);
              }}>
                <Plus size={18} /> Record New Expense
              </button>
            </header>

            <section className="glass table-card">
              {/* Filters */}
              <div className="table-actions">
                <input
                  type="text"
                  placeholder="Search expense description or category..."
                  className="search-input"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                />
                
                <select
                  className="search-input"
                  style={{ maxWidth: "200px" }}
                  value={expenseFilterCategory}
                  onChange={(e) => setExpenseFilterCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Description</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.length > 0 ? (
                      filteredExpenses.map((exp) => (
                        <tr key={exp.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{formatDate(exp.date)}</td>
                          <td>
                            <span style={{ padding: "0.25rem 0.5rem", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 600, color: "var(--accent-yellow)", textTransform: "uppercase" }}>
                              {exp.category}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: "var(--accent-yellow)" }}>{formatCurrency(exp.amount)}</td>
                          <td>{exp.description || <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>N/A</span>}</td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn-icon" style={{ marginRight: "0.5rem" }} onClick={() => startEditExpense(exp)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="btn-icon delete" onClick={() => handleDeleteExpense(exp.id)}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlignment: "center", padding: "3rem", color: "var(--text-muted)" }}>
                          No matching expense logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Clients Directory View */}
        {activeTab === "clients" && (
          <>
            <header className="page-header">
              <div className="page-title">
                <h1>Clients Directory</h1>
                <p>Manage client information, tanker rates, and account summaries</p>
              </div>
              <button className="btn btn-primary" onClick={() => {
                setEditingClient(null);
                setClientForm({ name: "", location: "", rate_per_tanker: "" });
                setShowClientModal(true);
              }}>
                <Plus size={18} /> Create Client Account
              </button>
            </header>

            <section className="glass table-card">
              <div className="table-actions">
                <input
                  type="text"
                  placeholder="Search client directory..."
                  className="search-input"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Default Delivery Location</th>
                      <th>Default Rate</th>
                      <th>Total Trips</th>
                      <th>Total Tankers</th>
                      <th>Total Revenue</th>
                      <th>Outstanding Balance</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <tr key={client.id}>
                          <td style={{ fontWeight: 700 }}>{client.name}</td>
                          <td>{client.location || <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>N/A</span>}</td>
                          <td>{formatCurrency(client.rate_per_tanker)}</td>
                          <td>{client.total_trips || 0} trips</td>
                          <td>{client.total_tankers || 0}</td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(client.total_revenue || 0)}</td>
                          <td style={{ fontWeight: 600, color: (client.outstanding_balance || 0) > 0 ? "var(--accent-red)" : "var(--accent-green)" }}>
                            {formatCurrency(client.outstanding_balance || 0)}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn-icon" style={{ marginRight: "0.5rem" }} onClick={() => startEditClient(client)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="btn-icon delete" onClick={() => handleDeleteClient(client.id)}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" style={{ textAlignment: "center", padding: "3rem", color: "var(--text-muted)" }}>
                          No clients found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Auto Bill View */}
        {activeTab === "billing" && (
          <>
            <header className="page-header">
              <div className="page-title">
                <h1>Auto Bill Generator</h1>
                <p>Select client and date range to automatically compile delivery statements and export bills</p>
              </div>
            </header>

            <div className="invoice-creator-layout">
              {/* Sidebar controls */}
              <div className="glass" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Billing Controls</h3>
                <form onSubmit={handleGenerateInvoice}>
                  <div className="form-group">
                    <label className="form-label">Client Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={billClientName}
                      onChange={(e) => setBillClientName(e.target.value)}
                      placeholder="Type or select client name..."
                      list="billing-clients-list"
                      required
                    />
                    <datalist id="billing-clients-list">
                      {clients.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Billing Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={billStartDate}
                      onChange={(e) => setBillStartDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Billing End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={billEndDate}
                      onChange={(e) => setBillEndDate(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }} disabled={generatingInvoice}>
                    {generatingInvoice ? "Aggregating logs..." : "Generate Statement"}
                  </button>
                </form>
              </div>

              {/* Bill/Statement Sheet */}
              <div>
                {invoiceData ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                      <button className="btn btn-secondary" onClick={handlePrintInvoice}>
                        <Printer size={16} /> Print or Save as PDF
                      </button>
                    </div>

                    {/* Printable Invoice Page */}
                    <div className="invoice-preview-card" style={{ padding: "2rem", background: "#fff", color: "#000", fontFamily: "Arial, Helvetica, sans-serif" }}>
                      <div className="invoice-header-img" style={{ marginBottom: "0.25rem" }}>
                        <img src="/header_logo.png" alt="Shivshambhu Jalapuravtha" style={{ width: "100%", height: "auto", display: "block" }} />
                      </div>
                      
                      <hr style={{ border: "none", borderTop: "3.5px solid #000", margin: "0.25rem 0 1rem 0" }} />

                      {/* Main Details Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "0.3rem", margin: "1rem 0 0.5rem", fontSize: "0.9rem", color: "#000" }}>
                        <div>Client Name :</div>
                        <div style={{ fontWeight: "bold" }}>{invoiceData.client.name}</div>
                        
                        <div>Start Date :</div>
                        <div style={{ fontWeight: "bold" }}>{formatDateDDMMMYY(invoiceData.startDate)}</div>
                        
                        <div>End Date :</div>
                        <div style={{ fontWeight: "bold" }}>{formatDateDDMMMYY(invoiceData.endDate)}</div>
                      </div>

                      {/* Total Tankers Supplied Row */}
                      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "0.3rem", margin: "0.5rem 0", fontSize: "0.9rem", color: "#000", fontWeight: "bold" }}>
                        <div>TOTAL TANKERS SUPPLIED</div>
                        <div>{invoiceData.summary.totalTankers}</div>
                      </div>

                      {/* Total Amount Due Box */}
                      <div style={{ border: "2px solid #000", display: "grid", gridTemplateColumns: "220px 1fr", padding: "0.4rem 0.6rem", fontWeight: "bold", fontSize: "0.95rem", color: "#000", alignItems: "center", marginBottom: "1.5rem" }}>
                        <span>TOTAL AMOUNT DUE</span>
                        <span>{invoiceData.summary.totalAmount}</span>
                      </div>

                      {/* Table */}
                      <table className="invoice-table" style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", border: "1px solid #000", fontSize: "0.76rem", color: "#000", fontFamily: "Arial, Helvetica, sans-serif" }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid #000" }}>
                            <th style={{ border: "1px solid #000", padding: "0.4rem 0.2rem", textAlign: "center", fontWeight: "bold", width: "12%" }}>DATE</th>
                            <th style={{ border: "1px solid #000", padding: "0.4rem 0.4rem", textAlign: "center", fontWeight: "bold", width: "36%" }}>COMPANY</th>
                            <th style={{ border: "1px solid #000", padding: "0.4rem 0.4rem", textAlign: "center", fontWeight: "bold", width: "22%" }}>LOCATION</th>
                            <th style={{ border: "1px solid #000", padding: "0.4rem 0.2rem", textAlign: "center", fontWeight: "bold", width: "10%", lineHeight: "1.1" }}>NO OF<br />TANKERS</th>
                            <th style={{ border: "1px solid #000", padding: "0.4rem 0.2rem", textAlign: "center", fontWeight: "bold", width: "8%" }}>RATE</th>
                            <th style={{ border: "1px solid #000", padding: "0.4rem 0.2rem", textAlign: "center", fontWeight: "bold", width: "12%", lineHeight: "1.1" }}>TOTAL<br />AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceData.items.map((item) => (
                            <tr key={item.id}>
                              <td style={{ border: "1px solid #000", padding: "0.35rem 0.3rem", textAlign: "center", whiteSpace: "nowrap" }}>{formatDateDMMMYY(item.date)}</td>
                              <td style={{ border: "1px solid #000", padding: "0.35rem 0.4rem", textAlign: "left", wordBreak: "break-word", lineHeight: "1.25" }}>{item.client_name || invoiceData.client.name}</td>
                              <td style={{ border: "1px solid #000", padding: "0.35rem 0.4rem", textAlign: "left", wordBreak: "break-word", lineHeight: "1.25" }}>{item.location || invoiceData.client.location || "N/A"}</td>
                              <td style={{ border: "1px solid #000", padding: "0.35rem 0.3rem", textAlign: "center" }}>{item.tankers_supplied}</td>
                              <td style={{ border: "1px solid #000", padding: "0.35rem 0.3rem", textAlign: "center" }}>{item.rate_per_tanker}</td>
                              <td style={{ border: "1px solid #000", padding: "0.35rem 0.3rem", textAlign: "center" }}>{item.total_amount}</td>
                            </tr>
                          ))}
                          {/* Total Row */}
                          <tr style={{ fontWeight: "bold" }}>
                            <td style={{ border: "1px solid #000", padding: "0.35rem 0.3rem" }}></td>
                            <td style={{ border: "1px solid #000", padding: "0.35rem 0.4rem", textAlign: "center" }}>TOTAL</td>
                            <td style={{ border: "1px solid #000", padding: "0.35rem 0.4rem" }}></td>
                            <td style={{ border: "1px solid #000", padding: "0.35rem 0.3rem" }}></td>
                            <td style={{ border: "1px solid #000", padding: "0.35rem 0.3rem" }}></td>
                            <td style={{ border: "1px solid #000", padding: "0.35rem 0.3rem", textAlign: "center" }}>{formatIndianNumber(invoiceData.summary.totalAmount)}</td>
                          </tr>
                        </tbody>
                      </table>

                    </div>
                  </div>
                ) : (
                  <div className="glass" style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
                    <FileText size={48} style={{ color: "var(--accent-blue)" }} />
                    <div>
                      <h4 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>No Bill Generated Yet</h4>
                      <p style={{ fontSize: "0.85rem", maxWidth: "320px" }}>Select a client and date range in the panel on the left, then click Generate Statement.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal - Client Add/Edit */}
      {showClientModal && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <div className="modal-header">
              <h3>{editingClient ? "Modify Client Record" : "Register Client"}</h3>
              <button className="close-button" onClick={() => setShowClientModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleClientSubmit}>
              <div className="form-group">
                <label className="form-label">Client / Company Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="e.g. BENCI INFRA"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Delivery Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={clientForm.location}
                  onChange={(e) => setClientForm({ ...clientForm, location: e.target.value })}
                  placeholder="e.g. KORLAI JETTY SITE"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Rate per Tanker (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  value={clientForm.rate_per_tanker}
                  onChange={(e) => setClientForm({ ...clientForm, rate_per_tanker: e.target.value })}
                  placeholder="e.g. 2000"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowClientModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Daily Supply Add/Edit */}
      {showSupplyModal && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <div className="modal-header">
              <h3>{editingSupply ? "Modify Supply Log" : "Log Daily Water Supply"}</h3>
              <button className="close-button" onClick={() => setShowSupplyModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSupplySubmit}>
              <div className="form-group">
                <label className="form-label">Select Client *</label>
                <select
                  className="form-control"
                  value={supplyForm.client_id}
                  onChange={(e) => handleSupplyClientChange(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Select Client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={supplyForm.date}
                    onChange={(e) => setSupplyForm({ ...supplyForm, date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">No of Tankers *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={supplyForm.tankers_supplied}
                    onChange={(e) => setSupplyForm({ ...supplyForm, tankers_supplied: e.target.value })}
                    placeholder="e.g. 1"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Rate per Tanker (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={supplyForm.rate_per_tanker}
                    onChange={(e) => setSupplyForm({ ...supplyForm, rate_per_tanker: e.target.value })}
                    placeholder="e.g. 2000"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select
                    className="form-control"
                    value={supplyForm.payment_status}
                    onChange={(e) => setSupplyForm({ ...supplyForm, payment_status: e.target.value })}
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={supplyForm.location}
                  onChange={(e) => setSupplyForm({ ...supplyForm, location: e.target.value })}
                  placeholder="e.g. PANCHAYAT WELL"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Remarks / Description</label>
                <input
                  type="text"
                  className="form-control"
                  value={supplyForm.description}
                  onChange={(e) => setSupplyForm({ ...supplyForm, description: e.target.value })}
                  placeholder="e.g. Morning trip by Driver"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupplyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Expense Add/Edit */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <div className="modal-header">
              <h3>{editingExpense ? "Modify Expense Entry" : "Log Business Expense"}</h3>
              <button className="close-button" onClick={() => setShowExpenseModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleExpenseSubmit}>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="e.g. 500"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <input
                  type="text"
                  className="form-control"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  placeholder="e.g. DIESEL, MECHANIC, LABOUR"
                  list="expense-categories"
                  required
                />
                <datalist id="expense-categories">
                  {uniqueCategories.map((c, i) => (
                    <option key={i} value={c} />
                  ))}
                  <option value="DIESEL" />
                  <option value="MECHANIC" />
                  <option value="LABOUR" />
                  <option value="OIL, GREASE, FILTER" />
                  <option value="PUNCTURE" />
                </datalist>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Remarks</label>
                <input
                  type="text"
                  className="form-control"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g. Diesel fuel 50 liters"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple helper to format dates from YYYY-MM-DD
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit"
    });
  } catch (e) {
    return dateStr;
  }
}

function formatDateDDMMMYY(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateStr;
  }
}

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateStr;
  }
}

function formatDateDMMMYY(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateStr;
  }
}

function formatIndianNumber(num) {
  if (num === undefined || num === null) return "";
  try {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0
    }).format(num);
  } catch (e) {
    return num.toString();
  }
}

// Custom SVG Line Chart Component
function MonthlyTrendChart({ trends }) {
  const chartHeight = 220;
  const chartWidth = 600;
  const padding = { top: 15, right: 30, bottom: 25, left: 60 };

  const usableWidth = chartWidth - padding.left - padding.right;
  const usableHeight = chartHeight - padding.top - padding.bottom;

  // Find max revenue & expenses
  const maxVal = Math.max(
    ...trends.map((t) => Math.max(t.revenue || 0, t.expenses || 0)),
    10000 // default minimum scale
  ) * 1.1; // 10% breathing room

  const months = trends.map((t) => {
    // Format "2026-03" -> "Mar"
    try {
      const parts = t.month.split("-");
      const date = new Date(parts[0], parts[1] - 1);
      return date.toLocaleDateString("en-US", { month: "short" });
    } catch {
      return t.month;
    }
  });

  // Calculate coordinates
  const getCoords = (value, idx) => {
    const x = padding.left + (idx / Math.max(trends.length - 1, 1)) * usableWidth;
    const y = padding.top + usableHeight - (value / maxVal) * usableHeight;
    return { x, y };
  };

  const revenuePoints = trends.map((t, idx) => getCoords(t.revenue || 0, idx));
  const expensePoints = trends.map((t, idx) => getCoords(t.expenses || 0, idx));

  // Build SVG Path strings
  const getPathD = (points) => {
    if (points.length === 0) return "";
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  };

  const getAreaD = (points) => {
    if (points.length === 0) return "";
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const baseY = padding.top + usableHeight;
    return `${getPathD(points)} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  };

  const formatYLabel = (val) => {
    if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val;
  };

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%">
      {/* Grid lines & Y Axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
        const val = ratio * maxVal;
        const y = padding.top + usableHeight - ratio * usableHeight;
        return (
          <g key={idx}>
            <line
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              fill="var(--text-muted)"
              fontSize="10"
              textAnchor="end"
              fontFamily="inherit"
            >
              {formatYLabel(val)}
            </text>
          </g>
        );
      })}

      {/* X Axis Labels */}
      {months.map((m, idx) => {
        const x = padding.left + (idx / Math.max(trends.length - 1, 1)) * usableWidth;
        return (
          <text
            key={idx}
            x={x}
            y={chartHeight - 8}
            fill="var(--text-muted)"
            fontSize="10"
            textAnchor="middle"
            fontFamily="inherit"
          >
            {m}
          </text>
        );
      })}

      {/* Areas */}
      {revenuePoints.length > 0 && (
        <path
          d={getAreaD(revenuePoints)}
          fill="url(#revGrad)"
          opacity="0.12"
        />
      )}
      {expensePoints.length > 0 && (
        <path
          d={getAreaD(expensePoints)}
          fill="url(#expGrad)"
          opacity="0.12"
        />
      )}

      {/* Lines */}
      {revenuePoints.length > 0 && (
        <path
          d={getPathD(revenuePoints)}
          fill="none"
          stroke="var(--accent-cyan)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {expensePoints.length > 0 && (
        <path
          d={getPathD(expensePoints)}
          fill="none"
          stroke="var(--accent-yellow)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Dots */}
      {revenuePoints.map((p, idx) => (
        <g key={`rev-${idx}`}>
          <circle cx={p.x} cy={p.y} r="5" fill="var(--bg-primary)" stroke="var(--accent-cyan)" strokeWidth="2" />
          <title>{`Revenue: Rs. ${trends[idx].revenue.toLocaleString()}`}</title>
        </g>
      ))}

      {/* Gradients definitions */}
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-cyan)" />
          <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-yellow)" />
          <stop offset="100%" stopColor="var(--accent-yellow)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
