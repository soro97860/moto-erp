import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, ClipboardList, Package, Warehouse, Users, BarChart3,
  LogOut, Menu, X, Settings,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/checkout', label: '結帳', icon: ShoppingCart },
  { to: '/orders', label: '工單查詢', icon: ClipboardList },
  { to: '/products', label: '商品管理', icon: Package },
  { to: '/warehouse', label: '倉儲入庫', icon: Warehouse },
  { to: '/customers', label: '客戶資料', icon: Users },
  { to: '/reports', label: '報表', icon: BarChart3 },
];

// Bottom nav uses first 5 items; Reports accessible via sidebar or swipe
const bottomNavItems = navItems.slice(0, 5);

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white',
    );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 text-white shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <h1 className="text-lg font-bold">機車行 ERP</h1>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.name}</p>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-700 space-y-0.5">
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white',
                )
              }
            >
              <Settings className="h-4 w-4" /> 系統設定
            </NavLink>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" /> 登出
          </button>
        </div>
      </aside>

      {/* ── Mobile drawer overlay ────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-5 border-b border-gray-700">
              <div>
                <h1 className="text-lg font-bold">機車行 ERP</h1>
                <p className="text-xs text-gray-400">{user?.name}</p>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 px-2">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={linkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-gray-700 space-y-0.5">
              {user?.role === 'ADMIN' && (
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white',
                    )
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  <Settings className="h-4 w-4" /> 系統設定
                </NavLink>
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                <LogOut className="h-4 w-4" /> 登出
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
          <h1 className="text-base font-bold">機車行 ERP</h1>
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex">
          {bottomNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary-600' : 'text-gray-500',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-5 w-5 mb-0.5', isActive && 'text-primary-600')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
