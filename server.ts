import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import cors from "cors";
import { 
  Item, Location, Movement, Team, User, AuditLog, 
  EcommerceOrder, BOM, WorkOrder, TechnicianVan, PartsRequest, SlackConfig, CustomReport
} from "./src/types";

dotenv.config();

const app = express();

// --- STRIPE LAZY INITIALIZATION & WEBHOOK ROUTING ---
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      stripeClient = new Stripe(key, {
        apiVersion: "2025-01-27.acacia" as any,
      });
    }
  }
  return stripeClient;
}

// Stripe Webhook endpoint MUST use express.raw() to preserve request signature.
// This is registered BEFORE app.use(express.json()) so that we get the raw Buffer.
app.post(
  ["/webhook", "/api/stripe/webhook"],
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).send("Webhook Error: Missing stripe-signature header");
    }

    const stripe = getStripeClient();
    if (!stripe) {
      console.warn("[Stripe Webhook] Received event but STRIPE_SECRET_KEY is not configured.");
      return res.status(400).send("Webhook Error: Server Stripe key is not configured");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn("[Stripe Webhook] Received event but STRIPE_WEBHOOK_SECRET is not configured.");
      return res.status(400).send("Webhook Error: Server Webhook Secret is not configured");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Stripe Webhook] Processed event of type: ${event.type}`);

    // Handle successful payments and lifecycle updates
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // The identifier could be stored in client_reference_id (e.g., email or user id or team id)
      const identifier = session.client_reference_id || session.customer_email || session.customer_details?.email;
      
      if (identifier) {
        db = readDB();
        
        // Let's search for user by email (case-insensitive) or by id
        let userIndex = db.users.findIndex(
          (u: any) => u.email.toLowerCase() === identifier.toLowerCase() || u.id === identifier
        );
        
        // If we can't find by client_reference_id directly, let's check customer details email
        if (userIndex === -1 && session.customer_details?.email) {
          userIndex = db.users.findIndex(
            (u: any) => u.email.toLowerCase() === session.customer_details!.email!.toLowerCase()
          );
        }

        if (userIndex !== -1) {
          const user = db.users[userIndex];
          
          // Determine plan from priceId or session metadata, or default to monthly
          let plan: "monthly" | "yearly" = "monthly";
          
          const lineItems = session.line_items?.data || [];
          const priceId = lineItems[0]?.price?.id;
          
          const priceIdYearly = process.env.VITE_STRIPE_PRICE_ID_YEARLY;
          
          if (priceId && priceId === priceIdYearly) {
            plan = "yearly";
          } else if (session.metadata?.plan === "yearly") {
            plan = "yearly";
          }

          user.subscriptionStatus = "active";
          user.subscriptionType = plan;
          user.subscribedAt = new Date().toISOString();

          logAudit(
            "User",
            user.id,
            "SUBSCRIBE",
            "Stripe Gateway",
            `User ${user.name} subscribed to ${plan} plan via Webhook.`
          );
          
          writeDB(db);
          console.log(`[Stripe Webhook] Subscription successfully activated for user: ${user.email} (${plan})`);
        } else {
          // If user not found, let's also support updating teams if client_reference_id was a teamId
          const teamIndex = db.teams.findIndex((t: any) => t.id === identifier);
          if (teamIndex !== -1) {
            const team = db.teams[teamIndex];
            team.status = "active";
            team.tier = "premium";
            logAudit(
              "Team",
              team.id,
              "SUBSCRIBE",
              "Stripe Gateway",
              `Team ${team.name} subscription completed via Webhook.`
            );
            writeDB(db);
            console.log(`[Stripe Webhook] Subscription successfully activated for team: ${team.name}`);
          } else {
            console.warn(`[Stripe Webhook] No matching User or Team found for reference identifier: ${identifier}`);
          }
        }
      } else {
        console.warn("[Stripe Webhook] No reference identifier or email found in checkout session object.");
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      let userEmail = subscription.metadata?.email || subscription.metadata?.user_email || subscription.metadata?.userId;
      
      if (!userEmail && typeof subscription.customer === "string") {
        try {
          const customer = await stripe.customers.retrieve(subscription.customer);
          if (customer && !customer.deleted) {
            userEmail = (customer as Stripe.Customer).email || undefined;
          }
        } catch (e: any) {
          console.error("[Stripe Webhook] Error fetching customer details:", e.message);
        }
      }

      if (userEmail) {
        db = readDB();
        const userIndex = db.users.findIndex(
          (u: any) => u.email.toLowerCase() === userEmail!.toLowerCase() || u.id === userEmail
        );
        if (userIndex !== -1) {
          const user = db.users[userIndex];
          const status = subscription.status; // 'active', 'trialing', 'past_due', 'canceled', 'unpaid', etc.
          
          if (event.type === "customer.subscription.deleted" || status === "canceled" || status === "unpaid") {
            user.subscriptionStatus = "expired";
            logAudit("User", user.id, "UNSUBSCRIBE", "Stripe Gateway", `User ${user.name} subscription ended via Stripe.`);
          } else if (status === "active") {
            user.subscriptionStatus = "active";
            logAudit("User", user.id, "SUBSCRIPTION_UPDATE", "Stripe Gateway", `User ${user.name} subscription status set to active.`);
          } else if (status === "trialing") {
            user.subscriptionStatus = "trialing";
            logAudit("User", user.id, "SUBSCRIPTION_UPDATE", "Stripe Gateway", `User ${user.name} subscription status set to trialing.`);
          } else {
            // Treat past_due, incomplete, paused, etc. as expired
            user.subscriptionStatus = "expired";
            logAudit("User", user.id, "SUBSCRIPTION_UPDATE", "Stripe Gateway", `User ${user.name} subscription status updated to ${status} (restricted/expired).`);
          }
          
          if (subscription.metadata?.plan === "yearly" || subscription.metadata?.plan === "monthly") {
            user.subscriptionType = subscription.metadata.plan as "monthly" | "yearly";
          }

          writeDB(db);
          console.log(`[Stripe Webhook] Subscription status updated for user ${user.email} to: ${user.subscriptionStatus}`);
        } else {
          console.warn(`[Stripe Webhook] No matching user found for: ${userEmail}`);
        }
      } else {
        console.warn("[Stripe Webhook] Could not determine user email from subscription update/delete event.");
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[Stripe Webhook] Invoice paid: ${invoice.id}`);
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[Stripe Webhook] Invoice payment failed: ${invoice.id}`);
    }

    res.json({ received: true });
  }
);

// Standard Middlewares for regular JSON endpoints
app.use(cors({ origin: true }));
app.use(express.json());

// Create Checkout Session
app.post(
  ["/create-checkout-session", "/api/stripe/create-checkout-session"],
  async (req, res) => {
    const { priceId, teamId, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: "Missing required parameter: priceId" });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({
        error: "Stripe integration is not configured on this server. Please set STRIPE_SECRET_KEY.",
      });
    }

    try {
      // Find user/team info to prefill customer email if possible
      let customerEmail: string | undefined = undefined;
      db = readDB();
      const user = db.users.find((u: any) => u.id === teamId || u.email.toLowerCase() === String(teamId).toLowerCase());
      if (user) {
        customerEmail = user.email;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: teamId, // Tethers transaction to the app team/user
        customer_email: customerEmail,
        success_url: `${successUrl || `${process.env.APP_URL || "http://localhost:3000"}/?stripe_checkout=success&plan=monthly`}`,
        cancel_url: cancelUrl || `${process.env.APP_URL || "http://localhost:3000"}/?stripe_checkout=cancel`,
        metadata: {
          plan: priceId === process.env.VITE_STRIPE_PRICE_ID_YEARLY ? "yearly" : "monthly",
          email: customerEmail || "",
        },
        subscription_data: {
          metadata: {
            plan: priceId === process.env.VITE_STRIPE_PRICE_ID_YEARLY ? "yearly" : "monthly",
            email: customerEmail || "",
          }
        }
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("[Stripe Create Session Error]:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "inventory_db.json");

// --- INITIAL STATE / SEED DATA ---
const defaultData = {
  items: [
    { id: "1", sku: "SKU-ECOM-102", name: "Premium Leather Boots", category: "E-Commerce", unit: "Pairs", stock: 14, cost: 45.00, supplier: "Apex Footwear Ltd", minSafetyThreshold: 25 },
    { id: "2", sku: "SKU-MANU-509", name: "Industrial Grade Fasteners", category: "Manufacturing", unit: "Boxes", stock: 450, cost: 0.15, supplier: "Titan Bolt Corp", minSafetyThreshold: 100 },
    { id: "3", sku: "SKU-FIELD-881", name: "Field Testing Oscilloscope", category: "Field Service", unit: "Units", stock: 4, cost: 1200.00, supplier: "Tektronix Direct", minSafetyThreshold: 5 },
    { id: "4", sku: "SKU-COMP-001", name: "Vibram Sole Insert", category: "Manufacturing", unit: "Units", stock: 50, cost: 5.50, supplier: "Apex Footwear Ltd", minSafetyThreshold: 80 },
    { id: "5", sku: "SKU-COMP-002", name: "Premium Cowhide Leather (sq ft)", category: "Manufacturing", unit: "Sq Ft", stock: 300, cost: 12.00, supplier: "Tandy Leather Co", minSafetyThreshold: 100 }
  ] as Item[],
  locations: [
    { id: "LOC-WH-1", name: "East Coast Distribution Center", type: "warehouse", address: "100 Logistics Blvd, Newark, NJ" },
    { id: "LOC-ST-2", name: "Manhattan Flagship Store", type: "store", address: "450 Broadway, New York, NY" },
    { id: "LOC-VH-3", name: "Service Truck #4 (Tech Dave)", type: "vehicle", address: "Mobile - Boston Area" }
  ] as Location[],
  movements: [
    { id: "mov_1", itemId: "1", fromLocationId: "LOC-WH-1", toLocationId: "LOC-ST-2", quantity: 5, createdBy: "Alex (E-comm)", createdAt: new Date(Date.now() - 86400000).toISOString() }
  ] as Movement[],
  teams: [
    { id: "team_1", name: "E-Commerce Operations", description: "Direct-to-Consumer fulfillment and store replenishment" },
    { id: "team_2", name: "Manufacturing Production", description: "Product assembly, material bills and work orders" },
    { id: "team_3", name: "Field Engineering Services", description: "On-site equipment repairs, parts delivery and fleet stock" }
  ] as Team[],
  users: [
    { id: "usr_1", name: "Dave Miller", email: "dave@teams.com", teamId: "team_3", role: "Staff" },
    { id: "usr_2", name: "Sarah Connor", email: "sarah@teams.com", teamId: "team_2", role: "Manager" },
    { id: "usr_3", name: "Alex Mercer", email: "alex@teams.com", teamId: "team_1", role: "Staff" },
    { id: "usr_4", name: "Enterprise Administrator", email: "phidephefem@gmail.com", teamId: "team_1", role: "Admin" }
  ] as User[],
  orders: [
    { id: "ORD-9912", sku: "SKU-ECOM-102", customerName: "John Smith", quantity: 1, status: "pending", channel: "Shopify", createdAt: new Date(Date.now() - 3600000 * 2).toISOString() },
    { id: "ORD-9913", sku: "SKU-ECOM-102", customerName: "Alice Wonderland", quantity: 2, status: "picking", channel: "Amazon", createdAt: new Date(Date.now() - 3600000 * 5).toISOString() },
    { id: "ORD-9914", sku: "SKU-MANU-509", customerName: "Factory Outlet", quantity: 10, status: "shipped", channel: "WooCommerce", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() }
  ] as EcommerceOrder[],
  boms: [
    { 
      id: "BOM-ECOM-102", 
      itemId: "1", 
      name: "Standard Boot Assembly", 
      components: [
        { itemId: "4", quantity: 2 }, // 2 Vibram Sole Inserts
        { itemId: "5", quantity: 3 }  // 3 Sq Ft Leather
      ],
      description: "Direct production routing of premium leather workboots."
    }
  ] as BOM[],
  workOrders: [
    { id: "WO-201", bomId: "BOM-ECOM-102", quantity: 20, status: "in-progress", dueDate: "2026-07-20" },
    { id: "WO-202", bomId: "BOM-ECOM-102", quantity: 50, status: "planned", dueDate: "2026-08-01" }
  ] as WorkOrder[],
  vans: [
    {
      technicianId: "usr_1",
      technicianName: "Dave Miller",
      vanId: "VAN-TRUCK-04",
      stock: { "3": 2, "2": 150 }
    }
  ] as TechnicianVan[],
  partsRequests: [
    { id: "REQ-301", technicianId: "usr_1", technicianName: "Dave Miller", itemId: "3", quantity: 1, status: "requested", jobName: "Raytheon Calibration Job", createdAt: new Date(Date.now() - 1800000).toISOString() }
  ] as PartsRequest[],
  slackConfig: {
    webhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX",
    channelName: "#inventory-alerts",
    enabled: true
  } as SlackConfig,
  reports: [
    { id: "REP-001", title: "Q3 Restock Safety Audit", type: "Safety Runway", createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), summary: "Current critical shortages flagged for E-Commerce boots. Recommend 11+ additional safety stock." },
    { id: "REP-002", title: "Field Fleet Tooling Assessment", type: "Utilization", createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), summary: "Dave Miller's service vehicle tool calibration is complete. Fasteners stock checked." }
  ] as CustomReport[],
  auditLogs: [
    { id: "aud_0", entityType: "Database", entityId: "System", action: "BOOTSTRAP", performedBy: "System", performedAt: new Date().toISOString(), details: "Inventory platform database initialized successfully." }
  ] as AuditLog[]
};

// --- DATA READ/WRITE LOGIC ---
function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(content);
      // Ensure all arrays are initialized
      if (!parsed.reports) parsed.reports = defaultData.reports;
      if (!parsed.orders) parsed.orders = defaultData.orders;
      if (!parsed.boms) parsed.boms = defaultData.boms;
      if (!parsed.workOrders) parsed.workOrders = defaultData.workOrders;
      if (!parsed.partsRequests) parsed.partsRequests = defaultData.partsRequests;
      return parsed;
    }
  } catch (err) {
    console.error("Error reading database file, using in-memory default", err);
  }
  return defaultData;
}

let firestoreInstance: Firestore | null = null;

function getFirestoreInstance() {
  if (firestoreInstance) return firestoreInstance;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (getApps().length === 0) {
        initializeApp({
          projectId: config.projectId,
        });
      }
      if (config.firestoreDatabaseId) {
        firestoreInstance = getFirestore(config.firestoreDatabaseId);
      } else {
        firestoreInstance = getFirestore();
      }
      console.log("[Firebase] Admin initialized with project:", config.projectId, "and databaseId:", config.firestoreDatabaseId || "(default)");
      return firestoreInstance;
    }
  } catch (err) {
    console.error("[Firebase] Failed to initialize Firestore", err);
  }
  return null;
}

async function loadFromFirestore() {
  const fsDb = getFirestoreInstance();
  if (!fsDb) return null;

  try {
    console.log("[Firebase] Loading state from Firestore...");
    const collections = [
      "items", "locations", "movements", "teams", "users", "orders", 
      "boms", "workOrders", "vans", "partsRequests", "reports", "auditLogs"
    ];
    const loadedData: any = {};

    // Load slackConfig
    try {
      const doc = await fsDb.collection("inventory_metadata").doc("slackConfig").get();
      loadedData.slackConfig = doc.exists ? doc.data() : defaultData.slackConfig;
    } catch (e) {
      loadedData.slackConfig = defaultData.slackConfig;
    }

    // Load main collections
    for (const col of collections) {
      const snapshot = await fsDb.collection(col).get();
      if (!snapshot.empty) {
        const list: any[] = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        loadedData[col] = list;
      } else {
        loadedData[col] = (defaultData as any)[col];
      }
    }

    if (loadedData.items && loadedData.items.length > 0) {
      console.log("[Firebase] State successfully loaded from Firestore.");
      return loadedData;
    }
  } catch (err) {
    console.error("[Firebase] Error loading from Firestore, using local file/memory:", err);
  }
  return null;
}

async function syncToFirestore(data: typeof defaultData) {
  const fsDb = getFirestoreInstance();
  if (!fsDb) return;

  try {
    console.log("[Firebase] Syncing state to Firestore...");
    const collections = [
      "items", "locations", "movements", "teams", "users", "orders", 
      "boms", "workOrders", "vans", "partsRequests", "reports", "auditLogs"
    ];
    
    // Sync slackConfig
    await fsDb.collection("inventory_metadata").doc("slackConfig").set(data.slackConfig || {});

    // Sync other collections
    for (const col of collections) {
      const itemsList = (data as any)[col] || [];
      const batch = fsDb.batch();
      
      const snapshot = await fsDb.collection(col).get();
      const existingIds = snapshot.docs.map(d => d.id);
      const currentIds = itemsList.map((item: any) => String(item.id));

      // Delete removed documents
      for (const id of existingIds) {
        if (!currentIds.includes(id)) {
          batch.delete(fsDb.collection(col).doc(id));
        }
      }

      // Set or update current documents
      for (const item of itemsList) {
        const { id, ...rest } = item;
        if (id) {
          batch.set(fsDb.collection(col).doc(String(id)), rest, { merge: true });
        }
      }

      await batch.commit();
    }
    console.log("[Firebase] Firestore sync completed successfully.");
  } catch (err) {
    console.error("[Firebase] Error syncing to Firestore:", err);
  }
}

function writeDB(data: typeof defaultData) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    // Trigger Firestore background sync
    syncToFirestore(data);
  } catch (err) {
    console.error("Error writing database file", err);
  }
}

// Ensure DB exists on boot
let db = readDB();
if (!fs.existsSync(DB_FILE)) {
  writeDB(db);
}

// Perform asynchronous startup load/merge with Firestore
loadFromFirestore().then((firestoreData) => {
  if (firestoreData) {
    db = firestoreData;
    // Write locally to sync local backup cache file
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    console.log("[Firebase] Local cache database synchronized with cloud Firestore.");
  } else {
    console.log("[Firebase] No data found in Firestore or fallback. Seeding current state to Firestore...");
    syncToFirestore(db);
  }
});

// Helper to log changes to the audit log
function logAudit(entityType: string, entityId: string, action: string, performedBy: string, details: string) {
  const newLog: AuditLog = {
    id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    entityType,
    entityId,
    action,
    performedBy,
    performedAt: new Date().toISOString(),
    details
  };
  db.auditLogs.unshift(newLog);
  writeDB(db);
  return newLog;
}

// Helper to get Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });
    }
  }
  return aiClient;
}

// Helper to check safety stock and mock-trigger Slack
async function checkSafetyStockAlert(item: Item, changedQty: number, user: string) {
  if (item.stock < item.minSafetyThreshold) {
    const detail = `🚨 Stock Alert: ${item.name} (${item.sku}) is below safety threshold! Current: ${item.stock}, Threshold: ${item.minSafetyThreshold}`;
    logAudit("Item", item.id, "LOW_STOCK_ALERT", "System", detail);

    // Mock Slack Dispatch
    if (db.slackConfig.enabled) {
      console.log(`[SLACK OUTBOUND SUCCESS] Hook: ${db.slackConfig.webhookUrl} | Msg: ${detail}`);
    }
  }
}

// --- REST API ENDPOINTS ---

// Get all application state at once (helps client minimize waterfall fetches)
app.get("/api/state", (req, res) => {
  db = readDB();
  res.json(db);
});

// Master Item Catalog CRUD
app.get("/api/items", (req, res) => {
  db = readDB();
  res.json(db.items);
});

app.post("/api/items", (req, res) => {
  db = readDB();
  const { sku, name, category, unit, stock, cost, supplier, minSafetyThreshold } = req.body;
  if (!sku || !name || !category) {
    return res.status(400).json({ error: "Missing required catalog fields." });
  }

  // SKU Unique check
  if (db.items.find((i: Item) => i.sku.toUpperCase() === sku.toUpperCase())) {
    return res.status(400).json({ error: `SKU '${sku}' already exists in the catalog.` });
  }

  const newItem: Item = {
    id: String(Date.now()),
    sku: sku.toUpperCase(),
    name,
    category,
    unit: unit || "Units",
    stock: Number(stock) || 0,
    cost: Number(cost) || 0,
    supplier: supplier || "N/A",
    minSafetyThreshold: Number(minSafetyThreshold) || 0
  };

  db.items.push(newItem);
  logAudit("Item", newItem.id, "CREATE", "Admin", `Added master item: ${name} (${sku})`);
  checkSafetyStockAlert(newItem, newItem.stock, "Admin");
  writeDB(db);

  res.status(201).json(newItem);
});

app.post("/api/items/batch", (req, res) => {
  db = readDB();
  const { items: incomingItems } = req.body;
  if (!incomingItems || !Array.isArray(incomingItems)) {
    return res.status(400).json({ error: "Invalid or empty items list provided." });
  }

  const imported: Item[] = [];
  const skippedSKUs: string[] = [];
  const errorsList: string[] = [];

  incomingItems.forEach((incoming, index) => {
    const { sku, name, category, unit, stock, cost, supplier, minSafetyThreshold } = incoming;
    
    if (!sku || !name || !category) {
      errorsList.push(`Row ${index + 1}: Missing required fields (SKU, Name, or Category).`);
      return;
    }

    const cleanSKU = sku.trim().toUpperCase();
    if (db.items.find((i: Item) => i.sku.toUpperCase() === cleanSKU) || imported.find((i: Item) => i.sku.toUpperCase() === cleanSKU)) {
      skippedSKUs.push(cleanSKU);
      return;
    }

    const newItem: Item = {
      id: String(Date.now() + index + Math.floor(Math.random() * 1000)),
      sku: cleanSKU,
      name: name.trim(),
      category: category.trim() as any,
      unit: unit ? unit.trim() : "Units",
      stock: Number(stock) || 0,
      cost: Number(cost) || 0,
      supplier: supplier ? supplier.trim() : "N/A",
      minSafetyThreshold: Number(minSafetyThreshold) || 0
    };

    db.items.push(newItem);
    imported.push(newItem);
    checkSafetyStockAlert(newItem, newItem.stock, "Admin");
  });

  if (imported.length > 0) {
    logAudit("Item", "Batch", "BATCH_IMPORT", "Admin", `Batch imported ${imported.length} master items via CSV.`);
    writeDB(db);
  }

  res.status(200).json({
    success: true,
    importedCount: imported.length,
    skipped: skippedSKUs,
    errors: errorsList,
    importedItems: imported
  });
});

app.put("/api/items/:id", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const itemIndex = db.items.findIndex((i: Item) => i.id === id);
  if (itemIndex === -1) return res.status(404).json({ error: "Item not found." });

  const current = db.items[itemIndex];
  const updated: Item = {
    ...current,
    ...req.body,
    id: current.id, // keep id immutable
    stock: Number(req.body.stock !== undefined ? req.body.stock : current.stock),
    cost: Number(req.body.cost !== undefined ? req.body.cost : current.cost),
    minSafetyThreshold: Number(req.body.minSafetyThreshold !== undefined ? req.body.minSafetyThreshold : current.minSafetyThreshold)
  };

  db.items[itemIndex] = updated;
  logAudit("Item", id, "UPDATE", "Operator", `Updated item specifications: ${updated.name}`);
  checkSafetyStockAlert(updated, updated.stock, "Operator");
  writeDB(db);

  res.json(updated);
});

app.post("/api/items/:id/variance", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const { physicalStock, reason, performedBy } = req.body;
  
  const itemIndex = db.items.findIndex((i: Item) => i.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: "Item not found." });
  }

  const item = db.items[itemIndex];
  const originalStock = item.stock;
  const difference = Number(physicalStock) - originalStock;
  
  // Update the item's stock
  item.stock = Number(physicalStock);
  
  // Create audit entry
  const discrepancyText = difference > 0 ? `+${difference}` : `${difference}`;
  const details = `Stock Variance Log: Physical stock counted at ${physicalStock} units (System record: ${originalStock} units, variance of ${discrepancyText}). Reason: ${reason || "Not specified"}.`;
  
  logAudit("Item", id, "STOCK_VARIANCE", performedBy || "Admin", details);
  checkSafetyStockAlert(item, item.stock, performedBy || "Admin");
  
  writeDB(db);
  res.json({ success: true, item, discrepancy: difference });
});

app.delete("/api/items/:id", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const target = db.items.find((i: Item) => i.id === id);
  if (!target) return res.status(404).json({ error: "Item not found." });

  db.items = db.items.filter((i: Item) => i.id !== id);
  logAudit("Item", id, "DELETE", "Admin", `Deleted item catalog record: ${target.name} (${target.sku})`);
  writeDB(db);

  res.json({ success: true, message: "Item deleted." });
});

// Stock Movements & Allocations
app.post("/api/movements", (req, res) => {
  db = readDB();
  const { itemId, fromLocationId, toLocationId, quantity, createdBy } = req.body;
  if (!itemId || !quantity) {
    return res.status(400).json({ error: "Missing movement parameters." });
  }

  const item = db.items.find((i: Item) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Item catalog entry missing." });

  const qty = Number(quantity);
  if (qty <= 0) return res.status(400).json({ error: "Quantity must be greater than 0." });

  // Adjust overall ledger stock if receiving / exporting
  // from "N/A" -> receiving (stock increases)
  // to "N/A" -> shipping/scrap (stock decreases)
  // transfer -> stock remains same, but we log the movement
  if (fromLocationId === "N/A" && toLocationId !== "N/A") {
    item.stock += qty;
  } else if (fromLocationId !== "N/A" && toLocationId === "N/A") {
    if (item.stock < qty) return res.status(400).json({ error: `Insufficient stock in ledger. Available: ${item.stock}` });
    item.stock -= qty;
  } else if (fromLocationId !== "N/A" && toLocationId !== "N/A") {
    // If movement is between vans and warehouse, adjust specifically
    if (fromLocationId === "LOC-VH-3") {
      const van = db.vans[0]; // Dave's van mock
      const vanStock = van.stock[itemId] || 0;
      if (vanStock < qty) return res.status(400).json({ error: "Insufficient stock in service vehicle." });
      van.stock[itemId] = vanStock - qty;
    }
    if (toLocationId === "LOC-VH-3") {
      const van = db.vans[0];
      van.stock[itemId] = (van.stock[itemId] || 0) + qty;
    }
  }

  const movement: Movement = {
    id: `mov_${Date.now()}`,
    itemId,
    fromLocationId: fromLocationId || "N/A",
    toLocationId: toLocationId || "N/A",
    quantity: qty,
    createdBy: createdBy || "Admin",
    createdAt: new Date().toISOString()
  };

  db.movements.unshift(movement);
  logAudit("Movement", movement.id, "TRANSFER", movement.createdBy, `Moved ${qty}x ${item.name} from ${fromLocationId} to ${toLocationId}`);
  checkSafetyStockAlert(item, item.stock, movement.createdBy);
  writeDB(db);

  res.status(201).json({ movement, updatedItem: item });
});

// Batch Stock Movements & Allocations
app.post("/api/movements/batch", (req, res) => {
  db = readDB();
  const { movements, createdBy } = req.body;
  if (!movements || !Array.isArray(movements) || movements.length === 0) {
    return res.status(400).json({ error: "Missing or invalid movements batch." });
  }

  const createdMovements = [];
  const updatedItems = [];

  for (const m of movements) {
    const { itemId, fromLocationId, toLocationId, quantity } = m;
    if (!itemId || !quantity) {
      return res.status(400).json({ error: "Each movement in the batch must have itemId and quantity." });
    }
    const item = db.items.find((i: Item) => i.id === itemId);
    if (!item) return res.status(404).json({ error: `Item catalog entry missing for ID: ${itemId}` });

    const qty = Number(quantity);
    if (qty <= 0) return res.status(400).json({ error: "Quantity must be greater than 0." });

    if (fromLocationId === "N/A" && toLocationId !== "N/A") {
      item.stock += qty;
    } else if (fromLocationId !== "N/A" && toLocationId === "N/A") {
      if (item.stock < qty) return res.status(400).json({ error: `Insufficient stock in ledger for ${item.name}. Available: ${item.stock}` });
      item.stock -= qty;
    } else if (fromLocationId !== "N/A" && toLocationId !== "N/A") {
      if (fromLocationId === "LOC-VH-3") {
        const van = db.vans[0];
        const vanStock = van.stock[itemId] || 0;
        if (vanStock < qty) return res.status(400).json({ error: `Insufficient stock in service vehicle for ${item.name}.` });
        van.stock[itemId] = vanStock - qty;
      }
      if (toLocationId === "LOC-VH-3") {
        const van = db.vans[0];
        van.stock[itemId] = (van.stock[itemId] || 0) + qty;
      }
    }

    const movement: Movement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      itemId,
      fromLocationId: fromLocationId || "N/A",
      toLocationId: toLocationId || "N/A",
      quantity: qty,
      createdBy: createdBy || "Admin",
      createdAt: new Date().toISOString()
    };

    db.movements.unshift(movement);
    logAudit("Movement", movement.id, "TRANSFER", movement.createdBy, `Moved ${qty}x ${item.name} from ${fromLocationId} to ${toLocationId}`);
    checkSafetyStockAlert(item, item.stock, movement.createdBy);
    createdMovements.push(movement);
    updatedItems.push(item);
  }

  writeDB(db);
  res.status(201).json({ movements: createdMovements, updatedItems });
});

// E-Commerce Order Fulfilment State
app.get("/api/orders", (req, res) => {
  db = readDB();
  res.json(db.orders);
});

app.put("/api/orders/:id/status", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const { status } = req.body; // 'picking' | 'packed' | 'shipped'
  
  const order = db.orders.find((o: EcommerceOrder) => o.id === id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const oldStatus = order.status;
  order.status = status;

  // If status transitions to 'picking' or 'packed', let's reserve/reduce inventory
  if (status === "shipped" && oldStatus !== "shipped") {
    // Deduct stock upon final shipment
    const item = db.items.find((i: Item) => i.sku === order.sku);
    if (item) {
      if (item.stock >= order.quantity) {
        item.stock -= order.quantity;
        logAudit("Order", id, "SHIPMENT_DEDUCT", "Fulfillment System", `Deducted ${order.quantity} of ${item.name} for completed Order ${id}`);
        checkSafetyStockAlert(item, item.stock, "Fulfillment System");
      } else {
        return res.status(400).json({ error: `Insufficient stock to fulfill shipment. SKU ${order.sku} has only ${item.stock} available.` });
      }
    }
  }

  logAudit("Order", id, "STATUS_CHANGE", "Fulfillment Agent", `Order status updated from ${oldStatus} to ${status}`);
  writeDB(db);
  res.json(order);
});

app.post("/api/orders", (req, res) => {
  db = readDB();
  const { sku, customerName, quantity, channel } = req.body;
  if (!sku || !customerName || !quantity || !channel) {
    return res.status(400).json({ error: "Missing required order fields: sku, customerName, quantity, channel." });
  }

  const newOrder: EcommerceOrder = {
    id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    sku,
    customerName,
    quantity: Number(quantity),
    status: "pending",
    channel,
    createdAt: new Date().toISOString()
  };

  db.orders.unshift(newOrder);
  logAudit("Order", newOrder.id, "CREATE", "Fulfillment System", `Placed new E-commerce order for ${quantity}x ${sku}`);
  writeDB(db);
  res.status(201).json(newOrder);
});

app.delete("/api/orders/:id", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const target = db.orders.find((o: EcommerceOrder) => o.id === id);
  if (!target) return res.status(404).json({ error: "Order not found." });

  db.orders = db.orders.filter((o: EcommerceOrder) => o.id !== id);
  logAudit("Order", id, "DELETE", "Fulfillment System", `Deleted e-commerce order record: ${id}`);
  writeDB(db);
  res.json({ success: true, message: "Order deleted." });
});

// Manufacturing work orders and BOM
app.get("/api/bom", (req, res) => {
  db = readDB();
  res.json(db.boms);
});

app.post("/api/bom", (req, res) => {
  db = readDB();
  const { itemId, name, components, description } = req.body;
  if (!itemId || !name || !components || components.length === 0) {
    return res.status(400).json({ error: "BOM requires name, finished item and components list." });
  }

  const newBom: BOM = {
    id: `BOM-${Date.now()}`,
    itemId,
    name,
    components,
    description: description || ""
  };

  db.boms.push(newBom);
  logAudit("BOM", newBom.id, "CREATE", "Production Engineer", `Created new BOM: ${name}`);
  writeDB(db);
  res.status(201).json(newBom);
});

app.delete("/api/bom/:id", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const target = db.boms.find((b: BOM) => b.id === id);
  if (!target) return res.status(404).json({ error: "BOM not found." });

  db.boms = db.boms.filter((b: BOM) => b.id !== id);
  logAudit("BOM", id, "DELETE", "Production Engineer", `Deleted BOM: ${target.name}`);
  writeDB(db);
  res.json({ success: true, message: "BOM deleted." });
});

app.post("/api/work-orders", (req, res) => {
  db = readDB();
  const { bomId, quantity, dueDate } = req.body;
  if (!bomId || !quantity || !dueDate) {
    return res.status(400).json({ error: "Missing required work order parameters." });
  }

  const newWO: WorkOrder = {
    id: `WO-${Date.now()}`,
    bomId,
    quantity: Number(quantity),
    status: "planned",
    dueDate
  };

  db.workOrders.push(newWO);
  logAudit("WorkOrder", newWO.id, "CREATE", "Planner", `Planned Production Work Order for ${quantity}x BOM (${bomId})`);
  writeDB(db);
  res.status(201).json(newWO);
});

app.put("/api/work-orders/:id/status", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const { status } = req.body; // 'in-progress' | 'completed'

  const wo = db.workOrders.find((w: WorkOrder) => w.id === id);
  if (!wo) return res.status(404).json({ error: "Work order not found." });

  const bom = db.boms.find((b: BOM) => b.id === wo.bomId);
  if (!bom) return res.status(404).json({ error: "Associated BOM not found." });

  const oldStatus = wo.status;
  wo.status = status;

  if (status === "completed" && oldStatus !== "completed") {
    // BOM Explosion: Deduct components and add finished item to inventory!
    let componentIssues = [];
    
    // Check component stocks first
    for (const comp of bom.components) {
      const requiredQty = comp.quantity * wo.quantity;
      const compItem = db.items.find((i: Item) => i.id === comp.itemId);
      if (!compItem || compItem.stock < requiredQty) {
        componentIssues.push(`${compItem ? compItem.name : "Unknown component"} (Required: ${requiredQty}, Available: ${compItem ? compItem.stock : 0})`);
      }
    }

    if (componentIssues.length > 0) {
      // Revert status to show failure
      wo.status = oldStatus;
      return res.status(400).json({ 
        error: `Material shortage! Cannot complete production. Minor shortages detected:`, 
        details: componentIssues 
      });
    }

    // Deduct raw materials
    for (const comp of bom.components) {
      const requiredQty = comp.quantity * wo.quantity;
      const compItem = db.items.find((i: Item) => i.id === comp.itemId)!;
      compItem.stock -= requiredQty;
      logAudit("Item", compItem.id, "BOM_DEDUCT", "Work Order Completion", `Deducted ${requiredQty} units of raw material for production run ${id}`);
      checkSafetyStockAlert(compItem, compItem.stock, "Work Order Completion");
    }

    // Add finished item to inventory
    const finishedItem = db.items.find((i: Item) => i.id === bom.itemId);
    if (finishedItem) {
      finishedItem.stock += wo.quantity;
      logAudit("Item", finishedItem.id, "PRODUCTION_ADD", "Work Order Completion", `Produced and credited ${wo.quantity} finished items of ${finishedItem.name} to warehouse`);
      checkSafetyStockAlert(finishedItem, finishedItem.stock, "Work Order Completion");
    }
  }

  logAudit("WorkOrder", id, "STATUS_CHANGE", "Production Supervisor", `Work order status changed from ${oldStatus} to ${status}`);
  writeDB(db);
  res.json(wo);
});

app.delete("/api/work-orders/:id", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const target = db.workOrders.find((w: WorkOrder) => w.id === id);
  if (!target) return res.status(404).json({ error: "Work order not found." });

  db.workOrders = db.workOrders.filter((w: WorkOrder) => w.id !== id);
  logAudit("WorkOrder", id, "DELETE", "Production Supervisor", `Deleted Work Order: ${id}`);
  writeDB(db);
  res.json({ success: true, message: "Work order deleted." });
});

// Field Service Van Stock and Parts Requests
app.get("/api/van-stock", (req, res) => {
  db = readDB();
  res.json(db.vans);
});

app.get("/api/parts-requests", (req, res) => {
  db = readDB();
  res.json(db.partsRequests);
});

app.post("/api/parts-requests", (req, res) => {
  db = readDB();
  const { itemId, quantity, jobName } = req.body;
  if (!itemId || !quantity || !jobName) {
    return res.status(400).json({ error: "Missing required parts request fields." });
  }

  const item = db.items.find((i: Item) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Item not found in catalog." });

  const newReq: PartsRequest = {
    id: `REQ-${Date.now()}`,
    technicianId: "usr_1", // Mock technician Dave
    technicianName: "Dave Miller",
    itemId,
    quantity: Number(quantity),
    status: "requested",
    jobName,
    createdAt: new Date().toISOString()
  };

  db.partsRequests.push(newReq);
  logAudit("PartsRequest", newReq.id, "CREATE", "Dave Miller (Field Tech)", `Requested ${quantity}x ${item.name} for Job: ${jobName}`);
  writeDB(db);
  res.status(201).json(newReq);
});

app.put("/api/parts-requests/:id/status", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const { status } = req.body; // 'approved' | 'dispatched'

  const pr = db.partsRequests.find((p: PartsRequest) => p.id === id);
  if (!pr) return res.status(404).json({ error: "Parts request not found." });

  const oldStatus = pr.status;
  pr.status = status;

  // If dispatched, we deduct from main inventory and transfer to the technician's van stock!
  if (status === "dispatched" && oldStatus !== "dispatched") {
    const item = db.items.find((i: Item) => i.id === pr.itemId);
    if (item) {
      if (item.stock >= pr.quantity) {
        item.stock -= pr.quantity; // take out of central storage
        
        // Add to Dave's van stock
        const van = db.vans[0];
        van.stock[pr.itemId] = (van.stock[pr.itemId] || 0) + pr.quantity;

        logAudit("PartsRequest", id, "DISPATCH", "Warehouse Staff", `Dispatched ${pr.quantity}x ${item.name} to Dave's Service Van. Central stock deducted.`);
        checkSafetyStockAlert(item, item.stock, "Warehouse Staff");
      } else {
        pr.status = oldStatus; // revert status
        return res.status(400).json({ error: `Shortage in central storage. Fulfiller cannot dispatch SKU ${item.sku}. Only ${item.stock} available.` });
      }
    }
  }

  logAudit("PartsRequest", id, "STATUS_CHANGE", "Fulfillment Supervisor", `Parts request state updated from ${oldStatus} to ${status}`);
  writeDB(db);
  res.json(pr);
});

