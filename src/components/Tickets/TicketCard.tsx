import React, { useState } from 'react';
import { Ticket } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Calendar, User, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

interface TicketCardProps {
  ticket: Ticket;
  onUpdate: (updatedTicket: Ticket) => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleStatusChange = async (newStatus: string) => {
    try {
      setLoading(true);
      const updatedTicket = await api.updateTicket(ticket.id, { status: newStatus });
      onUpdate(updatedTicket);
    } catch (error) {
      console.error('Failed to update ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    try {
      setLoading(true);
      const updatedTicket = await api.updateTicket(ticket.id, { priority: newPriority });
      onUpdate(updatedTicket);
    } catch (error) {
      console.error('Failed to update ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const canUpdateStatus = user?.role === 'admin' || ticket.user_id === user?.id;
  const canAssign = user?.role === 'admin';

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-medium text-gray-900">{ticket.title}</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
              {getStatusIcon(ticket.status)}
              <span className="ml-1">{ticket.status.replace('_', ' ')}</span>
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority}
            </span>
          </div>
          
          <p className="text-gray-600 mb-4">{ticket.description}</p>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-1" />
              {ticket.user_name} ({ticket.user_email})
            </div>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date(ticket.created_at).toLocaleDateString()}
            </div>
            {ticket.assigned_name && (
              <div className="flex items-center">
                <span className="text-xs">Assigned to: {ticket.assigned_name}</span>
              </div>
            )}
          </div>
        </div>
        
        {canUpdateStatus && (
          <div className="ml-4 flex flex-col space-y-2">
            {user?.role === 'admin' && (
              <>
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={loading}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                
                <select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  disabled={loading}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};