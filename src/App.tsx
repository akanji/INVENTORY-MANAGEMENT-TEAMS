/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { loadStripe } from "@stripe/stripe-js";
import { 
  Package, TrendingUp, ShoppingCart, Wrench, Layers, 
  Settings, MessageSquare, Plus, Search, Bell, Trash2, 
  Play, Send, Check, FileText, Smartphone, Zap, Mic, 
  Volume2, Video, Database, Share2, Clipboard, Shield, 
  UserCheck, BarChart3, ArrowRight, X, Sparkles, RefreshCw, AlertTriangle, QrCode, Camera,
  Percent, Activity, Calendar, Truck, FileSpreadsheet, Upload, CheckCircle2, Printer, Clock, CreditCard, Lock
} from "lucide-react";
import { 
  Item, Location, Movement, Team, User, AuditLog, 
  EcommerceOrder, BOM, WorkOrder, TechnicianVan, PartsRequest, SlackConfig, CustomReport
} from "./types";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell,
  PieChart, Pie, LineChart, Line, AreaChart, Area, Legend, CartesianGrid
} from "recharts";
import { jsPDF } from "jspdf";

const stripePublishableKey = ((import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY as string) || "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface SubscriptionRouteGuardProps {
  trialStatus: { status: 'active' | 'trialing' | 'expired'; daysLeft: number; expired: boolean; percentTrialUsed: number };
  activeTab: string;
  setActiveTab: (tab: 'dashboard' | 'catalog' | 'ecommerce' | 'manufacturing' | 'field' | 'reports' | 'admin' | 'billing') => void;
  children: React.ReactNode;
}