app.delete("/api/parts-requests/:id", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const target = db.partsRequests.find((p: PartsRequest) => p.id === id);
  if (!target) return res.status(404).json({ error: "Parts request not found." });

  db.partsRequests = db.partsRequests.filter((p: PartsRequest) => p.id !== id);
  logAudit("PartsRequest", id, "DELETE", "Warehouse Staff", `Deleted parts request: ${id}`);
  writeDB(db);
  res.json({ success: true, message: "Parts request deleted." });
});

// Reports & Forecasts CRUD
app.get("/api/reports", (req, res) => {
  db = readDB();
  res.json(db.reports || []);
});

app.post("/api/reports", (req, res) => {
  db = readDB();
  const { title, type, summary } = req.body;
  if (!title || !type || !summary) {
    return res.status(400).json({ error: "Missing required report fields: title, type, summary." });
  }

  const newReport: CustomReport = {
    id: `REP-${Math.floor(100 + Math.random() * 900)}`,
    title,
    type,
    createdAt: new Date().toISOString(),
    summary
  };

  if (!db.reports) db.reports = [];
  db.reports.unshift(newReport);
  logAudit("Report", newReport.id, "CREATE", "Admin", `Created custom executive report: ${title}`);
  writeDB(db);
  res.status(201).json(newReport);
});

