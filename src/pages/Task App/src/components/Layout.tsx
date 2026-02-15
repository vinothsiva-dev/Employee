import React from 'react';
import { NavLink } from 'react-router-dom';
import { designTokens } from '../designTokens';
import { useUI } from '../context/UIContext';
import LogoMark from './LogoMark';

import { useAppData } from '../context/DataContext';

const navItems = [
  { label: 'Dashboard', path: '/tasks/' },
  { label: 'Work Items', path: '/tasks/work-items' },
  { label: 'Notes', path: '/tasks/notes' },
  { label: 'Analytics', path: '/tasks/analytics' },
  { label: 'Settings', path: '/tasks/settings' },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { openAgent } = useUI();
  const { users, currentUserId } = useAppData();

  const currentUser = users.find(u => u.id === currentUserId);
  const displayName = currentUser?.name || 'Guest User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="!min-h-screen !text-slate-900" style={{ backgroundColor: '#f6f8fb', fontFamily: "'Inter', sans-serif" }}>
      <header className="!bg-white !border-b !border-slate-200 !shadow-sm">
        <div className="!max-w-7xl !mx-auto !px-4 !sm:px-6 !lg:px-8">
          <div className="!                                       flex items-center justify-between h-16">
            <LogoMark />
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-3 text-sm font-medium text-slate-600">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/tasks/'}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-full transition ${isActive ? '!text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`
                    }
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? designTokens.colors.accent : undefined,
                    })}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <button
                className="!text-sm !font-semibold !rounded-full !border !shadow-sm !transition"
                onClick={openAgent}
                style={{
                  backgroundColor: 'white',
                  color: '#1e293b', // slate-800
                  border: '1px solid #e2e8f0', // slate-200
                }}
              >
                Ask Agent
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{displayName}</span>
                <div className="h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <nav className="md:hidden border-b border-slate-200 bg-white">
        <div className="flex items-center justify-around px-4 py-2 text-xs font-semibold uppercase text-slate-500">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/tasks/'}
              className={({ isActive }) =>
                `px-2 py-1 rounded-md ${isActive ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="w-full mx-auto px-6 lg:px-12 py-6 space-y-6">{children}</main>
    </div>
  );
};

export default Layout;

