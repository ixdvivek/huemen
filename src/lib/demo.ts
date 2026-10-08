import { defaultSettings, type Snapshot } from './types';

const t = (daysAgo: number) => new Date(Date.now() - daysAgo * 864e5).toISOString();
const d = (daysAgo: number) => t(daysAgo).slice(0, 10);

export function demoSnapshot(): Snapshot {
  return {
    settings: {
      ...defaultSettings,
      businessName: 'Your Studio',
      ownerName: 'You',
      email: 'you@email.com',
      phone: '+91 98765 43210',
      address: 'Bengaluru, India',
      upiId: 'yourname@upi',
      upiName: 'Your Studio',
      bankName: 'HDFC Bank',
      accountName: 'Your Studio',
      accountNumber: '50100012341234',
      ifsc: 'HDFC0001234',
      usdDetails: 'Wise · you@email.com\nSWIFT transfers on request',
    },
    clients: [
      { id: 'c1', created_at: t(40), name: 'Priya Sharma', company: 'Northwind Labs', email: 'priya@northwind.in', phone: null, address: 'Pune, India' },
      { id: 'c2', created_at: t(30), name: 'Sam Lee', company: 'Bluehill Co.', email: 'sam@bluehill.co', phone: null, address: 'Austin, TX' },
    ],
    projects: [
      { id: 'p1', created_at: t(30), client_id: 'c1', title: 'Website redesign', currency: 'INR', status: 'active', rates: [{ name: 'Development', amount: 2000 }], start_date: d(30), notes: null },
      { id: 'p2', created_at: t(20), client_id: 'c2', title: 'Brand identity', currency: 'USD', status: 'active', rates: [{ name: 'Design', amount: 60 }], start_date: d(20), notes: null },
    ],
    deliverables: [
      { id: 'd1', created_at: t(30), project_id: 'p1', title: 'Discovery & wireframes', kind: 'fixed', hours: null, rate: null, amount: 60000, status: 'done', is_additional: false, due_date: null },
      { id: 'd2', created_at: t(30), project_id: 'p1', title: 'UI design · 8 pages', kind: 'fixed', hours: null, rate: null, amount: 90000, status: 'done', is_additional: false, due_date: null },
      { id: 'd3', created_at: t(30), project_id: 'p1', title: 'Development', kind: 'hourly', hours: 30, rate: 2000, amount: 60000, status: 'in_progress', is_additional: false, due_date: null },
      { id: 'd4', created_at: t(10), project_id: 'p1', title: 'Blog module', kind: 'hourly', hours: 15, rate: 2000, amount: 30000, status: 'todo', is_additional: true, due_date: null },
      { id: 'd5', created_at: t(20), project_id: 'p2', title: 'Logo & brand mark', kind: 'fixed', hours: null, rate: null, amount: 2400, status: 'done', is_additional: false, due_date: null },
      { id: 'd6', created_at: t(20), project_id: 'p2', title: 'Brand guidelines', kind: 'fixed', hours: null, rate: null, amount: 1200, status: 'in_progress', is_additional: false, due_date: null },
    ],
    invoices: [
      { id: 'i1', created_at: t(28), project_id: 'p1', number: 'INV-0001', type: 'advance', issue_date: d(28), due_date: d(21), items: [{ title: 'Advance', detail: '30% of project value', amount: 72000 }], discount: 0, total: 72000, notes: null, status: 'sent' },
      { id: 'i2', created_at: t(7), project_id: 'p1', number: 'INV-0002', type: 'milestone', issue_date: d(7), due_date: d(-7), items: [{ title: 'Discovery & wireframes', detail: 'Fixed price', amount: 60000, deliverable_id: 'd1' }, { title: 'Development', detail: '9 hrs × ₹2,000', hours: 9, rate: 2000, amount: 18000 }], discount: 0, total: 78000, notes: 'Milestone 2 of 3.', status: 'sent' },
      { id: 'i3', created_at: t(18), project_id: 'p2', number: 'INV-0003', type: 'advance', issue_date: d(18), due_date: d(11), items: [{ title: 'Advance', detail: 'Logo & brand mark', amount: 2400 }], discount: 0, total: 2400, notes: null, status: 'sent' },
    ],
    payments: [
      { id: 'pay1', created_at: t(25), invoice_id: 'i1', project_id: 'p1', number: 'RCT-0001', date: d(25), amount: 72000, method: 'bank', reference: 'NEFT 4471', notes: null },
      { id: 'pay2', created_at: t(1), invoice_id: 'i2', project_id: 'p1', number: 'RCT-0002', date: d(1), amount: 18000, method: 'upi', reference: '1234 5678 9012', notes: null },
      { id: 'pay3', created_at: t(15), invoice_id: 'i3', project_id: 'p2', number: 'RCT-0003', date: d(15), amount: 2400, method: 'wise', reference: null, notes: null },
    ],
    activity: [
      { id: 'a1', created_at: t(30), project_id: 'p1', kind: 'project', title: 'Project created', detail: 'Website redesign' },
      { id: 'a2', created_at: t(10), project_id: 'p1', kind: 'scope', title: 'Additional work added', detail: 'Blog module · ₹30,000' },
      { id: 'a3', created_at: t(1), project_id: 'p1', kind: 'payment', title: 'Payment recorded', detail: '₹18,000 on INV-0002' },
    ],
  };
}