app.delete("/api/reports/:id", (req, res) => {
  db = readDB();
  const { id } = req.params;
  if (!db.reports) db.reports = [];
  const target = db.reports.find((r: CustomReport) => r.id === id);
  if (!target) return res.status(404).json({ error: "Report not found." });

  db.reports = db.reports.filter((r: CustomReport) => r.id !== id);
  logAudit("Report", id, "DELETE", "Admin", `Deleted custom report: ${target.title}`);
  writeDB(db);
  res.json({ success: true, message: "Report deleted." });
});

// Slack Notifications settings & simulation
app.get("/api/slack/settings", (req, res) => {
  db = readDB();
  res.json(db.slackConfig);
});

app.post("/api/slack/settings", (req, res) => {
  db = readDB();
  const { webhookUrl, channelName, enabled } = req.body;
  db.slackConfig = {
    webhookUrl: webhookUrl || db.slackConfig.webhookUrl,
    channelName: channelName || db.slackConfig.channelName,
    enabled: enabled !== undefined ? enabled : db.slackConfig.enabled
  };
  logAudit("SlackConfig", "slack_settings", "CONFIG_CHANGE", "Admin", `Slack integration settings saved. Target channel: ${db.slackConfig.channelName}`);
  writeDB(db);
  res.json(db.slackConfig);
});

