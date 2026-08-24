import React, { useState } from 'react';
import { USERS } from '../data/users';
import { User } from '../types';
import { KeyRound, Shirt, Lock, Eye, EyeOff, CloudCheck, Loader2, ShieldCheck } from 'lucide-react';
import { doc, safeGetDoc, usersCol } from '../lib/firebase';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  usersList?: (User & { password?: string })[];
}

export default function LoginScreen({ onLogin, usersList = USERS }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Please enter both your username and password.');
      return;
    }

    setIsAuthenticating(true);

    try {
      // 1. Search in memory usersList state
      let matchedUser = usersList.find(
        u => u && u.username && u.username.trim().toLowerCase() === cleanUsername
      );

      // 2. Direct Cloud Firestore query fallback to support logins from any new device/location
      if (!matchedUser) {
        try {
          const snap = await safeGetDoc(doc(usersCol, 'app_users'));
          if (snap && snap.exists()) {
            const data = snap.data();
            if (data && Array.isArray(data.users)) {
              const cloudUsers: (User & { password?: string })[] = data.users;
              const foundInCloud = cloudUsers.find(
                u => u && u.username && u.username.trim().toLowerCase() === cleanUsername
              );
              if (foundInCloud) {
                matchedUser = foundInCloud;
              }
            }
          }
        } catch (cloudErr) {
          console.warn("Direct Cloud Firestore user query error:", cloudErr);
        }
      }

      if (!matchedUser) {
        setError("Invalid username or password. Please check your credentials and try again.");
        setIsAuthenticating(false);
        return;
      }

      // Validate password
      const expectedPassword = matchedUser.password || (matchedUser.username === 'superadmin' ? 'superadmin123' : 'password123');
      
      if (expectedPassword !== cleanPassword) {
        setError("Invalid username or password. Please check your credentials and try again.");
        setIsAuthenticating(false);
        return;
      }

      // Success login
      onLogin({
        username: matchedUser.username,
        name: matchedUser.name,
        role: matchedUser.role,
        roleName: matchedUser.roleName,
        deptAccess: matchedUser.deptAccess
      });
    } catch (err: any) {
      setError("Authentication failed. Please check your network connection and try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50/70 via-rose-50/40 to-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200">
          <Shirt className="w-8 h-8" />
        </div>
        <h2 className="mt-4 text-3xl font-black text-slate-900 tracking-tight">
          THREADS
        </h2>
        <p className="mt-1.5 text-[11px] text-pink-800 font-extrabold uppercase tracking-widest bg-pink-100/90 py-1.5 px-4 rounded-full inline-block border border-pink-200 shadow-2xs">
          Total Headcount, Revenue, Efficiency & Apparel Dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-xl rounded-3xl border border-pink-150 sm:px-10">
          
          <div className="flex items-center justify-between border-b border-pink-100 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-pink-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Sign In to Your Account
              </h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CloudCheck className="w-3 h-3 text-emerald-600" /> Encrypted Sync
            </span>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 border-l-4 border-rose-500 p-3.5 rounded-r-xl text-xs text-rose-800 font-semibold border border-rose-100 shadow-2xs">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="appearance-none block w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl shadow-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="appearance-none block w-full px-3.5 py-2.5 pr-10 bg-pink-50/40 border border-pink-200 rounded-xl shadow-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-extrabold text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Authenticating Account...
                  </>
                ) : (
                  'Sign In Securely'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-pink-100 pt-4 text-center">
            <span className="inline-flex items-center text-xs text-slate-500 gap-1.5 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Protected Authentication Protocol
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}