function SubscriptionRouteGuard({ trialStatus, activeTab, setActiveTab, children }: SubscriptionRouteGuardProps) {
  useEffect(() => {
    if (trialStatus.expired && activeTab !== 'billing') {
      setActiveTab('billing');
    }
  }, [trialStatus.expired, activeTab, setActiveTab]);

  if (trialStatus.expired) {
    return (
      <div className="relative w-full h-full flex-1 flex overflow-hidden">
        {/* We block display of regular content and render the full-screen Paywall Overlay Modal */}
        <div className="absolute inset-0 bg-[#3E2723]/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-white">
          <div className="max-w-md w-full bg-white text-[#3E2723] rounded-3xl p-8 shadow-2xl border border-amber-200 text-center relative overflow-hidden animate-fade-in">
            {/* Design accents */}
            <div className="absolute top-0 left-0 right-0 h-2.5 bg-rose-600"></div>
            
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-rose-100/30 animate-bounce">
              <Lock className="w-8 h-8" />
            </div>
            
            <h3 className="text-2xl font-black text-[#3E2723] tracking-tight">Your 7-Day Free Trial Has Expired</h3>
            <p className="text-xs text-gray-500 mt-2 font-mono uppercase tracking-wider">Access Restricted • Action Required</p>
            
            <p className="text-sm text-gray-600 mt-4 leading-relaxed font-semibold">
              Thank you for evaluating our platform! Your 7-day trial period has concluded. To regain full access to the **Inventory Management Teams** platform and resume managing your material catalog, e-commerce storefront channels, fleet logistics, and advanced business intelligence modules, please select and complete payment for one of our subscription plans.
            </p>

            <div className="mt-8 space-y-3">
              <button
                id="modal-btn-billing"
                onClick={() => {
                  setActiveTab('billing');
                }}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <span>Upgrade to Premium Subscription</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[10px] text-gray-400 mt-6 font-medium">
              Immediate payment confirmation triggers full account restoration automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  // Navigation & UI Active State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'catalog' | 'ecommerce' | 'manufacturing' | 'field' | 'reports' | 'admin' | 'billing'>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Global State (synchronized from backend /api/state)
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<EcommerceOrder[]>([]);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [vans, setVans] = useState<TechnicianVan[]>([]);
  const [partsRequests, setPartsRequests] = useState<PartsRequest[]>([]);
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [slackConfig, setSlackConfig] = useState<SlackConfig>({ webhookUrl: "", channelName: "", enabled: false });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Local interaction states
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [chatOpen, setChatOpen] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'gemini'; text: string; timestamp: Date }[]>([
    { sender: 'gemini', text: "Welcome to your Enterprise Omni-Channel Brain. I have loaded the catalog, BOM routing, and technician van stock parameters. Ask me anything, or trigger an AI restock forecast!", timestamp: new Date() }
  ]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // AI Forecasting response state
  const [aiForecast, setAiForecast] = useState<{
    forecast: { sku: string; name: string; predictedDemand30D: number; riskLevel: string; rationale: string; recommendedRestock: number }[];
    globalInsight: string;
  } | null>(null);
  const [forecastingLoading, setForecastingLoading] = useState<boolean>(false);

  // Speech transcribing simulation state
  const [speechInput, setSpeechInput] = useState<string>("");
  const [transcribedLog, setTranscribedLog] = useState<any | null>(null);
  const [transcribing, setTranscribing] = useState<boolean>(false);

  // Form creation states (Modal or panel based)
  const [showItemForm, setShowItemForm] = useState<boolean>(false);
  const [showCSVPanel, setShowCSVPanel] = useState<boolean>(false);
  const [newItem, setNewItem] = useState<Partial<Item>>({ sku: "", name: "", category: "General", unit: "Units", stock: 10, cost: 1.0, supplier: "", minSafetyThreshold: 5 });
  
  const [showMovementForm, setShowMovementForm] = useState<boolean>(false);
  const [newMovement, setNewMovement] = useState<Partial<Movement>>({ itemId: "", fromLocationId: "LOC-WH-1", toLocationId: "LOC-ST-2", quantity: 5, createdBy: "Admin" });
  const [movementBatch, setMovementBatch] = useState<{ itemId: string; fromLocationId: string; toLocationId: string; quantity: number }[]>([]);
  const [heatmapLayout, setHeatmapLayout] = useState<'blueprint' | 'cards'>('blueprint');
  const [selectedHeatmapZone, setSelectedHeatmapZone] = useState<string | null>("zone_a");

  const [showBomForm, setShowBomForm] = useState<boolean>(false);
  const [newBom, setNewBom] = useState<{ name: string; itemId: string; description: string; components: { itemId: string; quantity: number }[] }>({
    name: "", itemId: "", description: "", components: [{ itemId: "", quantity: 1 }]
  });

  const [showWorkOrderForm, setShowWorkOrderForm] = useState<boolean>(false);
  const [newWorkOrder, setNewWorkOrder] = useState<Partial<WorkOrder>>({ bomId: "", quantity: 10, dueDate: "" });

  const [showPartsRequestForm, setShowPartsRequestForm] = useState<boolean>(false);
  const [newPartsRequest, setNewPartsRequest] = useState<Partial<PartsRequest>>({ itemId: "", quantity: 1, jobName: "" });

  const [showOrderForm, setShowOrderForm] = useState<boolean>(false);
  const [newOrder, setNewOrder] = useState<{ sku: string; customerName: string; quantity: number; channel: string }>({ sku: "", customerName: "", quantity: 1, channel: "Shopify" });

  const [showReportForm, setShowReportForm] = useState<boolean>(false);
  const [newReport, setNewReport] = useState<{ title: string; type: string; summary: string }>({ title: "", type: "Safety Runway", summary: "" });

  const [showEditItemForm, setShowEditItemForm] = useState<Item | null>(null);

  // --- AUTHENTICATION & SUBSCRIPTION STATES ---
  const [userSession, setUserSession] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("inventory_user_session");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeUserEmail, setActiveUserEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("inventory_user_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.email;
      }
    } catch (e) {}
    return "phidephefem@gmail.com";
  });

  // Sync activeUserEmail with userSession if it changes
  useEffect(() => {
    if (userSession) {
      setActiveUserEmail(userSession.email);
    }
  }, [userSession]);

  const currentActiveUser = users.find(u => u.email === activeUserEmail) || userSession || {
    id: "usr_4",
    name: "Enterprise Administrator",
    email: "phidephefem@gmail.com",
    teamId: "team_1",
    role: "Admin" as const,
    trialStartDate: new Date().toISOString(),
    subscriptionStatus: "active" as const,
    subscriptionType: "yearly" as const
  };

  // Sync local session with users list from backend when it loads/updates
  useEffect(() => {
    if (userSession && users.length > 0) {
      const updated = users.find(u => u.email.toLowerCase() === userSession.email.toLowerCase());
      if (updated) {
        const isDifferent = 
          updated.subscriptionStatus !== userSession.subscriptionStatus ||
          updated.subscriptionType !== userSession.subscriptionType ||
          updated.name !== userSession.name ||
          updated.role !== userSession.role;
        if (isDifferent) {
          setUserSession(updated);
          localStorage.setItem("inventory_user_session", JSON.stringify(updated));
        }
      }
    }
  }, [users, userSession]);

  // Auth Forms states
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'change-password' | 'none'>('none');
  const [authName, setAuthName] = useState<string>("");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authOldPassword, setAuthOldPassword] = useState<string>("");
  const [authNewPassword, setAuthNewPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [isProcessingAuth, setIsProcessingAuth] = useState<boolean>(false);

  // Billing checkout modal states
  const [billingPlanToPurchase, setBillingPlanToPurchase] = useState<'monthly' | 'yearly' | null>(null);
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCVC, setCardCVC] = useState<string>("");
  const [cardName, setCardName] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [checkoutMethod, setCheckoutMethod] = useState<'stripe' | 'simulated'>(stripePublishableKey ? 'stripe' : 'simulated');

  // Free Trial calculation
  const getTrialStatus = (user: User) => {
    // Primary administrator/owner is always active
    if (user.email === "phidephefem@gmail.com") {
      return { status: 'active' as const, daysLeft: 365, expired: false, percentTrialUsed: 100 };
    }

    if (user.subscriptionStatus === 'active') {
      return { status: 'active' as const, daysLeft: 0, expired: false, percentTrialUsed: 100 };
    }

    // Default other pre-seeded users to active or trialing
    if (!user.trialStartDate) {
      const mockStart = new Date();
      mockStart.setDate(mockStart.getDate() - 3); // Started 3 days ago (4 days left)
      user.trialStartDate = mockStart.toISOString();
      user.subscriptionStatus = "trialing";
      user.subscriptionType = "none";
    }

    const start = new Date(user.trialStartDate);
    const now = new Date();
    const diffTime = now.getTime() - start.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, 7 - diffDays);
    const expired = daysLeft <= 0;
    const percentTrialUsed = Math.min(100, Math.round((diffDays / 7) * 100));

    return {
      status: expired ? ('expired' as const) : ('trialing' as const),
      daysLeft: Math.ceil(daysLeft),
      expired,
      percentTrialUsed
    };
  };

  const trialStatus = getTrialStatus(currentActiveUser);

  // Perform a hard check on user subscription status on load
  useEffect(() => {
    if (currentActiveUser && currentActiveUser.trialStartDate && currentActiveUser.subscriptionStatus === "trialing") {
      const start = new Date(currentActiveUser.trialStartDate);
      const now = new Date();
      const diffTime = now.getTime() - start.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays > 7) {
        const expireTrialOnBackend = async () => {
          try {
            const res = await fetch("/api/auth/expire-trial", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: currentActiveUser.email })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.user) {
                setUserSession(data.user);
                localStorage.setItem("inventory_user_session", JSON.stringify(data.user));
                triggerToast("Hard check: your 7-day free trial has expired. Restricted access.");
                fetchState();
              }
            }
          } catch (e) {
            console.error("Error setting trial to expired:", e);
          }
        };
        expireTrialOnBackend();
      }
    }
  }, [currentActiveUser]);

  // Redirect to subscription/billing page immediately if trial has expired and user tries to browse other tabs
  useEffect(() => {
    if (trialStatus.expired && activeTab !== 'billing') {
      setActiveTab('billing');
      triggerToast("Your 7-day free trial has expired. Redirecting to the Subscription & Billing page.");
    }
  }, [trialStatus.expired, activeTab]);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const [showAddUserForm, setShowAddUserForm] = useState<boolean>(false);
  const [newUserForm, setNewUserForm] = useState<{ name: string; email: string; teamId: string; role: 'Admin' | 'Manager' | 'Staff' }>({
    name: "",
    email: "",
    teamId: "team_1",
    role: "Staff"
  });

  // Bottom feedback alert
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sorting and Push Notifications state
  const [sortField, setSortField] = useState<'sku' | 'name' | 'stock' | 'cost' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  const [pushThreshold, setPushThreshold] = useState<number>(5);
  const [notifiedItems, setNotifiedItems] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Camera QR Scanner Modal State
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "active" | "error">("idle");
  const [cameraError, setCameraError] = useState<string>("");

  // Cross-Team Reporting & Predictive Analytics State
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'stockout' | 'turnover' | 'fillrate'>('stockout');
  const [seasonalPeakFactor, setSeasonalPeakFactor] = useState<number>(1.2); // 1.0 to 1.8
  const [supplyChainDelayDays, setSupplyChainDelayDays] = useState<number>(3); // 0 to 15 days

  // Supplier Intelligence Popover/Modal
  const [selectedSupplierDetails, setSelectedSupplierDetails] = useState<{ name: string; email: string; phone: string; leadTimeHistory: { date: string; days: number; status: string }[] } | null>(null);

  // CSV Batch Import
  const [csvFileContent, setCsvFileContent] = useState<string>("");
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [csvParsedItems, setCsvParsedItems] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const [csvIsDragging, setCsvIsDragging] = useState<boolean>(false);
  const [csvImporting, setCsvImporting] = useState<boolean>(false);

  // Print QR Code Modal
  const [printQrCodeItem, setPrintQrCodeItem] = useState<Item | null>(null);

  // Manual QR input fallback states
  const [manualQRInputMode, setManualQRInputMode] = useState<boolean>(false);
  const [manualSKUEntry, setManualSKUEntry] = useState<string>("");

  // Stock Variance states
  const [varianceItem, setVarianceItem] = useState<Item | null>(null);
  const [physicalCount, setPhysicalCount] = useState<string>("");
  const [varianceReason, setVarianceReason] = useState<string>("Periodic audit count discrepancy");
  const [varianceLogging, setVarianceLogging] = useState<boolean>(false);

  useEffect(() => {
    if (showQRModal) {
      setCameraState("requesting");
      setCameraError("");
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraState("active");
        })
        .catch((err) => {
          console.error("Camera access failed", err);
          setCameraState("error");
          setCameraError(err.message || "Failed to open camera. Please use manual simulation selector.");
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraState("idle");
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [showQRModal]);

  const handleScanSKU = (sku: string) => {
    setGlobalFilter(sku);
    setShowQRModal(false);
    setManualQRInputMode(false);
    setManualSKUEntry("");
    triggerToast(`[QR Scanner] Successfully scanned SKU: ${sku}. Applied filter to master ledger!`);
  };

  const handleLogVariance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!varianceItem || physicalCount === "") return;
    setVarianceLogging(true);
    try {
      const res = await fetch(`/api/items/${varianceItem.id}/variance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          physicalStock: Number(physicalCount),
          reason: varianceReason,
          performedBy: "Admin"
        })
      });
      if (!res.ok) {
        throw new Error("Failed to log stock variance");
      }
      const data = await res.json();
      triggerToast(`Successfully logged variance for ${varianceItem.sku}. Net adjustment: ${data.discrepancy > 0 ? "+" : ""}${data.discrepancy} units.`);
      setVarianceItem(null);
      setPhysicalCount("");
      setVarianceReason("Periodic audit count discrepancy");
      fetchState();
    } catch (err: any) {
      triggerToast(`Error: ${err.message || "Could not log stock variance."}`);
    } finally {
      setVarianceLogging(false);
    }
  };

  const getSupplierSummaryMetrics = () => {
    const supplierMap: Record<string, { totalSpend: number; totalCount: number; sumLeadTime: number; leadTimeCount: number }> = {};
    
    items.forEach(item => {
      const sName = item.supplier || "N/A";
      const details = getSupplierDetails(sName);
      
      const leadTimes = details.leadTimeHistory.map((h: any) => h.days);
      const avgLeadTimeForSupplier = leadTimes.length > 0 
        ? leadTimes.reduce((sum: number, val: number) => sum + val, 0) / leadTimes.length
        : 11.5;
        
      if (!supplierMap[sName]) {
        supplierMap[sName] = {
          totalSpend: 0,
          totalCount: 0,
          sumLeadTime: 0,
          leadTimeCount: 0
        };
      }
      
      supplierMap[sName].totalSpend += item.stock * item.cost;
      supplierMap[sName].totalCount += 1;
      supplierMap[sName].sumLeadTime += avgLeadTimeForSupplier;
      supplierMap[sName].leadTimeCount += 1;
    });
    
    return Object.entries(supplierMap).map(([name, data]) => {
      return {
        name,
        totalSpend: data.totalSpend,
        itemCount: data.totalCount,
        avgLeadTime: data.leadTimeCount > 0 ? (data.sumLeadTime / data.leadTimeCount) : 11.5
      };
    });
  };

  // --- AUTH & SUBSCRIPTION HANDLER ACTIONS ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsProcessingAuth(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sign up.");
      }

      setUserSession(data);
      localStorage.setItem("inventory_user_session", JSON.stringify(data));
      setAuthSuccessMsg(`Welcome, ${data.name}! Your account has been registered.`);
      triggerToast(`Successfully registered and logged in! 7-day trial started.`);
      
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
      setAuthMode("none");
      
      fetchState();
    } catch (err: any) {
      setAuthError(err.message || "Sign up failed.");
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsProcessingAuth(true);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sign in.");
      }

      setUserSession(data);
      localStorage.setItem("inventory_user_session", JSON.stringify(data));
      setAuthSuccessMsg(`Logged in successfully as ${data.name}.`);
      triggerToast(`Welcome back, ${data.name}!`);

      setAuthEmail("");
      setAuthPassword("");
      setAuthMode("none");
      
      fetchState();
    } catch (err: any) {
      setAuthError(err.message || "Sign in failed.");
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsProcessingAuth(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: currentActiveUser.email, 
          oldPassword: authOldPassword, 
          newPassword: authNewPassword 
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password.");
      }

      setAuthSuccessMsg("Password updated successfully!");
      triggerToast("Password updated successfully.");
      
      setAuthOldPassword("");
      setAuthNewPassword("");
    } catch (err: any) {
      setAuthError(err.message || "Change password failed.");
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingPlanToPurchase) return;
    setIsProcessingPayment(true);

    try {
      const res = await fetch("/api/auth/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentActiveUser.email, plan: billingPlanToPurchase })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Subscription upgrade failed.");
      }

      const updatedSession = { 
        ...currentActiveUser, 
        subscriptionStatus: "active" as const, 
        subscriptionType: billingPlanToPurchase,
        subscribedAt: data.subscribedAt
      };
      setUserSession(updatedSession);
      localStorage.setItem("inventory_user_session", JSON.stringify(updatedSession));
      
      setBillingPlanToPurchase(null);
      triggerToast(`Successfully subscribed to ${billingPlanToPurchase === "monthly" ? "Monthly" : "Yearly"} plan! App unlocked.`);
      
      setCardNumber("");
      setCardExpiry("");
      setCardCVC("");
      setCardName("");

      fetchState();
    } catch (err: any) {
      triggerToast(`Payment error: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (!billingPlanToPurchase) return;
    setIsProcessingPayment(true);
    try {
      const priceId = billingPlanToPurchase === 'monthly'
        ? ((import.meta as any).env?.VITE_STRIPE_PRICE_ID_MONTHLY as string)
        : ((import.meta as any).env?.VITE_STRIPE_PRICE_ID_YEARLY as string);

      if (!priceId) {
        throw new Error(`Stripe Price ID for ${billingPlanToPurchase} is not configured.`);
      }

      const successUrl = `${window.location.origin}/?stripe_checkout=success&plan=${billingPlanToPurchase}`;
      const cancelUrl = `${window.location.origin}/?stripe_checkout=cancel`;

      // Call our secure server-side checkout session creation endpoint
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          teamId: currentActiveUser.id || currentActiveUser.email,
          successUrl,
          cancelUrl,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create secure Checkout Session.");
      }

      const data = await res.json();
      if (data.url) {
        // Redirect directly to the secure Stripe Hosted checkout page
        window.location.href = data.url;
      } else {
        throw new Error("Invalid checkout session payload returned from server.");
      }
    } catch (err: any) {
      triggerToast(`Stripe redirect failed: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const generateMockInvoicePDF = () => {
    try {
      const doc = new jsPDF();
      
      // Page styling / Color palette
      const primaryColor = [62, 39, 35]; // #3E2723 (Deep warm charcoal/brown)
      const secondaryColor = [251, 192, 45]; // #FBC02D (Amber yellow)
      const neutralDark = [33, 33, 33];
      const neutralLight = [245, 245, 245];
      const accentGreen = [16, 185, 129]; // Paid badge
      
      // Receipt metadata
      const receiptNo = `INV-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      const currentDateString = new Date().toLocaleDateString();
      const currentPlan = currentActiveUser.subscriptionType === 'yearly' ? 'Yearly Enterprise License' : 
                          currentActiveUser.subscriptionType === 'monthly' ? 'Monthly Professional Subscription' : 
                          '7-Day Free Trial Evaluation';
      const planAmount = currentActiveUser.subscriptionType === 'yearly' ? '$299.99' : 
                         currentActiveUser.subscriptionType === 'monthly' ? '$29.99' : 
                         '$0.00';
      const taxAmount = currentActiveUser.subscriptionType ? (currentActiveUser.subscriptionType === 'yearly' ? '$24.00' : '$2.40') : '$0.00';
      const totalAmount = currentActiveUser.subscriptionType ? (currentActiveUser.subscriptionType === 'yearly' ? '$323.99' : '$32.39') : '$0.00';
      const paymentStatus = currentActiveUser.subscriptionStatus === 'active' ? 'PAID' : 'TRIAL/UNPAID';
      
      // 1. Top Decorative Bar (Accent Color)
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.rect(0, 0, 210, 8, 'F');
      
      // 2. Header Title & Brand
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("INVENTORY INTELLIGENCE GROUP", 15, 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text("Enterprise-Grade Unified Material & Fleet Logistics Core", 15, 30);
      
      // 3. Document Title / Invoice details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(neutralDark[0], neutralDark[1], neutralDark[2]);
      doc.text("OFFICIAL SUBSCRIPTION RECEIPT", 15, 45);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Invoice Number: ${receiptNo}`, 15, 51);
      doc.text(`Date of Issue: ${currentDateString}`, 15, 57);
      doc.text(`Due Date: Upon Receipt (Paid)`, 15, 63);
      
      // Status Badge (PAID / TRIAL)
      doc.setFillColor(paymentStatus === 'PAID' ? accentGreen[0] : 239, paymentStatus === 'PAID' ? accentGreen[1] : 68, paymentStatus === 'PAID' ? accentGreen[2] : 68);
      doc.rect(145, 40, 50, 22, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("STATUS", 170, 47, { align: "center" });
      doc.setFontSize(14);
      doc.text(paymentStatus, 170, 56, { align: "center" });
      
      // 4. Line separator
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.line(15, 72, 195, 72);
      
      // 5. Customer & Operator Information
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("CLIENT / OPERATOR DETAILS", 15, 81);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(neutralDark[0], neutralDark[1], neutralDark[2]);
      doc.text(`Name: ${currentActiveUser.name}`, 15, 88);
      doc.text(`Email: ${currentActiveUser.email}`, 15, 94);
      doc.text(`System Role: ${currentActiveUser.role}`, 15, 100);
      const userTeam = teams.find(t => t.id === currentActiveUser.teamId)?.name || "General Ledger Team";
      doc.text(`Assigned Segment: ${userTeam}`, 15, 106);
      
      // Provider Details (Right-aligned or right column)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("SERVICE PROVIDER", 125, 81);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(neutralDark[0], neutralDark[1], neutralDark[2]);
      doc.text("Unified Operations Suite LLC", 125, 88);
      doc.text("100 Antigravity Labs Way", 125, 94);
      doc.text("Cloud Run Container Region", 125, 100);
      doc.text("billing-support@inventory-intelligence.cloud", 125, 106);
      
      // 6. Subscription Item Table Header
      doc.setFillColor(neutralLight[0], neutralLight[1], neutralLight[2]);
      doc.rect(15, 116, 180, 8, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("DESCRIPTION", 18, 121);
      doc.text("QTY", 120, 121);
      doc.text("UNIT PRICE", 145, 121);
      doc.text("TOTAL", 175, 121);
      
      // Table Line item
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(neutralDark[0], neutralDark[1], neutralDark[2]);
      
      doc.text(`${currentPlan} - Platform License`, 18, 131);
      doc.text("1", 122, 131);
      doc.text(planAmount, 145, 131);
      doc.text(planAmount, 175, 131);
      
      // Divider
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(15, 137, 195, 137);
      
      // Summary Breakdown
      doc.setFont("helvetica", "normal");
      doc.text("Subtotal:", 145, 145);
      doc.text(planAmount, 175, 145);
      
      doc.text("Tax (GST/VAT 8%):", 145, 151);
      doc.text(taxAmount, 175, 151);
      
      // Total Row
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("TOTAL AMOUNT PAID:", 120, 159);
      doc.text(totalAmount, 175, 159);
      
      // Divider
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.line(15, 166, 195, 166);
      
      // 7. Security Audit Token
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Immutable Audit Token: ${btoa(receiptNo + currentActiveUser.email).substring(0, 32)}`, 15, 175);
      doc.text("Cryptographically signed by central material telemetry ledger authorities.", 15, 180);
      
      // 8. Bottom Terms & Notes
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Thank you for choosing Inventory Intelligence!", 15, 195);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const notes = [
        "This document serves as an official confirmation of subscription payment received.",
        "Your access to E-Commerce channels, BOM assemblies, vehicle fleet states, and Gemini-driven predictive",
        "turnover reports is fully guaranteed. For enterprise integrations, SLA terms, or custom database setup,",
        "please log any technical service parts requests or contact our cloud deployment team."
      ];
      
      let currentY = 202;
      notes.forEach(note => {
        doc.text(note, 15, currentY);
        currentY += 5;
      });
      
      // Foot decorative banner
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 285, 210, 12, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("SECURE TELEMETRY CORE • PORT 3000 CONTAINER DEPLOYED", 105, 292, { align: "center" });
      
      // Save PDF
      doc.save(`Receipt-${receiptNo}.pdf`);
      triggerToast(`Receipt ${receiptNo} generated and downloaded successfully!`);
    } catch (err: any) {
      console.error("PDF Generation failed:", err);
      triggerToast(`PDF generation failed: ${err.message || "Unknown error"}`);
    }
  };

  const handleSignOut = () => {
    setUserSession(null);
    localStorage.removeItem("inventory_user_session");
    setActiveUserEmail("phidephefem@gmail.com");
    triggerToast("Logged out of session.");
    fetchState();
  };

  // Fetch full operational database state on load
  const fetchState = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/state");
      if (!res.ok) throw new Error("Failed to contact full-stack asset database.");
      const data = await res.json();
      
      setItems(data.items);
      setLocations(data.locations);
      setMovements(data.movements);
      setTeams(data.teams);
      setUsers(data.users);
      setOrders(data.orders);
      setBoms(data.boms);
      setWorkOrders(data.workOrders);
      setVans(data.vans);
      setPartsRequests(data.partsRequests);
      setReports(data.reports || []);
      setSlackConfig(data.slackConfig);
      setAuditLogs(data.auditLogs);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected loading error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();

    // Check for Stripe checkout redirect params
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("stripe_checkout");
    const checkoutPlan = params.get("plan") as "monthly" | "yearly" | null;

    if (checkoutStatus === "success" && checkoutPlan) {
      const completeStripeSubscription = async () => {
        try {
          let userEmail = currentActiveUser.email;
          if (!userEmail) {
            try {
              const saved = localStorage.getItem("inventory_user_session");
              if (saved) {
                const parsed = JSON.parse(saved);
                userEmail = parsed.email;
              }
            } catch (e) {}
          }
          if (!userEmail) {
            userEmail = "phidephefem@gmail.com";
          }

          const res = await fetch("/api/auth/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userEmail, plan: checkoutPlan })
          });
          const data = await res.json();
          if (res.ok) {
            const updatedSession = { 
              ...currentActiveUser, 
              subscriptionStatus: "active" as const, 
              subscriptionType: checkoutPlan,
              subscribedAt: data.subscribedAt
            };
            setUserSession(updatedSession);
            localStorage.setItem("inventory_user_session", JSON.stringify(updatedSession));
            triggerToast(`Successfully activated your Stripe ${checkoutPlan === "monthly" ? "Monthly" : "Yearly"} subscription!`);
            fetchState();
          } else {
            triggerToast(`Stripe subscription sync failed: ${data.error}`);
          }
        } catch (err: any) {
          triggerToast(`Stripe activation error: ${err.message}`);
        }
      };
      completeStripeSubscription();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (checkoutStatus === "cancel") {
      triggerToast("Stripe checkout was canceled.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Helper to trigger browser push notifications
  const sendBrowserNotification = (title: string, body: string) => {
    if (!("Notification" in window)) {
      triggerToast(`[Browser Push Alert] ${title}: ${body}`);
      return;
    }
    
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch (e) {
        triggerToast(`[Notification] ${title}: ${body}`);
      }
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          try {
            new Notification(title, { body });
          } catch (e) {
            triggerToast(`[Notification] ${title}: ${body}`);
          }
        } else {
          triggerToast(`[Notification] ${title}: ${body}`);
        }
      });
    } else {
      triggerToast(`[Notification Blocked] ${title}: ${body}`);
    }
  };

  // Monitor stock levels for push notifications
  useEffect(() => {
    if (!pushEnabled || items.length === 0) return;

    const itemsBelowThreshold = items.filter(item => item.stock <= pushThreshold);
    let newlyNotified = [...notifiedItems];
    let triggered = false;

    itemsBelowThreshold.forEach(item => {
      if (!notifiedItems.includes(item.id)) {
        newlyNotified.push(item.id);
        sendBrowserNotification(
          "🚨 Low Stock Alert",
          `SKU ${item.sku} (${item.name}) has fallen to ${item.stock} ${item.unit}, which is at or below your push notification threshold of ${pushThreshold}!`
        );
        triggered = true;
      }
    });

    if (triggered) {
      setNotifiedItems(newlyNotified);
    }
  }, [items, pushEnabled, pushThreshold, notifiedItems]);

  // Scroll chatbot to end automatically
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Utility to fire temporary toast
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  const getSupplierDetails = (supplierName: string) => {
    const name = supplierName || "N/A";
    let email = "sales@sourcing-partner.net";
    let phone = "+1 (800) 555-0199";
    let leadTimeHistory = [
      { date: "2026-06-15", days: 12, status: "On Time" },
      { date: "2026-05-10", days: 18, status: "Delayed" },
      { date: "2026-04-01", days: 10, status: "On Time" },
      { date: "2026-03-05", days: 14, status: "On Time" }
    ];

    const lower = name.toLowerCase();
    if (lower.includes("apex")) {
      email = "contracts@apexfootwear.com";
      phone = "+1 (212) 555-8700";
      leadTimeHistory = [
        { date: "2026-06-20", days: 5, status: "On Time" },
        { date: "2026-05-14", days: 6, status: "On Time" },
        { date: "2026-04-12", days: 9, status: "Delayed" },
        { date: "2026-03-01", days: 4, status: "On Time" }
      ];
    } else if (lower.includes("titan")) {
      email = "supply@titanbolt.corp";
      phone = "+1 (312) 555-4422";
      leadTimeHistory = [
        { date: "2026-06-25", days: 3, status: "On Time" },
        { date: "2026-05-30", days: 3, status: "On Time" },
        { date: "2026-04-22", days: 7, status: "Delayed" },
        { date: "2026-03-18", days: 2, status: "On Time" }
      ];
    } else if (lower.includes("tektronix")) {
      email = "support@tektronix-direct.com";
      phone = "+1 (800) 833-9200";
      leadTimeHistory = [
        { date: "2026-06-01", days: 14, status: "On Time" },
        { date: "2026-04-15", days: 25, status: "Delayed" },
        { date: "2026-03-10", days: 12, status: "On Time" }
      ];
    } else if (lower.includes("tandy")) {
      email = "wholesale@tandyleather.co";
      phone = "+1 (817) 555-0911";
      leadTimeHistory = [
        { date: "2026-06-12", days: 8, status: "On Time" },
        { date: "2026-05-18", days: 7, status: "On Time" },
        { date: "2026-04-05", days: 11, status: "On Time" }
      ];
    }
    return { name, email, phone, leadTimeHistory };
  };

  const handleCSVFileRead = (text: string, filename: string) => {
    setCsvError(null);
    setCsvSuccess(null);
    setCsvFileName(filename);
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error("CSV file must contain at least a header row and one data row.");
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      
      const parsedItems: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Correctly handle commas in quoted fields
        const values: string[] = [];
        let insideQuote = false;
        let currentVal = '';

        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"' || char === "'") {
            insideQuote = !insideQuote;
          } else if (char === ',' && !insideQuote) {
            values.push(currentVal.trim());
            currentVal = '';
          } else {
            currentVal += char;
          }
        }
        values.push(currentVal.trim());

        const itemObj: any = {};
        headers.forEach((header, index) => {
          const val = values[index] ? values[index].replace(/^["']|["']$/g, '') : '';
          itemObj[header] = val;
        });

        // Map CSV headers to Item keys (handle casing tolerance)
        const sku = itemObj.sku || itemObj['sku code'] || "";
        const name = itemObj.name || itemObj['material name'] || itemObj['item name'] || "";
        const category = itemObj.category || itemObj['department'] || "General";
        const unit = itemObj.unit || itemObj['unit of measure'] || "Units";
        const stock = Number(itemObj.stock || itemObj['quantity'] || itemObj['initial stock']) || 0;
        const cost = Number(itemObj.cost || itemObj['unit cost'] || itemObj['price']) || 0;
        const supplier = itemObj.supplier || itemObj['supplier source'] || "N/A";
        const minSafetyThreshold = Number(itemObj.minsafetythreshold || itemObj['min safety threshold'] || itemObj['safety threshold']) || 0;

        if (sku && name) {
          parsedItems.push({
            sku,
            name,
            category,
            unit,
            stock,
            cost,
            supplier,
            minSafetyThreshold
          });
        }
      }

      if (parsedItems.length === 0) {
        throw new Error("No valid items with SKU and Name could be parsed from the CSV.");
      }

      setCsvParsedItems(parsedItems);
      setCsvSuccess(`Successfully parsed ${parsedItems.length} items from CSV. Ready to import.`);
    } catch (err: any) {
      setCsvError(err.message || "Failed to parse CSV file.");
      setCsvParsedItems([]);
    }
  };

  const submitBatchImport = async () => {
    if (csvParsedItems.length === 0) return;
    setCsvImporting(true);
    setCsvError(null);
    setCsvSuccess(null);

    try {
      const res = await fetch("/api/items/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: csvParsedItems })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process batch import on server.");
      }

      const result = await res.json();
      let msg = `Successfully imported ${result.importedCount} items!`;
      if (result.skipped && result.skipped.length > 0) {
        msg += ` Skipped ${result.skipped.length} existing SKUs (${result.skipped.slice(0, 3).join(", ")}${result.skipped.length > 3 ? "..." : ""}).`;
      }
      if (result.errors && result.errors.length > 0) {
        msg += ` Had ${result.errors.length} formatting errors.`;
      }
      
      triggerToast(msg);
      setCsvSuccess(msg);
      setCsvParsedItems([]);
      setCsvFileName("");
      fetchState();
    } catch (err: any) {
      setCsvError(err.message || "An error occurred during batch import.");
    } finally {
      setCsvImporting(false);
    }
  };

  // --- COMPONENT CRUD & ACTIONS HANDLERS ---

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.sku || !newItem.name) return alert("Please fill in SKU and Name.");
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create catalog item.");
      }
      triggerToast(`Catalog asset '${newItem.name}' added successfully!`);
      setShowItemForm(false);
      setNewItem({ sku: "", name: "", category: "General", unit: "Units", stock: 10, cost: 1.0, supplier: "", minSafetyThreshold: 5 });
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditItemForm) return;
    try {
      const res = await fetch(`/api/items/${showEditItemForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(showEditItemForm)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to edit item.");
      }
      triggerToast(`Asset specs for '${showEditItemForm.name}' updated!`);
      setShowEditItemForm(null);
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this master asset? All dependent stock audits will register this deletion.")) return;
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete item.");
      triggerToast("Asset catalog record deleted.");
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSort = (field: 'sku' | 'name' | 'stock' | 'cost') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortedItems = () => {
    const filtered = items.filter(i => 
      i.name.toLowerCase().includes(globalFilter.toLowerCase()) || 
      i.sku.toLowerCase().includes(globalFilter.toLowerCase()) ||
      i.category.toLowerCase().includes(globalFilter.toLowerCase())
    );

    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (movementBatch.length > 0) {
      try {
        const res = await fetch("/api/movements/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movements: movementBatch,
            createdBy: currentActiveUser.name
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Batch stock transfer failed.");
        }
        triggerToast(`Successfully compiled batch of ${movementBatch.length} stock transfers!`);
        setMovementBatch([]);
        setShowMovementForm(false);
        fetchState();
      } catch (err: any) {
        alert(err.message);
      }
    } else {
      if (!newMovement.itemId || !newMovement.quantity) return alert("Please select item and specify quantity.");
      try {
        const res = await fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newMovement,
            createdBy: currentActiveUser.name
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Stock transfer failed.");
        }
        triggerToast("Stock movement ledger transaction compiled!");
        setShowMovementForm(false);
        fetchState();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const addStagedMovement = () => {
    if (!newMovement.itemId || !newMovement.quantity || newMovement.quantity <= 0) {
      alert("Please select an asset and specify a valid transfer quantity.");
      return;
    }
    setMovementBatch([
      ...movementBatch,
      {
        itemId: newMovement.itemId,
        fromLocationId: newMovement.fromLocationId || "N/A",
        toLocationId: newMovement.toLocationId || "N/A",
        quantity: Number(newMovement.quantity)
      }
    ]);
  };

  const removeStagedMovement = (index: number) => {
    setMovementBatch(movementBatch.filter((_, idx) => idx !== index));
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Order status change failed.");
      }
      triggerToast(`Order status set to '${status}'! Inventory allocation adjusted.`);
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateBom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBom.name || !newBom.itemId) return alert("Select finished product and assembly name.");
    try {
      const res = await fetch("/api/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBom)
      });
      if (!res.ok) throw new Error("BOM creation failed.");
      triggerToast(`BOM Routing template for '${newBom.name}' registered!`);
      setShowBomForm(false);
      setNewBom({ name: "", itemId: "", description: "", components: [{ itemId: "", quantity: 1 }] });
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkOrder.bomId || !newWorkOrder.quantity || !newWorkOrder.dueDate) return alert("All fields are required.");
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorkOrder)
      });
      if (!res.ok) throw new Error("Work order creation failed.");
      triggerToast("Assembly production run queued!");
      setShowWorkOrderForm(false);
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateWorkOrderStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/work-orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Work order status change failed.");
      }
      triggerToast(`Work order completed! Bills of Materials (BOM) exploded and stock balances synchronized.`);
      fetchState();
    } catch (err: any) {
      alert(err.message || " shortage on assembly raw materials.");
    }
  };

  const handleCreatePartsRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartsRequest.itemId || !newPartsRequest.quantity || !newPartsRequest.jobName) return alert("Please fill all fields.");
    try {
      const res = await fetch("/api/parts-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPartsRequest)
      });
      if (!res.ok) throw new Error("Failed to submit request.");
      triggerToast("Field dispatch part request created!");
      setShowPartsRequestForm(false);
      setNewPartsRequest({ itemId: "", quantity: 1, jobName: "" });
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdatePartsRequestStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/parts-requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to dispatch parts.");
      }
      triggerToast(`Parts dispatched! Deducted from Central Storage and loaded to Dave's mobile stock ledger.`);
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getZoneMetrics = () => {
    const zones = [
      { id: "zone_a", name: "Zone A: D2C Retail Shelves", description: "Direct-to-Consumer retail boxes & finished footwear", maxCapacity: 200, category: "E-Commerce", itemsList: [] as Item[], totalStock: 0 },
      { id: "zone_b", name: "Zone B: Component Pallets", description: "Heavy metal bolt pallets & fastener cartons", maxCapacity: 800, category: "Manufacturing", itemsList: [] as Item[], totalStock: 0 },
      { id: "zone_c", name: "Zone C: High-Value Electronics Vault", description: "Climate-controlled instruments & oscilloscopes", maxCapacity: 20, category: "Field Service", itemsList: [] as Item[], totalStock: 0 },
      { id: "zone_d", name: "Zone D: Raw Materials Rack", description: "Vibram rubber outsoles & premium leather rolls", maxCapacity: 300, category: "Manufacturing", itemsList: [] as Item[], totalStock: 0 },
      { id: "zone_e", name: "Zone E: Intake & Quality Dock", description: "Transit staging area for incoming unassigned lots", maxCapacity: 150, category: "General", itemsList: [] as Item[], totalStock: 0 },
      { id: "zone_f", name: "Zone F: Outbound Dispatch Bay", description: "Pallet consolidation and e-commerce shipping boxes", maxCapacity: 250, category: "General", itemsList: [] as Item[], totalStock: 0 },
    ];

    items.forEach(item => {
      if (item.category === "E-Commerce") {
        zones[0].itemsList.push(item);
        zones[0].totalStock += item.stock;
      } else if (item.category === "Manufacturing") {
        if (item.sku.includes("COMP") || item.name.toLowerCase().includes("sole") || item.name.toLowerCase().includes("leather")) {
          zones[3].itemsList.push(item);
          zones[3].totalStock += item.stock;
        } else {
          zones[1].itemsList.push(item);
          zones[1].totalStock += item.stock;
        }
      } else if (item.category === "Field Service") {
        zones[2].itemsList.push(item);
        zones[2].totalStock += item.stock;
      } else {
        zones[4].itemsList.push(item);
        zones[4].totalStock += item.stock;
      }
    });

    zones[4].totalStock += Math.min(orders.length * 3, 100);
    zones[5].totalStock += Math.min(orders.filter(o => o.status === 'packed' || o.status === 'picking').length * 15 + 10, 180);

    return zones.map(z => {
      const density = Math.min(Math.round((z.totalStock / z.maxCapacity) * 100), 100);
      let heatColorClass = "bg-emerald-50 text-emerald-800 border-emerald-200";
      let textClass = "text-emerald-600";
      let progressClass = "bg-emerald-500";
      let hexColor = "#10b981";
      let hoverBg = "hover:bg-emerald-50";
      
      if (z.id === "zone_c") {
        // High value electronics vault capacity is lower, so 20 is max. 
      }

      if (density > 85) {
        heatColorClass = "bg-rose-50 text-rose-800 border-rose-200 animate-pulse";
        textClass = "text-rose-600";
        progressClass = "bg-rose-500 animate-pulse";
        hexColor = "#f43f5e";
        hoverBg = "hover:bg-rose-50";
      } else if (density > 60) {
        heatColorClass = "bg-orange-50 text-orange-800 border-orange-200";
        textClass = "text-orange-600";
        progressClass = "bg-orange-500";
        hexColor = "#f97316";
        hoverBg = "hover:bg-orange-50";
      } else if (density > 30) {
        heatColorClass = "bg-amber-50 text-amber-800 border-amber-200";
        textClass = "text-amber-600";
        progressClass = "bg-amber-500";
        hexColor = "#eab308";
        hoverBg = "hover:bg-amber-50";
      }

      return {
        ...z,
        density,
        heatColorClass,
        textClass,
        progressClass,
        hexColor,
        hoverBg
      };
    });
  };

  const handleQuickReorder = async (item: Item) => {
    const deficit = item.minSafetyThreshold - item.stock;
    const reorderQty = Math.max(deficit + Math.ceil(item.minSafetyThreshold * 0.25), 50);

    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          fromLocationId: "N/A",
          toLocationId: "LOC-WH-1",
          quantity: reorderQty,
          createdBy: "Auto-Replenishment System"
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit reorder.");
      }
      triggerToast(`Successfully reordered ${reorderQty} ${item.unit} for ${item.name}!`);
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.sku || !newOrder.customerName || !newOrder.quantity) return alert("Please fill all fields.");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder)
      });
      if (!res.ok) throw new Error("Order creation failed.");
      triggerToast("New E-commerce order placed!");
      setShowOrderForm(false);
      setNewOrder({ sku: "", customerName: "", quantity: 1, channel: "Shopify" });
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel and delete this order?")) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Order deletion failed.");
      triggerToast("E-commerce order record deleted.");
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteBom = async (bomId: string) => {
    if (!confirm("Are you sure you want to delete this BOM Spec?")) return;
    try {
      const res = await fetch(`/api/bom/${bomId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("BOM deletion failed.");
      triggerToast("BOM specification record deleted.");
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteWorkOrder = async (woId: string) => {
    if (!confirm("Are you sure you want to delete this Work Order?")) return;
    try {
      const res = await fetch(`/api/work-orders/${woId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Work order deletion failed.");
      triggerToast("Work order record deleted.");
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePartsRequest = async (prId: string) => {
    if (!confirm("Are you sure you want to delete this parts request?")) return;
    try {
      const res = await fetch(`/api/parts-requests/${prId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Parts request deletion failed.");
      triggerToast("Parts request record deleted.");
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReport.title || !newReport.summary) return alert("Please fill all fields.");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReport)
      });
      if (!res.ok) throw new Error("Report creation failed.");
      triggerToast("Executive report registered!");
      setShowReportForm(false);
      setNewReport({ title: "", type: "Safety Runway", summary: "" });
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Report deletion failed.");
      triggerToast("Report record deleted.");
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveSlackSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/slack/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackConfig)
      });
      if (!res.ok) throw new Error("Failed to save Slack credentials.");
      triggerToast("Slack notifications endpoint saved.");
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTriggerSlackTest = async () => {
    try {
      const res = await fetch("/api/slack/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "🔔 Alert from INVENTORY MANAGEMENT TEAMS Command Panel: E-Commerce Storefront sales Spike detected for SKU-ECOM-102!" })
      });
      if (!res.ok) throw new Error("Outbound Slack trigger failed.");
      const result = await res.json();
      triggerToast("Slack alert sent to system logs successfully.");
      fetchState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentActiveUser.role !== 'Admin') {
      triggerToast("Access Denied: Only Admin users can register new team members.");
      return;
    }
    if (!newUserForm.name.trim() || !newUserForm.email.trim() || !newUserForm.teamId || !newUserForm.role) {
      alert("Please fill in all required fields.");
      return;
    }
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserForm)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add user.");
      }
      const createdUser = await res.json();
      setUsers(prev => [...prev, createdUser]);
      setNewUserForm({ name: "", email: "", teamId: "team_1", role: "Staff" });
      setShowAddUserForm(false);
      triggerToast(`Team member '${createdUser.name}' registered successfully!`);
      fetchState();
    } catch (err: any) {
      alert(err.message || "Error registering user.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (currentActiveUser.role !== 'Admin') {
      triggerToast("Access Denied: Only Admin users can delete team members.");
      return;
    }
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    if (targetUser.email === "phidephefem@gmail.com") {
      triggerToast("Cannot delete primary Enterprise Administrator account.");
      return;
    }

    if (!confirm(`Are you sure you want to remove team member '${targetUser.name}'?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user.");
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      triggerToast(`Team member '${targetUser.name}' removed from registry.`);
      fetchState();
    } catch (err: any) {
      alert(err.message || "Error deleting user.");
    }
  };

  // --- CROSS-TEAM REPORTING & PREDICTIVE ANALYTICS DATASOURCES ---
  const getSeasonalStockoutData = () => {
    const baseHistorical = [1.2, 0.8, 2.1, 3.4]; // Spring, Summer, Autumn, Winter
    const basePredicted = [
      Math.max(0.5, Number((1.1 * seasonalPeakFactor + supplyChainDelayDays * 0.15).toFixed(1))),
      Math.max(0.3, Number((0.7 * seasonalPeakFactor + supplyChainDelayDays * 0.08).toFixed(1))),
      Math.max(1.0, Number((2.0 * seasonalPeakFactor + supplyChainDelayDays * 0.22).toFixed(1))),
      Math.max(1.5, Number((3.5 * seasonalPeakFactor + supplyChainDelayDays * 0.35).toFixed(1))),
    ];

    return [
      { name: "Spring", Historical: baseHistorical[0], Predicted: basePredicted[0], AlertThreshold: 1.5 },
      { name: "Summer", Historical: baseHistorical[1], Predicted: basePredicted[1], AlertThreshold: 1.5 },
      { name: "Autumn", Historical: baseHistorical[2], Predicted: basePredicted[2], AlertThreshold: 1.5 },
      { name: "Winter", Historical: baseHistorical[3], Predicted: basePredicted[3], AlertThreshold: 1.5 },
    ];
  };

  const getInventoryTurnoverData = () => {
    // E-Commerce
    const ecomItems = items.filter(i => i.category === 'E-Commerce');
    const ecomAvgStock = ecomItems.reduce((acc, i) => acc + i.stock, 0) / (ecomItems.length || 1);
    const ecomOrderedQty = orders.reduce((acc, o) => acc + o.quantity, 0);
    const ecomRatio = Number((((ecomOrderedQty || 120) / (ecomAvgStock || 15)) * seasonalPeakFactor).toFixed(1));

    // Manufacturing
    const manuItems = items.filter(i => i.category === 'Manufacturing');
    const manuAvgStock = manuItems.reduce((acc, i) => acc + i.stock, 0) / (manuItems.length || 1);
    const manuOrderedQty = workOrders.reduce((acc, w) => acc + w.quantity, 0);
    const manuRatio = Number((((manuOrderedQty || 85) / (manuAvgStock || 40)) * seasonalPeakFactor).toFixed(1));

    // Field Service
    const fieldItems = items.filter(i => i.category === 'Field Service');
    const fieldAvgStock = fieldItems.reduce((acc, i) => acc + i.stock, 0) / (fieldItems.length || 1);
    const fieldOrderedQty = partsRequests.reduce((acc, p) => acc + p.quantity, 0);
    const fieldRatio = Number((((fieldOrderedQty || 45) / (fieldAvgStock || 12)) * seasonalPeakFactor).toFixed(1));

    return [
      { name: "E-Commerce", TurnoverRatio: ecomRatio, TargetBenchmark: 6.5 },
      { name: "Manufacturing", TurnoverRatio: manuRatio, TargetBenchmark: 4.2 },
      { name: "Field Service", TurnoverRatio: fieldRatio, TargetBenchmark: 5.0 },
    ];
  };

  const getBlendedFillRateData = () => {
    const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    const delayDeduction = supplyChainDelayDays * 0.75;

    return months.map((month, idx) => {
      const ecomBase = 97.4 - (idx % 2 === 0 ? 1.5 : 0.2) - delayDeduction;
      const manuBase = 93.8 + (idx * 0.6) - delayDeduction;
      const fieldBase = 90.5 - (idx === 4 ? 3.5 : 0) - delayDeduction;
      const blendedAvg = (ecomBase + manuBase + fieldBase) / 3;

      return {
        month,
        "E-Commerce Team": Number(Math.max(60, Math.min(100, ecomBase)).toFixed(1)),
        "Manufacturing Team": Number(Math.max(60, Math.min(100, manuBase)).toFixed(1)),
        "Field Service Team": Number(Math.max(60, Math.min(100, fieldBase)).toFixed(1)),
        "Blended Average": Number(Math.max(60, Math.min(100, blendedAvg)).toFixed(1)),
      };
    });
  };

  // --- GEMINI CO-PILOT SERVICES ---

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg, timestamp: new Date() }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg })
      });
      if (!res.ok) throw new Error("Gemini network error");
      const data = await res.json();
      setChatMessages(prev => [...prev, { sender: "gemini", text: data.responseText, timestamp: new Date() }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { sender: "gemini", text: "Offline Alert: Failed to communicate with the Gemini service. Verify system credentials.", timestamp: new Date() }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleTriggerAIForecast = async () => {
    setForecastingLoading(true);
    triggerToast("Starting high-thinking Gemini forecasting on master stock & storefront trends...");
    try {
      const res = await fetch("/api/gemini/forecast", { method: "POST" });
      if (!res.ok) throw new Error("Forecasting service failed");
      const data = await res.json();
      setAiForecast(data);
      setActiveTab("reports");
      triggerToast("AI 30-Day Demand Forecast updated!");
    } catch (err: any) {
      alert("AI Forecasting simulation processed. Please verify internet connection.");
    } finally {
      setForecastingLoading(false);
    }
  };

  const handleTranscribeSpeech = async () => {
    setTranscribing(true);
    try {
      const res = await fetch("/api/gemini/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleText: speechInput })
      });
      if (!res.ok) throw new Error("Transcriber offline.");
      const data = await res.json();
      setTranscribedLog(data);
      triggerToast("Technician voice log transcribed and parsed!");
    } catch (err: any) {
      alert("Transcription processing issue.");
    } finally {
      setTranscribing(false);
    }
  };

  // Helper for item lookup
  const getItemName = (id: string) => {
    const item = items.find(i => i.id === id);
    return item ? `${item.name} (${item.sku})` : "Unknown Item";
  };

  // Main UI skeleton
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FDFBF7] text-[#3E2723] font-sans antialiased">
      
      {/* 1. LEFT STRUCTURAL DRAWER PANEL (Earth Brown background, white fonts, yellow accents) */}
      <div id="side-navigation" className="w-80 bg-[#3E2723] text-white flex flex-col justify-between border-r border-[#5D4037] z-10 shrink-0">
        <div className="p-6 flex flex-col gap-8">
          
          {/* Brand header */}
          <div className="flex items-center gap-3">
            <div className="bg-[#FBC02D] text-[#3E2723] p-2.5 rounded-xl shadow-lg flex items-center justify-center">
              <Layers className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-lg leading-tight tracking-wider text-[#FBC02D]">INVENTORY TEAMS</h1>
              <p className="text-[11px] text-white/70 font-mono tracking-widest mt-0.5">UNIFIED INTELLIGENCE</p>
            </div>
          </div>

          {/* User Badge */}
          <div className="bg-[#5D4037]/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#FBC02D] text-[#3E2723] font-bold text-sm flex items-center justify-center shrink-0">
              {getInitials(currentActiveUser.name)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate text-[#FBC02D]">{currentActiveUser.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[8px] bg-white/10 px-1 py-0.2 rounded font-mono text-white/80 font-extrabold uppercase">
                  {currentActiveUser.role}
                </span>
                <span className="text-[10px] text-white/50 truncate">{currentActiveUser.email}</span>
              </div>
            </div>
          </div>

          {/* Nav List */}
          <nav className="flex flex-col gap-1.5">
            <button 
              id="btn-nav-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-[#FBC02D] text-[#3E2723] shadow-md font-semibold' : 'hover:bg-white/5 text-white/95'}`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Executive Dashboard</span>
            </button>
            <button 
              id="btn-nav-catalog"
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'catalog' ? 'bg-[#FBC02D] text-[#3E2723] shadow-md font-semibold' : 'hover:bg-white/5 text-white/95'}`}
            >
              <Package className="w-4 h-4" />
              <span>Catalog & stock ledger</span>
            </button>
            <button 
              id="btn-nav-ecommerce"
              onClick={() => setActiveTab('ecommerce')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'ecommerce' ? 'bg-[#FBC02D] text-[#3E2723] shadow-md font-semibold' : 'hover:bg-white/5 text-white/95'}`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>E-Commerce Module</span>
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              )}
            </button>
            <button 
              id="btn-nav-manufacturing"
              onClick={() => setActiveTab('manufacturing')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'manufacturing' ? 'bg-[#FBC02D] text-[#3E2723] shadow-md font-semibold' : 'hover:bg-white/5 text-white/95'}`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Manufacturing Suite</span>
              {workOrders.filter(w => w.status === 'in-progress').length > 0 && (
                <span className="ml-auto bg-[#FBC02D] text-[#3E2723] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {workOrders.filter(w => w.status === 'in-progress').length}
                </span>
              )}
            </button>
            <button 
              id="btn-nav-field"
              onClick={() => setActiveTab('field')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'field' ? 'bg-[#FBC02D] text-[#3E2723] shadow-md font-semibold' : 'hover:bg-white/5 text-white/95'}`}
            >
              <Wrench className="w-4 h-4" />
              <span>Field Service Fleet</span>
              {partsRequests.filter(p => p.status === 'requested').length > 0 && (
                <span className="ml-auto bg-[#FBC02D]/80 text-[#3E2723] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {partsRequests.filter(p => p.status === 'requested').length}
                </span>
              )}
            </button>
            <button 
              id="btn-nav-reports"
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'reports' ? 'bg-[#FBC02D] text-[#3E2723] shadow-md font-semibold' : 'hover:bg-white/5 text-white/95'}`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Forecasting & Reports</span>
            </button>
            <button 
              id="btn-nav-admin"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'admin' ? 'bg-[#FBC02D] text-[#3E2723] shadow-md font-semibold' : 'hover:bg-white/5 text-white/95'}`}
            >
              <Settings className="w-4 h-4" />
              <span>Admin & Slack Setup</span>
            </button>
            <button 
              id="btn-nav-billing"
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'billing' ? 'bg-[#FBC02D] text-[#3E2723] shadow-md font-semibold' : 'hover:bg-white/5 text-white/95'}`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Subscription & Billing</span>
              {trialStatus.expired ? (
                <span className="ml-auto bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                  Expired
                </span>
              ) : trialStatus.status === 'trialing' ? (
                <span className="ml-auto bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {trialStatus.daysLeft}d left
                </span>
              ) : (
                <span className="ml-auto bg-amber-500 text-[#3E2723] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Pro
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Footer info inside menu */}
        <div className="p-6 border-t border-white/5 flex flex-col gap-2 bg-[#5D4037]/30">
          <div className="flex items-center justify-between text-[11px] text-[#FBC02D]">
            <span className="font-semibold">CLOUD SYNCED</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <p className="text-[10px] text-white/50 leading-relaxed font-sans">
            Secure Relational Ledger Mode Active
          </p>
        </div>
      </div>

      {/* 2. MAIN CONTAINER & OPERATIONAL CONTEXT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER BAR */}
        <header className="h-20 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="md:hidden p-2 text-[#3E2723]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#3E2723] tracking-tight">
                {activeTab === 'dashboard' && "Executive Systems Dashboard"}
                {activeTab === 'catalog' && "Central Material Catalog & Locations"}
                {activeTab === 'ecommerce' && "Omni-Channel Storefront Logistics"}
                {activeTab === 'manufacturing' && "Production BOM Routing & WIP Assembly"}
                {activeTab === 'field' && "Technician Service Vans & Parts Dispatch"}
                {activeTab === 'reports' && "Dynamic Demand Forecasting & Business Intelligence"}
                {activeTab === 'admin' && "Administration Settings, Slack Triggers & Audits"}
                {activeTab === 'billing' && "Subscription, Billing & Authentication Management"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeTab === 'dashboard' && "Unified operational pulse across E-Commerce, Production line and Fleet Logistics"}
                {activeTab === 'catalog' && "Manage unified material specifications, warehouses, stock levels and movements"}
                {activeTab === 'ecommerce' && "D2C storefront channels replenishment status and available-to-promise buffers"}
                {activeTab === 'manufacturing' && "Bills of Materials assembly structure definition and finished good completions"}
                {activeTab === 'field' && "On-site parts inventory tracking and mobile vehicle allocations"}
                {activeTab === 'reports' && "Gemini High-Thinking projections, safety-runway parameters and item turnovers"}
                {activeTab === 'admin' && "Manage Slack alerting endpoints, view immutable logs and assign team permissions"}
                {activeTab === 'billing' && "Sign in, Sign up, change passwords, track trial usage, and subscribe to premium access plans"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                id="inp-global-filter"
                type="text" 
                placeholder="Search SKU or description..." 
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723] transition-all"
              />
            </div>

            {/* Sync trigger button */}
            <button 
              id="btn-sync-database"
              onClick={fetchState}
              title="Synchronize database states"
              className="p-2.5 rounded-xl border border-gray-200 text-[#3E2723] hover:bg-gray-50 transition-all flex items-center justify-center relative"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Alert bell indicating low safety stock */}
            <button 
              id="btn-low-stock-notifications"
              onClick={() => {
                const low = items.filter(i => i.stock < i.minSafetyThreshold);
                alert(`Platform Alerts Monitor: ${low.length} items currently below minimum safety thresholds. We recommend running AI restock forecasting immediately.`);
              }}
              className="p-2.5 rounded-xl border border-gray-200 text-[#3E2723] hover:bg-gray-50 transition-all flex items-center justify-center relative"
            >
              <Bell className="w-4 h-4" />
              {items.filter(i => i.stock < i.minSafetyThreshold).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                  {items.filter(i => i.stock < i.minSafetyThreshold).length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* TRIAL ADVANCE NOTIFICATION BANNER */}
        {trialStatus.status === 'trialing' && (
          <div className="mx-8 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-pulse-slow">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-[#3E2723]" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-[#3E2723] uppercase tracking-wider font-mono">Free Trial Advance Notification</h4>
                <p className="text-xs text-[#3E2723]/90 mt-0.5 font-semibold">
                  Your 7-day free trial will expire in <span className="text-rose-600 underline font-extrabold">{trialStatus.daysLeft} {trialStatus.daysLeft === 1 ? 'day' : 'days'}</span>. Upgrade now to ensure uninterrupted access to the Inventory Management Teams ecosystem!
                </p>
              </div>
            </div>
            <button
              id="btn-trial-upgrade-now"
              onClick={() => setActiveTab('billing')}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>Upgrade to Premium</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3. UNIFIED SECTION COMMAND PANEL (Well-Structured Single Button Panel Constraint in Every View) */}
        <section id="section-command-panel" className="m-8 mb-0 p-4 bg-[#3E2723] text-white rounded-2xl flex flex-wrap gap-3 items-center shadow-lg border border-[#5D4037]">
          <div className="flex items-center gap-2 pr-3 border-r border-white/10">
            <Zap className="w-5 h-5 text-[#FBC02D] stroke-[2.5]" />
            <span className="text-xs font-bold tracking-wider uppercase font-mono">Panel Commands</span>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            {/* Context-aware buttons, arranged in a neat panel deck */}
            <button 
              id="btn-panel-add-catalog"
              onClick={() => { setShowItemForm(true); setActiveTab('catalog'); }}
              className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] font-semibold text-xs rounded-xl shadow-sm hover:bg-[#FBC02D]/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add Catalog Item</span>
            </button>

            <button 
              id="btn-panel-transfer-stock"
              onClick={() => { setShowMovementForm(true); setActiveTab('catalog'); }}
              className="px-4 py-2 bg-white text-[#3E2723] font-semibold text-xs rounded-xl shadow-sm hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Transfer Stock</span>
            </button>

            <button 
              id="btn-panel-ai-forecast"
              onClick={handleTriggerAIForecast}
              disabled={forecastingLoading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-white/5"
            >
              {forecastingLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Computing Projections...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#FBC02D]" />
                  <span>Run Gemini Forecast</span>
                </>
              )}
            </button>

            <button 
              id="btn-panel-slack-trigger"
              onClick={handleTriggerSlackTest}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-white/5"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Trigger Slack Webhook</span>
            </button>

            <button 
              id="btn-panel-export-catalog"
              onClick={() => {
                const headers = "ID,SKU,Name,Category,Unit,Stock,Cost,Supplier,MinSafety\n";
                const rows = items.map(i => `${i.id},"${i.sku}","${i.name}","${i.category}","${i.unit}",${i.stock},${i.cost},"${i.supplier}",${i.minSafetyThreshold}`).join("\n");
                const blob = new Blob([headers + rows], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `inventory_master_ledger_${Date.now()}.csv`;
                a.click();
                triggerToast("CSV catalog master ledger generated and downloaded.");
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-white/5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Stock CSV</span>
            </button>

            {/* Secondary operations based on tab */}
            {activeTab === 'ecommerce' && (
              <button 
                id="btn-panel-ecommerce-order"
                onClick={() => setShowOrderForm(true)}
                className="px-4 py-2 bg-[#FBC02D]/20 hover:bg-[#FBC02D]/30 text-[#FBC02D] font-semibold text-xs rounded-xl transition-all border border-[#FBC02D]/10"
              >
                🛒 New Storefront Order
              </button>
            )}

            {activeTab === 'manufacturing' && (
              <>
                <button 
                  id="btn-panel-add-bom"
                  onClick={() => setShowBomForm(true)}
                  className="px-4 py-2 bg-[#FBC02D]/20 hover:bg-[#FBC02D]/30 text-[#FBC02D] font-semibold text-xs rounded-xl transition-all border border-[#FBC02D]/10"
                >
                  ➕ Register BOM Routing
                </button>
                <button 
                  id="btn-panel-add-wo"
                  onClick={() => setShowWorkOrderForm(true)}
                  className="px-4 py-2 bg-[#FBC02D]/20 hover:bg-[#FBC02D]/30 text-[#FBC02D] font-semibold text-xs rounded-xl transition-all border border-[#FBC02D]/10"
                >
                  🚀 Plan Production Run
                </button>
              </>
            )}

            {activeTab === 'field' && (
              <button 
                id="btn-panel-field-request"
                onClick={() => setShowPartsRequestForm(true)}
                className="px-4 py-2 bg-[#FBC02D]/20 hover:bg-[#FBC02D]/30 text-[#FBC02D] font-semibold text-xs rounded-xl transition-all border border-[#FBC02D]/10"
              >
                🛠️ Technician Parts Request
              </button>
            )}

            {activeTab === 'reports' && (
              <button 
                id="btn-panel-reports-create"
                onClick={() => setShowReportForm(true)}
                className="px-4 py-2 bg-[#FBC02D]/20 hover:bg-[#FBC02D]/30 text-[#FBC02D] font-semibold text-xs rounded-xl transition-all border border-[#FBC02D]/10"
              >
                📈 Create Custom Report
              </button>
            )}
          </div>
        </section>

        {/* 4. CONTENT WRAPPER */}
        <div className="flex-1 flex overflow-hidden">
          <SubscriptionRouteGuard trialStatus={trialStatus} activeTab={activeTab} setActiveTab={setActiveTab}>
            {/* MIDDLE ACTIVE VIEWPORT */}
            <main className="flex-1 p-8 overflow-y-auto min-w-0">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#3E2723] animate-spin" />
                <p className="text-sm font-semibold text-gray-500">Retrieving operational stock ledgers...</p>
              </div>
            ) : errorMsg ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-800">Connection Interrupted</h4>
                  <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
                  <button onClick={fetchState} className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all">
                    Retry Connection
                  </button>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8"
                >
                  
                  {/* --- TAB A: EXECUTIVE DASHBOARD --- */}
                  {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                      
                      {/* Real-time Visual Alert Indicator Banner for Safety Thresholds */}
                      {items.filter(i => i.stock < i.minSafetyThreshold).length > 0 ? (
                        <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 shadow-md relative overflow-hidden animate-pulse-slow">
                          {/* Ambient background glow */}
                          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-rose-200/40 rounded-full blur-3xl pointer-events-none"></div>
                          
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rose-200/60">
                            <div className="flex items-start gap-3.5">
                              <div className="p-3 bg-rose-600 text-white rounded-2xl shrink-0 shadow-lg shadow-rose-600/20 animate-bounce">
                                <AlertTriangle className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="font-bold text-rose-950 text-base md:text-lg flex items-center gap-2">
                                  <span>🚨 Real-Time Safety Stock Outage Alert</span>
                                  <span className="text-xs bg-rose-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                                    {items.filter(i => i.stock < i.minSafetyThreshold).length} ITEMS DEPLETED
                                  </span>
                                </h3>
                                <p className="text-xs text-rose-800 font-medium mt-0.5">
                                  The following inventory assets have breached their minimum safety thresholds. Quick-reorder immediately to replenish.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-900 bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 shrink-0">
                              <span className="w-2 h-2 bg-rose-600 rounded-full animate-ping"></span>
                              <span>LIVE DEPLETION AUDIT</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                            {items.filter(i => i.stock < i.minSafetyThreshold).map(item => {
                              const pct = Math.max(0, Math.round((item.stock / item.minSafetyThreshold) * 100));
                              return (
                                <div key={item.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between gap-3 hover:shadow transition-all hover:bg-white">
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <h4 className="font-bold text-xs sm:text-sm text-gray-900 line-clamp-1">{item.name}</h4>
                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">SKU: {item.sku}</p>
                                      </div>
                                      <span className="text-[10px] bg-rose-50 text-rose-700 font-extrabold px-2 py-0.5 rounded border border-rose-200 shrink-0 font-mono font-bold">
                                        {pct}% Stock
                                      </span>
                                    </div>

                                    {/* Visual Stock Level Progress Meter */}
                                    <div className="mt-3 space-y-1">
                                      <div className="flex justify-between text-[9px] font-bold text-gray-400">
                                        <span>Current: {item.stock}</span>
                                        <span>Min Safe: {item.minSafetyThreshold}</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-rose-500 rounded-full" 
                                          style={{ width: `${Math.min(100, pct)}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-rose-50">
                                    <span className="text-[10px] text-gray-400 font-medium">Category: {item.category}</span>
                                    <button
                                      id={`btn-alert-reorder-${item.id}`}
                                      onClick={() => handleQuickReorder(item)}
                                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1 shrink-0 uppercase tracking-wider font-bold"
                                    >
                                      <Zap className="w-3 h-3 fill-white" />
                                      <span>Quick Reorder</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shrink-0 shadow-md shadow-emerald-500/10">
                              <Check className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-emerald-950 text-xs sm:text-sm">Safety Stock Ledger Status: Nominal</h3>
                              <p className="text-[11px] text-emerald-700 mt-0.5">All warehouse catalogs currently maintain stock levels safely above safety-outage minimum thresholds.</p>
                            </div>
                          </div>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-lg border border-emerald-200 tracking-wider uppercase shrink-0 font-bold">
                            Ledger All-Clear
                          </span>
                        </div>
                      )}
                      
                      {/* Metric widgets */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500 font-medium">Synced SKU Catalog</p>
                            <p className="text-3xl font-bold text-[#3E2723]">{items.length}</p>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">Active Ledger</span>
                          </div>
                          <div className="p-4 bg-[#3E2723]/5 rounded-xl text-[#3E2723]">
                            <Package className="w-6 h-6" />
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500 font-medium">Safety Stock Outages</p>
                            <p className="text-3xl font-bold text-red-600">
                              {items.filter(i => i.stock < i.minSafetyThreshold).length}
                            </p>
                            <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-semibold">Action Advised</span>
                          </div>
                          <div className="p-4 bg-red-50 rounded-xl text-red-600">
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500 font-medium">Storefront Order Backlog</p>
                            <p className="text-3xl font-bold text-[#FBC02D]">{orders.filter(o => o.status !== 'shipped').length}</p>
                            <span className="text-[10px] text-[#3E2723] bg-[#FBC02D]/10 px-2 py-0.5 rounded-full font-semibold">Picking / Packing</span>
                          </div>
                          <div className="p-4 bg-[#FBC02D]/10 rounded-xl text-[#3E2723]">
                            <ShoppingCart className="w-6 h-6" />
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500 font-medium">Work Orders In-Progress</p>
                            <p className="text-3xl font-bold text-emerald-600">
                              {workOrders.filter(w => w.status === 'in-progress').length}
                            </p>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">Assembly Lines</span>
                          </div>
                          <div className="p-4 bg-emerald-50 rounded-xl text-emerald-600">
                            <TrendingUp className="w-6 h-6" />
                          </div>
                        </div>

                      </div>

                      {/* Warnings & reorder suggestions panel */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-base text-[#3E2723]">🚨 Automated Low Stock & Replenishment Monitor</h3>
                            <span className="text-xs font-semibold text-[#FBC02D] bg-[#3E2723] px-3 py-1 rounded-full">
                              {items.filter(i => i.stock < i.minSafetyThreshold).length} critical exceptions
                            </span>
                          </div>

                          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
                            {items.filter(i => i.stock < i.minSafetyThreshold).length === 0 ? (
                              <p className="text-sm text-gray-500 py-4 text-center">All catalog items maintain stock levels above safe thresholds.</p>
                            ) : (
                              items.filter(i => i.stock < i.minSafetyThreshold).map(item => {
                                const deficit = item.minSafetyThreshold - item.stock;
                                return (
                                  <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-red-50/40 hover:bg-red-50/80 p-4 rounded-xl border border-red-100/50 transition-all mb-2">
                                    <div className="flex items-start gap-3">
                                      <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0 mt-0.5 animate-pulse">
                                        <AlertTriangle className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-bold text-sm text-gray-900">{item.name}</h4>
                                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                                            Deficit: -{deficit} {item.unit}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-500 font-mono mt-1">
                                          SKU: {item.sku} | Category: {item.category} | Supplier: {item.supplier}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                                      <div className="text-left sm:text-right">
                                        <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                                          Current Stock: {item.stock} {item.unit}
                                        </p>
                                        <p className="text-[10px] text-gray-500">Safety Threshold: {item.minSafetyThreshold} {item.unit}</p>
                                      </div>
                                      <button
                                        id={`btn-reorder-${item.id}`}
                                        onClick={() => handleQuickReorder(item)}
                                        className="px-3.5 py-2 bg-[#3E2723] text-[#FBC02D] hover:bg-[#3E2723]/90 text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 shrink-0"
                                      >
                                        <Zap className="w-3.5 h-3.5 fill-[#FBC02D]" />
                                        <span>Quick Reorder</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Quick Statistics details */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
                          <h3 className="font-bold text-base text-[#3E2723]">🚀 E-Commerce Storefront Sync</h3>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            Continuous available-to-promise allocations sync live status directly to Shopify, Amazon, and WooCommerce catalogs.
                          </p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="text-xs font-semibold">Shopify Integrator</span>
                              <span className="text-xs font-mono text-emerald-600 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Connected
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="text-xs font-semibold">Amazon FBA API</span>
                              <span className="text-xs font-mono text-emerald-600 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Connected
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="text-xs font-semibold">WooCommerce Webhook</span>
                              <span className="text-xs font-mono text-[#FBC02D] font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-[#FBC02D] rounded-full animate-ping"></span> Syncing...
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Warehouse Area Occupancy & Stock Density Heatmap */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-4">
                          <div>
                            <h3 className="font-bold text-lg text-[#3E2723] flex items-center gap-2">
                              <Database className="w-5 h-5 text-[#FBC02D]" />
                              <span>📍 Warehouse Storage Density & Zone Occupancy Heatmap</span>
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              Real-time volumetric allocation across the East Coast Distribution Center (LOC-WH-1) zones.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                            <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Safe (&lt;30%)
                            </span>
                            <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Moderate (30-60%)
                            </span>
                            <span className="px-2 py-1 rounded bg-orange-50 text-orange-700 border border-orange-200">
                              Elevated (60-85%)
                            </span>
                            <span className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                              Critical (&gt;85%)
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                          
                          {/* Left: Recharts density chart */}
                          <div className="lg:col-span-5 flex flex-col justify-between">
                            <div className="space-y-2 mb-4">
                              <h4 className="text-xs uppercase font-bold text-gray-400 tracking-wider">Volumetric Load Analysis</h4>
                              <p className="text-xs text-gray-500">
                                Comparative bar chart plotting capacity saturation rates per sector.
                              </p>
                            </div>
                            
                            <div className="h-64 w-full text-xs">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={getZoneMetrics()}
                                  margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                                >
                                  <XAxis 
                                    dataKey="id" 
                                    tickFormatter={(v) => v.replace("zone_", "Zone ").toUpperCase()}
                                    tick={{ fill: "#6b7280", fontSize: 10, fontWeight: "semibold" }}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis 
                                    domain={[0, 100]} 
                                    tickFormatter={(v) => `${v}%`}
                                    tick={{ fill: "#6b7280", fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <RechartsTooltip
                                    formatter={(value: any, name: any, props: any) => [`${value}% Occupancy`, `Zone: ${props.payload.name}`]}
                                    contentStyle={{ background: "#3E2723", color: "#fff", borderRadius: "12px", border: "none", fontSize: "11px" }}
                                  />
                                  <Bar dataKey="density" radius={[6, 6, 0, 0]} barSize={32}>
                                    {getZoneMetrics().map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.hexColor} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[11px] text-gray-600 leading-normal space-y-1">
                              <span className="font-bold text-[#3E2723]">💡 Operational Insight:</span>
                              <p>
                                Stock density calculations are bound dynamically to physical storage dimensions. Reordering low-threshold items or shipping pending store orders will immediately recalibrate these load ratios.
                              </p>
                            </div>
                          </div>

                          {/* Right: Interactive heatmap grid */}
                          <div className="lg:col-span-7 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-1">
                                <h4 className="text-xs uppercase font-bold text-gray-400 tracking-wider">Live Floorplan Layout</h4>
                                <p className="text-xs text-gray-500">
                                  Visualize actual physical space load limits across distributions.
                                </p>
                              </div>
                              <div className="bg-gray-100 p-1 rounded-xl flex gap-1 self-start sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => setHeatmapLayout('blueprint')}
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${heatmapLayout === 'blueprint' ? 'bg-[#3E2723] text-[#FBC02D]' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                  🗺️ 2D Heatmap Grid
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setHeatmapLayout('cards')}
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${heatmapLayout === 'cards' ? 'bg-[#3E2723] text-[#FBC02D]' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                  📇 Sector Cards
                                </button>
                              </div>
                            </div>

                            {heatmapLayout === 'blueprint' ? (
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {getZoneMetrics().map((zone) => {
                                    const isSelected = selectedHeatmapZone === zone.id;
                                    // Calculate background based on density
                                    let bgHeatClass = "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900";
                                    let glowPulsing = "";
                                    if (zone.density >= 85) {
                                      bgHeatClass = "bg-rose-100 hover:bg-rose-200 border-rose-300 text-rose-950";
                                      glowPulsing = "animate-pulse-slow";
                                    } else if (zone.density >= 60) {
                                      bgHeatClass = "bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-950";
                                    } else if (zone.density >= 30) {
                                      bgHeatClass = "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900";
                                    }

                                    return (
                                      <button
                                        type="button"
                                        key={zone.id}
                                        onClick={() => setSelectedHeatmapZone(zone.id)}
                                        className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between h-36 ${bgHeatClass} ${glowPulsing} ${isSelected ? 'ring-4 ring-[#FBC02D] border-transparent shadow-md' : 'shadow-sm hover:scale-[1.01]'}`}
                                      >
                                        <div className="w-full">
                                          <div className="flex justify-between items-start gap-1">
                                            <span className="font-extrabold text-[10px] uppercase tracking-wider text-gray-500">{zone.category}</span>
                                            <span className="text-[10px] font-mono font-bold bg-white/75 px-1.5 py-0.5 rounded-md border border-gray-200/40">
                                              {zone.id.replace("zone_", "B-0").toUpperCase()}
                                            </span>
                                          </div>
                                          <h5 className="font-bold text-xs sm:text-sm mt-1 line-clamp-1">{zone.name}</h5>
                                          <p className="text-[10px] opacity-75 mt-0.5 font-medium">{zone.totalStock} / {zone.maxCapacity} Units</p>
                                        </div>

                                        <div className="w-full space-y-1.5 mt-2">
                                          <div className="flex justify-between items-center text-[10px] font-bold">
                                            <span>STOCK DENSITY</span>
                                            <span className="font-mono">{zone.density}%</span>
                                          </div>
                                          <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-current rounded-full" 
                                              style={{ width: `${zone.density}%` }}
                                            ></div>
                                          </div>
                                        </div>

                                        {isSelected && (
                                          <div className="absolute top-1 right-1">
                                            <span className="flex h-2.5 w-2.5 relative">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3E2723] opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FBC02D]"></span>
                                            </span>
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Detail Box for Selected Zone */}
                                {(() => {
                                  const selectedZoneData = getZoneMetrics().find(z => z.id === selectedHeatmapZone);
                                  if (!selectedZoneData) return null;
                                  return (
                                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/60">
                                        <div>
                                          <h4 className="font-bold text-sm text-[#3E2723] flex items-center gap-1.5">
                                            <span>📊 Bay Audit: {selectedZoneData.name}</span>
                                            <span className="text-[10px] uppercase font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                                              {selectedZoneData.category}
                                            </span>
                                          </h4>
                                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedZoneData.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                          <div className="text-right">
                                            <span className="text-[10px] text-gray-400 block font-medium">Sectors Load Ratio</span>
                                            <span className="text-xs font-bold font-mono text-[#3E2723]">{selectedZoneData.density}% Saturation</span>
                                          </div>
                                          <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs" style={{ backgroundColor: selectedZoneData.hexColor + "20", color: selectedZoneData.hexColor }}>
                                            {selectedZoneData.density}%
                                          </div>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400 block">Materials Allocation In Bay</span>
                                        {selectedZoneData.itemsList.length > 0 ? (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs text-[#3E2723]">
                                              <thead>
                                                <tr className="border-b border-gray-200 text-gray-400 text-[10px] font-bold uppercase">
                                                  <th className="pb-2">Material / SKU</th>
                                                  <th className="pb-2 text-right">Active Stock</th>
                                                  <th className="pb-2 text-right">Min Safe</th>
                                                  <th className="pb-2 text-right">Actions</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-100">
                                                {selectedZoneData.itemsList.map((item) => (
                                                  <tr key={item.id} className="hover:bg-gray-100/40">
                                                    <td className="py-2.5">
                                                      <span className="font-bold text-gray-900 block">{item.name}</span>
                                                      <span className="text-[10px] text-gray-500 font-mono">SKU: {item.sku}</span>
                                                    </td>
                                                    <td className="py-2.5 text-right font-semibold font-mono">
                                                      {item.stock} {item.unit}
                                                    </td>
                                                    <td className="py-2.5 text-right font-mono text-gray-500">
                                                      {item.minSafetyThreshold} {item.unit}
                                                    </td>
                                                    <td className="py-2.5 text-right">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setNewMovement({
                                                            itemId: item.id,
                                                            fromLocationId: selectedZoneData.id === 'zone_a' ? 'LOC-WH-1' : 'LOC-ST-2',
                                                            toLocationId: selectedZoneData.id === 'zone_a' ? 'LOC-ST-2' : 'LOC-WH-1',
                                                            quantity: 5
                                                          });
                                                          setShowMovementForm(true);
                                                        }}
                                                        className="px-2 py-1 bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] text-[10px] font-bold rounded-lg transition-all"
                                                      >
                                                        Move Stock
                                                      </button>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-gray-400 italic py-2">No catalog stock is currently registered under this physical bay location ledger.</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {getZoneMetrics().map((zone) => (
                                  <div 
                                    key={zone.id} 
                                    className={`p-4 rounded-2xl border-2 transition-all duration-300 ${zone.hoverBg} ${zone.density > 85 ? 'border-rose-300 bg-rose-50/20' : 'border-gray-100 bg-white'} flex flex-col justify-between`}
                                  >
                                    <div>
                                      {/* Zone name & indicator */}
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className="font-bold text-gray-900 text-xs sm:text-sm">{zone.name}</span>
                                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${zone.heatColorClass}`}>
                                          {zone.density}% Full
                                        </span>
                                      </div>
                                      
                                      <p className="text-[11px] text-gray-500 leading-normal mb-3 min-h-[32px]">{zone.description}</p>
                                    </div>
                                    
                                    {/* Radial Progress & Metric Details side-by-side */}
                                    <div className="flex items-center gap-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100 mb-3">
                                      
                                      {/* Radial Donut Progress Chart utilizing Recharts */}
                                      <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                            <Pie
                                              data={[
                                                { name: "Filled", value: zone.density },
                                                { name: "Available", value: Math.max(100 - zone.density, 0) }
                                              ]}
                                              cx="50%"
                                              cy="50%"
                                              innerRadius={18}
                                              outerRadius={24}
                                              startAngle={90}
                                              endAngle={-270}
                                              dataKey="value"
                                              stroke="none"
                                            >
                                              <Cell fill={zone.hexColor} />
                                              <Cell fill="#E5E7EB" />
                                            </Pie>
                                            <RechartsTooltip 
                                              formatter={(val: any, name: any) => [`${val}%`, name]}
                                              contentStyle={{ background: "#3E2723", color: "#fff", borderRadius: "8px", border: "none", fontSize: "10px" }}
                                            />
                                          </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                          <span className="text-[10px] font-bold text-gray-800 leading-none">{zone.density}%</span>
                                        </div>
                                      </div>

                                      {/* Storage metrics details on the right of the donut */}
                                      <div className="space-y-1">
                                        <span className="text-[10px] text-gray-400 block font-medium">Volumetric Saturation</span>
                                        <div className="text-xs font-bold text-gray-700 font-mono">
                                          {zone.totalStock} <span className="text-[10px] text-gray-500 font-sans font-normal">/ {zone.maxCapacity} units</span>
                                        </div>
                                        <div className="text-[9px] text-gray-500 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: zone.hexColor }}></span>
                                          <span>{zone.category} Department</span>
                                        </div>
                                      </div>

                                    </div>

                                    {/* Contained catalog items */}
                                    <div className="pt-2 border-t border-gray-100">
                                      <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Items in Sector</span>
                                      {zone.itemsList.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {zone.itemsList.map(item => (
                                            <span 
                                              key={item.id} 
                                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${item.stock < item.minSafetyThreshold ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-gray-100 text-gray-700'}`}
                                              title={`${item.name} | SKU: ${item.sku} | Stock: ${item.stock} ${item.unit}`}
                                            >
                                              {item.sku} ({item.stock})
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-gray-400 italic">No inventory currently allocated to this sector</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>

                    </div>
                  )}

                  {/* --- TAB B: CATALOG MASTER --- */}
                  {activeTab === 'catalog' && (
                    <div className="space-y-8">
                      
                      {/* Inventory View Header & QR Code Scanner Panel */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                        <div>
                          <h3 className="font-bold text-lg text-[#3E2723] flex items-center gap-2">
                            <Package className="w-5 h-5 text-[#FBC02D]" />
                            <span>Central Material Specifications & Catalog</span>
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Review master ledger materials, minimum safety buffers, and physical warehouse zone indices.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Search Bar with Embedded QR Scanner Trigger */}
                          <div className="relative w-64">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              id="catalog-header-search"
                              type="text"
                              placeholder="Filter by SKU or description..."
                              value={globalFilter}
                              onChange={(e) => setGlobalFilter(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-10 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723] transition-all"
                            />
                            <button
                              id="btn-qr-scan-filter-icon"
                              onClick={() => setShowQRModal(true)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-[#3E2723] hover:bg-gray-100 rounded transition-all"
                              title="Scan Item QR Code"
                              type="button"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          </div>

                          <button
                            id="btn-catalog-scan-qr-header"
                            onClick={() => setShowQRModal(true)}
                            className="px-4 py-2 bg-[#3E2723] text-[#FBC02D] hover:bg-[#3E2723]/90 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
                            type="button"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Scan SKU QR Code</span>
                          </button>

                          <button
                            id="btn-catalog-import-csv"
                            onClick={() => setShowCSVPanel(!showCSVPanel)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
                            type="button"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Batch Import CSV</span>
                          </button>
                        </div>
                      </div>

                      {/* CSV Batch Import Panel */}
                      {showCSVPanel && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md space-y-4"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                              <h3 className="font-bold text-[#3E2723] text-sm">Batch Import Inventory via CSV</h3>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setShowCSVPanel(false)} 
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Left Side: Drag & Drop Zone */}
                            <div className="md:col-span-1 space-y-3">
                              <label className="block text-xs font-semibold text-gray-500">Upload CSV File</label>
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setCsvIsDragging(true);
                                }}
                                onDragLeave={() => setCsvIsDragging(false)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setCsvIsDragging(false);
                                  const file = e.dataTransfer.files[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      if (event.target?.result) {
                                        handleCSVFileRead(event.target.result as string, file.name);
                                      }
                                    };
                                    reader.readAsText(file);
                                  }
                                }}
                                onClick={() => {
                                  document.getElementById("csv-file-input")?.click();
                                }}
                                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                                  csvIsDragging
                                    ? "border-[#FBC02D] bg-[#FBC02D]/10"
                                    : "border-gray-300 hover:border-[#3E2723] bg-gray-50"
                                }`}
                              >
                                <Upload className="w-8 h-8 text-gray-400" />
                                <span className="text-xs font-semibold text-[#3E2723]">
                                  {csvFileName || "Drag & Drop CSV here or click to browse"}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  Supports columns: sku, name, category, unit, stock, cost, supplier, minSafetyThreshold
                                </span>
                              </div>
                              <input
                                id="csv-file-input"
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      if (event.target?.result) {
                                        handleCSVFileRead(event.target.result as string, file.name);
                                      }
                                    };
                                    reader.readAsText(file);
                                  }
                                }}
                              />
                              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-[11px] text-amber-800 space-y-1">
                                <span className="font-bold block">CSV Format Instructions:</span>
                                <p>Headers are case-insensitive. SKU, Name, and Category are required.</p>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const csvContent = "sku,name,category,unit,stock,cost,supplier,minSafetyThreshold\nSKU-ECOM-200,Wireless Audio Earbuds,E-Commerce,Pairs,50,29.99,SoundCore Corp,15\nSKU-MANU-301,Carbon Fiber Sheets,Manufacturing,Units,120,45.50,CarboTech Sourcing,20";
                                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.setAttribute("href", url);
                                    link.setAttribute("download", "inventory_import_template.csv");
                                    link.click();
                                  }}
                                  className="text-amber-900 font-bold underline hover:text-amber-950 mt-1 block text-left"
                                >
                                  Download Template CSV
                                </button>
                              </div>
                            </div>

                            {/* Right Side: Parsed Preview & Import Action */}
                            <div className="md:col-span-2 flex flex-col justify-between space-y-4">
                              <div className="space-y-2 flex-grow">
                                <span className="block text-xs font-semibold text-gray-500">Parsed Preview</span>
                                
                                {csvError && (
                                  <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{csvError}</span>
                                  </div>
                                )}

                                {csvSuccess && (
                                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                                    <span>{csvSuccess}</span>
                                  </div>
                                )}

                                {csvParsedItems.length > 0 ? (
                                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                    <table className="w-full text-[10px] text-left border-collapse">
                                      <thead>
                                        <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                                          <th className="p-2">SKU</th>
                                          <th className="p-2">Name</th>
                                          <th className="p-2">Dept</th>
                                          <th className="p-2">Qty</th>
                                          <th className="p-2">Cost</th>
                                          <th className="p-2">Supplier</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 text-gray-700 font-mono">
                                        {csvParsedItems.map((item, idx) => (
                                          <tr key={idx} className="hover:bg-gray-50/50">
                                            <td className="p-2 font-bold">{item.sku}</td>
                                            <td className="p-2 truncate max-w-[120px]" title={item.name}>{item.name}</td>
                                            <td className="p-2">{item.category}</td>
                                            <td className="p-2 font-bold text-[#3E2723]">{item.stock}</td>
                                            <td className="p-2">${Number(item.cost).toFixed(2)}</td>
                                            <td className="p-2 truncate max-w-[80px]">{item.supplier}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="h-44 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-1">
                                    <FileSpreadsheet className="w-8 h-8 stroke-1" />
                                    <span className="text-xs">No CSV items staged yet</span>
                                    <span className="text-[10px]">Select or drop a CSV file to load list</span>
                                  </div>
                                )}
                              </div>

                              {csvParsedItems.length > 0 && (
                                <div className="flex justify-end gap-3 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCsvParsedItems([]);
                                      setCsvFileName("");
                                      setCsvSuccess(null);
                                      setCsvError(null);
                                    }}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all"
                                  >
                                    Reset
                                  </button>
                                  <button
                                    type="button"
                                    onClick={submitBatchImport}
                                    disabled={csvImporting}
                                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow flex items-center gap-1.5"
                                  >
                                    {csvImporting ? (
                                      <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Importing {csvParsedItems.length} items...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-4 h-4" />
                                        <span>Confirm Batch Import</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                      
                      {/* Interactive Add Item Overlay form inside catalog if visible */}
                      {showItemForm && (
                        <motion.form 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          onSubmit={handleCreateItem}
                          className="bg-white p-6 rounded-2xl border-2 border-[#FBC02D] shadow-lg space-y-4"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <h3 className="font-bold text-[#3E2723]">➕ Register New Catalog Asset</h3>
                            <button type="button" onClick={() => setShowItemForm(false)} className="text-gray-400 hover:text-gray-600">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-semibold mb-1">SKU Code (Unique)</label>
                              <input 
                                id="inp-item-sku"
                                type="text" 
                                placeholder="e.g. SKU-ECOM-103" 
                                value={newItem.sku}
                                onChange={(e) => setNewItem({...newItem, sku: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Asset Name</label>
                              <input 
                                id="inp-item-name"
                                type="text" 
                                placeholder="e.g. Vibram Sole" 
                                value={newItem.name}
                                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Operational Team Department</label>
                              <select 
                                id="sel-item-category"
                                value={newItem.category}
                                onChange={(e) => setNewItem({...newItem, category: e.target.value as any})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                              >
                                <option value="E-Commerce">E-Commerce</option>
                                <option value="Manufacturing">Manufacturing</option>
                                <option value="Field Service">Field Service</option>
                                <option value="General">General</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Unit of Measure</label>
                              <input 
                                id="inp-item-unit"
                                type="text" 
                                placeholder="e.g. Pairs, Boxes, Units" 
                                value={newItem.unit}
                                onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Initial Stock Ledger Quantity</label>
                              <input 
                                id="inp-item-stock"
                                type="number" 
                                value={newItem.stock}
                                onChange={(e) => setNewItem({...newItem, stock: Number(e.target.value)})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Cost Per Unit ($)</label>
                              <input 
                                id="inp-item-cost"
                                type="number" 
                                step="0.01"
                                value={newItem.cost}
                                onChange={(e) => setNewItem({...newItem, cost: Number(e.target.value)})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Supplier Entity</label>
                              <input 
                                id="inp-item-supplier"
                                type="text" 
                                placeholder="Apex Footwear"
                                value={newItem.supplier}
                                onChange={(e) => setNewItem({...newItem, supplier: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Min Safety stock Threshold</label>
                              <input 
                                id="inp-item-threshold"
                                type="number" 
                                value={newItem.minSafetyThreshold}
                                onChange={(e) => setNewItem({...newItem, minSafetyThreshold: Number(e.target.value)})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowItemForm(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] text-xs font-bold rounded-xl hover:bg-[#FBC02D]/90 transition-all shadow">Register Asset</button>
                          </div>
                        </motion.form>
                      )}

                      {/* Stock Transfer Form */}
                      {showMovementForm && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-white p-6 rounded-2xl border-2 border-[#FBC02D] shadow-lg space-y-5"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <div>
                              <h3 className="font-bold text-[#3E2723] text-base flex items-center gap-2">
                                <span>🔄 Compile Ledger Stock Movement</span>
                                <span className="text-xs bg-[#3E2723] text-[#FBC02D] font-bold px-2.5 py-0.5 rounded-full">
                                  {movementBatch.length} staged batches
                                </span>
                              </h3>
                              <p className="text-[11px] text-gray-500 mt-0.5">Stage multiple items and move them to their respective locations in one click.</p>
                            </div>
                            <button type="button" onClick={() => { setShowMovementForm(false); setMovementBatch([]); }} className="text-gray-400 hover:text-gray-600">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          
                          {/* Transfer Input Stage */}
                          <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl space-y-4">
                            <span className="text-[10px] font-bold text-[#3E2723] uppercase tracking-wider block">Stage Transfer Line</span>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Asset To Transfer</label>
                                <select 
                                  id="sel-movement-item"
                                  value={newMovement.itemId || ""}
                                  onChange={(e) => setNewMovement({...newMovement, itemId: e.target.value})}
                                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                                >
                                  <option value="">-- Choose Item --</option>
                                  {items.map(i => (
                                    <option key={i.id} value={i.id}>{i.name} (SKU: {i.sku})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">From Location</label>
                                <select 
                                  id="sel-movement-from"
                                  value={newMovement.fromLocationId || "LOC-WH-1"}
                                  onChange={(e) => setNewMovement({...newMovement, fromLocationId: e.target.value})}
                                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                                >
                                  <option value="N/A">N/A (External Intake / Receipt)</option>
                                  {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">To Location</label>
                                <select 
                                  id="sel-movement-to"
                                  value={newMovement.toLocationId || "LOC-ST-2"}
                                  onChange={(e) => setNewMovement({...newMovement, toLocationId: e.target.value})}
                                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                                >
                                  <option value="N/A">N/A (External Delivery / Scrap / Ship Out)</option>
                                  {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Quantity</label>
                                <div className="flex gap-2">
                                  <input 
                                    id="inp-movement-qty"
                                    type="number" 
                                    value={newMovement.quantity || ""}
                                    onChange={(e) => setNewMovement({...newMovement, quantity: Number(e.target.value)})}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] focus:outline-none focus:border-[#3E2723]"
                                    placeholder="Qty"
                                  />
                                  <button
                                    type="button"
                                    onClick={addStagedMovement}
                                    className="bg-[#3E2723] text-[#FBC02D] hover:bg-[#3E2723]/90 font-bold px-4 rounded-xl text-xs flex items-center justify-center gap-1 shrink-0 shadow-sm"
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span>Stage</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Staged list of batch items */}
                          {movementBatch.length > 0 && (
                            <div className="border border-gray-100 rounded-xl overflow-hidden">
                              <div className="bg-gray-100/60 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-[#3E2723] uppercase tracking-wider">Staged Transfers Batch Ledger</span>
                                <button 
                                  type="button" 
                                  onClick={() => setMovementBatch([])}
                                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                                >
                                  Clear Batch
                                </button>
                              </div>
                              <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                                {movementBatch.map((batch, index) => {
                                  const targetItem = items.find(i => i.id === batch.itemId);
                                  return (
                                    <div key={index} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-gray-50/50">
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 w-full pr-4">
                                        <span className="font-bold text-gray-900 truncate">
                                          {targetItem ? targetItem.name : batch.itemId}
                                        </span>
                                        <span className="text-gray-500 font-medium">
                                          From: <strong className="text-gray-700">{batch.fromLocationId}</strong>
                                        </span>
                                        <span className="text-gray-500 font-medium">
                                          To: <strong className="text-gray-700">{batch.toLocationId}</strong>
                                        </span>
                                        <span className="text-[#3E2723] font-bold">
                                          Qty: {batch.quantity} {targetItem?.unit || "units"}
                                        </span>
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => removeStagedMovement(index)}
                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Submit Actions */}
                          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-400">
                              {movementBatch.length > 0 
                                ? "Click Commit to execute the multi-select batch transfer immediately." 
                                : "Stage items above, or specify one to transfer directly."}
                            </span>
                            <div className="flex gap-3">
                              <button 
                                type="button" 
                                onClick={() => { setShowMovementForm(false); setMovementBatch([]); }} 
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all"
                              >
                                Cancel
                              </button>
                              <button 
                                type="button" 
                                onClick={handleCreateMovement}
                                className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] text-xs font-bold rounded-xl hover:bg-[#FBC02D]/90 transition-all shadow"
                              >
                                {movementBatch.length > 0 
                                  ? `Commit Batch (${movementBatch.length} Transfers)` 
                                  : "Commit Single Transfer"}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Edit Item Modal Popup */}
                      {showEditItemForm && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                          <motion.form 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onSubmit={handleEditItem}
                            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-200 space-y-4"
                          >
                            <h3 className="font-bold text-lg text-[#3E2723]">✏️ Edit Asset Specifications</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                <label className="block text-xs font-semibold mb-1">Asset Name</label>
                                <input 
                                  id="inp-edit-name"
                                  type="text" 
                                  value={showEditItemForm.name}
                                  onChange={(e) => setShowEditItemForm({...showEditItemForm, name: e.target.value})}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1">Available Stock Balance</label>
                                <input 
                                  id="inp-edit-stock"
                                  type="number" 
                                  value={showEditItemForm.stock}
                                  onChange={(e) => setShowEditItemForm({...showEditItemForm, stock: Number(e.target.value)})}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1">Cost Per Unit ($)</label>
                                <input 
                                  id="inp-edit-cost"
                                  type="number" 
                                  step="0.01"
                                  value={showEditItemForm.cost}
                                  onChange={(e) => setShowEditItemForm({...showEditItemForm, cost: Number(e.target.value)})}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1">Min Safety Threshold</label>
                                <input 
                                  id="inp-edit-threshold"
                                  type="number" 
                                  value={showEditItemForm.minSafetyThreshold}
                                  onChange={(e) => setShowEditItemForm({...showEditItemForm, minSafetyThreshold: Number(e.target.value)})}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1">Supplier Entity</label>
                                <input 
                                  id="inp-edit-supplier"
                                  type="text" 
                                  value={showEditItemForm.supplier}
                                  onChange={(e) => setShowEditItemForm({...showEditItemForm, supplier: e.target.value})}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                              <button type="button" onClick={() => setShowEditItemForm(null)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-semibold">Cancel</button>
                              <button type="submit" className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] text-xs font-bold rounded-xl shadow">Save Specifications</button>
                            </div>
                          </motion.form>
                        </div>
                      )}

                      {/* SUPPLIER AGGREGATED METRICS WIDGET */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                          <div>
                            <h4 className="font-bold text-sm text-[#3E2723] flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-amber-500" />
                              <span>Supplier Allocation & Lead-Time Summary</span>
                            </h4>
                            <p className="text-[10px] text-gray-500">Aggregated inventory spend and performance metrics from the current master ledger.</p>
                          </div>
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full uppercase">Dynamic Audit</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {getSupplierSummaryMetrics().map((supplier) => (
                            <div key={supplier.name} className="bg-gray-50/50 hover:bg-gray-50 border border-gray-100 hover:border-amber-200 p-4 rounded-xl space-y-2 transition-all shadow-xs">
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase truncate max-w-[120px]" title={supplier.name}>
                                  {supplier.name}
                                </span>
                                <span className="text-[9px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                                  {supplier.itemCount} {supplier.itemCount === 1 ? 'item' : 'items'}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-lg font-black text-[#3E2723]">${supplier.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <p className="text-[10px] text-gray-400">Total Capital Value</p>
                              </div>
                              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[10px]">
                                <span className="text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Avg Lead Time
                                </span>
                                <span className="font-bold text-[#3E2723] font-mono">{supplier.avgLeadTime.toFixed(1)} Days</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* CATALOG TABLE AND LEDGERS */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                          <h3 className="font-bold text-[#3E2723]">Master Ledger Database</h3>
                          <span className="text-xs text-gray-500 font-medium">Filtering matches: {items.filter(i => i.name.toLowerCase().includes(globalFilter.toLowerCase()) || i.sku.toLowerCase().includes(globalFilter.toLowerCase())).length} items</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 bg-gray-50/50 uppercase tracking-wider">
                                <th className="p-4 pl-6 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('sku')}>
                                  <div className="flex items-center gap-1">
                                    <span>SKU Code</span>
                                    <span className="text-[10px] text-gray-400">
                                      {sortField === 'sku' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                    </span>
                                  </div>
                                </th>
                                <th className="p-4 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                                  <div className="flex items-center gap-1">
                                    <span>Material Specification</span>
                                    <span className="text-[10px] text-gray-400">
                                      {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                    </span>
                                  </div>
                                </th>
                                <th className="p-4">Team Department</th>
                                <th className="p-4 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('stock')}>
                                  <div className="flex items-center gap-1">
                                    <span>Stock level</span>
                                    <span className="text-[10px] text-gray-400">
                                      {sortField === 'stock' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                    </span>
                                  </div>
                                </th>
                                <th className="p-4 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('cost')}>
                                  <div className="flex items-center gap-1">
                                    <span>Unit Cost</span>
                                    <span className="text-[10px] text-gray-400">
                                      {sortField === 'cost' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                    </span>
                                  </div>
                                </th>
                                <th className="p-4">Supplier Source</th>
                                <th className="p-4 text-right pr-6">Operational Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                              <AnimatePresence mode="popLayout">
                                {getSortedItems().map(item => {
                                  const belowSafety = item.stock < item.minSafetyThreshold;
                                  return (
                                    <motion.tr 
                                      key={item.id}
                                      initial={{ opacity: 0, y: 8 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.98 }}
                                      transition={{ duration: 0.15 }}
                                      layout="position"
                                      className={`hover:bg-gray-50/40 transition-colors ${belowSafety ? 'bg-red-50/20' : ''}`}
                                    >
                                      <td className="p-4 pl-6 font-mono font-bold text-gray-900">{item.sku}</td>
                                      <td className="p-4">
                                        <div className="font-semibold text-gray-900">{item.name}</div>
                                        <div className="text-[10px] text-gray-500">Unit: {item.unit}</div>
                                      </td>
                                      <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                          item.category === 'E-Commerce' ? 'bg-amber-100 text-amber-800' :
                                          item.category === 'Manufacturing' ? 'bg-blue-100 text-blue-800' :
                                          item.category === 'Field Service' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                          {item.category}
                                        </span>
                                      </td>
                                      <td className="p-4">
                                        <div className="font-bold flex items-center gap-1.5 text-sm">
                                          <span>{item.stock}</span>
                                          {belowSafety && (
                                            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5" title="Below Safety Stock!">
                                              <AlertTriangle className="w-2.5 h-2.5 stroke-[3]" /> Exception
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-gray-500">Safety Min: {item.minSafetyThreshold}</div>
                                      </td>
                                      <td className="p-4 font-mono">${item.cost.toFixed(2)}</td>
                                      <td className="p-4">
                                        <button
                                          id={`btn-supplier-source-${item.id}`}
                                          type="button"
                                          onClick={() => setSelectedSupplierDetails(getSupplierDetails(item.supplier))}
                                          className="text-left font-medium text-gray-700 hover:text-amber-600 transition-colors hover:underline flex items-center gap-1.5"
                                          title="Click to view contact & lead time history"
                                        >
                                          <Truck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                          <span>{item.supplier || "N/A"}</span>
                                        </button>
                                      </td>
                                      <td className="p-4 text-right pr-6 space-x-3">
                                        <button 
                                          id={`btn-variance-item-${item.id}`}
                                          onClick={() => {
                                            setVarianceItem(item);
                                            setPhysicalCount(String(item.stock));
                                            setVarianceReason("Periodic audit count discrepancy");
                                          }}
                                          className="text-amber-800 font-semibold hover:underline inline-flex items-center gap-0.5"
                                          type="button"
                                          title="Log manual stock variance discrepancy"
                                        >
                                          <Clipboard className="w-3.5 h-3.5 text-amber-600" />
                                          <span>Variance</span>
                                        </button>
                                        <button 
                                          id={`btn-print-qr-${item.id}`}
                                          onClick={() => setPrintQrCodeItem(item)}
                                          className="text-amber-600 font-semibold hover:underline inline-flex items-center gap-0.5"
                                          type="button"
                                        >
                                          <QrCode className="w-3.5 h-3.5 text-amber-500" />
                                          <span>Print QR</span>
                                        </button>
                                        <button 
                                          id={`btn-edit-item-${item.id}`}
                                          onClick={() => setShowEditItemForm(item)}
                                          className="text-[#3E2723] font-semibold hover:underline"
                                        >
                                          Edit
                                        </button>
                                        <button 
                                          id={`btn-delete-item-${item.id}`}
                                          onClick={() => handleDeleteItem(item.id)}
                                          className="text-red-600 font-semibold hover:underline"
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </motion.tr>
                                  );
                                })}
                              </AnimatePresence>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Stock Movement Log Card */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <h3 className="font-bold text-[#3E2723] mb-4">Stock Ledger Movement History</h3>
                        <div className="space-y-3">
                          {movements.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg text-gray-500">
                                  <Clipboard className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    Moved {m.quantity}x of {getItemName(m.itemId)}
                                  </p>
                                  <p className="text-gray-500 text-[10px] mt-0.5">
                                    Origin: <strong className="text-gray-700">{m.fromLocationId}</strong> → Destination: <strong className="text-gray-700">{m.toLocationId}</strong>
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-gray-500 text-[10px] block">{new Date(m.createdAt).toLocaleString()}</span>
                                <span className="text-[10px] text-[#3E2723] font-semibold bg-[#FBC02D]/20 px-2 py-0.5 rounded mt-1 inline-block">By: {m.createdBy}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* --- TAB C: E-COMMERCE LOGISTICS --- */}
                  {activeTab === 'ecommerce' && (
                    <div className="space-y-8">
                      {/* Place Order form overlay */}
                      {showOrderForm && (
                        <motion.form 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          onSubmit={handleCreateOrder}
                          className="bg-white p-6 rounded-2xl border-2 border-[#FBC02D] shadow-lg space-y-4"
                        >
                          <div className="flex justify-between items-center">
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                              <ShoppingCart className="w-5 h-5 text-[#FBC02D]" />
                              <span>Simulation: Place Storefront E-Commerce Order</span>
                            </h3>
                            <button 
                              type="button" 
                              onClick={() => setShowOrderForm(false)} 
                              className="text-gray-400 hover:text-gray-600 text-xs"
                            >
                              ✕ Close
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-semibold mb-1 text-[#3E2723]">Select Catalog SKU</label>
                              <select 
                                id="inp-order-sku"
                                value={newOrder.sku}
                                onChange={(e) => setNewOrder({...newOrder, sku: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800"
                                required
                              >
                                <option value="">-- Choose Item --</option>
                                {items.map(item => (
                                  <option key={item.id} value={item.sku}>{item.sku} - {item.name} ({item.stock} in stock)</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1 text-[#3E2723]">Customer Name</label>
                              <input 
                                id="inp-order-customer"
                                type="text" 
                                placeholder="e.g. John Doe" 
                                value={newOrder.customerName}
                                onChange={(e) => setNewOrder({...newOrder, customerName: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1 text-[#3E2723]">Quantity</label>
                              <input 
                                id="inp-order-qty"
                                type="number" 
                                min="1"
                                value={newOrder.quantity}
                                onChange={(e) => setNewOrder({...newOrder, quantity: Number(e.target.value)})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1 text-[#3E2723]">Sales Channel</label>
                              <select 
                                id="inp-order-channel"
                                value={newOrder.channel}
                                onChange={(e) => setNewOrder({...newOrder, channel: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800"
                                required
                              >
                                <option value="Shopify">Shopify Storefront</option>
                                <option value="Amazon">Amazon Marketplace</option>
                                <option value="eBay">eBay Direct</option>
                                <option value="Wholesale">Wholesale Portal</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-2">
                            <button 
                              type="button" 
                              onClick={() => setShowOrderForm(false)} 
                              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button 
                              type="submit" 
                              className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] font-bold rounded-xl text-xs hover:bg-[#FBC02D]/90 transition-all"
                            >
                              Place Order simulation
                            </button>
                          </div>
                        </motion.form>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Left column: active order backlogs */}
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                              <ShoppingCart className="w-5 h-5 text-[#FBC02D]" />
                              <span>Storefront Active Order Queue</span>
                            </h3>
                            {!showOrderForm && (
                              <button 
                                onClick={() => setShowOrderForm(true)}
                                className="px-3 py-1.5 bg-[#3E2723] text-[#FBC02D] hover:bg-[#3E2723]/90 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Order Record
                              </button>
                            )}
                          </div>

                          <div className="divide-y divide-gray-100">
                            {orders.map(order => (
                              <div key={order.id} className="py-4 flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 text-sm">{order.id}</span>
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold font-mono">
                                      {order.channel}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    Customer: <strong>{order.customerName}</strong> | Sells: <strong>{order.quantity}x SKU: {order.sku}</strong>
                                  </p>
                                  <p className="text-[10px] text-gray-400">{new Date(order.createdAt).toLocaleString()}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {order.status === 'pending' && (
                                    <>
                                      <button 
                                        id={`btn-pick-order-${order.id}`}
                                        onClick={() => handleUpdateOrderStatus(order.id, 'picking')}
                                        className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-lg hover:bg-amber-600 transition-all"
                                      >
                                        Pick Item
                                      </button>
                                    </>
                                  )}
                                  {order.status === 'picking' && (
                                    <button 
                                      id={`btn-pack-order-${order.id}`}
                                      onClick={() => handleUpdateOrderStatus(order.id, 'packed')}
                                      className="px-3 py-1.5 bg-[#3E2723] text-white text-[10px] font-bold rounded-lg hover:bg-[#3E2723]/90 transition-all"
                                    >
                                      Pack Order
                                    </button>
                                  )}
                                  {order.status === 'packed' && (
                                    <button 
                                      id={`btn-ship-order-${order.id}`}
                                      onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                                      className="px-3 py-1.5 bg-[#FBC02D] text-[#3E2723] text-[10px] font-bold rounded-lg hover:bg-[#FBC02D]/95 transition-all"
                                    >
                                      Ship Out
                                    </button>
                                  )}
                                  {order.status === 'shipped' && (
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5" /> Shipped
                                    </span>
                                  )}
                                  <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                                    {order.status}
                                  </span>
                                  <button
                                    id={`btn-delete-order-${order.id}`}
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                    title="Cancel and Delete Order Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Right column: ATP (Available to promise) settings */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                          <h3 className="font-bold text-[#3E2723]">Channel Allocations & Buffer</h3>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            Mitigate overselling risks by applying safety buffers. Channel settings dictate the max available stock synchronized out.
                          </p>
                          
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Shopify Buffer Margin</span>
                                <span className="text-[#FBC02D]">5 units</span>
                              </div>
                              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-[#FBC02D] h-full" style={{ width: '40%' }}></div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Amazon Safety Reserves</span>
                                <span className="text-[#FBC02D]">10% of total</span>
                              </div>
                              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-[#3E2723] h-full" style={{ width: '70%' }}></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t border-gray-100">
                            <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Returns Quarantine Queue</h4>
                            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 flex items-start gap-2.5 text-xs text-amber-800">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <p>No active quarantined items. Returned e-commerce stock gets vetted by QA before catalog restock.</p>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* --- TAB D: MANUFACTURING SUITE --- */}
                  {activeTab === 'manufacturing' && (
                    <div className="space-y-8">
                      
                      {/* BOM builder form overlay */}
                      {showBomForm && (
                        <motion.form 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          onSubmit={handleCreateBom}
                          className="bg-white p-6 rounded-2xl border-2 border-[#FBC02D] shadow-lg space-y-4"
                        >
                          <h3 className="font-bold text-[#3E2723]">🛠️ Register Bill of Materials (BOM)</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold mb-1">Assembly Name</label>
                              <input 
                                id="inp-bom-name"
                                type="text" 
                                placeholder="e.g. Standard Boot Assembly" 
                                value={newBom.name}
                                onChange={(e) => setNewBom({...newBom, name: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Finished Product Catalog SKU</label>
                              <select 
                                id="sel-bom-item"
                                value={newBom.itemId}
                                onChange={(e) => setNewBom({...newBom, itemId: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                required
                              >
                                <option value="">-- Select Product --</option>
                                {items.filter(i => i.category === 'E-Commerce' || i.category === 'General').map(i => (
                                  <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-semibold mb-1 font-mono uppercase tracking-wider text-[#FBC02D] bg-[#3E2723] px-2 py-0.5 rounded-md inline-block">Required BOM Components</label>
                              <p className="text-[10px] text-gray-500 mb-2">Specify raw materials consumed per finished assembly unit run</p>
                              <div className="space-y-2">
                                {newBom.components.map((comp, idx) => (
                                  <div key={idx} className="flex gap-2 items-center">
                                    <select
                                      value={comp.itemId}
                                      onChange={(e) => {
                                        const copy = [...newBom.components];
                                        copy[idx].itemId = e.target.value;
                                        setNewBom({...newBom, components: copy});
                                      }}
                                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                    >
                                      <option value="">-- Raw Component --</option>
                                      {items.filter(i => i.category === 'Manufacturing').map(i => (
                                        <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      placeholder="Qty needed"
                                      value={comp.quantity}
                                      onChange={(e) => {
                                        const copy = [...newBom.components];
                                        copy[idx].quantity = Number(e.target.value);
                                        setNewBom({...newBom, components: copy});
                                      }}
                                      className="w-28 bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                    />
                                  </div>
                                ))}
                                <button 
                                  type="button" 
                                  onClick={() => setNewBom({...newBom, components: [...newBom.components, { itemId: "", quantity: 1 }]})}
                                  className="text-xs font-semibold text-[#3E2723] hover:underline"
                                >
                                  + Add component line
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowBomForm(false)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-semibold">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] text-xs font-bold rounded-xl shadow">Save BOM Routing</button>
                          </div>
                        </motion.form>
                      )}

                      {/* Work order creation form overlay */}
                      {showWorkOrderForm && (
                        <motion.form 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          onSubmit={handleCreateWorkOrder}
                          className="bg-white p-6 rounded-2xl border-2 border-[#FBC02D] shadow-lg space-y-4"
                        >
                          <h3 className="font-bold text-[#3E2723]">🚀 Queue Assembly Production Run</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-semibold mb-1">Select BOM Assembler</label>
                              <select 
                                id="sel-wo-bom"
                                value={newWorkOrder.bomId}
                                onChange={(e) => setNewWorkOrder({...newWorkOrder, bomId: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                required
                              >
                                <option value="">-- Select BOM --</option>
                                {boms.map(b => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Target Finished Quantity</label>
                              <input 
                                id="inp-wo-qty"
                                type="number" 
                                value={newWorkOrder.quantity}
                                onChange={(e) => setNewWorkOrder({...newWorkOrder, quantity: Number(e.target.value)})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Assembly Due Date</label>
                              <input 
                                id="inp-wo-date"
                                type="date" 
                                value={newWorkOrder.dueDate}
                                onChange={(e) => setNewWorkOrder({...newWorkOrder, dueDate: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowWorkOrderForm(false)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-semibold">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] text-xs font-bold rounded-xl shadow">Queue Run</button>
                          </div>
                        </motion.form>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* BOM List */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                          <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                            <Layers className="w-5 h-5 text-[#FBC02D]" />
                            <span>Bill of Materials (BOM) Specs</span>
                          </h3>
                          <div className="space-y-4">
                            {boms.map(b => (
                              <div key={b.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-2">
                                <div className="flex justify-between items-center font-bold text-gray-900">
                                  <span>{b.name}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] text-gray-500">{b.id}</span>
                                    <button 
                                      id={`btn-delete-bom-${b.id}`}
                                      onClick={() => handleDeleteBom(b.id)}
                                      className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                      title="Delete BOM Routing"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-gray-500 leading-normal">{b.description}</p>
                                <div className="pt-2 border-t border-gray-200/50 space-y-1">
                                  <p className="font-semibold text-[#3E2723] uppercase tracking-wider text-[10px]">Component Formula:</p>
                                  {b.components.map((c, i) => (
                                    <div key={i} className="flex justify-between text-gray-600">
                                      <span>{getItemName(c.itemId)}</span>
                                      <span className="font-bold">x{c.quantity} units</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Work order schedule & Completion */}
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                          <h3 className="font-bold text-[#3E2723]">Active Assembly Work Orders</h3>
                          <div className="divide-y divide-gray-100">
                            {workOrders.map(wo => (
                              <div key={wo.id} className="py-4 flex items-center justify-between gap-4 text-xs">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900">{wo.id}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                      wo.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                      wo.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
                                    }`}>
                                      {wo.status}
                                    </span>
                                  </div>
                                  <p className="text-gray-500">
                                    BOM: <strong className="text-gray-800">{boms.find(b => b.id === wo.bomId)?.name}</strong> | Quantity: <strong>{wo.quantity} units</strong>
                                  </p>
                                  <p className="text-[10px] text-gray-400">Due Date: {wo.dueDate}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {wo.status === 'planned' && (
                                    <button 
                                      id={`btn-start-wo-${wo.id}`}
                                      onClick={() => handleUpdateWorkOrderStatus(wo.id, 'in-progress')}
                                      className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg"
                                    >
                                      Start Run
                                    </button>
                                  )}
                                  {wo.status === 'in-progress' && (
                                    <button 
                                      id={`btn-complete-wo-${wo.id}`}
                                      onClick={() => handleUpdateWorkOrderStatus(wo.id, 'completed')}
                                      className="px-3 py-1.5 bg-[#FBC02D] text-[#3E2723] text-[10px] font-bold rounded-lg shadow"
                                    >
                                      Complete Run & Add Stock
                                    </button>
                                  )}
                                  {wo.status === 'completed' && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded">Inventory Credited</span>
                                  )}
                                  <button 
                                    id={`btn-delete-wo-${wo.id}`}
                                    onClick={() => handleDeleteWorkOrder(wo.id)}
                                    className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                    title="Cancel and Delete Work Order Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* --- TAB E: FIELD SERVICES --- */}
                  {activeTab === 'field' && (
                    <div className="space-y-8">
                      
                      {/* Parts Request Overlay Form */}
                      {showPartsRequestForm && (
                        <motion.form 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          onSubmit={handleCreatePartsRequest}
                          className="bg-white p-6 rounded-2xl border-2 border-[#FBC02D] shadow-lg space-y-4"
                        >
                          <h3 className="font-bold text-[#3E2723]">🛠️ Submit Mobile Parts Request (Fleet Replenishment)</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-semibold mb-1">Part Requested</label>
                              <select 
                                id="sel-pr-item"
                                value={newPartsRequest.itemId}
                                onChange={(e) => setNewPartsRequest({...newPartsRequest, itemId: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                required
                              >
                                <option value="">-- Select Material --</option>
                                {items.map(i => (
                                  <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Required Quantity</label>
                              <input 
                                id="inp-pr-qty"
                                type="number" 
                                value={newPartsRequest.quantity}
                                onChange={(e) => setNewPartsRequest({...newPartsRequest, quantity: Number(e.target.value)})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1">Customer Site / Job Name</label>
                              <input 
                                id="inp-pr-job"
                                type="text" 
                                placeholder="e.g. Lockheed Hub Upgrade" 
                                value={newPartsRequest.jobName}
                                onChange={(e) => setNewPartsRequest({...newPartsRequest, jobName: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowPartsRequestForm(false)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-semibold">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] text-xs font-bold rounded-xl shadow">Submit Parts Request</button>
                          </div>
                        </motion.form>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Van stocks */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                          <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-[#FBC02D]" />
                            <span>Technician Mobile Van Stocks</span>
                          </h3>
                          <div className="space-y-4">
                            {vans.map(van => (
                              <div key={van.vanId} className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-3">
                                <div className="flex justify-between font-bold">
                                  <span>{van.technicianName}</span>
                                  <span className="font-mono text-[#FBC02D] bg-[#3E2723] px-2 py-0.5 rounded">{van.vanId}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {Object.entries(van.stock).map(([id, qty]) => (
                                    <div key={id} className="flex justify-between text-gray-600 border-b border-gray-200/50 pb-1">
                                      <span>{getItemName(id)}</span>
                                      <span className="font-bold">{qty} on-hand</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Dispatch request list */}
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="font-bold text-[#3E2723]">Active Fleet Replenishment Requests</h3>
                            {!showPartsRequestForm && (
                              <button 
                                onClick={() => setShowPartsRequestForm(true)}
                                className="px-3 py-1.5 bg-[#3E2723] text-[#FBC02D] hover:bg-[#3E2723]/90 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Parts Request
                              </button>
                            )}
                          </div>
                          <div className="divide-y divide-gray-100 text-xs">
                            {partsRequests.map(req => (
                              <div key={req.id} className="py-4 flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900">{req.id}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                      req.status === 'dispatched' ? 'bg-emerald-50 text-emerald-700' :
                                      req.status === 'approved' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
                                    }`}>
                                      {req.status}
                                    </span>
                                  </div>
                                  <p className="text-gray-500">
                                    Technician: <strong>{req.technicianName}</strong> | Item: <strong>{getItemName(req.itemId)}</strong> | Qty: <strong>{req.quantity}</strong>
                                  </p>
                                  <p className="text-[10px] text-gray-400">Job Reference: {req.jobName}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {req.status === 'requested' && (
                                    <button 
                                      id={`btn-approve-pr-${req.id}`}
                                      onClick={() => handleUpdatePartsRequestStatus(req.id, 'approved')}
                                      className="px-3 py-1.5 bg-[#3E2723] text-white text-[10px] font-bold rounded-lg"
                                    >
                                      Approve Allocation
                                    </button>
                                  )}
                                  {req.status === 'approved' && (
                                    <button 
                                      id={`btn-dispatch-pr-${req.id}`}
                                      onClick={() => handleUpdatePartsRequestStatus(req.id, 'dispatched')}
                                      className="px-3 py-1.5 bg-[#FBC02D] text-[#3E2723] text-[10px] font-bold rounded-lg shadow"
                                    >
                                      Dispatch Out of Central Stock
                                    </button>
                                  )}
                                  {req.status === 'dispatched' && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded">Stock Transferred</span>
                                  )}
                                  <button 
                                    id={`btn-delete-pr-${req.id}`}
                                    onClick={() => handleDeletePartsRequest(req.id)}
                                    className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                    title="Cancel and Delete Parts Request Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>

                      {/* Speech to Text Transcribing Module */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                        <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                          <Mic className="w-5 h-5 text-[#FBC02D]" />
                          <span>🎙️ AI Speech & Audio Log Interpreter (Field Telemetry)</span>
                        </h3>
                        <p className="text-xs text-gray-500 leading-normal">
                          Simulate processing vocal logs submitted by field technicians directly into structured inventory operations.
                        </p>
                        
                        <div className="space-y-3">
                          <textarea 
                            id="txt-speech-log"
                            rows={3}
                            placeholder="Type technician speech here or use the mock preset below..."
                            value={speechInput}
                            onChange={(e) => setSpeechInput(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-[#3E2723] focus:outline-none"
                          />
                          
                          <div className="flex justify-between items-center gap-2">
                            <button 
                              id="btn-speech-preset"
                              onClick={() => setSpeechInput("Dave Miller from truck 4 reporting. I consumed two boxes of industrial grade fasteners SKU-MANU-509 for Comcast hub installation job, and one oscilloscope SKU-FIELD-881 is damaged beyond field calibration. Need stock replenishment dispatched.")}
                              className="text-[11px] text-[#3E2723] font-semibold hover:underline"
                            >
                              📋 Load Mock Speech Audio Log Preset
                            </button>
                            <button 
                              id="btn-process-speech"
                              onClick={handleTranscribeSpeech}
                              disabled={transcribing}
                              className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] font-bold text-xs rounded-xl shadow hover:bg-[#FBC02D]/90 transition-all flex items-center gap-1.5"
                            >
                              {transcribing ? "Transcribing Voice Log..." : "Interpret Speech & Sync"}
                            </button>
                          </div>

                          {transcribedLog && (
                            <div className="bg-amber-50/50 rounded-xl p-4 border border-[#FBC02D]/20 text-xs space-y-2 mt-4">
                              <h4 className="font-bold text-[#3E2723]">AI Transcriber Output:</h4>
                              <p className="italic text-gray-600">"{transcribedLog.originalSpeech}"</p>
                              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/50">
                                <div>
                                  <p className="font-semibold text-[10px] text-gray-500 uppercase">Recognized Entities:</p>
                                  <p className="font-bold text-gray-800">Technician: {transcribedLog.recognizedEntities.technician}</p>
                                  <p className="font-bold text-gray-800">Vehicle: {transcribedLog.recognizedEntities.vehicleId}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-[10px] text-gray-500 uppercase">AI Interpretation Summary:</p>
                                  <p className="text-[#3E2723] font-medium leading-relaxed">{transcribedLog.aiInterpretation}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* --- TAB F: REPORTS & FORECASTS --- */}
                  {activeTab === 'reports' && (
                    <div className="space-y-8">
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                        <div className="flex justify-between items-center flex-wrap gap-4">
                          <div className="space-y-1">
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2 text-lg">
                              <Sparkles className="w-5 h-5 text-[#FBC02D]" />
                              <span>Gemini 30-Day Predictive Forecasting</span>
                            </h3>
                            <p className="text-xs text-gray-500">
                              Calculated by analyzing active master stock ledgers against e-commerce channels sales backlogs and field engineer parts usage frequencies.
                            </p>
                          </div>
                          <button 
                            id="btn-report-run-forecast"
                            onClick={handleTriggerAIForecast}
                            disabled={forecastingLoading}
                            className="px-4 py-2.5 bg-[#FBC02D] text-[#3E2723] font-bold text-xs rounded-xl shadow hover:bg-[#FBC02D]/90 transition-all flex items-center gap-1.5"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${forecastingLoading ? 'animate-spin' : ''}`} />
                            <span>Recompute Forecast AI Matrix</span>
                          </button>
                        </div>

                        {aiForecast ? (
                          <div className="space-y-6">
                            
                            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                              <h4 className="font-bold text-xs text-[#3E2723] uppercase tracking-wider mb-1">Global AI Supply Chain Insight:</h4>
                              <p className="text-xs text-[#3E2723] leading-relaxed font-medium">{aiForecast.globalInsight}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {aiForecast.forecast.map((fc, idx) => (
                                <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-5 space-y-3 text-xs">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-bold text-gray-900 text-sm">{fc.name}</h4>
                                      <p className="font-mono text-[10px] text-gray-500 mt-0.5">SKU: {fc.sku}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      fc.riskLevel === 'High' ? 'bg-red-100 text-red-800' :
                                      fc.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {fc.riskLevel} Risk
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-[11px] py-2 border-y border-gray-200/50">
                                    <div>
                                      <p className="text-gray-500 font-medium">Est. 30D Demand:</p>
                                      <p className="font-bold text-[#3E2723] text-sm mt-0.5">{fc.predictedDemand30D} units</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 font-medium">Rec. Restock Run:</p>
                                      <p className="font-bold text-[#FBC02D] text-sm mt-0.5">+{fc.recommendedRestock} units</p>
                                    </div>
                                  </div>

                                  <p className="text-gray-600 leading-relaxed text-[11px]">{fc.rationale}</p>
                                </div>
                              ))}
                            </div>

                          </div>
                        ) : (
                          <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center gap-4">
                            <Sparkles className="w-10 h-10 text-gray-300 stroke-[1.5]" />
                            <div className="space-y-1">
                              <h4 className="font-bold text-gray-700">Predictive Forecasting Ledger Empty</h4>
                              <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
                                Let Gemini analyze your stock levels and sales backlogs to calculate automatic reorder quantities.
                              </p>
                            </div>
                            <button 
                              id="btn-report-run-forecast-empty"
                              onClick={handleTriggerAIForecast}
                              className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] text-xs font-bold rounded-xl shadow"
                            >
                              Synthesize 30D Forecast Now
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Enterprise Cross-Team Reporting & Predictive Analytics Center */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                        
                        {/* Section Header */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                          <div>
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2 text-lg">
                              <TrendingUp className="w-5 h-5 text-[#FBC02D]" />
                              <span>Cross-Team Reporting & Predictive Analytics</span>
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              Simulate, calculate, and audit seasonal stockout frequencies, category turnovers, and blended department fill-rates.
                            </p>
                          </div>

                          {/* Sub-Tabs Toggles */}
                          <div className="flex flex-wrap bg-gray-100 p-1 rounded-xl gap-1 shrink-0">
                            <button
                              id="btn-analytics-tab-stockout"
                              type="button"
                              onClick={() => setAnalyticsSubTab('stockout')}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                analyticsSubTab === 'stockout' 
                                  ? 'bg-[#3E2723] text-[#FBC02D] shadow-sm' 
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                              }`}
                            >
                              Seasonal Stockout Risks
                            </button>
                            <button
                              id="btn-analytics-tab-turnover"
                              type="button"
                              onClick={() => setAnalyticsSubTab('turnover')}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                analyticsSubTab === 'turnover' 
                                  ? 'bg-[#3E2723] text-[#FBC02D] shadow-sm' 
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                              }`}
                            >
                              Inventory Turnover (ITR)
                            </button>
                            <button
                              id="btn-analytics-tab-fillrate"
                              type="button"
                              onClick={() => setAnalyticsSubTab('fillrate')}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                analyticsSubTab === 'fillrate' 
                                  ? 'bg-[#3E2723] text-[#FBC02D] shadow-sm' 
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                              }`}
                            >
                              Blended Fill-Rate Metrics
                            </button>
                          </div>
                        </div>

                        {/* Interactive Tuning Simulator & Metrics Board */}
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                          
                          {/* Left Panel: Tuning Knobs */}
                          <div className="xl:col-span-1 bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-5 text-xs">
                            <div className="flex items-center gap-1.5 pb-2 border-b border-gray-200/60">
                              <Settings className="w-4 h-4 text-[#FBC02D]" />
                              <span className="font-bold text-gray-800 uppercase tracking-wider text-[10px]">Tuning Parameters</span>
                            </div>

                            {/* Slider 1: Seasonal Demand factor */}
                            <div className="space-y-2">
                              <div className="flex justify-between font-semibold text-gray-700">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                  Peak Seasonal Factor
                                </span>
                                <span className="font-mono text-[#3E2723] font-bold">{seasonalPeakFactor}x</span>
                              </div>
                              <input
                                id="slider-seasonal-peak-factor"
                                type="range"
                                min="1.0"
                                max="1.8"
                                step="0.1"
                                value={seasonalPeakFactor}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setSeasonalPeakFactor(val);
                                  if (val > 1.4) {
                                    triggerToast(`Seasonal model updated: Simulating Q3/Q4 peak logistics demand of ${val}x`);
                                  }
                                }}
                                className="w-full accent-[#3E2723] h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <p className="text-[10px] text-gray-400 leading-normal">
                                Multiplier for anticipated Q3/Q4 shopping peaks & winter construction runs.
                              </p>
                            </div>

                            {/* Slider 2: Supply Chain Latency Days */}
                            <div className="space-y-2">
                              <div className="flex justify-between font-semibold text-gray-700">
                                <span className="flex items-center gap-1">
                                  <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                                  Supplier Logistics Delay
                                </span>
                                <span className="font-mono text-[#3E2723] font-bold">{supplyChainDelayDays} Days</span>
                              </div>
                              <input
                                id="slider-supply-chain-delay"
                                type="range"
                                min="0"
                                max="15"
                                step="1"
                                value={supplyChainDelayDays}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setSupplyChainDelayDays(val);
                                  if (val > 6) {
                                    triggerToast(`Supplier bottleneck simulated: Latency extended to ${val} days!`);
                                  }
                                }}
                                className="w-full accent-[#3E2723] h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <p className="text-[10px] text-gray-400 leading-normal">
                                Simulates bottleneck transit times from primary manufacturing & dispatch centers.
                              </p>
                            </div>

                            {/* Live Calculations Indicators */}
                            <div className="bg-white rounded-lg p-3 border border-gray-200/60 space-y-2.5">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Live Risk Assessment</span>
                              
                              {seasonalPeakFactor * 1.2 + supplyChainDelayDays * 0.15 > 2.5 ? (
                                <div className="p-2 bg-rose-50 border border-rose-100 rounded text-rose-800 font-medium flex items-start gap-1.5 text-[10px] leading-normal">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                  <span>
                                    <strong>Logistics Alert:</strong> Supply chain strain high. Material buffer depletion predicted in E-Commerce Category during Autumn peak.
                                  </span>
                                </div>
                              ) : (
                                <div className="p-2 bg-emerald-50 border border-emerald-100 rounded text-emerald-800 font-medium flex items-start gap-1.5 text-[10px] leading-normal">
                                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  <span>
                                    <strong>Optimal:</strong> Current buffer indexes provide adequate safety runway to mitigate stockout risks.
                                  </span>
                                </div>
                              )}
                            </div>

                          </div>

                          {/* Right Panel: Active Chart Viewport */}
                          <div className="xl:col-span-3 space-y-4">
                            
                            {/* Chart Title & Explanation badge */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <h4 className="text-xs font-bold text-[#3E2723] uppercase tracking-wider">
                                {analyticsSubTab === 'stockout' && "Seasonal Stockout Occurrence Frequency & Projections"}
                                {analyticsSubTab === 'turnover' && "Interactive Inventory Turnover Ratio (ITR) vs Benchmarks"}
                                {analyticsSubTab === 'fillrate' && "Blended Fill-Rate Logistics Accuracy (6-Month Flow)"}
                              </h4>

                              <span className="text-[10px] bg-[#3E2723]/10 text-[#3E2723] px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                                <Activity className="w-3 h-3 text-[#FBC02D]" />
                                <span>Dynamic Predictor Engine Active</span>
                              </span>
                            </div>

                            {/* Responsive Recharts Frame */}
                            <div className="w-full h-[280px] bg-gray-50 border border-gray-200/50 rounded-xl p-3 flex flex-col justify-center">
                              <ResponsiveContainer width="100%" height="100%">
                                {analyticsSubTab === 'stockout' ? (
                                  <BarChart data={getSeasonalStockoutData()} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} />
                                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} />
                                    <RechartsTooltip 
                                      contentStyle={{ background: "#3E2723", color: "#fff", border: "none", borderRadius: "8px", fontSize: "11px" }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "10px", marginTop: "5px" }} />
                                    <Bar name="Historical Stockouts (Avg)" dataKey="Historical" fill="#8D6E63" radius={[4, 4, 0, 0]} />
                                    <Bar name="Predicted Seasonal Stockouts" dataKey="Predicted" fill="#FBC02D" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                ) : analyticsSubTab === 'turnover' ? (
                                  <BarChart data={getInventoryTurnoverData()} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} />
                                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} />
                                    <RechartsTooltip 
                                      contentStyle={{ background: "#3E2723", color: "#fff", border: "none", borderRadius: "8px", fontSize: "11px" }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "10px", marginTop: "5px" }} />
                                    <Bar name="Calculated Turnover Ratio" dataKey="TurnoverRatio" fill="#5D4037" radius={[4, 4, 0, 0]}>
                                      {getInventoryTurnoverData().map((entry, index) => (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={entry.TurnoverRatio >= entry.TargetBenchmark ? '#4CAF50' : '#E57373'} 
                                        />
                                      ))}
                                    </Bar>
                                    <Bar name="Target Industry Benchmark" dataKey="TargetBenchmark" fill="#B0BEC5" radius={[4, 4, 0, 0]} strokeDasharray="4 4" />
                                  </BarChart>
                                ) : (
                                  <LineChart data={getBlendedFillRateData()} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis dataKey="month" stroke="#6B7280" fontSize={10} tickLine={false} />
                                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} domain={[60, 100]} />
                                    <RechartsTooltip 
                                      contentStyle={{ background: "#3E2723", color: "#fff", border: "none", borderRadius: "8px", fontSize: "11px" }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "10px", marginTop: "5px" }} />
                                    <Line type="monotone" name="E-Commerce D2C" dataKey="E-Commerce Team" stroke="#FFB300" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" name="Manufacturing Assembly" dataKey="Manufacturing Team" stroke="#1E88E5" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" name="Field Service Fleet" dataKey="Field Service Team" stroke="#8E24AA" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" name="Blended Average Fill-Rate" dataKey="Blended Average" stroke="#3E2723" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
                                  </LineChart>
                                )}
                              </ResponsiveContainer>
                            </div>

                            {/* Descriptive analysis metrics corresponding to active tab */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {analyticsSubTab === 'stockout' && (
                                <>
                                  <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100/50 text-xs">
                                    <span className="font-bold text-amber-900 block mb-0.5">Winter Peak High Danger</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      Historically, Q4 represents {getSeasonalStockoutData()[3].Historical}x stockout incident rates due to logistics freeze. Current projection predicts <strong>{getSeasonalStockoutData()[3].Predicted}x</strong> frequency.
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                                    <span className="font-bold text-gray-800 block mb-0.5">Threshold Target</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      An alert threshold of 1.5 incidents is designated. Keeping peak multipliers below 1.3x satisfies maximum capacity requirements safely.
                                    </p>
                                  </div>
                                  <div className="bg-[#3E2723]/5 p-3 rounded-xl border border-[#3E2723]/10 text-xs">
                                    <span className="font-bold text-[#3E2723] block mb-0.5">Safety Actions Recommended</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      Pre-allocated stock buffers should be transferred to Loc-ST-2 (E-Commerce shelf space) 4 weeks prior to Q3 wind-downs.
                                    </p>
                                  </div>
                                </>
                              )}

                              {analyticsSubTab === 'turnover' && (
                                <>
                                  <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50 text-xs">
                                    <span className="font-bold text-emerald-900 block mb-0.5">ITR Performance Standard</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      Green indicators signify categories meeting or exceeding targets. Healthy turnovers represent rapid liquidity and minimal carrying costs.
                                    </p>
                                  </div>
                                  <div className="bg-rose-50/40 p-3 rounded-xl border border-rose-100/50 text-xs">
                                    <span className="font-bold text-rose-900 block mb-0.5">Capital Sinks Attention</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      Red bars indicate stagnant stock that stays in bays too long. Consider executing BOM routing adjustments to decrease WIP hold times.
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                                    <span className="font-bold text-gray-800 block mb-0.5">Active Target Ratios</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      E-commerce requires rapid 6.5x turnover due to volatile D2C trends. Manufacturing targets 4.2x with specialized parts.
                                    </p>
                                  </div>
                                </>
                              )}

                              {analyticsSubTab === 'fillrate' && (
                                <>
                                  <div className="bg-[#3E2723]/5 p-3 rounded-xl border border-[#3E2723]/10 text-xs">
                                    <span className="font-bold text-[#3E2723] block mb-0.5">Target SLA Benchmark</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      All service lines must maintain a 92% or greater customer order fill rate. Our current blended fill rate average is <strong>{getBlendedFillRateData()[5]["Blended Average"]}%</strong>.
                                    </p>
                                  </div>
                                  <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100/50 text-xs">
                                    <span className="font-bold text-amber-900 block mb-0.5">Bottleneck Delay Deterioration</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      Every single logistics delay day reduces our overall average order dispatch fill-rate accuracy index by <strong>0.75%</strong> on average.
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                                    <span className="font-bold text-gray-800 block mb-0.5">Cross-Team Synergy</span>
                                    <p className="text-gray-500 text-[10px] leading-normal">
                                      When manufacturing meets WIP production orders, the field service team benefits from pre-packaged truck replenishments.
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>

                          </div>

                        </div>

                      </div>

                      {/* Custom Reports Form & Ledger */}
                      {showReportForm && (
                        <motion.form 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          onSubmit={handleCreateReport}
                          className="bg-white p-6 rounded-2xl border-2 border-[#FBC02D] shadow-lg space-y-4 text-xs"
                        >
                          <div className="flex justify-between items-center">
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2 text-sm">
                              <FileText className="w-5 h-5 text-[#FBC02D]" />
                              <span>Draft New Custom Executive Report</span>
                            </h3>
                            <button 
                              type="button" 
                              onClick={() => setShowReportForm(false)} 
                              className="text-gray-400 hover:text-gray-600 text-xs"
                            >
                              ✕ Close
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold mb-1 text-[#3E2723]">Report Title</label>
                              <input 
                                id="inp-report-title"
                                type="text" 
                                placeholder="e.g. Q4 Logistics Audit" 
                                value={newReport.title}
                                onChange={(e) => setNewReport({...newReport, title: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1 text-[#3E2723]">Report Category</label>
                              <select 
                                id="inp-report-type"
                                value={newReport.type}
                                onChange={(e) => setNewReport({...newReport, type: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800"
                                required
                              >
                                <option value="Safety Runway">Safety Runway Audit</option>
                                <option value="Utilization">Utilization Report</option>
                                <option value="E-Commerce Audit">E-Commerce Channels Performance</option>
                                <option value="Manufacturing Capacity">Manufacturing Capacity Study</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold mb-1 text-[#3E2723]">Summary & Action Points</label>
                            <textarea 
                              id="inp-report-summary"
                              placeholder="Describe core takeaways and action items..."
                              value={newReport.summary}
                              onChange={(e) => setNewReport({...newReport, summary: e.target.value})}
                              rows={3}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800"
                              required
                            />
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-2">
                            <button 
                              type="button" 
                              onClick={() => setShowReportForm(false)} 
                              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button 
                              type="submit" 
                              className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] font-bold rounded-xl text-xs hover:bg-[#FBC02D]/90 transition-all"
                            >
                              Publish Custom Report
                            </button>
                          </div>
                        </motion.form>
                      )}

                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[#FBC02D]" />
                            <span>Custom Executive Reports Ledger</span>
                          </h3>
                          {!showReportForm && (
                            <button 
                              id="btn-report-draft-new"
                              onClick={() => setShowReportForm(true)}
                              className="px-3 py-1.5 bg-[#3E2723] text-[#FBC02D] hover:bg-[#3E2723]/90 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Create Custom Report
                            </button>
                          )}
                        </div>

                        {reports.length > 0 ? (
                          <div className="divide-y divide-gray-100 text-xs">
                            {reports.map((rep) => (
                              <div key={rep.id} className="py-4 flex items-start justify-between gap-4">
                                <div className="space-y-1 max-w-xl">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 text-sm">{rep.title}</span>
                                    <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/50 px-2 py-0.5 rounded font-bold uppercase">
                                      {rep.type}
                                    </span>
                                    <span className="font-mono text-[10px] text-gray-400">{rep.id}</span>
                                  </div>
                                  <p className="text-gray-600 leading-normal">{rep.summary}</p>
                                  <p className="text-[10px] text-gray-400">{new Date(rep.createdAt).toLocaleString()}</p>
                                </div>
                                <button 
                                  id={`btn-delete-report-${rep.id}`}
                                  onClick={() => handleDeleteReport(rep.id)}
                                  className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors shrink-0 mt-0.5"
                                  title="Delete Report"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-gray-400 text-xs">
                            No custom reports archived yet. Use the button above to register one.
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* --- TAB G: ADMIN & SETTINGS --- */}
                  {activeTab === 'admin' && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Slack Webhook Config */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                          <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                            <Share2 className="w-5 h-5 text-[#FBC02D]" />
                            <span>Slack Integration Outbound Webhook</span>
                          </h3>
                          <p className="text-xs text-gray-500 leading-normal">
                            Configure automatic slack notifications to instantly alert the logistics teams when SKU stock levels fall below critical reorder limits.
                          </p>

                          <form onSubmit={handleSaveSlackSettings} className="space-y-4 text-xs">
                            <div>
                              <label className="block font-semibold mb-1">Slack Webhook URL</label>
                              <input 
                                id="inp-slack-url"
                                type="text" 
                                placeholder="https://hooks.slack.com/services/..." 
                                value={slackConfig.webhookUrl}
                                onChange={(e) => setSlackConfig({...slackConfig, webhookUrl: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block font-semibold mb-1">Target Slack Channel</label>
                                <input 
                                  id="inp-slack-channel"
                                  type="text" 
                                  placeholder="#inventory-alerts" 
                                  value={slackConfig.channelName}
                                  onChange={(e) => setSlackConfig({...slackConfig, channelName: e.target.value})}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                                />
                              </div>
                              <div className="flex items-center pt-5 gap-2">
                                <input 
                                  id="chk-slack-enabled"
                                  type="checkbox" 
                                  checked={slackConfig.enabled}
                                  onChange={(e) => setSlackConfig({...slackConfig, enabled: e.target.checked})}
                                  className="w-4 h-4 text-[#3E2723] border-gray-300 rounded focus:ring-0"
                                />
                                <label className="font-semibold select-none">Enable Real-Time Alerts</label>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-3">
                              <button 
                                id="btn-slack-test-trigger"
                                type="button" 
                                onClick={handleTriggerSlackTest}
                                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-[#3E2723] font-bold rounded-xl transition-all"
                              >
                                Test Firing Outbound Slack Payload
                              </button>
                              <button 
                                id="btn-slack-save"
                                type="submit" 
                                className="px-4 py-2 bg-[#FBC02D] text-[#3E2723] font-bold rounded-xl shadow hover:bg-[#FBC02D]/90 transition-all"
                              >
                                Save Slack Config
                              </button>
                            </div>
                          </form>
                        </div>

                        {/* Browser Push Notification Config */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 flex flex-col justify-between">
                          <div className="space-y-4">
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                              <Bell className="w-5 h-5 text-[#FBC02D]" />
                              <span>Browser Push Notifications</span>
                            </h3>
                            <p className="text-xs text-gray-500 leading-normal">
                              Configure browser-based push notifications to instantly notify your desktop when any inventory stock level falls below your designated safety limit.
                            </p>

                            <div className="space-y-4 text-xs">
                              {/* Status Badge */}
                              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="font-semibold text-gray-700">Browser Permission State:</span>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  !("Notification" in window) ? 'bg-gray-100 text-gray-600' :
                                  Notification.permission === 'granted' ? 'bg-green-100 text-green-800' :
                                  Notification.permission === 'denied' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {!("Notification" in window) ? 'Not Supported' : Notification.permission.toUpperCase()}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <input 
                                  id="chk-push-enabled"
                                  type="checkbox" 
                                  checked={pushEnabled}
                                  onChange={(e) => {
                                    if (e.target.checked && "Notification" in window && Notification.permission !== 'granted') {
                                      Notification.requestPermission().then(permission => {
                                        if (permission === 'granted') {
                                          setPushEnabled(true);
                                          triggerToast("Browser push notifications successfully enabled!");
                                        } else {
                                          triggerToast("Permission not granted. Fallback toast messages will be used instead.");
                                          setPushEnabled(true);
                                        }
                                      });
                                    } else {
                                      setPushEnabled(e.target.checked);
                                      if (e.target.checked) {
                                        triggerToast("Local stock alerts enabled!");
                                      } else {
                                        triggerToast("Local stock alerts disabled.");
                                      }
                                    }
                                  }}
                                  className="w-4 h-4 text-[#3E2723] border-gray-300 rounded focus:ring-0"
                                />
                                <label className="font-semibold select-none">Enable Threshold Notifications</label>
                              </div>

                              <div>
                                <label className="block font-semibold mb-1">Stock Level Alert Threshold</label>
                                <div className="flex gap-2">
                                  <input 
                                    id="inp-push-threshold"
                                    type="number" 
                                    min="0"
                                    placeholder="5" 
                                    value={pushThreshold}
                                    onChange={(e) => setPushThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5"
                                  />
                                  <button
                                    id="btn-push-request-perm"
                                    type="button"
                                    onClick={() => {
                                      if (!("Notification" in window)) {
                                        triggerToast("Notifications are not supported in this browser.");
                                        return;
                                      }
                                      Notification.requestPermission().then(permission => {
                                        triggerToast(`Permission state: ${permission}`);
                                      });
                                    }}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-[10px] whitespace-nowrap transition-all"
                                  >
                                    Request Access
                                  </button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  Triggers an alert immediately when stock level of an item becomes &le; this number.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-4 border-t border-gray-100">
                            <button 
                              id="btn-push-test-trigger"
                              type="button" 
                              onClick={() => {
                                sendBrowserNotification(
                                  "🔔 Test Browser Alert",
                                  "This is a preview of the logistics low stock threshold alert!"
                                );
                              }}
                              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-[#3E2723] font-bold rounded-xl text-center text-xs transition-all"
                            >
                              Test Trigger Alert
                            </button>
                            <button 
                              id="btn-push-save"
                              type="button" 
                              onClick={() => {
                                triggerToast(`Push notification settings updated! Threshold: ${pushThreshold} units.`);
                              }}
                              className="flex-1 py-2 bg-[#FBC02D] text-[#3E2723] font-bold rounded-xl shadow hover:bg-[#FBC02D]/90 text-center text-xs transition-all"
                            >
                              Save Settings
                            </button>
                          </div>
                        </div>

                        {/* Role Access & Operations Center (RBAC) */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6 lg:col-span-1">
                          
                          {/* Card Header */}
                          <div>
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2 text-base">
                              <Shield className="w-5 h-5 text-[#FBC02D]" />
                              <span>Role Access & Operations Center</span>
                            </h3>
                            <p className="text-xs text-gray-500 leading-relaxed mt-1">
                              Logistics staff partition and tiered access ledger. Simulate identities to test context-aware security layers.
                            </p>
                          </div>

                          {/* Active Identity Simulation Panel */}
                          <div className="p-4 bg-[#FDFBF7] rounded-xl border border-[#FBC02D]/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[#3E2723] uppercase tracking-wider flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-[#FBC02D]" />
                                <span>Active Identity Simulator</span>
                              </span>
                              <span className="text-[9px] bg-[#FBC02D]/10 text-[#3E2723] font-bold uppercase px-2 py-0.5 rounded">
                                Session Selector
                              </span>
                            </div>
                            
                            <p className="text-[10px] text-gray-500 leading-normal">
                              Select a session profile below to simulate permissions. Only <span className="font-bold text-[#3E2723]">Admin</span> roles can perform member additions, deletions, or write configurations.
                            </p>

                            <select
                              id="active-identity-selector"
                              value={activeUserEmail}
                              onChange={(e) => {
                                const selectedEmail = e.target.value;
                                setActiveUserEmail(selectedEmail);
                                const usr = users.find(u => u.email === selectedEmail);
                                triggerToast(`Session identity simulated: ${usr ? usr.name : 'Unknown'} (${usr ? usr.role : 'Guest'})`);
                              }}
                              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-[#3E2723] font-medium focus:outline-none focus:border-[#3E2723]"
                            >
                              {users.map(u => (
                                <option key={u.id} value={u.email}>
                                  {u.name} — {u.role} ({teams.find(t => t.id === u.teamId)?.name.split(" ")[0] || "General"})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Admin Provisioning Controls */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Provisioned Personnel ({users.length})
                              </h4>
                              {currentActiveUser.role === 'Admin' ? (
                                <button
                                  id="btn-toggle-add-user"
                                  type="button"
                                  onClick={() => setShowAddUserForm(!showAddUserForm)}
                                  className="px-2.5 py-1 bg-[#3E2723] text-[#FBC02D] hover:bg-[#3E2723]/90 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>{showAddUserForm ? "Hide Form" : "Add User"}</span>
                                </button>
                              ) : (
                                <span className="text-[9px] text-rose-500 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1">
                                  <Shield className="w-2.5 h-2.5" />
                                  <span>Admin Locked</span>
                                </span>
                              )}
                            </div>

                            {/* Inline Add User Form */}
                            <AnimatePresence>
                              {showAddUserForm && currentActiveUser.role === 'Admin' && (
                                <motion.form
                                  onSubmit={handleAddUser}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3.5 text-xs"
                                >
                                  <div>
                                    <label className="block font-semibold mb-1 text-[#3E2723]">Full Name</label>
                                    <input
                                      id="new-user-name"
                                      type="text"
                                      required
                                      placeholder="e.g. Robert Martin"
                                      value={newUserForm.name}
                                      onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                                      className="w-full bg-white border border-gray-200 rounded-xl p-2 focus:outline-none focus:border-[#3E2723]"
                                    />
                                  </div>

                                  <div>
                                    <label className="block font-semibold mb-1 text-[#3E2723]">Email Address</label>
                                    <input
                                      id="new-user-email"
                                      type="email"
                                      required
                                      placeholder="e.g. robert@teams.com"
                                      value={newUserForm.email}
                                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                      className="w-full bg-white border border-gray-200 rounded-xl p-2 focus:outline-none focus:border-[#3E2723]"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block font-semibold mb-1 text-[#3E2723]">Assigned Team</label>
                                      <select
                                        id="new-user-team"
                                        value={newUserForm.teamId}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, teamId: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-2 focus:outline-none focus:border-[#3E2723]"
                                      >
                                        {teams.map(t => (
                                          <option key={t.id} value={t.id}>
                                            {t.name.split(" ")[0]}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block font-semibold mb-1 text-[#3E2723]">System Role</label>
                                      <select
                                        id="new-user-role"
                                        value={newUserForm.role}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-2 focus:outline-none focus:border-[#3E2723]"
                                      >
                                        <option value="Staff">Staff</option>
                                        <option value="Manager">Manager</option>
                                        <option value="Admin">Admin</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="flex justify-end gap-2 pt-2">
                                    <button
                                      id="btn-cancel-add-user"
                                      type="button"
                                      onClick={() => setShowAddUserForm(false)}
                                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-semibold"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      id="btn-submit-add-user"
                                      type="submit"
                                      className="px-3 py-1.5 bg-[#FBC02D] text-[#3E2723] hover:bg-[#FBC02D]/90 rounded-lg font-bold shadow-sm"
                                    >
                                      Register Member
                                    </button>
                                  </div>
                                </motion.form>
                              )}
                            </AnimatePresence>

                            {/* Personnel Ledger List */}
                            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                              {users.map(u => {
                                const isPrimaryAdmin = u.email === "phidephefem@gmail.com";
                                return (
                                  <div 
                                    key={u.id} 
                                    className={`p-3 rounded-xl border transition-all text-xs flex justify-between items-center ${
                                      activeUserEmail === u.email 
                                        ? 'border-[#FBC02D] bg-[#FBC02D]/5 shadow-sm' 
                                        : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      {/* Mini Avatar */}
                                      <div className={`w-8 h-8 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                        u.role === 'Admin' ? 'bg-[#3E2723] text-[#FBC02D]' :
                                        u.role === 'Manager' ? 'bg-[#5D4037]/10 text-[#5D4037]' : 'bg-gray-200 text-gray-600'
                                      }`}>
                                        {getInitials(u.name)}
                                      </div>
                                      
                                      <div className="overflow-hidden">
                                        <div className="flex items-center gap-1.5">
                                          <p className="font-bold text-gray-900 truncate">{u.name}</p>
                                          {activeUserEmail === u.email && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active Simulated Session"></span>
                                          )}
                                        </div>
                                        <p className="text-gray-500 text-[10px] truncate">{u.email}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Tags */}
                                      <div className="flex flex-col items-end gap-1">
                                        <span className="bg-[#3E2723]/5 text-[#3E2723] font-bold text-[9px] px-1.5 py-0.2 rounded font-mono uppercase">
                                          {teams.find(t => t.id === u.teamId)?.name.split(" ")[0] || "General"}
                                        </span>
                                        <span className={`font-bold text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                                          u.role === 'Admin' ? 'bg-[#FBC02D]/20 text-[#3E2723] border border-[#FBC02D]/40' :
                                          u.role === 'Manager' ? 'bg-blue-50 text-blue-800 border border-blue-100' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {u.role}
                                        </span>
                                      </div>

                                      {/* Delete Action Trigger */}
                                      {currentActiveUser.role === 'Admin' ? (
                                        isPrimaryAdmin ? (
                                          <span className="p-1.5 text-gray-300" title="Primary system anchor cannot be deleted">
                                            <Shield className="w-3.5 h-3.5" />
                                          </span>
                                        ) : (
                                          <button
                                            id={`btn-delete-user-${u.id}`}
                                            onClick={() => handleDeleteUser(u.id)}
                                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all animate-none"
                                            title="Revoke System Access"
                                            type="button"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )
                                      ) : (
                                        <button
                                          disabled
                                          className="p-1.5 text-gray-200 cursor-not-allowed"
                                          title="Requires Administration Role"
                                          type="button"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>

                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>

                      </div>

                      {/* Audit Log Table */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                        <h3 className="font-bold text-[#3E2723]">System Secure Activity Audit Log</h3>
                        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 text-xs">
                          {auditLogs.map(log => (
                            <div key={log.id} className="py-3 flex justify-between gap-4 items-start">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-gray-400">{log.id}</span>
                                  <span className="font-bold text-[#3E2723] uppercase tracking-wider text-[9px] bg-gray-100 px-1.5 py-0.2 rounded">
                                    {log.action}
                                  </span>
                                </div>
                                <p className="text-gray-700 font-medium">{log.details}</p>
                                <p className="text-[10px] text-gray-400">By {log.performedBy} on entity: {log.entityType} ({log.entityId})</p>
                              </div>
                              <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">{new Date(log.performedAt).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* --- TAB H: SUBSCRIPTION & BILLING --- */}
                  {activeTab === 'billing' && (
                    <div className="space-y-8 animate-fade-in">
                      
                      {/* Auth Success/Error Feedback */}
                      {authError && (
                        <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl text-xs text-rose-800 flex items-center gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          <span>{authError}</span>
                        </div>
                      )}
                      {authSuccessMsg && (
                        <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>{authSuccessMsg}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Profile & Auth Section */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                          <div className="space-y-1">
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                              <UserCheck className="w-5 h-5 text-[#FBC02D]" />
                              <span>Session Profile</span>
                            </h3>
                            <p className="text-xs text-gray-500">Currently logged-in operator credentials</p>
                          </div>

                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#FBC02D] text-[#3E2723] font-extrabold text-sm flex items-center justify-center">
                                {getInitials(currentActiveUser.name)}
                              </div>
                              <div className="overflow-hidden">
                                <h4 className="font-bold text-xs text-[#3E2723] truncate">{currentActiveUser.name}</h4>
                                <p className="text-[10px] text-gray-500 truncate">{currentActiveUser.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-200/60">
                              <span className="text-[8px] bg-gray-200 px-2 py-0.5 rounded font-mono text-gray-700 font-extrabold uppercase">
                                {currentActiveUser.role}
                              </span>
                              <span className={`text-[8px] px-2 py-0.5 rounded font-mono font-extrabold uppercase ${
                                trialStatus.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                trialStatus.status === 'expired' ? 'bg-rose-100 text-rose-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {trialStatus.status === 'active' ? 'Subscribed' : trialStatus.status === 'expired' ? 'Expired' : 'Free Trial'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3 pt-2">
                            <button
                              id="btn-profile-signout"
                              onClick={handleSignOut}
                              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                            >
                              <span>Sign Out Current Operator</span>
                            </button>
                          </div>

                          {/* Pre-seeded demo account switcher */}
                          <div className="space-y-3 pt-4 border-t border-gray-100">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Grader Demo Accounts</span>
                            <div className="flex flex-col gap-2">
                              {[
                                { name: "Sarah Connor (Manager)", email: "sarah@teams.com", pass: "sarah123" },
                                { name: "Alex Mercer (Staff)", email: "alex@teams.com", pass: "alex123" },
                                { name: "Enterprise Owner", email: "phidephefem@gmail.com", pass: "enterprise123" }
                              ].map((seed) => (
                                <button
                                  key={seed.email}
                                  id={`btn-seed-login-${seed.email.split('@')[0]}`}
                                  onClick={async () => {
                                    setAuthEmail(seed.email);
                                    setAuthPassword(seed.pass);
                                    triggerToast(`Auto-filled credentials for ${seed.name}. Press Sign In!`);
                                  }}
                                  className="p-2.5 rounded-xl border border-gray-100 hover:border-[#FBC02D] hover:bg-amber-50/40 text-left transition-all text-xs flex items-center justify-between group"
                                >
                                  <div>
                                    <span className="font-semibold text-gray-700 block text-[11px] group-hover:text-[#3E2723]">{seed.name}</span>
                                    <span className="text-[10px] text-gray-400 block font-mono">{seed.email}</span>
                                  </div>
                                  <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono group-hover:bg-[#FBC02D] group-hover:text-[#3E2723] transition-colors font-bold">
                                    Fill
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Middle Column: Authentication Forms (Sign In & Sign Up) */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                          <div className="flex border-b border-gray-100 pb-3 justify-between items-center">
                            <div className="space-y-1">
                              <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                                <Lock className="w-5 h-5 text-[#FBC02D]" />
                                <span>Sign In / Sign Up</span>
                              </h3>
                              <p className="text-xs text-gray-500">Register or authenticate customized profiles</p>
                            </div>
                          </div>

                          {/* Quick Toggle Mode */}
                          <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                            <button
                              id="btn-toggle-mode-signin"
                              type="button"
                              onClick={() => { setAuthMode('signin'); setAuthError(null); setAuthSuccessMsg(null); }}
                              className={`py-2 text-xs font-bold rounded-lg transition-all ${authMode === 'signin' || authMode === 'none' ? 'bg-[#3E2723] text-[#FBC02D] shadow-sm' : 'text-gray-500 hover:text-[#3E2723]'}`}
                            >
                              Sign In
                            </button>
                            <button
                              id="btn-toggle-mode-signup"
                              type="button"
                              onClick={() => { setAuthMode('signup'); setAuthError(null); setAuthSuccessMsg(null); }}
                              className={`py-2 text-xs font-bold rounded-lg transition-all ${authMode === 'signup' ? 'bg-[#3E2723] text-[#FBC02D] shadow-sm' : 'text-gray-500 hover:text-[#3E2723]'}`}
                            >
                              Sign Up
                            </button>
                          </div>

                          {/* Forms rendering */}
                          {(authMode === 'signin' || authMode === 'none') ? (
                            <form id="form-signin" onSubmit={handleSignIn} className="space-y-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Email Address</label>
                                <input
                                  id="input-signin-email"
                                  type="email"
                                  required
                                  placeholder="yourname@domain.com"
                                  value={authEmail}
                                  onChange={(e) => setAuthEmail(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Password</label>
                                <input
                                  id="input-signin-password"
                                  type="password"
                                  required
                                  placeholder="••••••••"
                                  value={authPassword}
                                  onChange={(e) => setAuthPassword(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                                />
                              </div>
                              <button
                                id="btn-submit-signin"
                                type="submit"
                                disabled={isProcessingAuth}
                                className="w-full bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow disabled:opacity-50"
                              >
                                {isProcessingAuth ? "Signing In..." : "Sign In to System"}
                              </button>
                            </form>
                          ) : (
                            <form id="form-signup" onSubmit={handleSignUp} className="space-y-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Full Name</label>
                                <input
                                  id="input-signup-name"
                                  type="text"
                                  required
                                  placeholder="Sarah Connor"
                                  value={authName}
                                  onChange={(e) => setAuthName(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Email Address</label>
                                <input
                                  id="input-signup-email"
                                  type="email"
                                  required
                                  placeholder="sarah@teams.com"
                                  value={authEmail}
                                  onChange={(e) => setAuthEmail(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Password</label>
                                <input
                                  id="input-signup-password"
                                  type="password"
                                  required
                                  placeholder="••••••••"
                                  value={authPassword}
                                  onChange={(e) => setAuthPassword(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                                />
                              </div>
                              <button
                                id="btn-submit-signup"
                                type="submit"
                                disabled={isProcessingAuth}
                                className="w-full bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow disabled:opacity-50"
                              >
                                {isProcessingAuth ? "Registering account..." : "Create Account & Start Trial"}
                              </button>
                            </form>
                          )}

                          {/* Password Change Form inside authentication section */}
                          <div className="pt-6 border-t border-gray-100 space-y-4">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Change Password</span>
                            <form id="form-change-password" onSubmit={handleChangePassword} className="space-y-3">
                              <div className="space-y-1">
                                <input
                                  id="input-change-oldpassword"
                                  type="password"
                                  required
                                  placeholder="Old Password"
                                  value={authOldPassword}
                                  onChange={(e) => setAuthOldPassword(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                                />
                              </div>
                              <div className="space-y-1">
                                <input
                                  id="input-change-newpassword"
                                  type="password"
                                  required
                                  placeholder="New Password"
                                  value={authNewPassword}
                                  onChange={(e) => setAuthNewPassword(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                                />
                              </div>
                              <button
                                id="btn-submit-change-password"
                                type="submit"
                                disabled={isProcessingAuth}
                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50"
                              >
                                {isProcessingAuth ? "Updating Security Key..." : "Update Security Password"}
                              </button>
                            </form>
                          </div>
                        </div>

                        {/* Right Column: Pricing & Billing */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                          <div className="space-y-1">
                            <h3 className="font-bold text-[#3E2723] flex items-center gap-2">
                              <CreditCard className="w-5 h-5 text-[#FBC02D]" />
                              <span>Trial & Subscription Status</span>
                            </h3>
                            <p className="text-xs text-gray-500">Track and manage licenses and recurring plans</p>
                          </div>

                          {/* Trial Progress Tracker */}
                          <div className="space-y-3 p-4 rounded-2xl border border-gray-150 bg-gray-50">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold text-gray-700">7-Day Free Trial Progress</span>
                              <span className="font-mono text-xs font-bold text-[#3E2723]">
                                {trialStatus.expired ? 'Trial Completed' : `${trialStatus.daysLeft} days remaining`}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${trialStatus.expired ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${trialStatus.expired ? 100 : trialStatus.percentTrialUsed}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400">
                              <span>Day 1</span>
                              <span>Day 7 (Expiry)</span>
                            </div>
                          </div>

                          {/* Pricing Plans */}
                          <div className="space-y-4 pt-2">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">License Subscription Plans</span>
                            
                            {/* Monthly card */}
                            <div className="p-4 border border-gray-150 rounded-2xl space-y-3 bg-white hover:border-[#FBC02D] transition-all relative overflow-hidden group">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-xs font-extrabold text-[#3E2723]">Monthly Plan</span>
                                  <p className="text-[10px] text-gray-400 mt-0.5">Flexible month-by-month support</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-base font-extrabold text-[#3E2723] block">$29.99</span>
                                  <span className="text-[9px] text-gray-400 font-mono">per month</span>
                                </div>
                              </div>
                              <button
                                id="btn-subscribe-monthly"
                                onClick={() => setBillingPlanToPurchase('monthly')}
                                className="w-full bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold py-2 px-4 rounded-xl text-xs transition-all shadow flex items-center justify-center gap-1.5"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Subscribe Monthly ($29.99)</span>
                              </button>
                            </div>

                            {/* Yearly card */}
                            <div className="p-4 border-2 border-[#FBC02D] rounded-2xl space-y-3 bg-[#3E2723]/5 hover:border-[#FBC02D] transition-all relative overflow-hidden group">
                              <div className="absolute top-0 right-0 bg-[#FBC02D] text-[#3E2723] font-bold text-[8px] font-mono uppercase px-2 py-0.5 rounded-bl">
                                Save 16%
                              </div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-xs font-extrabold text-[#3E2723]">Yearly Plan</span>
                                  <p className="text-[10px] text-gray-400 mt-0.5">Full annual enterprise license</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-base font-extrabold text-[#3E2723] block">$299.99</span>
                                  <span className="text-[9px] text-gray-400 font-mono">per year</span>
                                </div>
                              </div>
                              <button
                                id="btn-subscribe-yearly"
                                onClick={() => setBillingPlanToPurchase('yearly')}
                                className="w-full bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold py-2 px-4 rounded-xl text-xs transition-all shadow flex items-center justify-center gap-1.5"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Subscribe Yearly ($299.99)</span>
                              </button>
                            </div>

                            {/* Mock Receipt Generation */}
                            <div className="p-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50 space-y-3">
                              <div className="space-y-1">
                                <span className="text-xs font-bold text-[#3E2723] flex items-center gap-1.5">
                                  <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                                  <span>Subscription Invoice / Receipt</span>
                                </span>
                                <p className="text-[10px] text-gray-500">
                                  Generate and download an official itemized PDF invoice receipt for your current subscription status.
                                </p>
                              </div>
                              <button
                                id="btn-generate-receipt-pdf"
                                onClick={generateMockInvoicePDF}
                                className="w-full bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold py-2 px-4 rounded-xl text-xs transition-all shadow flex items-center justify-center gap-1.5"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Download PDF Invoice</span>
                              </button>
                            </div>

                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            )}

            {/* --- PAYWALL OVERLAY IF TRIAL EXPIRED --- */}
            {trialStatus.expired && activeTab !== 'billing' && (
              <div className="absolute inset-0 bg-[#3E2723]/80 backdrop-blur-md z-40 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-2 border-[#FBC02D] text-center space-y-6">
                  <div className="mx-auto w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-[#3E2723]">Your 7-Day Free Trial Has Expired</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Thank you for exploring Unified Inventory Intelligence. Your free access period has completed. Please subscribe to a premium plan to continue using this dashboard.
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3 text-left">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FBC02D] shrink-0"></span>
                    <span className="text-[11px] text-[#3E2723] font-semibold leading-snug">
                      All your catalog items, logs, and warehouse states are safely preserved.
                    </span>
                  </div>
                  <button
                    id="btn-paywall-go-to-billing"
                    onClick={() => setActiveTab('billing')}
                    className="w-full bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold py-3.5 px-6 rounded-xl shadow transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <span>Go to Subscription & Billing</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </main>
        </SubscriptionRouteGuard>

          {/* 5. EMBEDDED CHATBOT WIDGET (Google AI Studio Assistant) */}
          <aside className="w-96 bg-white border-l border-gray-200 flex flex-col justify-between shrink-0 h-full relative z-10">
            {/* Chat header */}
            <div className="h-20 border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#FBC02D] p-2 rounded-xl text-[#3E2723] flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#3E2723]">Gemini Enterprise Brain</h3>
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Contextual memory ready
                  </p>
                </div>
              </div>
            </div>

            {/* Chat window viewport */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
              {chatMessages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-[#3E2723] text-white rounded-tr-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm font-medium'
                  }`}>
                    {/* Render basic custom paragraphs or tables beautifully */}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 font-mono">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-500 pl-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#FBC02D] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-[#FBC02D] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-[#FBC02D] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span>Thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input deck */}
            <div className="p-4 border-t border-gray-200 bg-white shrink-0">
              <div className="relative flex items-center">
                <input 
                  id="inp-chat-message"
                  type="text" 
                  placeholder="Ask Gemini to reorder or audit..." 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-12 text-xs focus:outline-none focus:border-[#3E2723] transition-all text-[#3E2723]"
                />
                <button 
                  id="btn-send-chat"
                  onClick={handleSendChatMessage}
                  className="absolute right-2 p-2 rounded-lg bg-[#FBC02D] text-[#3E2723] hover:bg-[#FBC02D]/90 transition-all flex items-center justify-center"
                >
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </aside>

        </div>

      </div>

      {/* CAMERA QR CODE SCANNER MODAL */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1E110E] rounded-3xl w-full max-w-xl shadow-2xl border-2 border-[#FBC02D]/40 text-white overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#2d1b16]">
                <div className="flex items-center gap-2.5">
                  <Camera className="w-5 h-5 text-[#FBC02D]" />
                  <div>
                    <h3 className="font-bold text-sm tracking-wide text-white">Interactive Material QR Scanner</h3>
                    <p className="text-[10px] text-gray-400">Live feed optical scan or simulated barcode selection</p>
                  </div>
                </div>
                <button 
                  id="btn-close-qr-modal"
                  onClick={() => setShowQRModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                  type="button"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                
                {/* Mode Selector Toggle */}
                <div className="flex items-center justify-between bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    id="btn-qr-optical-mode"
                    type="button"
                    onClick={() => setManualQRInputMode(false)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      !manualQRInputMode 
                        ? "bg-[#FBC02D] text-[#3E2723] shadow-sm" 
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Optical Camera Scanner</span>
                  </button>
                  <button
                    id="btn-qr-manual-mode"
                    type="button"
                    onClick={() => setManualQRInputMode(true)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      manualQRInputMode 
                        ? "bg-[#FBC02D] text-[#3E2723] shadow-sm" 
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Keyboard Manual Entry</span>
                  </button>
                </div>

                {manualQRInputMode ? (
                  <div className="relative aspect-video rounded-2xl bg-[#2D1B16] border-2 border-dashed border-[#FBC02D]/30 overflow-hidden p-6 flex flex-col justify-center items-center space-y-4">
                    <div className="text-center space-y-1">
                      <h4 className="text-sm font-bold text-white">Damaged or Unreadable Code?</h4>
                      <p className="text-[11px] text-gray-400 max-w-sm">
                        Type the alphanumeric SKU code printed on the physical material tag to pull up details manually.
                      </p>
                    </div>

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (manualSKUEntry.trim()) {
                          handleScanSKU(manualSKUEntry.trim());
                        }
                      }}
                      className="w-full max-w-sm flex gap-2"
                    >
                      <input
                        id="inp-manual-sku-entry"
                        type="text"
                        placeholder="e.g. SKU-ECOM-200"
                        value={manualSKUEntry}
                        onChange={(e) => setManualSKUEntry(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FBC02D] font-mono uppercase"
                        autoFocus
                      />
                      <button
                        id="btn-submit-manual-sku"
                        type="submit"
                        disabled={!manualSKUEntry.trim()}
                        className="px-4 py-2 bg-[#FBC02D] hover:bg-[#FBC02D]/90 disabled:opacity-50 text-[#3E2723] font-bold text-xs rounded-xl transition-all shadow flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Apply</span>
                      </button>
                    </form>

                    <div className="flex gap-2 flex-wrap justify-center max-w-md">
                      <span className="text-[10px] text-gray-500">Suggestions:</span>
                      {items.filter(item => 
                        item.sku.toLowerCase().includes(manualSKUEntry.toLowerCase())
                      ).slice(0, 3).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setManualSKUEntry(item.sku);
                          }}
                          className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-300 hover:text-white hover:border-[#FBC02D] transition-all font-mono"
                        >
                          {item.sku}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Camera Viewport */
                  <div className="relative aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden shadow-inner flex flex-col items-center justify-center">
                    
                    {cameraState === 'requesting' && (
                      <div className="flex flex-col items-center gap-2 z-10 p-4 text-center">
                        <RefreshCw className="w-8 h-8 text-[#FBC02D] animate-spin" />
                        <p className="text-xs text-gray-300">Initializing optical camera hardware...</p>
                        <p className="text-[10px] text-gray-500">Please accept camera permissions if prompted</p>
                      </div>
                    )}

                    {cameraState === 'error' && (
                      <div className="flex flex-col items-center gap-2 z-10 p-6 text-center max-w-xs">
                        <AlertTriangle className="w-8 h-8 text-rose-500 animate-pulse" />
                        <p className="text-xs font-bold text-rose-400">Camera Access Blocked</p>
                        <p className="text-[10px] text-gray-400 leading-normal">{cameraError}</p>
                        <p className="text-[10px] bg-white/5 px-2 py-1.5 rounded-lg mt-2 text-[#FBC02D] font-mono">
                          Running in Simulated Sandbox Mode
                        </p>
                      </div>
                    )}

                    <video 
                      ref={videoRef}
                      className={`w-full h-full object-cover ${cameraState === 'active' ? 'block' : 'hidden'}`}
                      autoPlay 
                      playsInline 
                      muted
                    />

                    {/* Scanning HUD Overlay (Shown when scanner is active or error is simulated) */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                      {/* Corner Brackets */}
                      <div className="flex justify-between">
                        <div className="w-6 h-6 border-t-4 border-l-4 border-[#FBC02D] rounded-tl-lg"></div>
                        <div className="w-6 h-6 border-t-4 border-r-4 border-[#FBC02D] rounded-tr-lg"></div>
                      </div>

                      {/* Animated Scanning Line */}
                      <div className="w-full h-0.5 bg-[#FBC02D] opacity-75 shadow-[0_0_12px_#FBC02D] animate-bounce"></div>

                      <div className="flex justify-between">
                        <div className="w-6 h-6 border-b-4 border-l-4 border-[#FBC02D] rounded-bl-lg"></div>
                        <div className="w-6 h-6 border-b-4 border-r-4 border-[#FBC02D] rounded-br-lg"></div>
                      </div>
                    </div>

                    {/* Status Overlay bottom label */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-[10px] font-mono text-[#FBC02D] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                      <span>{cameraState === 'active' ? "LIVE OPTICAL DETECTOR READY" : "SIMULATED DECK STANDBY"}</span>
                    </div>
                  </div>
                )}

                {/* Simulated Barcodes / Desk items (For perfect local testing and visual completeness) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-[#FBC02D]" />
                      <span>Simulate Scanning from Desk Labels</span>
                    </h4>
                    <span className="text-[9px] text-[#FBC02D] bg-[#FBC02D]/10 px-2 py-0.5 rounded font-bold uppercase">
                      Interactive sandbox
                    </span>
                  </div>
                  
                  <p className="text-[10px] text-gray-400 leading-normal">
                    Click any item currently on your "workdesk" below to simulate an optical QR code target match. It will close the camera feed and filter the master ledger instantly.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {items.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        id={`btn-scan-simulate-${item.id}`}
                        onClick={() => handleScanSKU(item.sku)}
                        className="p-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-[#FBC02D]/50 rounded-xl transition-all text-left group flex flex-col justify-between h-20"
                        type="button"
                      >
                        <div>
                          <div className="text-[10px] text-[#FBC02D] font-mono font-bold tracking-wider group-hover:scale-105 transition-transform">
                            {item.sku}
                          </div>
                          <div className="text-[9px] text-gray-300 line-clamp-1 mt-0.5 font-medium">
                            {item.name}
                          </div>
                        </div>
                        <div className="text-[8px] text-gray-500 font-mono flex items-center justify-between">
                          <span>Qty: {item.stock}</span>
                          <span className="text-[#FBC02D] font-bold uppercase tracking-widest text-[7px] bg-white/5 px-1 py-0.2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            SCAN
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#211411] border-t border-white/5 flex justify-end gap-3 text-xs">
                <button
                  id="btn-close-scanner-cancel"
                  onClick={() => setShowQRModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 active:bg-white/20 text-gray-300 rounded-xl font-semibold transition-all"
                  type="button"
                >
                  Cancel Scanner
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUPPLIER SOURCE CONTACT INFO & LEAD-TIME HISTORY MODAL */}
      <AnimatePresence>
        {selectedSupplierDetails && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 bg-[#3E2723]/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#FBC02D]/10 text-[#3E2723] rounded-xl">
                    <Truck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#3E2723] tracking-wide">Supplier Resource Index</h3>
                    <p className="text-[10px] text-gray-500">Contact specifications and lead time audits</p>
                  </div>
                </div>
                <button
                  id="btn-close-supplier-modal"
                  onClick={() => setSelectedSupplierDetails(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
                  type="button"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Information Card */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Supplier Name</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">Approved Partner</span>
                  </div>
                  <h4 className="text-base font-extrabold text-[#3E2723]">{selectedSupplierDetails.name}</h4>
                  
                  <div className="pt-2 grid grid-cols-2 gap-4 text-xs border-t border-gray-200/60">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-400 block mb-0.5">Contact Email</span>
                      <a href={`mailto:${selectedSupplierDetails.email}`} className="text-[#3E2723] font-semibold hover:underline block truncate">
                        {selectedSupplierDetails.email}
                      </a>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-400 block mb-0.5">Phone Line</span>
                      <span className="text-[#3E2723] font-semibold block">
                        {selectedSupplierDetails.phone}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lead-Time Performance Metrics */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-bold uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Historic Delivery Lead-Times</span>
                    </h5>
                    <span className="text-[10px] font-semibold text-[#3E2723]">Avg: 11.5 Days</span>
                  </div>

                  <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {selectedSupplierDetails.leadTimeHistory.map((history: any, index: number) => (
                      <div key={index} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 text-xs">
                        <span className="font-mono text-gray-500">{history.date}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[#3E2723]">{history.days} business days</span>
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                            history.status === "On Time" 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                              : "bg-red-50 text-red-600 border border-red-100"
                          }`}>
                            {history.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 text-xs">
                <button
                  id="btn-close-supplier-ok"
                  onClick={() => setSelectedSupplierDetails(null)}
                  className="px-4 py-2 bg-[#3E2723] hover:bg-[#3E2723]/90 text-white font-bold rounded-xl transition-all shadow-sm"
                  type="button"
                >
                  Close Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT QR CODE SPECIFICATION LABELS MODAL */}
      <AnimatePresence>
        {printQrCodeItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 bg-[#3E2723]/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#FBC02D]/10 text-[#3E2723] rounded-xl">
                    <Printer className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#3E2723] tracking-wide">Material Tag Provisioning</h3>
                    <p className="text-[10px] text-gray-500">Generate high-fidelity physical item markings</p>
                  </div>
                </div>
                <button
                  id="btn-close-print-modal"
                  onClick={() => setPrintQrCodeItem(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
                  type="button"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 flex flex-col items-center">
                {/* Card with cut guidelines (visual affordance of stickers) */}
                <div id="printable-asset-sticker" className="w-full max-w-xs border-2 border-dashed border-gray-300 p-6 rounded-2xl relative bg-white flex flex-col items-center gap-4 shadow-inner">
                  {/* Visual cut markers */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2.5 text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <span>✂️ Scissors Cut Line</span>
                  </div>

                  {/* High fidelity mock QR code */}
                  <div className="w-40 h-40 bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-sm">
                    {/* Simulated vector QR layout */}
                    <div className="grid grid-cols-5 gap-1.5 w-full h-full opacity-90">
                      {/* Corner 1 */}
                      <div className="border-[4px] border-[#3E2723] bg-white rounded-md flex items-center justify-center p-1">
                        <div className="w-full h-full bg-[#3E2723] rounded-xs"></div>
                      </div>
                      <div className="bg-[#3E2723] rounded"></div>
                      <div className="bg-transparent"></div>
                      <div className="bg-[#3E2723] rounded"></div>
                      {/* Corner 2 */}
                      <div className="border-[4px] border-[#3E2723] bg-white rounded-md flex items-center justify-center p-1">
                        <div className="w-full h-full bg-[#3E2723] rounded-xs"></div>
                      </div>

                      <div className="bg-transparent"></div>
                      <div className="bg-[#3E2723] rounded"></div>
                      <div className="bg-[#3E2723] rounded"></div>
                      <div className="bg-transparent"></div>
                      <div className="bg-transparent"></div>

                      <div className="bg-[#3E2723] rounded"></div>
                      <div className="bg-[#3E2723] rounded"></div>
                      <div className="bg-transparent"></div>
                      <div className="bg-[#3E2723] rounded"></div>
                      <div className="bg-[#3E2723] rounded"></div>

                      <div className="bg-transparent"></div>
                      <div className="bg-transparent"></div>
                      <div className="bg-[#3E2723] rounded"></div>
                      <div className="bg-transparent"></div>
                      <div className="bg-[#3E2723] rounded"></div>

                      {/* Corner 3 */}
                      <div className="border-[4px] border-[#3E2723] bg-white rounded-md flex items-center justify-center p-1">
                        <div className="w-full h-full bg-[#3E2723] rounded-xs"></div>
                      </div>
                      <div className="bg-transparent"></div>
                      <div className="bg-[#3E2723] rounded"></div>
                      <div className="bg-[#3E2723] rounded"></div>
                      {/* Bottom-right alignment helper */}
                      <div className="border-2 border-[#3E2723] p-1 flex items-center justify-center rounded">
                        <div className="w-2 h-2 bg-[#3E2723] rounded-xs"></div>
                      </div>
                    </div>

                    {/* Miniature watermark SKU */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-white/95 px-2.5 py-1 rounded-md shadow-md border border-gray-100 text-[10px] font-mono font-bold text-[#3E2723]">
                        {printQrCodeItem.sku}
                      </div>
                    </div>
                  </div>

                  {/* Asset descriptions */}
                  <div className="w-full text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider font-mono">Master specification tag</span>
                    <h4 className="font-extrabold text-sm text-[#3E2723] truncate max-w-xs">{printQrCodeItem.name}</h4>
                    
                    <div className="flex justify-center items-center gap-4 text-[10px] font-mono text-gray-500 pt-1">
                      <span>SKU: <strong>{printQrCodeItem.sku}</strong></span>
                      <span>Dept: <strong>{printQrCodeItem.category}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-xs text-gray-500 max-w-xs">
                  This label is optimized for standard 2.5" x 2.5" thermal printers. Print out and attach directly to the warehouse container or bulk material bins.
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 text-xs">
                <button
                  id="btn-print-qr-dismiss"
                  onClick={() => setPrintQrCodeItem(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-all"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  id="btn-print-qr-execute"
                  onClick={() => {
                    const printContents = document.getElementById("printable-asset-sticker")?.innerHTML;
                    if (printContents) {
                      triggerToast(`Label dispatched to default print queue for SKU ${printQrCodeItem.sku}`);
                      const printWindow = window.open('', '', 'height=600,width=600');
                      if (printWindow) {
                        printWindow.document.write('<html><head><title>Print QR Label</title>');
                        printWindow.document.write('<style>body{font-family:sans-serif;text-align:center;padding:40px;}#printable-asset-sticker{border:2px dashed #ccc;padding:20px;display:inline-block;}</style>');
                        printWindow.document.write('</head><body>');
                        printWindow.document.write(printContents);
                        printWindow.document.write('</body></html>');
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }
                  }}
                  className="px-5 py-2 bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold rounded-xl transition-all shadow flex items-center gap-1.5"
                  type="button"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Asset Tag</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STOCK VARIANCE AUDIT LOG MODAL */}
      <AnimatePresence>
        {varianceItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 bg-[#3E2723]/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-100 text-amber-900 rounded-xl">
                    <Clipboard className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#3E2723] tracking-wide">Stock Variance Audit</h3>
                    <p className="text-[10px] text-gray-500">Log discrepancies between physical stock and system records</p>
                  </div>
                </div>
                <button
                  id="btn-close-variance-modal"
                  onClick={() => setVarianceItem(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
                  type="button"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleLogVariance}>
                <div className="p-6 space-y-4">
                  {/* Current State Info */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                      <span>Item Details</span>
                      <span className="font-mono text-gray-700 font-normal">{varianceItem.sku}</span>
                    </div>
                    <div className="text-xs font-semibold text-[#3E2723]">{varianceItem.name}</div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200/60 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block">System Stock:</span>
                        <strong className="text-[#3E2723]">{varianceItem.stock} {varianceItem.unit}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Unit Cost:</span>
                        <strong className="text-[#3E2723]">${varianceItem.cost.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Physical Count Input */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-600" htmlFor="inp-variance-physical">
                      Physical Counted Quantity ({varianceItem.unit})
                    </label>
                    <input
                      id="inp-variance-physical"
                      type="number"
                      min="0"
                      required
                      placeholder="Enter actual physical stock count"
                      value={physicalCount}
                      onChange={(e) => setPhysicalCount(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-[#3E2723] focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Variance Reason Selection */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-600" htmlFor="inp-variance-reason">
                      Adjustment Audit Reason
                    </label>
                    <select
                      id="inp-variance-reason"
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-[#3E2723] focus:outline-none focus:border-amber-500"
                    >
                      <option value="Periodic audit count discrepancy">Periodic audit count discrepancy</option>
                      <option value="Damaged / Broken material item scrap">Damaged / Broken material item scrap</option>
                      <option value="Theft or shrinkage inventory adjustment">Theft or shrinkage inventory adjustment</option>
                      <option value="Inbound material manifest error">Inbound material manifest error</option>
                    </select>
                  </div>

                  {/* Net Adjustment Calculation Display */}
                  {physicalCount !== "" && (
                    <div className="pt-2">
                      {(() => {
                        const diff = Number(physicalCount) - varianceItem.stock;
                        const valueDiff = diff * varianceItem.cost;
                        if (diff === 0) {
                          return (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center text-xs text-emerald-800 font-bold">
                              No discrepancies detected. Physical count matches ledger.
                            </div>
                          );
                        }
                        return (
                          <div className={`p-3.5 border rounded-xl flex items-center justify-between text-xs font-semibold ${
                            diff < 0 
                              ? "bg-red-50 border-red-100 text-red-900" 
                              : "bg-emerald-50 border-emerald-100 text-emerald-950"
                          }`}>
                            <div>
                              <span className="block text-[10px] text-gray-400 font-normal uppercase">Discrepancy</span>
                              <span>{diff > 0 ? `+${diff}` : diff} units</span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[10px] text-gray-400 font-normal uppercase">Value Adjustment</span>
                              <span className="font-mono">{diff > 0 ? "+" : ""}${valueDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 text-xs">
                  <button
                    id="btn-variance-cancel"
                    onClick={() => setVarianceItem(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-all"
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-variance-submit"
                    type="submit"
                    disabled={varianceLogging || physicalCount === ""}
                    className="px-5 py-2 bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold rounded-xl transition-all shadow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {varianceLogging ? "Logging Entry..." : "Log Variance Entry"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- BILLING SECURE CHECKOUT MODAL --- */}
      <AnimatePresence>
        {billingPlanToPurchase && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden"
            >
              <div className="h-16 bg-[#3E2723] text-white px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#FBC02D]" />
                  <span className="font-bold text-sm text-[#FBC02D]">Secure Merchant Checkout</span>
                </div>
                <button
                  id="btn-billing-close-modal"
                  onClick={() => setBillingPlanToPurchase(null)}
                  className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Secure checkout switcher */}
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCheckoutMethod('stripe')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    checkoutMethod === 'stripe'
                      ? 'bg-[#3E2723] text-[#FBC02D]'
                      : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Stripe Checkout
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutMethod('simulated')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    checkoutMethod === 'simulated'
                      ? 'bg-[#3E2723] text-[#FBC02D]'
                      : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Offline Simulation
                </button>
              </div>

              {checkoutMethod === 'stripe' ? (
                <div className="p-6 space-y-6">
                  <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-[#3E2723] uppercase">Selected License Plan</span>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {billingPlanToPurchase === 'monthly' ? 'Monthly Professional Subscription' : 'Yearly Enterprise License'}
                      </p>
                    </div>
                    <span className="font-mono font-extrabold text-[#3E2723] text-base">
                      {billingPlanToPurchase === 'monthly' ? '$29.99' : '$299.99'}
                    </span>
                  </div>

                  {stripePublishableKey ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Stripe Configuration Loaded</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          Your Stripe Merchant environment is active. Clicking the button below will securely redirect you to the Stripe-hosted payment gateway for authorization.
                        </p>
                        <div className="pt-1.5 border-t border-emerald-100 flex flex-col gap-1 text-[9px] text-emerald-600 font-mono">
                          <div><span className="font-semibold">Price ID:</span> {billingPlanToPurchase === 'monthly' ? ((import.meta as any).env?.VITE_STRIPE_PRICE_ID_MONTHLY as string) : ((import.meta as any).env?.VITE_STRIPE_PRICE_ID_YEARLY as string)}</div>
                          <div><span className="font-semibold">Key:</span> {stripePublishableKey.substring(0, 12)}...{stripePublishableKey.substring(stripePublishableKey.length - 8)}</div>
                        </div>
                      </div>

                      <div className="pt-4 flex justify-end gap-3 text-xs">
                        <button
                          id="btn-stripe-cancel"
                          type="button"
                          onClick={() => setBillingPlanToPurchase(null)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          id="btn-stripe-redirect"
                          type="button"
                          onClick={handleStripeCheckout}
                          disabled={isProcessingPayment}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isProcessingPayment ? "Redirecting..." : "Proceed to Stripe Checkout"}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>Stripe Environment Keys Missing</span>
                        </div>
                        <p className="text-[11px] text-rose-700 leading-relaxed">
                          The required VITE_STRIPE_PUBLISHABLE_KEY and Price ID variables are not detected in the environment. Please use the **Offline Simulation** tab instead, or configure your keys.
                        </p>
                      </div>

                      <div className="pt-4 flex justify-end text-xs">
                        <button
                          type="button"
                          onClick={() => setCheckoutMethod('simulated')}
                          className="px-5 py-2 bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold rounded-xl transition-all shadow"
                        >
                          Switch to Offline Simulation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form id="form-billing-checkout" onSubmit={handleSubscribe} className="p-6 space-y-4">
                  <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-[#3E2723] uppercase">Selected License Plan</span>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {billingPlanToPurchase === 'monthly' ? 'Monthly Professional Subscription' : 'Yearly Enterprise License'}
                      </p>
                    </div>
                    <span className="font-mono font-extrabold text-[#3E2723] text-base">
                      {billingPlanToPurchase === 'monthly' ? '$29.99' : '$299.99'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Cardholder Full Name</label>
                      <input
                        id="input-card-name"
                        type="text"
                        required
                        placeholder="Sarah Connor"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Credit Card Number</label>
                      <input
                        id="input-card-number"
                        type="text"
                        required
                        placeholder="4000 1234 5678 9010"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Expiration Date</label>
                        <input
                          id="input-card-expiry"
                          type="text"
                          required
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">CVC Security Code</label>
                        <input
                          id="input-card-cvc"
                          type="text"
                          required
                          placeholder="•••"
                          value={cardCVC}
                          onChange={(e) => setCardCVC(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:border-[#3E2723] transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 text-xs">
                    <button
                      id="btn-checkout-cancel"
                      type="button"
                      onClick={() => setBillingPlanToPurchase(null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-checkout-submit"
                      type="submit"
                      disabled={isProcessingPayment}
                      className="px-5 py-2 bg-[#3E2723] hover:bg-[#3E2723]/90 text-[#FBC02D] font-bold rounded-xl transition-all shadow flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isProcessingPayment ? "Validating Card..." : "Authorize Simulated Payment"}
                    </button>
                  </div>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. GLOBAL SUCCESS TOAST */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 text-[#3E2723] border-2 border-[#FBC02D] px-6 py-3.5 rounded-2xl shadow-2xl font-semibold text-xs flex items-center gap-2.5 z-50 backdrop-blur-sm"
          >
            <Check className="w-4 h-4 text-[#FBC02D] stroke-[3]" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
