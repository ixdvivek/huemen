export type Currency = 'INR' | 'USD';
export type ProjectStatus = 'active' | 'on_hold' | 'completed';
export type DeliverableStatus = 'todo' | 'in_progress' | 'done';
export type InvoiceType = 'advance' | 'milestone' | 'additional' | 'final' | 'custom';
export type InvoiceStatus = 'draft' | 'sent' | 'void';
export type PaymentMethod = 'upi' | 'bank' | 'wise' | 'paypal' | 'card' | 'cash' | 'other';

export interface Settings {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  logo: string; // data URL, optional
  upiId: string;
  upiName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  usdDetails: string; // free text: wire / Wise / PayPal
  invoicePrefix: string;
  receiptPrefix: string;
  dueDays: number;
  invoiceNote: string;
  receiptNote: string;
}

export interface Rate {
  name: string;
  amount: number;
}

export interface Row {
  id: string;
  created_at: string;
}

export interface Client extends Row {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface Project extends Row {
  client_id: string | null;
  title: string;
  currency: Currency;
  status: ProjectStatus;
  rates: Rate[];
  start_date: string | null;
  notes: string | null;
}

export interface Deliverable extends Row {
  project_id: string;
  title: string;
  kind: 'fixed' | 'hourly';
  hours: number | null;
  rate: number | null;
  amount: number;
  status: DeliverableStatus;
  is_additional: boolean;
  due_date: string | null;
}

export interface InvoiceItem {
  title: string;
  detail?: string;
  hours?: number | null;
  rate?: number | null;
  amount: number;
  deliverable_id?: string | null;
}

export interface Invoice extends Row {
  project_id: string;
  number: string;
  type: InvoiceType;
  issue_date: string;
  due_date: string | null;
  items: InvoiceItem[];
  discount: number;
  total: number;
  notes: string | null;
  status: InvoiceStatus;
}

export interface Payment extends Row {
  invoice_id: string;
  project_id: string;
  number: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
}

export interface Activity extends Row {
  project_id: string | null;
  kind: 'project' | 'deliverable' | 'invoice' | 'shared' | 'payment' | 'scope' | 'status';
  title: string;
  detail: string | null;
}

export interface Tables {
  clients: Client;
  projects: Project;
  deliverables: Deliverable;
  invoices: Invoice;
  payments: Payment;
  activity: Activity;
}

export type TableName = keyof Tables;

export interface Snapshot {
  settings: Settings;
  clients: Client[];
  projects: Project[];
  deliverables: Deliverable[];
  invoices: Invoice[];
  payments: Payment[];
  activity: Activity[];
}

export const defaultSettings: Settings = {
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
  logo: '',
  upiId: '',
  upiName: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  ifsc: '',
  usdDetails: '',
  invoicePrefix: 'INV-',
  receiptPrefix: 'RCT-',
  dueDays: 7,
  invoiceNote: 'Thank you for your business.',
  receiptNote: 'Thank you for the payment.',
};
