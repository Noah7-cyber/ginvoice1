import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Activity,
  CreditCard,
  Search,
  Edit,
  Trash2,
  Calendar,
  X,
  Check,
  AlertTriangle,
  Loader2,
  LogOut
} from 'lucide-react';
import {
  getAdminStats,
  getAdminUsers,
  getAdminUserDetails,
  updateUserAdmin,
  deleteUserAdmin,
  grantSubscriptionAdmin,
  clearAdminToken
} from '../services/api';
import { useToast } from './ToastProvider';

interface AdminDashboardProps {
    onLogout?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const { addToast } = useToast();
  const [stats, setStats] = useState({ totalBusinesses: 0, activeSubscriptions: 0, dailyActiveUsers: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [subDays, setSubDays] = useState(30);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const statsData = await getAdminStats();
      setStats(statsData);

      const usersData = await getAdminUsers(page, search);
      setUsers(usersData.users);
      setTotalPages(usersData.pages);
    } catch (err: any) {
      if (err.status === 403 || err.status === 401) {
        addToast('Session expired. Please log in.', 'error');
        if (onLogout) onLogout();
      } else {
        addToast('Failed to load admin data.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, search, addToast, onLogout]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await updateUserAdmin(selectedUser._id, {
        name: selectedUser.name,
        phone: selectedUser.phone,
        email: selectedUser.email
      });
      addToast('User updated successfully', 'success');
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      addToast('Update failed', 'error');
    }
  };

  const handleGrantSub = async () => {
    if (!selectedUser) return;
    try {
      await grantSubscriptionAdmin(selectedUser._id, subDays);
      addToast(`Subscription extended by ${subDays} days`, 'success');
      setIsSubModalOpen(false);
      fetchData();
    } catch (err) {
      addToast('Failed to grant subscription', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await deleteUserAdmin(selectedUser._id);
      addToast('User deleted permanently', 'success');
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      addToast('Delete failed', 'error');
    }
  };

  const fetchDetails = async (id: string) => {
      try {
          const details = await getAdminUserDetails(id);
          setSelectedUser(details);
      } catch (err) {
          addToast("Failed to fetch user details", "error");
      }
  };

  const handleLogout = () => {
      clearAdminToken();
      if (onLogout) onLogout();
      else window.location.reload();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-black text-gray-900">Admin Dashboard</h1>
           <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Command Center</p>
        </div>
        <button
           className="flex items-center gap-2 px-4 py-2 bg-white border border-red-100 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold shadow-sm transition-all"
           onClick={handleLogout}
        >
            <LogOut size={16} />
            Exit Secure Mode
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center gap-4">
          <div className="p-4 rounded-xl bg-blue-50 text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Total Users</p>
            <p className="text-3xl font-black text-gray-900">{stats.totalBusinesses}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center gap-4">
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Active Subs</p>
            <p className="text-3xl font-black text-gray-900">{stats.activeSubscriptions}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center gap-4">
          <div className="p-4 rounded-xl bg-purple-50 text-purple-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Daily Active</p>
            <p className="text-3xl font-black text-gray-900">{stats.dailyActiveUsers}</p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold">Registered Businesses</h2>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 border-b">
              <tr>
                <th className="px-6 py-4">Business Name</th>
                <th className="px-6 py-4">Email / Phone</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Active</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></td></tr>
              ) : users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{user.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span>{user.email || 'N/A'}</span>
                      <span className="text-xs text-gray-400">{user.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                      user.isSubscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.isSubscribed ? 'PRO' : 'FREE'}
                    </span>
                    {user.subscriptionExpiresAt && (
                      <div className="text-[10px] mt-1 text-gray-400">
                        Exp: {new Date(user.subscriptionExpiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        fetchDetails(user._id).then(() => {
                           setIsEditModalOpen(true);
                        });
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold mr-3"
                    >
                      View
                    </button>
                    <button
                      onClick={() => {
                         setSelectedUser(user);
                         setIsSubModalOpen(true);
                      }}
                      className="text-emerald-600 hover:text-emerald-800 font-bold mr-3"
                    >
                      Extend
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setIsDeleteModalOpen(true);
                      }}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t flex justify-between items-center bg-gray-50">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 bg-white border rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm font-bold text-gray-500">Page {page} of {totalPages}</span>
          <button
             disabled={page === totalPages}
             onClick={() => setPage(p => p + 1)}
             className="px-4 py-2 bg-white border rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">Edit User Details</h3>
              <button onClick={() => setIsEditModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Business Name</label>
                <input
                  type="text"
                  value={selectedUser.name}
                  onChange={e => setSelectedUser({...selectedUser, name: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={selectedUser.email || ''}
                  onChange={e => setSelectedUser({...selectedUser, email: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={selectedUser.phone}
                  onChange={e => setSelectedUser({...selectedUser, phone: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              {/* Stats Preview */}
              <div className="grid grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                      <span className="block text-xs text-gray-500 uppercase">Products</span>
                      <span className="text-lg font-bold">{selectedUser.productCount ?? '...'}</span>
                  </div>
                  <div>
                      <span className="block text-xs text-gray-500 uppercase">Transactions</span>
                      <span className="text-lg font-bold">{selectedUser.transactionCount ?? '...'}</span>
                  </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {isSubModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                <Calendar size={24} />
              </div>
              <h3 className="font-bold text-xl mb-2">Grant Subscription</h3>
              <p className="text-gray-500 text-sm mb-6">
                Extend <strong>{selectedUser.name}</strong>'s subscription. This will unlock PRO features immediately.
              </p>

              <div className="space-y-3 mb-6">
                {[30, 90, 365].map(days => (
                  <button
                    key={days}
                    onClick={() => setSubDays(days)}
                    className={`w-full flex justify-between px-4 py-3 rounded-xl border-2 font-bold transition-all ${
                      subDays === days ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span>{days} Days</span>
                    {subDays === days && <Check size={20} />}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsSubModalOpen(false)} className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                <button onClick={handleGrantSub} className="flex-1 py-3 font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">Grant Access</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="font-bold text-xl mb-2 text-red-600">Delete User?</h3>
              <p className="text-gray-500 text-sm mb-6">
                Are you sure you want to delete <strong>{selectedUser.name}</strong>? This action is
                <span className="font-bold text-red-600"> IRREVERSIBLE</span>. All products, transactions, and data will be wiped.
              </p>

              <div className="flex gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                <button onClick={handleDeleteUser} className="flex-1 py-3 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700">Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
