export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: 'bg-slate-700 text-slate-300',
    CONTACTED: 'bg-blue-900/50 text-blue-300',
    OPENED: 'bg-purple-900/50 text-purple-300',
    REPLIED: 'bg-yellow-900/50 text-yellow-300',
    CALL_BOOKED: 'bg-orange-900/50 text-orange-300',
    CONVERTED: 'bg-green-900/50 text-green-300',
    LOST: 'bg-red-900/50 text-red-400',
    DRAFT: 'bg-slate-700 text-slate-300',
    SCHEDULED: 'bg-blue-900/50 text-blue-300',
    SENT: 'bg-indigo-900/50 text-indigo-300',
    BOUNCED: 'bg-red-900/50 text-red-400',
    FAILED: 'bg-red-900/50 text-red-400',
    CLICKED: 'bg-cyan-900/50 text-cyan-300',
  };
  return colors[status] || 'bg-slate-700 text-slate-300';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'New',
    CONTACTED: 'Contacted',
    OPENED: 'Opened',
    REPLIED: 'Replied',
    CALL_BOOKED: 'Call Booked',
    CONVERTED: 'Converted',
    LOST: 'Lost',
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
    SENT: 'Sent',
    BOUNCED: 'Bounced',
    FAILED: 'Failed',
    CLICKED: 'Clicked',
  };
  return labels[status] || status;
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'OPENED',
  'REPLIED',
  'CALL_BOOKED',
  'CONVERTED',
  'LOST',
] as const;

export const INDUSTRIES = [
  'Restaurant',
  'Gym',
  'Salon',
  'Barbershop',
  'Dentist',
  'Contractor',
  'Plumber',
  'Electrician',
  'HVAC',
  'Landscaping',
  'Cleaning Service',
  'Auto Repair',
  'Real Estate Agent',
  'Chiropractor',
  'Law Firm',
  'Accounting',
  'Retail Store',
  'Coffee Shop',
  'Pet Grooming',
  'Yoga Studio',
  'Spa',
  'Photography',
  'Florist',
  'Bakery',
  'Pediatrician',
  'Veterinarian',
] as const;
