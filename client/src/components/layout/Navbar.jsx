import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, Menu, User, X } from 'lucide-react';
import { Logo, Button, Card, ConfirmDialog } from '../common/UI';
import { useAuth } from '../../context/AuthContext';

export function Navbar({ onLogout }) {
  const { isAuthenticated: loggedIn, isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const links = loggedIn
    ? [
        ["/", "Home"],
        ["/build", "Build Pizza"],
        ["/orders", "My Orders"],
        ...(isAdmin ? [["/admin", "Admin"]] : []),
      ]
    : [
        ["/", "Home"],
        ["/build", "Build Pizza"],
        ["/orders", "My Orders"],
      ];

  const handleLogoutConfirm = () => {
    setConfirmLogout(false);
    setProfile(false);
    setOpen(false);
    onLogout();
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-cream/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 xl:flex">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-sm font-semibold transition hover:text-tomato ${
                    isActive ? "text-tomato" : "text-stone-600"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 xl:flex">
            {loggedIn ? (
              <div className="relative">
                <Button variant="secondary" onClick={() => setProfile(!profile)}>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-white">
                    <User size={14} />
                  </span>
                  <span>{user?.name || "Account"}</span>
                  <ChevronDown size={15} />
                </Button>
                {profile && (
                  <Card className="absolute right-0 mt-2 w-48 p-2">
                    <Link
                      className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-stone-50"
                      to="/account"
                      onClick={() => setProfile(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-stone-50"
                      to="/dashboard"
                      onClick={() => setProfile(false)}
                    >
                      Customer dashboard
                    </Link>
                    <Link
                      className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-stone-50"
                      to="/orders"
                      onClick={() => setProfile(false)}
                    >
                      My orders
                    </Link>
                    {isAdmin && (
                      <Link
                        className="block rounded-lg px-3 py-2 text-sm font-semibold text-tomato hover:bg-red-50"
                        to="/admin"
                        onClick={() => setProfile(false)}
                      >
                        Admin portal
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setProfile(false);
                        setConfirmLogout(true);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Log out
                    </button>
                  </Card>
                )}
              </div>
            ) : (
              <>
                <Link className="px-3 text-sm font-bold text-stone-700 hover:text-tomato" to="/login">
                  Log in
                </Link>
                <Link to="/register">
                  <Button>Get started</Button>
                </Link>
              </>
            )}
          </div>
          <button
            className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm xl:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {open && (
          <div className="border-t border-stone-200 bg-white px-5 py-5 xl:hidden">
            {links.map(([to, label]) => (
              <Link
                key={to}
                onClick={() => setOpen(false)}
                className="block border-b border-stone-100 py-3 font-semibold"
                to={to}
              >
                {label}
              </Link>
            ))}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {loggedIn ? (
                <>
                  <Link to="/account" onClick={() => setOpen(false)}>
                    <Button variant="secondary" className="w-full">
                      Account
                    </Button>
                  </Link>
                  <Button onClick={() => setConfirmLogout(true)}>Log out</Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)}>
                    <Button variant="secondary" className="w-full">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setOpen(false)}>
                    <Button className="w-full">Register</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You’ll need to sign in again to view your account and orders."
        confirmLabel="Log out"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
}
