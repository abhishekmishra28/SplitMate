import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { SplitSquareHorizontal, Eye, EyeOff, Zap } from 'lucide-react';



export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {

      let result;

      if (mode === "login") {

        result = await login(
          form.email,
          form.password
        );

      } else {

        if (!form.name.trim()) {
          toast.error("Name is required");
          return;
        }

        if (form.password.length < 6) {
          toast.error(
            "Password must be at least 6 characters"
          );
          return;
        }

        result = await register(
          form.name.trim(),
          form.email,
          form.password
        );
      }

      if (result.success) {

        toast.success(
          mode === "login"
            ? "Welcome back!"
            : "Account created!"
        );

        navigate("/dashboard");

      } else {

        toast.error(
          result.error ||
          "Authentication failed"
        );
      }

    } catch (error) {

      toast.error(
        "Something went wrong"
      );

      console.error(error);

    } finally {

      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-900/50 mb-4">
            <SplitSquareHorizontal className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SplitMate</h1>
          <p className="text-gray-400 mt-1">Shared expenses, simplified</p>
        </div>

        {/* Auth Card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex bg-gray-800/60 rounded-xl p-1 mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  mode === m ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors text-sm"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={mode === 'register' ? 'Min 6 characters' : 'Your password'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors text-sm pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white rounded-xl py-2.5 font-medium text-sm transition-colors"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>


        {/* Demo Users */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-4">Or sign in directly as a Demo User</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {[
              { email: 'aisha@demo.com', pass: 'demo123', name: 'Aisha' },
              { email: 'rohan@demo.com', pass: 'demo123', name: 'Rohan' },
              { email: 'priya@demo.com', pass: 'demo123', name: 'Priya' },
              { email: 'meera@demo.com', pass: 'demo123', name: 'Meera' },
              { email: 'sam@demo.com', pass: 'demo123', name: 'Sam' },
              { email: 'dev@demo.com', pass: 'demo123', name: 'Dev' }
            ].map((demo, i) => (
              <button
                key={demo.email}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await login(demo.email, demo.pass);
                    if (res.success) {
                      toast.success("Welcome back, " + demo.name + "!");
                      navigate("/dashboard");
                    } else {
                      toast.error(res.error || "Demo login failed");
                    }
                  } catch (error) {
                    toast.error("Something went wrong");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-3 py-2 text-xs font-medium transition-colors capitalize flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                {demo.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
