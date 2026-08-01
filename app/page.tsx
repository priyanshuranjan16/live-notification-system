'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Bell,
  Building2,
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Briefcase,
  Mail,
  Phone,
  Globe,
  Shield,
  Activity,
  CheckCheck,
  AlertCircle,
  X,
  ExternalLink
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'AGENT';
}

interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  contacts?: Contact[];
  assignments?: Assignment[];
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  companyId?: string;
  company?: Company;
  assignments?: Assignment[];
}

interface Assignment {
  id: string;
  role: 'ACCOUNT_OWNER' | 'SUPPORT_LEAD' | 'SALES_REP';
  userId: string;
  user: User;
  companyId?: string;
  contactId?: string;
  createdAt: string;
}

interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'ASSIGNMENT' | 'CRON_REMINDER' | 'SYSTEM';
  isRead: boolean;
  createdAt: string;
}

interface CronLog {
  timestamp: string;
  message: string;
  status: string;
  targetUser?: string;
  targetItem?: string;
}

export default function CRMApp() {
  const [users, setUsers] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [cronLogs, setCronLogs] = useState<CronLog[]>([]);

  const [activeTab, setActiveTab] = useState<'companies' | 'contacts' | 'notifications' | 'cron'>('companies');
  
  // Modals & Form states
  const [isNewCompanyOpen, setIsNewCompanyOpen] = useState(false);
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

  // Assign Target State
  const [assignTarget, setAssignTarget] = useState<{ type: 'company' | 'contact'; id: string; name: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'ACCOUNT_OWNER' | 'SUPPORT_LEAD' | 'SALES_REP'>('ACCOUNT_OWNER');

  // Form states
  const [companyForm, setCompanyForm] = useState({ name: '', industry: '', website: '' });
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', companyId: '' });

  // Live Toast state
  const [toast, setToast] = useState<NotificationItem | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Load Users & Initial Data
  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchContacts();
    fetchCronStatus();
  }, []);

  // Socket setup & Active User Notifications fetch
  useEffect(() => {
    if (!activeUser) return;

    fetchNotifications(activeUser.id);

    // Socket.io Client Connection
    socketRef.current = io({ path: '/socket.io/' });

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server, joining room for user:', activeUser.id);
      socketRef.current?.emit('join_user_room', activeUser.id);
    });

    // Listen for live targeted notifications
    socketRef.current.on('notification:new', (newNotif: NotificationItem) => {
      console.log('Received live notification:', newNotif);
      if (newNotif.userId === activeUser.id) {
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
        setToast(newNotif);

        // Auto dismiss toast after 6 seconds
        setTimeout(() => {
          setToast((curr) => (curr?.id === newNotif.id ? null : curr));
        }, 6000);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [activeUser]);

  // Periodic poll for Cron Log updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCronStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
        if (data.length > 0 && !activeUser) {
          setActiveUser(data[0]); // default to Admin or first user
        }
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (Array.isArray(data)) setCompanies(data);
    } catch (err) {
      console.error('Failed to fetch companies', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      if (Array.isArray(data)) setContacts(data);
    } catch (err) {
      console.error('Failed to fetch contacts', err);
    }
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`);
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const fetchCronStatus = async () => {
    try {
      const res = await fetch('/api/cron/status');
      const data = await res.json();
      if (data.logs) setCronLogs(data.logs);
    } catch (err) {
      console.error('Failed to fetch cron status', err);
    }
  };

  // Actions

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name) return;
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });
      if (res.ok) {
        setCompanyForm({ name: '', industry: '', website: '' });
        setIsNewCompanyOpen(false);
        fetchCompanies();
      }
    } catch (err) {
      console.error('Error creating company', err);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email) return;
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        setContactForm({ name: '', email: '', phone: '', companyId: '' });
        setIsNewContactOpen(false);
        fetchContacts();
      }
    } catch (err) {
      console.error('Error creating contact', err);
    }
  };

  const handleOpenAssign = (type: 'company' | 'contact', id: string, name: string) => {
    setAssignTarget({ type, id, name });
    if (users.length > 0) setSelectedUserId(users[0].id);
    setSelectedRole('ACCOUNT_OWNER');
    setIsAssignModalOpen(true);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget || !selectedUserId) return;

    try {
      const payload: any = {
        userId: selectedUserId,
        role: selectedRole,
      };

      if (assignTarget.type === 'company') {
        payload.companyId = assignTarget.id;
      } else {
        payload.contactId = assignTarget.id;
      }

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsAssignModalOpen(false);
        fetchCompanies();
        fetchContacts();
        if (activeUser) fetchNotifications(activeUser.id);
      }
    } catch (err) {
      console.error('Error creating assignment', err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking as read', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!activeUser) return;
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUser.id }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all as read', err);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Are you sure you want to delete this company?')) return;
    try {
      await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      fetchCompanies();
    } catch (err) {
      console.error('Failed to delete company', err);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      fetchContacts();
    } catch (err) {
      console.error('Failed to delete contact', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                PulseCRM <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">Real-Time</span>
              </h1>
              <p className="text-xs text-slate-500">Live CRM Role & Notification System</p>
            </div>
          </div>

          {/* ACTIVE USER SWITCHER HEADER CONTROL */}
          <div className="flex items-center space-x-4">
            
            <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-medium text-slate-500 px-2 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Active Session:
              </span>
              <select
                value={activeUser?.id || ''}
                onChange={(e) => {
                  const user = users.find((u) => u.id === e.target.value);
                  if (user) setActiveUser(user);
                }}
                className="bg-white text-xs font-semibold text-slate-800 rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* NOTIFICATION BELL & DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                className="relative p-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center justify-center focus:outline-none"
                title="View Notifications"
              >
                <Bell className="w-5 h-5 text-emerald-700" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse-subtle shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* DROPDOWN MENU */}
              {isNotifDropdownOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-emerald-100 z-50 overflow-hidden">
                  <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-700" />
                      <h3 className="font-bold text-slate-800 text-sm">Notifications ({notifications.length})</h3>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No notifications for {activeUser?.name}.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 transition-colors ${
                            !n.isRead ? 'bg-emerald-50/50 border-l-4 border-emerald-500' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                          {!n.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(n.id)}
                              className="mt-2 text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Mark read
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* TOP BANNER / NAVIGATION TABS */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          
          {/* TABS */}
          <nav className="flex space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('companies')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'companies'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" /> Companies ({companies.length})
            </button>
            
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'contacts'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" /> Contacts ({contacts.length})
            </button>
            
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'notifications'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-4 h-4" /> Notifications Hub
              {unreadCount > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('cron')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'cron'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-600" /> Cron Worker
            </button>
          </nav>

          {/* ACTION BUTTONS */}
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {activeTab === 'companies' && (
              <button
                onClick={() => setIsNewCompanyOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Add Company
              </button>
            )}
            {activeTab === 'contacts' && (
              <button
                onClick={() => setIsNewContactOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Add Contact
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: COMPANIES */}
        {activeTab === 'companies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <div key={company.id} className="card-white p-6 relative flex flex-col justify-between hover:border-emerald-300 transition-all">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-600" /> {company.name}
                      </h3>
                      {company.industry && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {company.industry}
                        </p>
                      )}
                      {company.website && (
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-600 hover:underline mt-1 flex items-center gap-1 font-medium"
                        >
                          <Globe className="w-3 h-3" /> {company.website} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCompany(company.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Delete company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* ASSIGNMENTS LIST */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Role Assignments</span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        {company.assignments?.length || 0} assigned
                      </span>
                    </div>

                    {company.assignments && company.assignments.length > 0 ? (
                      <div className="space-y-2">
                        {company.assignments.map((a) => (
                          <div key={a.id} className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">{a.user.name}</span>
                            <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-md text-[10px]">
                              {a.role.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No users assigned yet.</p>
                    )}
                  </div>
                </div>

                {/* ASSIGN BUTTON */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenAssign('company', company.id, company.name)}
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs py-2 rounded-lg border border-emerald-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Assign User with Role
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: CONTACTS */}
        {activeTab === 'contacts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contacts.map((contact) => (
              <div key={contact.id} className="card-white p-6 relative flex flex-col justify-between hover:border-emerald-300 transition-all">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" /> {contact.name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" /> {contact.email}
                      </p>
                      {contact.phone && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {contact.phone}
                        </p>
                      )}
                      {contact.company && (
                        <div className="mt-2">
                          <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-semibold border border-slate-200 flex items-center gap-1 inline-flex">
                            <Building2 className="w-3 h-3 text-emerald-600" /> {contact.company.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Delete contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* ASSIGNMENTS LIST */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Role Assignments</span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        {contact.assignments?.length || 0} assigned
                      </span>
                    </div>

                    {contact.assignments && contact.assignments.length > 0 ? (
                      <div className="space-y-2">
                        {contact.assignments.map((a) => (
                          <div key={a.id} className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">{a.user.name}</span>
                            <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-md text-[10px]">
                              {a.role.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No users assigned yet.</p>
                    )}
                  </div>
                </div>

                {/* ASSIGN BUTTON */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenAssign('contact', contact.id, contact.name)}
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs py-2 rounded-lg border border-emerald-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Assign User with Role
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS HUB */}
        {activeTab === 'notifications' && (
          <div className="card-white p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-600" /> Notifications for {activeUser?.name}
                </h2>
                <p className="text-xs text-slate-500">Live targeted notifications stored in PostgreSQL</p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" /> Mark All as Read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">No notifications found for this user yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border transition-all flex items-start justify-between ${
                      !n.isRead
                        ? 'bg-emerald-50/70 border-emerald-200 shadow-xs'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg mt-0.5 ${
                        n.type === 'ASSIGNMENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {n.type === 'ASSIGNMENT' ? <UserCheck className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900">{n.title}</h3>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            n.type === 'ASSIGNMENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {n.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-2 block">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {!n.isRead ? (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="bg-white hover:bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-md border border-emerald-300 transition-colors shrink-0"
                      >
                        Mark Read
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Read
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CRON WORKER */}
        {activeTab === 'cron' && (
          <div className="card-white p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" /> Background Cron Automation (<code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">node-cron</code>)
                </h2>
                <p className="text-xs text-slate-500">Automated periodic follow-up worker creating notifications in PostgreSQL and delivering live Socket.IO events.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Worker Active (30 min Interval)
              </div>
            </div>

            <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs max-h-96 overflow-y-auto space-y-2 border border-slate-800">
              {cronLogs.length === 0 ? (
                <p className="text-slate-500">Waiting for next node-cron cycle execution...</p>
              ) : (
                cronLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-500 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-emerald-300">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* ASSIGNMENT MODAL */}
      {isAssignModalOpen && assignTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" /> Assign User Role
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Item</label>
                <div className="bg-slate-100 p-2.5 rounded-lg text-xs font-semibold text-slate-800 border border-slate-200">
                  {assignTarget.type.toUpperCase()}: {assignTarget.name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-white text-xs font-medium text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assign Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full bg-white text-xs font-medium text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="SHIELD_DIRECTOR">S.H.I.E.L.D. Director</option>
                  <option value="STARK_TECH_ADVISOR">Stark Tech Advisor</option>
                  <option value="VIBRANIUM_SPECIALIST">Vibranium Specialist</option>
                  <option value="MULTIVERSE_GUARDIAN">Multiverse Guardian</option>
                  <option value="HEAD_TACTICIAN">Head Tactician</option>
                  <option value="FIELD_LEAD">Field Lead</option>
                  <option value="ACCOUNT_OWNER">Account Owner</option>
                  <option value="SUPPORT_LEAD">Support Lead</option>
                  <option value="SALES_REP">Sales Representative</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW COMPANY MODAL */}
      {isNewCompanyOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" /> Create Company
              </h3>
              <button onClick={() => setIsNewCompanyOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full bg-white text-xs text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  placeholder="e.g. SaaS / Healthcare"
                  value={companyForm.industry}
                  onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                  className="w-full bg-white text-xs text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Website URL</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                  className="w-full bg-white text-xs text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCompanyOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors"
                >
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW CONTACT MODAL */}
      {isNewContactOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" /> Create Contact
              </h3>
              <button onClick={() => setIsNewContactOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full bg-white text-xs text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="sarah@example.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full bg-white text-xs text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+1 555-0199"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full bg-white text-xs text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Relate to Company</label>
                <select
                  value={contactForm.companyId}
                  onChange={(e) => setContactForm({ ...contactForm, companyId: e.target.value })}
                  className="w-full bg-white text-xs font-medium text-slate-900 rounded-lg p-2.5 border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- None (Standalone Contact) --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewContactOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIVE TOAST NOTIFICATION POPUP */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white rounded-2xl shadow-2xl border-l-4 border-emerald-500 border-t border-r border-b border-slate-200 p-4 transform transition-all duration-300 animate-bounce-subtle">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live Notification
                </span>
                <h4 className="font-bold text-sm text-slate-900 mt-1">{toast.title}</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{toast.message}</p>
              </div>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 shrink-0 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
