import { AuthResponse, Ticket, User, TicketStats } from '../types';

const API_BASE = 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth methods
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    this.token = response.token;
    localStorage.setItem('token', response.token);
    return response;
  }

  async register(email: string, password: string, fullName: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    });
    
    this.token = response.token;
    localStorage.setItem('token', response.token);
    return response;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('token');
  }

  // Ticket methods
  async getTickets(): Promise<Ticket[]> {
    return this.request<Ticket[]>('/tickets');
  }

  async createTicket(title: string, description: string, priority: string): Promise<Ticket> {
    return this.request<Ticket>('/tickets', {
      method: 'POST',
      body: JSON.stringify({ title, description, priority }),
    });
  }

  async updateTicket(id: number, updates: Partial<Ticket>): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Admin methods
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/admin/users');
  }

  async getStats(): Promise<TicketStats> {
    return this.request<TicketStats>('/admin/stats');
  }
}

export const api = new ApiClient();