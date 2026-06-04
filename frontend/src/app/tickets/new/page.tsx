"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, CircleCheckBig, CircleX, BadgeCheck, KeyRound, ArrowLeftRight, CreditCard, Landmark, MonitorSmartphone, ClipboardPen, MessagesSquare, Search } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "ACCOUNT_VERIFICATION", label: "Account Verification", icon: BadgeCheck,         description: "Verify your identity and account details" },
  { value: "PIN_RESET",            label: "PIN Reset",            icon: KeyRound,            description: "Reset your PIN or credentials securely" },
  { value: "TRANSACTION_ISSUE",    label: "Transaction Issue",    icon: ArrowLeftRight,      description: "Failed, duplicate or unauthorized transactions" },
  { value: "CARD_SERVICES",        label: "Card Services",        icon: CreditCard,          description: "Lost card, activation, limits, disputes" },
  { value: "LOAN_CREDIT",          label: "Loan & Credit",        icon: Landmark,            description: "Loan enquiries and credit issues" },
  { value: "DIGITAL_BANKING",      label: "Digital Banking",      icon: MonitorSmartphone,   description: "Mobile app and internet banking issues" },
  { value: "INFO_UPDATE",          label: "Information Update",   icon: ClipboardPen,        description: "Update your personal information on file" },
  { value: "COMPLAINT_FEEDBACK",   label: "Complaint / Feedback", icon: MessagesSquare,      description: "Share feedback or raise a complaint" },
];

// ─── Per-category field definitions ──────────────────────────────────────────

type FieldDef = {
  name: string;
  label: string;
  type: "text" | "select" | "date" | "textarea" | "tel" | "email" | "number";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  showWhen?: { field: string; value: string };
};

