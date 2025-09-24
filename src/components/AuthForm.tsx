import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, User, Mail, Lock, GraduationCap, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuthFormProps {
  initialIsLogin?: boolean;
  defaultRole?: 'student' | 'teacher' | 'admin';
  onClose?: () => void;
  onSuccess?: () => void;
}

export function AuthForm({ initialIsLogin = true, defaultRole = 'student', onClose, onSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminAccessCode, setAdminAccessCode] = useState('');
  const { signIn, signUp, user } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: defaultRole as 'teacher' | 'student' | 'admin',
    roll_no: '',
    class: '',
  });

  // Only allow signup if user is admin or has admin access code
  const canCreateAccount = user?.profile?.role === 'admin' || adminAccessCode === 'ADMIN123';

  useEffect(() => {
    setIsLogin(initialIsLogin);
    setFormData(prev => ({ ...prev, role: defaultRole }));
  }, [initialIsLogin, defaultRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // In your AuthForm's handleSubmit function:
          
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast.error(error.message || 'Invalid login credentials');
          return;
        }
        toast.success('Signed in successfully!');
        if (onSuccess) onSuccess();
      } else {
        if (!canCreateAccount) {
          toast.error('Only administrators can create new accounts. Please contact your admin.');
          return;
        }
      
        // For admin-created accounts, pass autoSignIn: false
        const { data, error } = await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          formData.role,
          formData.role === 'student' ? formData.roll_no : undefined,
          formData.role === 'student' ? formData.class : undefined,
          false // This prevents auto sign-in for admin-created accounts
        );
      
        if (error) {
          toast.error(error.message || 'Failed to create account');
          return;
        }
      
        if (data?.user) {
          toast.success('Account created successfully!');
          
          // Reset form fields
          setFormData(prev => ({
            ...prev,
            password: '',
            fullName: '',
            roll_no: '',
            class: '',
          }));
          
          // Call the success callback to refresh AdminDashboard
          if (onSuccess) onSuccess();
        }
      }
    } catch (error: any) {
      console.error('Unexpected authentication error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex justify-center p-4 overflow-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Modal Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        )}

        {/* Logo and Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          >
            <GraduationCap className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            School Management
          </h1>
          <p className="text-gray-600 mt-2">
            {isLogin ? 'Welcome back!' : 'Create New Account'}
          </p>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <>
                {!user && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center mb-2">
                      <Shield className="w-5 h-5 text-yellow-600 mr-2" />
                      <p className="text-sm font-medium text-yellow-800">Admin Access Required</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-yellow-700 mb-2">
                        Admin Access Code
                      </label>
                      <input
                        type="password"
                        value={adminAccessCode}
                        onChange={(e) => setAdminAccessCode(e.target.value)}
                        className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="Enter admin access code"
                        required={!user}
                      />
                      <p className="text-xs text-yellow-600 mt-1">
                        Only administrators can create new accounts
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter full name"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>

                {formData.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Roll Number
                      </label>
                      <input
                        type="text"
                        name="roll_no"
                        value={formData.roll_no}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter roll number"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Class
                      </label>
                      <input
                        type="text"
                        name="class"
                        value={formData.class}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter class"
                        required
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading || (!isLogin && !canCreateAccount)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {isLogin ? 'Create New Account' : 'Back to Login'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}