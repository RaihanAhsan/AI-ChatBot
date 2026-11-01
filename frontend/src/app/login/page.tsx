"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiLogin,
  apiRegister,
  getSavedUser,
  saveAuthSession,
} from "@/lib/hotelApi";

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Register State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCity, setRegCity] = useState("Jakarta, Indonesia");
  const [regPass, setRegPass] = useState("");
  const [regConfirmPass, setRegConfirmPass] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in (e.g. reopened browser), redirect straight to /dashboard
  useEffect(() => {
    const existing = getSavedUser();
    if (existing) {
      saveAuthSession(existing);
      router.replace("/dashboard");
    } else {
      setCheckingSession(false);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const email = loginEmail.trim().toLowerCase();
    const pass = loginPass.trim();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!pass) {
      setErrorMsg("Password is required.");
      return;
    }

    setLoading(true);
    try {
      const profile = await apiLogin(email, pass);
      saveAuthSession(profile);
      router.replace("/dashboard");
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          "Invalid email or password. Please create an account if you are new."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const name = regName.trim();
    const email = regEmail.trim().toLowerCase();
    const phone = regPhone.trim() || "+62 812 3456 7890";
    const city = regCity.trim() || "Jakarta, Indonesia";
    const pass = regPass.trim();
    const confirm = regConfirmPass.trim();

    if (!name || name.length < 2) {
      setErrorMsg("Full name is required (at least 2 characters).");
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!pass || pass.length < 4) {
      setErrorMsg("Password must be at least 4 characters.");
      return;
    }
    if (pass !== confirm) {
      setErrorMsg("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      const profile = await apiRegister({
        name,
        email,
        phone,
        city,
        password: pass,
      });
      saveAuthSession(profile);
      router.replace("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register account.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400/20 border-t-gold-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left / Visual */}
      <div className="relative hidden lg:block overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80"
          className="absolute inset-0 h-full w-full object-cover ken-burns"
          alt="Luxury hotel"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900/95 via-ink-900/70 to-gold-900/30"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(220,174,58,.18),transparent_55%)]"></div>

        <div className="relative z-10 flex h-full flex-col justify-between p-14">
          <div className="flex items-center gap-3 animate-fade-up">
            <div className="grid h-11 w-11 place-items-center rounded-full border border-gold-400/50 bg-gold-400/10">
              <svg
                className="h-5 w-5 text-gold-300"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
              </svg>
            </div>
            <span className="font-serif text-xl tracking-wide text-white">
              Aurelia
            </span>
          </div>

          <div>
            <p className="mb-5 text-[11px] tracking-[.5em] text-gold-300/90 animate-fade-up">
              EST. 1998
            </p>
            <h1 className="font-serif text-[3.6rem] leading-[1.05] text-white animate-fade-up">
              Where every
              <br />
              stay becomes
              <br />
              <span className="gold-shimmer">a legend.</span>
            </h1>
            <p className="mt-7 max-w-sm text-sm leading-relaxed text-white/55 animate-fade-up">
              A curated collection of five-star hotels in the world&apos;s most
              extraordinary destinations. 24-hour personal butler service,
              bespoke spas, and unforgettable stays.
            </p>

            <div className="mt-10 flex items-center gap-6 animate-fade-up">
              <div>
                <p className="font-serif text-2xl text-gold-300">120+</p>
                <p className="text-[11px] tracking-widest text-white/40">
                  PROPERTIES
                </p>
              </div>
              <div className="h-8 w-px bg-white/15"></div>
              <div>
                <p className="font-serif text-2xl text-gold-300">4.9</p>
                <p className="text-[11px] tracking-widest text-white/40">
                  RATING
                </p>
              </div>
              <div className="h-8 w-px bg-white/15"></div>
              <div>
                <p className="font-serif text-2xl text-gold-300">38</p>
                <p className="text-[11px] tracking-widest text-white/40">
                  COUNTRIES
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] tracking-widest text-white/25 animate-fade-in">
            © 2025 AURELIA COLLECTION
          </p>
        </div>
      </div>

      {/* Right / Auth Form */}
      <div className="relative flex items-center justify-center overflow-hidden bg-ink-900 px-6 py-12">
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold-500/10 blur-[120px]"></div>
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-gold-700/10 blur-[120px]"></div>

        <div className="relative w-full max-w-md animate-fade-up">
          {/* Mode Switch Tabs */}
          <div className="mb-7 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[.03] p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg("");
              }}
              className={`rounded-xl py-2.5 text-xs font-semibold transition ${
                mode === "login"
                  ? "bg-gradient-to-r from-gold-400 to-gold-600 text-ink-900"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setErrorMsg("");
              }}
              className={`rounded-xl py-2.5 text-xs font-semibold transition ${
                mode === "register"
                  ? "bg-gradient-to-r from-gold-400 to-gold-600 text-ink-900"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {mode === "login" ? (
            <>
              <p className="text-[11px] tracking-[.35em] text-gold-400 mb-2">
                WELCOME BACK
              </p>
              <h2 className="font-serif text-4xl text-white mb-2">
                Sign in to your account
              </h2>
              <p className="text-sm text-white/40 mb-7">
                Access your reservations, reward points, and 24/7 personal
                concierge service.
              </p>

              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div>
                  <label className="label-xs">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="label-xs">Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      placeholder="••••••••"
                      className="input-field pr-16"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-gold-300"
                    >
                      {showPwd ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full py-3.5 text-sm tracking-wide"
                >
                  {loading ? "Verifying…" : "Sign In Now →"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-white/40">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErrorMsg("");
                  }}
                  className="font-medium text-gold-400 hover:text-gold-300 underline"
                >
                  Register for free here
                </button>
              </p>

              {/* Quick Fill Helper for Testing Demo Account */}
              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.02] p-3.5 text-center">
                <p className="text-[11px] text-white/35">
                  Registered demo account:{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail("demo@aurelia.com");
                      setLoginPass("123456");
                      setErrorMsg("");
                    }}
                    className="font-medium text-gold-300 underline hover:text-gold-200"
                  >
                    demo@aurelia.com / 123456
                  </button>
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] tracking-[.35em] text-gold-400 mb-2">
                EXCLUSIVE MEMBERSHIP
              </p>
              <h2 className="font-serif text-4xl text-white mb-2">
                Create New Account
              </h2>
              <p className="text-sm text-white/40 mb-6">
                Join as a Gold Member and enjoy seamless luxury reservations.
              </p>

              <form onSubmit={handleRegister} className="space-y-4" noValidate>
                <div>
                  <label className="label-xs">Full Name *</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Full name as on ID / Passport"
                    className="input-field"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-xs">Email *</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@email.com"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-xs">Phone Number *</label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+62 812 3456 7890"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label-xs">City / Country</label>
                  <input
                    type="text"
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    placeholder="Jakarta, Indonesia"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-xs">Password *</label>
                    <input
                      type="password"
                      value={regPass}
                      onChange={(e) => setRegPass(e.target.value)}
                      placeholder="Min. 4 characters"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-xs">Confirm Password *</label>
                    <input
                      type="password"
                      value={regConfirmPass}
                      onChange={(e) => setRegConfirmPass(e.target.value)}
                      placeholder="Repeat password"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                {errorMsg && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full py-3.5 text-sm tracking-wide"
                >
                  {loading
                    ? "Creating Account…"
                    : "Register & Continue to Dashboard →"}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-white/40">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg("");
                  }}
                  className="font-medium text-gold-400 hover:text-gold-300 underline"
                >
                  Sign in here
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