const CATEGORY_FIELDS: Record<string, FieldDef[]> = {
  ACCOUNT_VERIFICATION: [
    { name: "accountNumber",   label: "Account number",         type: "text",  placeholder: "10-digit account number", required: true },
    { name: "accountName",     label: "Account name",           type: "text",  placeholder: "Full name on account",    required: true },
    { name: "verificationType",label: "What do you need to verify?", type: "select", required: true, options: [
      { value: "identity",     label: "Identity verification" },
      { value: "phone_update", label: "Phone number update" },
      { value: "email_update", label: "Email address update" },
      { value: "full_kyc",     label: "Full KYC re-verification" },
    ]},
    { name: "oldPhone",        label: "Current registered phone",type: "tel",  placeholder: "+234...", required: true },
    { name: "newPhone",        label: "New phone number",        type: "tel",  placeholder: "+234...", showWhen: { field: "verificationType", value: "phone_update" } },
    { name: "oldEmail",        label: "Current registered email",type: "email",placeholder: "your@email.com", required: true },
    { name: "newEmail",        label: "New email address",       type: "email",placeholder: "new@email.com",  showWhen: { field: "verificationType", value: "email_update" } },
    { name: "notes",           label: "Additional notes",        type: "textarea", placeholder: "Any other details..." },
  ],

  PIN_RESET: [
    { name: "accountNumber",   label: "Account number",          type: "text",   placeholder: "10-digit account number", required: true },
    { name: "registeredPhone", label: "Registered phone number", type: "tel",    placeholder: "+234...", required: true },
    { name: "resetReason",     label: "Reason for reset",        type: "select", required: true, options: [
      { value: "forgot_pin",   label: "Forgot PIN" },
      { value: "pin_blocked",  label: "PIN blocked after failed attempts" },
      { value: "suspicious",   label: "Suspicious activity — PIN may be compromised" },
      { value: "new_card",     label: "New card issued" },
    ]},
    { name: "preferredContact",label: "Preferred OTP channel",   type: "select", required: true, options: [
      { value: "sms",   label: "SMS to registered phone" },
      { value: "email", label: "Email to registered address" },
    ]},
    { name: "notes",           label: "Additional notes",        type: "textarea", placeholder: "Any other context..." },
  ],

  TRANSACTION_ISSUE: [
    { name: "transactionType", label: "Issue type", type: "select", required: true, options: [
      { value: "failed_transfer",       label: "Failed transfer — money left my account but did not arrive" },
      { value: "duplicate_debit",       label: "Duplicate debit — charged twice for same transaction" },
      { value: "unauthorized",          label: "Unauthorized transaction — I did not approve this" },
      { value: "reversal_request",      label: "Reversal request — I want a refund" },
    ]},
    { name: "transactionDate",   label: "Transaction date",        type: "date",   required: true },
    { name: "transactionAmount", label: "Transaction amount (₦)",  type: "number", placeholder: "e.g. 50000", required: true },
    { name: "referenceNumber",   label: "Transaction reference / session ID", type: "text", placeholder: "e.g. FT26040012345" },
    { name: "beneficiaryName",   label: "Beneficiary name",        type: "text",   placeholder: "Name of recipient", showWhen: { field: "transactionType", value: "failed_transfer" } },
    { name: "beneficiaryBank",   label: "Beneficiary bank",        type: "text",   placeholder: "e.g. Zenith Bank",  showWhen: { field: "transactionType", value: "failed_transfer" } },
    { name: "merchantName",      label: "Merchant / vendor name",  type: "text",   placeholder: "Where was this charged?", showWhen: { field: "transactionType", value: "unauthorized" } },
    { name: "description",       label: "Describe what happened",  type: "textarea", placeholder: "Provide full details of what occurred...", required: true },
  ],

  CARD_SERVICES: [
    { name: "issueType", label: "Issue type", type: "select", required: true, options: [
      { value: "lost_stolen",     label: "Lost or stolen card" },
      { value: "activation",      label: "Card activation" },
      { value: "deactivation",    label: "Deactivate / block card" },
      { value: "limit_increase",  label: "Increase spending limit" },
      { value: "limit_decrease",  label: "Decrease spending limit" },
      { value: "dispute",         label: "Dispute a card transaction" },
    ]},
    { name: "cardLastFour",  label: "Last 4 digits of card",   type: "text",   placeholder: "e.g. 4523", required: true },
    { name: "cardType",      label: "Card type",               type: "select", required: true, options: [
      { value: "debit",   label: "Debit card" },
      { value: "credit",  label: "Credit card" },
      { value: "prepaid", label: "Prepaid card" },
    ]},
    { name: "disputeAmount",   label: "Disputed amount (₦)",     type: "number", placeholder: "e.g. 15000",       showWhen: { field: "issueType", value: "dispute" } },
    { name: "disputeDate",     label: "Date of disputed charge", type: "date",                                     showWhen: { field: "issueType", value: "dispute" } },
    { name: "disputeMerchant", label: "Merchant name",           type: "text",   placeholder: "Where was charged?", showWhen: { field: "issueType", value: "dispute" } },
    { name: "requestedLimit",  label: "Requested new limit (₦)", type: "number", placeholder: "e.g. 500000", showWhen: { field: "issueType", value: "limit_increase" } },
    { name: "description",     label: "Additional details",      type: "textarea", placeholder: "Any further information..." },
  ],

  LOAN_CREDIT: [
    { name: "issueType", label: "Issue type", type: "select", required: true, options: [
      { value: "application_status", label: "Loan application status enquiry" },
      { value: "repayment_issue",    label: "Repayment issue" },
      { value: "credit_dispute",     label: "Credit score dispute" },
      { value: "loan_terms",         label: "Loan terms / interest rate query" },
    ]},
    { name: "loanReference",  label: "Loan reference number", type: "text",   placeholder: "e.g. LN-2026-00123" },
    { name: "loanAmount",     label: "Loan amount (₦)",       type: "number", placeholder: "e.g. 500000" },
    { name: "loanType",       label: "Loan type",             type: "select", options: [
      { value: "personal",  label: "Personal loan" },
      { value: "business",  label: "Business loan" },
      { value: "mortgage",  label: "Mortgage" },
      { value: "auto",      label: "Auto loan" },
      { value: "payday",    label: "Payday / salary advance" },
    ]},
    { name: "repaymentDate",  label: "Missed repayment date", type: "date", showWhen: { field: "issueType", value: "repayment_issue" } },
    { name: "description",    label: "Describe the issue",    type: "textarea", placeholder: "Full details of your enquiry...", required: true },
  ],

  DIGITAL_BANKING: [
    { name: "issueType", label: "Issue type", type: "select", required: true, options: [
      { value: "mobile_login",      label: "Cannot log in to mobile app" },
      { value: "internet_password", label: "Internet banking password reset" },
      { value: "device_reg",        label: "New device registration" },
      { value: "app_error",         label: "App error / crash" },
      { value: "transfer_blocked",  label: "Transfers blocked on app" },
    ]},
    { name: "deviceType",    label: "Device type",         type: "select", required: true, options: [
      { value: "android",  label: "Android phone" },
      { value: "iphone",   label: "iPhone / iPad" },
      { value: "browser",  label: "Web browser" },
    ]},
    { name: "appVersion",    label: "App version (if known)", type: "text",  placeholder: "e.g. 4.2.1" },
    { name: "lastLoginDate", label: "Last successful login",  type: "date" },
    { name: "errorMessage",  label: "Error message displayed", type: "text", placeholder: "Copy the exact error text" },
    { name: "description",   label: "Describe the issue",      type: "textarea", placeholder: "Steps to reproduce or full description...", required: true },
  ],

  INFO_UPDATE: [
    { name: "updateType", label: "What would you like to update?", type: "select", required: true, options: [
      { value: "address",   label: "Home address" },
      { value: "phone",     label: "Phone number" },
      { value: "email",     label: "Email address" },
      { value: "next_of_kin_name",  label: "Next of kin — name" },
      { value: "next_of_kin_phone", label: "Next of kin — phone number" },
      { value: "next_of_kin_rel",   label: "Next of kin — relationship" },
    ]},
    { name: "currentValue", label: "Current value on file", type: "text", placeholder: "What is currently stored?", required: true },
    { name: "newValue",     label: "New value",             type: "text", placeholder: "What should it be changed to?", required: true },
    { name: "effectiveDate",label: "Effective date (if applicable)", type: "date" },
    { name: "notes",        label: "Supporting information", type: "textarea", placeholder: "Any supporting context (e.g. moved house, changed number)..." },
  ],

  COMPLAINT_FEEDBACK: [
    { name: "type", label: "Type", type: "select", required: true, options: [
      { value: "complaint",   label: "Complaint — I am dissatisfied with a service" },
      { value: "feedback",    label: "Feedback — general experience" },
      { value: "suggestion",  label: "Suggestion — idea for improvement" },
    ]},
    { name: "channel", label: "Which channel does this relate to?", type: "select", required: true, options: [
      { value: "branch",        label: "Bank branch" },
      { value: "mobile_app",    label: "Mobile app" },
      { value: "internet",      label: "Internet banking" },
      { value: "call_centre",   label: "Call centre" },
      { value: "atm",           label: "ATM" },
      { value: "pos",           label: "POS terminal" },
    ]},
    { name: "incidentDate",  label: "Date of incident",        type: "date" },
    { name: "branchName",    label: "Branch name / location",  type: "text",  placeholder: "e.g. Victoria Island Branch", showWhen: { field: "channel", value: "branch" } },
    { name: "staffName",     label: "Staff name (if applicable)", type: "text", placeholder: "Name of the staff member" },
    { name: "description",   label: "Tell us what happened",   type: "textarea", placeholder: "Please describe your experience in detail...", required: true },
  ],
};