app.post("/api/slack/test", (req, res) => {
  db = readDB();
  const { message } = req.body;
  const dispatchMsg = message || "🔔 System Test: Inventory sync heartbeats online.";
  
  console.log(`[OUTBOUND SLACK WEBHOOK] URL: ${db.slackConfig.webhookUrl}`);
  console.log(`[PAYLOAD SENT] text: "${dispatchMsg}"`);
  
  logAudit("SlackSync", "test_ping", "SLACK_PING", "Admin", `Sent test alert: "${dispatchMsg}" to Slack webhook.`);
  res.json({ success: true, message: "Slack test notification triggered successfully.", dispatchedPayload: { text: dispatchMsg } });
});

// --- AUTHENTICATION & SUBSCRIPTION ENGINES ---
app.post("/api/auth/signup", (req, res) => {
  db = readDB();
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing name, email, or password." });
  }

  if (db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: `An account with email '${email}' already exists.` });
  }

  const newUser = {
    id: `usr_${Date.now()}`,
    name,
    email: email.toLowerCase(),
    password,
    teamId: "team_1",
    role: "Admin" as const,
    trialStartDate: new Date().toISOString(),
    subscriptionStatus: "trialing",
    subscriptionType: "none",
    subscribedAt: ""
  };

  db.users.push(newUser);
  logAudit("User", newUser.id, "SIGNUP", newUser.name, `New user signed up: ${name} (${email}) starting 7-day free trial.`);
  writeDB(db);

  res.status(201).json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    trialStartDate: newUser.trialStartDate,
    subscriptionStatus: newUser.subscriptionStatus,
    subscriptionType: newUser.subscriptionType
  });
});

