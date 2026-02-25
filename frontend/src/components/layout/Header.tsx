import { Link, useLocation } from 'react-router-dom';
import { adminApi } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';

export function Header() {
  const location = useLocation();
  const queryClient = useQueryClient();

  const navItems = [
    { path: '/users', label: 'Users' },
    { path: '/groups', label: 'Groups' },
    { path: '/logs', label: 'Request Logs' },
    { path: '/connector', label: 'Connector' },
  ];

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
      return;
    }

    try {
      await adminApi.reset();
      queryClient.invalidateQueries();
      alert('All data has been reset successfully');
    } catch (error) {
      console.error('Reset failed:', error);
      alert('Failed to reset data');
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none animate-dance">🕺</span>
            <span className="text-base font-semibold text-slate-900">SCIMmy</span>
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Reset All Data
          </button>
        </div>
        <nav className="flex gap-1 -mb-px">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                location.pathname === item.path
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