// ─── Auto-generate subject from key fields ────────────────────────────────────

const buildSubject = (category: string, fields: Record<string, string>): string => {
  switch (category) {
    case "ACCOUNT_VERIFICATION":
      return `Account Verification — ${fields.verificationType?.replace(/_/g, " ")} for ${fields.accountNumber || "account"}`;
    case "PIN_RESET":
      return `PIN Reset — ${fields.resetReason?.replace(/_/g, " ")} (Acct: ${fields.accountNumber || "N/A"})`;
    case "TRANSACTION_ISSUE":
      return `${fields.transactionType?.replace(/_/g, " ")} — ₦${fields.transactionAmount || "?"} on ${fields.transactionDate || "?"}`;
    case "CARD_SERVICES":
      return `Card ${fields.issueType?.replace(/_/g, " ")} — ${fields.cardType || ""} card ending ${fields.cardLastFour || "????"}`;
    case "LOAN_CREDIT":
      return `${fields.issueType?.replace(/_/g, " ")} — ${fields.loanReference || fields.loanType || "loan enquiry"}`;
    case "DIGITAL_BANKING":
      return `${fields.issueType?.replace(/_/g, " ")} on ${fields.deviceType || "device"}`;
    case "INFO_UPDATE":
      return `Update ${fields.updateType?.replace(/_/g, " ")} — ${fields.currentValue || ""} → ${fields.newValue || ""}`;
    case "COMPLAINT_FEEDBACK":
      return `${fields.type} — ${fields.channel?.replace(/_/g, " ")} ${fields.incidentDate ? `on ${fields.incidentDate}` : ""}`;
    default:
      return "Support request";
  }
};