app.post("/api/auth/signin", (req, res) => {
  db = readDB();
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password." });
  }

  const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const expectedPassword = user.password || user.name.split(" ")[0].toLowerCase() + "123";
  if (password !== expectedPassword) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (!user.trialStartDate) {
    user.trialStartDate = new Date(Date.now() - 3 * 86400000).toISOString();
  }
  if (!user.subscriptionStatus) {
    user.subscriptionStatus = user.email === "phidephefem@gmail.com" ? "active" : "trialing";
    user.subscriptionType = user.email === "phidephefem@gmail.com" ? "yearly" : "none";
  }

  writeDB(db);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    trialStartDate: user.trialStartDate,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionType: user.subscriptionType,
    subscribedAt: user.subscribedAt || ""
  });
});

app.post("/api/auth/change-password", (req, res) => {
  db = readDB();
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const userIndex = db.users.findIndex((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  const user = db.users[userIndex];
  const expectedPassword = user.password || user.name.split(" ")[0].toLowerCase() + "123";
  
  if (oldPassword !== expectedPassword) {
    return res.status(400).json({ error: "Incorrect old password." });
  }

  user.password = newPassword;
  logAudit("User", user.id, "PASSWORD_CHANGE", user.name, `User ${user.name} changed their password.`);
  writeDB(db);

  res.json({ success: true, message: "Password updated successfully." });
});

app.post("/api/auth/subscribe", (req, res) => {
  db = readDB();
  const { email, plan } = req.body;
  if (!email || !plan || (plan !== "monthly" && plan !== "yearly")) {
    return res.status(400).json({ error: "Missing email or invalid subscription plan." });
  }

  const userIndex = db.users.findIndex((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  const user = db.users[userIndex];
  user.subscriptionStatus = "active";
  user.subscriptionType = plan;
  user.subscribedAt = new Date().toISOString();

  logAudit("User", user.id, "SUBSCRIBE", user.name, `User ${user.name} subscribed to ${plan} plan.`);
  writeDB(db);

  res.json({
    success: true,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionType: user.subscriptionType,
    subscribedAt: user.subscribedAt
  });
});

app.post("/api/auth/expire-trial", (req, res) => {
  db = readDB();
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Missing email." });
  }

  const userIndex = db.users.findIndex((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  const user = db.users[userIndex];
  user.subscriptionStatus = "expired";
  logAudit("User", user.id, "TRIAL_EXPIRE", "System", `User ${user.name}'s free trial has expired.`);
  writeDB(db);

  res.json({
    success: true,
    user
  });
});

// User Management (Admin & Slack Setup Roles)
app.post("/api/users", (req, res) => {
  db = readDB();
  const { name, email, teamId, role } = req.body;
  if (!name || !email || !teamId || !role) {
    return res.status(400).json({ error: "Missing required user registration fields." });
  }

  // Check if email already exists
  if (db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: `User with email '${email}' already exists.` });
  }

  const newUser = {
    id: `usr_${Date.now()}`,
    name,
    email,
    teamId,
    role
  };

  db.users.push(newUser);
  logAudit("User", newUser.id, "CREATE", "Admin", `Registered new team member: ${name} (${role})`);
  writeDB(db);

  res.status(201).json(newUser);
});

app.delete("/api/users/:id", (req, res) => {
  db = readDB();
  const { id } = req.params;
  const userIndex = db.users.findIndex((u: any) => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  const target = db.users[userIndex];
  
  // Protect enterprise administrator from deletion to prevent locking out of Admin
  if (target.email === "phidephefem@gmail.com") {
    return res.status(400).json({ error: "Cannot delete the primary Enterprise Administrator account." });
  }

  db.users.splice(userIndex, 1);
  logAudit("User", id, "DELETE", "Admin", `Removed team member: ${target.name} (${target.role})`);
  writeDB(db);

  res.json({ success: true, message: `User '${target.name}' deleted successfully.` });
});

// --- CLIENT-SIDE INTEGRATION ENGINES (GEMINI AI DRIVEN) ---

// 1. Intelligent Inventory Assistant Chatbot
app.post("/api/gemini/chat", async (req, res) => {
  const { message, chatHistory } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Missing message query." });
  }

  // Load current inventory and logs to inject as contextual memory
  db = readDB();
  
  const formattedItems = db.items.map((i: Item) => 
    `- ${i.name} (SKU: ${i.sku}, Stock: ${i.stock}, Threshold: ${i.minSafetyThreshold}, Supplier: ${i.supplier}, Cost: $${i.cost})`
  ).join("\n");

  const recentMovements = db.movements.slice(0, 5).map((m: Movement) => {
    const item = db.items.find((i: Item) => i.id === m.itemId);
    return `- Moved ${m.quantity}x ${item ? item.name : "Unknown"} from ${m.fromLocationId} to ${m.toLocationId} at ${m.createdAt}`;
  }).join("\n");

  const contextSystemPrompt = `You are the Omni-Channel AI Agent and Supply Chain Brain for the "INVENTORY MANAGEMENT TEAMS" operations platform.
You support three integrated teams:
- E-Commerce Fulfillment (channels Shopify, Amazon, WooCommerce)
- Manufacturing Assembly (uses BOM bills and work orders to build products)
- Field Service Engineering (manages technician service van stock and job parts dispatch)

CURRENT SYSTEM STATUS MEMORY:
MASTER ITEMS CATALOG:
${formattedItems}

RECENT RAW STOCK MOVEMENTS:
${recentMovements}

Your goal is to answer queries dynamically and with precise intelligence.
Be operational, professional, and clear.
When making suggestions, reference the exact item names, SKUs, and stock quantities above.
If you suggest reordering, calculate the safety gap.
For example, if Premium Leather Boots (Stock: 14) is below safety threshold 25, suggest reordering 11+ to hit safe levels.

Keep response concise and format nicely in readable markdown with small tables or bullet points when showing data.`;

  try {
    const client = getGeminiClient();
    if (!client) {
      // Return beautiful simulated intelligence response if no API key is specified
      const simulatedResponse = `[Simulated Operations Engine] No active GEMINI_API_KEY detected in Secrets panel. 

Based on current stock levels:
- **Premium Leather Boots (SKU-ECOM-102)** has **14 pairs** left, which is **below** the minimum safety threshold of **25**.
- **Action Recommendation**: Draft a PO for at least **11 pairs** from *Apex Footwear Ltd* to restock the East Coast Distribution Center.
- **Manufacturing WIP**: We have **300 sq ft** of Cowhide Leather and **50 Vibram Sole Inserts** available, supporting a run of up to **20 boots** before sole exhaustion.

*Please insert your actual Gemini API Key in the Settings -> Secrets menu to unlock live multi-channel LLM sync!*`;
      return res.json({ responseText: simulatedResponse });
    }

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: {
        systemInstruction: contextSystemPrompt,
        temperature: 0.7
      }
    });

    res.json({ responseText: response.text });
  } catch (err: any) {
    console.error("Gemini chatbot error:", err);
    res.status(500).json({ error: "Failed to communicate with AI Copilot.", details: err.message });
  }
});

// 2. High-Thinking Demand Forecasting Simulator
app.post("/api/gemini/forecast", async (req, res) => {
  db = readDB();
  
  const catalogContext = db.items.map((i: Item) => ({
    sku: i.sku,
    name: i.name,
    category: i.category,
    currentStock: i.stock,
    safetyThreshold: i.minSafetyThreshold,
    cost: i.cost,
    supplier: i.supplier
  }));

  const orderContext = db.orders.map((o: EcommerceOrder) => ({
    sku: o.sku,
    qty: o.quantity,
    status: o.status,
    channel: o.channel,
    date: o.createdAt
  }));

  const forecastPrompt = `Analyze the current state of our inventory platform. Generate a structured JSON demand forecast for the next 30 days.
  
  INVENTORY DATA:
  ${JSON.stringify(catalogContext, null, 2)}
  
  ACTIVE E-COMMERCE ORDERS:
  ${JSON.stringify(orderContext, null, 2)}
  
  Output a JSON object conforming exactly to this schema:
  {
    "forecast": [
      {
        "sku": "SKU code",
        "name": "Item name",
        "predictedDemand30D": 120, // number
        "riskLevel": "Low" | "Medium" | "High",
        "rationale": "Explanation based on order history and safety stock",
        "recommendedRestock": 50 // proposed quantity to order
      }
    ],
    "globalInsight": "General summary regarding manufacturing WIP, field team parts consumption bottlenecks, or holiday storefront spikes."
  }`;

  try {
    const client = getGeminiClient();
    if (!client) {
      // Mock forecast
      const mockForecast = {
        forecast: [
          {
            sku: "SKU-ECOM-102",
            name: "Premium Leather Boots",
            predictedDemand30D: 32,
            riskLevel: "High",
            rationale: "Current stock (14) is below safety limit (25). Storefront order rate exhibits regular Shopify-channel volume of 5-10 units weekly, raising active stockout threat.",
            recommendedRestock: 25
          },
          {
            sku: "SKU-MANU-509",
            name: "Industrial Grade Fasteners",
            predictedDemand30D: 250,
            riskLevel: "Low",
            rationale: "Generous warehouse reserves (450) and low production line consumption. No immediate replenishments required.",
            recommendedRestock: 0
          },
          {
            sku: "SKU-FIELD-881",
            name: "Field Testing Oscilloscope",
            predictedDemand30D: 3,
            riskLevel: "Medium",
            rationale: "Field technician Dave Miller requested replacement units for upcoming infrastructure calibrations. Buffer stock (4) is critical since Lead Time is 14 days.",
            recommendedRestock: 2
          }
        ],
        globalInsight: "[Simulation Forecast Mode] Solid material runway in Leather WIP. E-commerce stockout warning is flagged for Premium Leather Boots. Monitor service fleet parts constraints."
      };
      return res.json(mockForecast);
    }

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: forecastPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["forecast", "globalInsight"],
          properties: {
            forecast: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["sku", "name", "predictedDemand30D", "riskLevel", "rationale", "recommendedRestock"],
                properties: {
                  sku: { type: Type.STRING },
                  name: { type: Type.STRING },
                  predictedDemand30D: { type: Type.INTEGER },
                  riskLevel: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  recommendedRestock: { type: Type.INTEGER }
                }
              }
            },
            globalInsight: { type: Type.STRING }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Forecasting prompt failed:", err);
    res.status(500).json({ error: "Failed to generate AI forecasting.", details: err.message });
  }
});

