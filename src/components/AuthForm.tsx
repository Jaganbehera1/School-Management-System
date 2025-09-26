import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, User, Mail, Lock, GraduationCap, Shield, X, Crown, BookOpen, Users, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuthFormProps {
  initialIsLogin?: boolean;
  defaultRole?: 'student' | 'teacher' | 'admin';
  onClose?: () => void;
  onSuccess?: () => void;
}

type AuthRole = 'student' | 'teacher' | 'admin' | null;

export function AuthForm({ initialIsLogin = true, defaultRole = 'student', onClose, onSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AuthRole>(null);
  const [roleValidationError, setRoleValidationError] = useState('');
  const [adminAccessCode, setAdminAccessCode] = useState('');
  const { signIn, signUp, user, validateRole } = useAuth(); // Add validateRole here

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
    
    if (isLogin && !selectedRole) {
      toast.error('Please select a role to continue');
      return;
    }
    
    setLoading(true);
    setRoleValidationError('');

    try {
      if (isLogin) {
        // First validate the role before attempting login
        if (selectedRole) {
          const isValidRole = await validateRole(formData.email, selectedRole);
          
          if (!isValidRole) {
            setRoleValidationError(`This email is not registered as a ${selectedRole} account. Please select the correct role.`);
            toast.error(`Invalid role selection!`);
            return;
          }
        }

        // If role validation passes, proceed with login
        const { error } = await signIn(formData.email, formData.password, selectedRole || undefined);
        
        if (error) {
          toast.error(error.message || 'Invalid login credentials');
          return;
        }

        toast.success(`Signed in as ${selectedRole} successfully!`);
        if (onSuccess) onSuccess();
      } else {
        if (!canCreateAccount) {
          toast.error('Only administrators can create new accounts. Please contact your admin.');
          return;
        }
      
        const { data, error } = await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          formData.role,
          formData.role === 'student' ? formData.roll_no : undefined,
          formData.role === 'student' ? formData.class : undefined,
          false
        );
      
        if (error) {
          toast.error(error.message || 'Failed to create account');
          return;
        }
      
        if (data?.user) {
          toast.success('Account created successfully!');
          setFormData(prev => ({
            ...prev,
            password: '',
            fullName: '',
            roll_no: '',
            class: '',
          }));
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
    if (roleValidationError) {
      setRoleValidationError('');
    }
  };

  const handleRoleSelect = (role: AuthRole) => {
    setSelectedRole(role);
    if (role) {
      setFormData(prev => ({ ...prev, role }));
    }
    if (roleValidationError) {
      setRoleValidationError('');
    }
  };

  const roleConfig = {
    admin: {
      icon: Crown,
      title: 'Administrator',
      description: 'Manage system settings, users, and overall platform',
      gradient: 'from-red-500 to-orange-500',
      bgGradient: 'from-red-50 to-orange-50',
      borderColor: 'border-red-200'
    },
    teacher: {
      icon: BookOpen,
      title: 'Teacher',
      description: 'Manage classes, assignments, and student progress',
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      borderColor: 'border-blue-200'
    },
    student: {
      icon: Users,
      title: 'Student',
      description: 'Access courses, submit assignments, and track progress',
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 to-emerald-50',
      borderColor: 'border-green-200'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl"
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-500 hover:text-gray-700 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>
        )}

        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="grid md:grid-cols-2 min-h-[600px]">
            {/* Left Side - Role Selection */}
            <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8 text-white">
              <div className="h-full flex flex-col justify-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center mb-8"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <GraduationCap className="w-10 h-10 text-white" />
                  </div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    School Management
                  </h1>
                  <p className="text-gray-300 mt-3 text-lg">
                    {isLogin ? 'Select your role to continue' : 'Create New Account'}
                  </p>
                </motion.div>

                <div className="space-y-6">
                  {(Object.entries(roleConfig) as [keyof typeof roleConfig, any][]).map(([role, config]) => {
                    const IconComponent = config.icon;
                    const isSelected = selectedRole === role;
                    
                    return (
                      <motion.button
                        key={role}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleRoleSelect(role as AuthRole)}
                        className={`w-full p-6 rounded-2xl text-left transition-all duration-300 border-2 ${
                          isSelected 
                            ? `bg-white/10 border-white/30 shadow-2xl` 
                            : `bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20`
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-xl bg-gradient-to-r ${config.gradient} shadow-lg`}>
                            <IconComponent className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{config.title}</h3>
                            <p className="text-gray-300 text-sm mt-1">{config.description}</p>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-3 h-3 bg-green-400 rounded-full"
                            />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Side - Form */}
            <div className="p-8 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {isLogin && !selectedRole ? (
                  <motion.div
                    key="role-selection"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                  >
                    <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Select Your Role</h2>
                    <p className="text-gray-600">Please choose your role to continue with login</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="auth-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold text-gray-800 mb-2">
                        {isLogin ? 'Welcome Back!' : 'Create Account'}
                      </h2>
                      {selectedRole && (
                        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-gray-100 to-gray-200 px-4 py-2 rounded-full">
                          {(() => {
                            const IconComponent = roleConfig[selectedRole].icon;
                            return <IconComponent className="w-4 h-4" />;
                          })()}
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {selectedRole} Account
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Role Validation Error */}
                    {roleValidationError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl"
                      >
                        <div className="flex items-center space-x-2 text-red-800">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">Role Validation Error</span>
                        </div>
                        <p className="text-red-700 text-sm mt-1">{roleValidationError}</p>
                      </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {!isLogin && (
                        <>
                          {!user && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
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
                            placeholder={`Enter ${selectedRole} email`}
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
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <div className="flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            {isLogin ? 'Verifying Role...' : 'Creating Account...'}
                          </div>
                        ) : (
                          isLogin ? `Sign In as ${selectedRole}` : 'Create Account'
                        )}
                      </motion.button>
                    </form>

                    <div className="mt-6 text-center">
                      <button
                        onClick={() => {
                          setIsLogin(!isLogin);
                          setSelectedRole(null);
                          setRoleValidationError('');
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}