// ─── Dynamic field renderer ───────────────────────────────────────────────────

function DynamicField({ field, register, control, watchValues, errors }: {
  field: FieldDef;
  register: any;
  control: any;
  watchValues: Record<string, string>;
  errors: any;
}) {
  // Conditional visibility
  if (field.showWhen && watchValues[field.showWhen.field] !== field.showWhen.value) return null;

  return (
    <div className="space-y-1.5">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {field.type === "select" ? (
        <Controller
          name={field.name}
          control={control}
          render={({ field: f }) => (
            <Select value={f.value || ""} onValueChange={f.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      ) : field.type === "textarea" ? (
        <Textarea rows={4} placeholder={field.placeholder} {...register(field.name)} />
      ) : (
        <Input type={field.type} placeholder={field.placeholder} {...register(field.name)} />
      )}

      {errors[field.name] && (
        <p className="text-xs text-destructive">{errors[field.name]?.message}</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  { q: "How do I reset my PIN?",            hint: "Select PIN Reset below and fill in your account details. An agent will action it in the core banking system.", category: "PIN_RESET" },
  { q: "My transfer failed but I was debited", hint: "Select Transaction Issue → Failed transfer. Provide the date, amount and reference number.", category: "TRANSACTION_ISSUE" },
  { q: "I lost my debit card",               hint: "Select Card Services → Lost or stolen card to block and replace it immediately.", category: "CARD_SERVICES" },
  { q: "How do I update my phone number?",   hint: "Select Information Update → Phone number. Provide your current and new number.", category: "INFO_UPDATE" },
  { q: "I can't log in to the mobile app",   hint: "Select Digital Banking → Cannot log in to mobile app and describe the issue.", category: "DIGITAL_BANKING" },
  { q: "I see a charge I don't recognise",   hint: "Select Transaction Issue → Unauthorized transaction. This is flagged urgent automatically.", category: "TRANSACTION_ISSUE" },
  { q: "How do I verify my identity (KYC)?", hint: "Select Account Verification → Full KYC re-verification. You'll be guided through ID upload and selfie.", category: "ACCOUNT_VERIFICATION" },
  { q: "I want to make a complaint",         hint: "Select Complaint / Feedback → Complaint and describe your experience.", category: "COMPLAINT_FEEDBACK" },
];

function FaqAssistant({ onSelect }: { onSelect: (category: string) => void }) {
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const matches = query.trim()
    ? FAQ_ITEMS.filter((f) => f.q.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().split(" ").some((w) => f.q.toLowerCase().includes(w)))
    : FAQ_ITEMS.slice(0, 4);

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-indigo-900">How can we help you today?</p>
        <button onClick={() => setDismissed(true)} className="text-xs text-indigo-400 hover:text-indigo-700">Skip</button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-indigo-400" />
        <input
          type="text"
          placeholder="Describe your issue briefly..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
      {matches.length > 0 && (
        <div className="space-y-1.5">
          {matches.map((f) => (
            <button
              key={f.q}
              onClick={() => { onSelect(f.category); setDismissed(true); }}
              className="w-full text-left rounded-lg border border-indigo-100 bg-white px-3 py-2.5 hover:border-primary hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-medium text-foreground group-hover:text-primary">{f.q}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.hint}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DRAFT_KEY = "ubf_ticket_draft";

export default function NewTicketPage() {
  const router = useRouter();
  const token = getToken();
  const [step, setStep] = useState<"category" | "details" | "done">("category");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Account number live validation
  const [accountVerified, setAccountVerified] = useState<boolean | null>(null);
  const [accountChecking, setAccountChecking] = useState(false);
  const [verifiedName, setVerifiedName] = useState("");
  const [accountError, setAccountError] = useState("");

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm();
  const watchValues = watch();
  const isMounted = useRef(false);

  const needsAccountCheck = ["ACCOUNT_VERIFICATION", "PIN_RESET"].includes(category);
  const accountNumberValue = watchValues.accountNumber || "";

  // Reset verification state when category changes
  useEffect(() => {
    setAccountVerified(null);
    setVerifiedName("");
    setAccountError("");
  }, [category]);

  // Debounced account number check — fires 600ms after typing stops
  useEffect(() => {
    if (!needsAccountCheck || !accountNumberValue) {
      setAccountVerified(null);
      setVerifiedName("");
      setAccountError("");
      return;
    }
    setAccountChecking(true);
    setAccountVerified(null);
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{ valid: boolean; name?: string; error?: string }>(
          `/tickets/validate-account?accountNumber=${encodeURIComponent(accountNumberValue)}`,
          { token: token! }
        );
        if (res.valid) {
          setAccountVerified(true);
          setVerifiedName(res.name || "");
          setAccountError("");
          if (category === "ACCOUNT_VERIFICATION") setValue("accountName", res.name || "");
        } else {
          setAccountVerified(false);
          setVerifiedName("");
          setAccountError(res.error || "Invalid account number");
          if (category === "ACCOUNT_VERIFICATION") setValue("accountName", "");
        }
      } catch {
        setAccountVerified(false);
        setAccountError("Could not verify — please try again");
      } finally {
        setAccountChecking(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [accountNumberValue, needsAccountCheck]);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const { category: savedCat, fields } = JSON.parse(saved);
        if (savedCat) {
          setCategory(savedCat);
          setStep("details");
          if (fields) reset(fields);
          setDraftRestored(true);
        }
      }
    } catch {}
    isMounted.current = true;
  }, []);

  // Save draft whenever category or fields change
  useEffect(() => {
    if (!isMounted.current || step === "done") return;
    if (!category) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ category, fields: watchValues }));
    } catch {}
  }, [category, JSON.stringify(watchValues), step]);

  const fields = CATEGORY_FIELDS[category] || [];
  const requiresKyc = ["ACCOUNT_VERIFICATION", "PIN_RESET"].includes(category);

  const onSubmit = async (data: Record<string, any>) => {
    // Validate required fields manually
    const missing = fields
      .filter((f) => f.required && !f.showWhen && !data[f.name])
      .map((f) => f.label);

    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      const subject = buildSubject(category, data);
      const description = data.description || data.notes || Object.entries(data)
        .filter(([k, v]) => v && k !== "description" && k !== "notes")
        .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`)
        .join("\n");

      const res = await apiRequest<{ ticket: any }>("/tickets/create", {
        method: "POST",
        body: { subject, description, category, metadata: data },
        token: token!,
      });
      setCreatedTicket(res.ticket);
      setStep("done");
      localStorage.removeItem(DRAFT_KEY);
      toast.success("Ticket submitted successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ["Category", "Details", "Submitted"];

  return (
    <AppShell allowedRoles={["CUSTOMER"]}>
      <div className="p-8 max-w-3xl mx-auto space-y-6">

        {/* Steps */}
        <div className="flex items-center gap-2">
          {stepLabels.map((label, i) => {
            const current = step === "category" ? 0 : step === "details" ? 1 : 2;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  i < current ? "bg-primary/20 text-primary" :
                  i === current ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}>{i + 1}</div>
                <span className="text-sm text-muted-foreground hidden sm:inline">{label}</span>
                {i < 2 && <div className="h-px w-8 bg-border mx-1" />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Category picker ── */}
        {step === "category" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">What do you need help with?</h2>
              <p className="text-muted-foreground text-sm mt-1">Select a category to get started</p>
            </div>
            <FaqAssistant onSelect={(cat) => { setCategory(cat); setStep("details"); }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES.map(({ value, label, icon: Icon, description }) => (
                <button
                  key={value}
                  onClick={() => setCategory(value)}
                  className={cn(
                    "text-left p-4 rounded-lg border transition-all hover:border-primary hover:shadow-sm",
                    category === value ? "border-primary bg-primary/5 shadow-sm" : "border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-md shrink-0", category === value ? "bg-primary text-white" : "bg-muted")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Button disabled={!category} onClick={() => setStep("details")}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Category-specific form ── */}
        {step === "details" && (
          <div className="space-y-6">
            {draftRestored && (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-md px-4 py-2.5 text-sm text-indigo-800">
                <span>Draft restored from your last session.</span>
                <button
                  className="text-xs underline ml-4 text-indigo-600 hover:text-indigo-900"
                  onClick={() => {
                    localStorage.removeItem(DRAFT_KEY);
                    setCategory("");
                    reset({});
                    setStep("category");
                    setDraftRestored(false);
                  }}
                >
                  Discard draft
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                {(() => { const C = CATEGORIES.find(c => c.value === category); return C ? <C.icon className="h-5 w-5 text-primary" /> : null; })()}
              </div>
              <div>
                <h2 className="text-xl font-bold">{CATEGORIES.find(c => c.value === category)?.label}</h2>
                <p className="text-muted-foreground text-sm">Fill in the details below</p>
              </div>
            </div>

            {requiresKyc && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3 flex gap-2 text-indigo-800 text-sm">
                <BadgeCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <span>This ticket requires identity verification. You will be prompted to upload your ID and take a selfie after submission.</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {fields.map((field) => {

                // ── Account number — live validation with tick/X ──────────
                if (needsAccountCheck && field.name === "accountNumber") {
                  return (
                    <div key="accountNumber" className="space-y-1.5">
                      <Label>Account number <span className="text-destructive ml-1">*</span></Label>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="10-digit account number"
                          {...register("accountNumber")}
                          className="pr-10"
                        />
                        <div className="absolute right-3 top-2.5 pointer-events-none">
                          {accountChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          {!accountChecking && accountVerified === true && (
                            <CircleCheckBig className="h-4 w-4 text-primary transition-all" />
                          )}
                          {!accountChecking && accountVerified === false && (
                            <CircleX className="h-4 w-4 text-destructive transition-all" />
                          )}
                        </div>
                      </div>
                      {accountVerified === false && accountError && (
                        <p className="text-xs text-destructive">{accountError}</p>
                      )}
                      {accountVerified === true && (
                        <p className="text-xs text-primary font-medium flex items-center gap-1">
                          <CircleCheckBig className="h-3 w-3" /> Verified — {verifiedName}
                        </p>
                      )}
                    </div>
                  );
                }

                // ── Account name — auto-filled + locked when verified ─────
                if (needsAccountCheck && field.name === "accountName") {
                  return (
                    <div key="accountName" className="space-y-1.5">
                      <Label>Account name <span className="text-destructive ml-1">*</span></Label>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Auto-filled after account number is verified"
                          {...register("accountName")}
                          readOnly={accountVerified === true}
                          className={cn("pr-10", accountVerified === true && "bg-muted cursor-not-allowed")}
                        />
                        {accountVerified === true && (
                          <div className="absolute right-3 top-2.5 pointer-events-none">
                            <CircleCheckBig className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </div>
                      {accountVerified === true && (
                        <p className="text-xs text-muted-foreground">Auto-filled from your account records</p>
                      )}
                    </div>
                  );
                }

                return (
                  <DynamicField
                    key={field.name}
                    field={field}
                    register={register}
                    control={control}
                    watchValues={watchValues}
                    errors={errors}
                  />
                );
              })}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep("category")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || (needsAccountCheck && accountVerified !== true)}
                  title={needsAccountCheck && accountVerified !== true ? "Verify your account number first" : undefined}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit ticket
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 3: Confirmation ── */}
        {step === "done" && createdTicket && (
          <div className="text-center space-y-5 py-8">
            <CircleCheckBig className="h-16 w-16 text-primary mx-auto" />
            <div>
              <h2 className="text-2xl font-bold">Ticket Submitted</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Ticket number:{" "}
                <span className="font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                  {createdTicket.ticketNumber}
                </span>
              </p>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Your ticket has been received. You will be notified by email when an agent responds.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {requiresKyc && (
                <Button onClick={() => router.push(`/kyc?ticketId=${createdTicket.id}`)}>
                  <BadgeCheck className="mr-2 h-4 w-4" /> Verify Identity
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push(`/tickets/${createdTicket.id}`)}>
                View ticket
              </Button>
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
