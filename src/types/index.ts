export interface User {
  id: number;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  user_id: number;
  assigned_to?: number;
  user_name: string;
  user_email: string;
  assigned_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TicketStats {
  ticketsByStatus: Record<string, number>;
  totalUsers: number;
  totalTickets: number;
}