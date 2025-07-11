import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { LoginForm } from './components/Auth/LoginForm';
import { RegisterForm } from './components/Auth/RegisterForm';
import { TicketList } from './components/Tickets/TicketList';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { BarChart3, Ticket } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<'tickets' | 'dashboard'>('tickets');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return authMode === 'login' ? (
      <LoginForm onToggleMode={() => setAuthMode('register')} />
    ) : (
      <RegisterForm onToggleMode={() => setAuthMode('login')} />
    );
  }

  return (
    <Layout>
      {user.role === 'admin' && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('tickets')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'tickets'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Ticket className="h-4 w-4 inline mr-2" />
                Tickets
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-2" />
                Dashboard
              </button>
            </nav>
          </div>
        </div>
      )}
      
      {activeTab === 'tickets' ? <TicketList /> : <AdminDashboard />}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;