// 3. Audio / Video Log Transcriber & Interpreter Simulator
app.post("/api/gemini/transcribe", (req, res) => {
  const { sampleText } = req.body;
  const technicianSpeech = sampleText || "Dave Miller from truck 4 reporting. I consumed two boxes of industrial grade fasteners SKU-MANU-509 for Comcast hub installation job, and one oscilloscope SKU-FIELD-881 is damaged beyond field calibration. Need stock replenishment dispatched.";
  
  // Return parsed intelligence mapping the natural voice memo directly to structured database properties!
  const parsedResponse = {
    originalSpeech: technicianSpeech,
    timestamp: new Date().toISOString(),
    recognizedEntities: {
      technician: "Dave Miller",
      vehicleId: "VAN-TRUCK-04",
      actions: [
        { sku: "SKU-MANU-509", quantity: 2, action: "CONSUMPTION", purpose: "Comcast hub installation" },
        { sku: "SKU-FIELD-881", quantity: 1, action: "DECOMMISSION_DAMAGE", purpose: "Field diagnostics" }
      ]
    },
    aiInterpretation: "Technician Dave Miller consumed 2 boxes of fasteners and decommissioned 1 damaged oscilloscope. System automatically prepares a Parts Dispatch Proposal for truck #4."
  };

  res.json(parsedResponse);
});

// --- VITE DEV SERVER / PRODUCTION ENTRY SETUP ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Inventory Management Enterprise Server listening on http://localhost:${PORT}`);
  });
}

startServer();
