import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  updateDoc,
  doc,
  orderBy,
  limit,
  setDoc,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { 
  Clock, 
  Users, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  LogIn, 
  LogOut,
  UserCheck,
  BookOpen,
  FileText,
  MapIcon,
  RefreshCw,
  X,
  User,
  ThumbsUp,
  ThumbsDown,
  Clock as ClockIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CheckCircle as CheckCircleIcon,
  XCircle,
  CalendarDays,
  Megaphone,
  Plus,
  School,
  Award,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, differenceInDays } from 'date-fns';

// Helper functions
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalFormattedDate = () => {
  return new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const formatLocalTime = (dateString: string | null) => {
  if (!dateString || dateString === "") return '-';
  try {
    const date = new Date(dateString);
    return format(date, 'h:mm a');
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return '-';
  }
};

// Keep this at the top level of your file
function getDateFolder(date: Date = new Date()) {
  const month = date.toLocaleString("default", { month: "short" });
  const day = date.getDate();
  return `${month}_${day}`;
}

// Add distance calculation function
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in meters
  
  return distance;
};

// Fixed location configuration (REPLACE WITH YOUR ACTUAL COORDINATES)
const FIXED_LOCATION = {
  latitude: 20.296499, // Replace with your school's latitude
  longitude: 85.835776 // Replace with your school's longitude
};
const ALLOWED_RADIUS_METERS = 200;

interface AttendanceRecord {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_address: string | null;
  check_out_address: string | null;
  total_hours: string | null;
  dateFolder?: string;
}

interface LeaveApplication {
  id: string;
  teacher_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  dateFolder?: string;
  duration?: number;
  leave_balance_before?: LeaveQuota;
  leave_balance_after?: LeaveQuota;
  processed?: boolean;
}

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class: string;
}

// Update your Announcement interface in Teacher Dashboard
interface Announcement {
  id?: string;
  title: string;
  message: string; // Changed from 'content'
  priority: 'low' | 'medium' | 'high';
  target_audience: 'all' | 'students' | 'teachers' | 'parents';
  expiry_date: string;
  created_at: string;
  created_by: string; // Changed from 'author'
}

interface LeaveQuota {
  casual: number;
  medical: number;
  emergency: number;
  personal: number;
}

interface TeacherInfo {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  subject: string;
  class: string;
  employment_type: string;
  class_id?: string;
}

const calculateLeaveDuration = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return differenceInDays(end, start) + 1;
};

export function TeacherDashboard() {
  const { user, profile } = useAuth();
  const { getCurrentLocation, getAddressFromCoordinates, loading: locationLoading, error: locationError } = useLocation();
  
  // State declarations
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
  });
  
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<'check-in' | 'check-out' | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showStudentAttendanceModal, setShowStudentAttendanceModal] = useState(false);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [allLeaveHistory, setAllLeaveHistory] = useState<LeaveApplication[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [activeTab, setActiveTab] = useState('overview');
  const [leaveHistoryPage, setLeaveHistoryPage] = useState(1);
  const [leaveHistoryLoading, setLeaveHistoryLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [detailedView, setDetailedView] = useState<'attendance' | 'leaves' | 'students' | null>(null);
  const [processingLeaves, setProcessingLeaves] = useState<Set<string>>(new Set());
  
  const [leaveBalance, setLeaveBalance] = useState<LeaveQuota>({
    casual: 12,
    medical: 15,
    emergency: 5,
    personal: 8
  });

  const [leaveForm, setLeaveForm] = useState({
    type: 'casual' as 'casual' | 'medical' | 'emergency' | 'personal',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const LEAVES_PER_PAGE = 10;
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (user?.uid) {
      loadTeacherData();
      loadLeaveApplications();
      loadAllLeaveHistory();
      loadAnnouncements();
    }
  }, [user]);

  useEffect(() => {
    if (showStudentAttendanceModal) {
      loadStudents();
    }
  }, [showStudentAttendanceModal, selectedDate]);

  useEffect(() => {
  if (showStudentAttendanceModal && students.length > 0) {
    loadStudentAttendanceForDate();
  }
}, [selectedDate, showStudentAttendanceModal]);

  // Auto-refresh only for leave history
  useEffect(() => {
    if (user?.uid && teacherInfo) {
      const intervalId = setInterval(() => {
        loadAllLeaveHistory();
      }, 10000);

      return () => clearInterval(intervalId);
    }
  }, [user, teacherInfo]);

  useEffect(() => {
    console.log('Leave Applications:', leaveApplications);
    console.log('Leave Balance:', leaveBalance);
    console.log('All Leave History:', allLeaveHistory);
  }, [leaveApplications, leaveBalance, allLeaveHistory]);

  const getDateFolderFromDateString = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return getDateFolder(date); // Use the top-level function
    } catch (error) {
      console.error('Error creating date folder:', error);
      return getDateFolder(); // Fallback to today's folder
    }
  };
  
  // In your Teacher Dashboard component
  const loadAnnouncements = async () => {
    try {
      const today = new Date().toISOString();

      // Query announcements that haven't expired and are targeted to teachers or all
      const announcementsQuery = query(
        collection(db, 'announcements'),
        where('expiry_date', '>=', today),
        where('target_audience', 'in', ['all', 'teachers']),
        orderBy('expiry_date'),
        orderBy('created_at', 'desc'),
        limit(5)
      );

      const announcementsSnapshot = await getDocs(announcementsQuery);
      const announcementsData = announcementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];

      setAnnouncements(announcementsData);
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  };

  const loadLeaveBalance = async (teacherId: string) => {
    try {
      // First try to get teacher-specific balance
      const balanceDoc = await getDoc(doc(db, 'teacher_leave_balance', teacherId));

      if (balanceDoc.exists()) {
        const balanceData = balanceDoc.data();

        // Check if the data has the expected structure
        if (balanceData && typeof balanceData === 'object') {
          // Extract just the balance values
          const currentBalance: LeaveQuota = {
            casual: typeof balanceData.casual === 'number' ? balanceData.casual : 12,
            medical: typeof balanceData.medical === 'number' ? balanceData.medical : 15,
            emergency: typeof balanceData.emergency === 'number' ? balanceData.emergency : 5,
            personal: typeof balanceData.personal === 'number' ? balanceData.personal : 8
          };

          setLeaveBalance(currentBalance);
          return currentBalance;
        }
      }

      // If no valid balance exists, create one with default quotas
      const defaultQuotasDoc = await getDoc(doc(db, 'leave_quotas', 'teacher'));
      let defaultQuotas: LeaveQuota = {
        casual: 12,
        medical: 15,
        emergency: 5,
        personal: 8
      };

      if (defaultQuotasDoc.exists()) {
        const quotasData = defaultQuotasDoc.data();
        defaultQuotas = {
          casual: typeof quotasData.casual === 'number' ? quotasData.casual : 12,
          medical: typeof quotasData.medical === 'number' ? quotasData.medical : 15,
          emergency: typeof quotasData.emergency === 'number' ? quotasData.emergency : 5,
          personal: typeof quotasData.personal === 'number' ? quotasData.personal : 8
        };
      }

      // Create a new leave balance document for the teacher
      await setDoc(doc(db, 'teacher_leave_balance', teacherId), defaultQuotas);
      setLeaveBalance(defaultQuotas);
      return defaultQuotas;

    } catch (error) {
      console.error('Error loading leave balance:', error);
      // Fallback to default values
      const defaultQuotas: LeaveQuota = {
        casual: 12,
        medical: 15,
        emergency: 5,
        personal: 8
      };
      setLeaveBalance(defaultQuotas);
      return defaultQuotas;
    }
  };

  const checkAndResetLeaveBalance = async (teacherId: string, currentBalance: LeaveQuota) => {
    try {
      // Check if we need to reset leave balances (yearly reset)
      const resetDoc = await getDoc(doc(db, 'leave_reset_dates', teacherId));
      const currentYear = new Date().getFullYear();

      let needsReset = false;

      if (!resetDoc.exists()) {
        needsReset = true;
      } else {
        const resetData = resetDoc.data();
        needsReset = resetData.year < currentYear;
      }

      if (needsReset) {
        // Get default quotas
        const defaultQuotasDoc = await getDoc(doc(db, 'leave_quotas', 'teacher'));
        let defaultQuotas: LeaveQuota = {
          casual: 12,
          medical: 15,
          emergency: 5,
          personal: 8
        };

        if (defaultQuotasDoc.exists()) {
          const quotasData = defaultQuotasDoc.data();
          defaultQuotas = {
            casual: typeof quotasData.casual === 'number' ? quotasData.casual : 12,
            medical: typeof quotasData.medical === 'number' ? quotasData.medical : 15,
            emergency: typeof quotasData.emergency === 'number' ? quotasData.emergency : 5,
            personal: typeof quotasData.personal === 'number' ? quotasData.personal : 8
          };
        }

        // Update the balance and reset date
        await runTransaction(db, async (transaction) => {
          transaction.set(doc(db, 'teacher_leave_balance', teacherId), defaultQuotas);
          transaction.set(doc(db, 'leave_reset_dates', teacherId), { 
            year: currentYear,
            resetAt: new Date().toISOString()
          });
        });

        setLeaveBalance(defaultQuotas);
        return defaultQuotas;
      }

      return currentBalance;
    } catch (error) {
      console.error('Error checking/resetting leave balance:', error);
      return currentBalance;
    }
  };

  const loadTeacherData = async () => {
    if (isLoadingRef.current) return;

    setRefreshing(true);
    isLoadingRef.current = true;
    try {
      const teachersQuery = query(
        collection(db, "teachers"),
        where("user_id", "==", user!.uid)
      );
      const teachersSnapshot = await getDocs(teachersQuery);

      if (!teachersSnapshot.empty) {
        const teacherDoc = teachersSnapshot.docs[0];
        const teacherData = { 
          id: teacherDoc.id, 
          ...teacherDoc.data() 
        } as TeacherInfo;
        
        setTeacherInfo(teacherData);

        // Load leave balance and check for yearly reset
        const currentBalance = await loadLeaveBalance(teacherDoc.id);
        await checkAndResetLeaveBalance(teacherDoc.id, currentBalance);

        const today = getLocalDateString();

        // 🔹 Helper to generate "Sep_15"
        const getDateFolder = (dateString: string) => {
          const dateObj = new Date(dateString);
          const month = dateObj.toLocaleString("default", { month: "short" });
          const day = dateObj.getDate();
          return `${month}_${day}`;
        };

        const todayFolder = getDateFolder(today);

        // 🔹 Fetch today's attendance from nested folder
        const todayAttendanceQuery = query(
          collection(db, "teacher_attendance", todayFolder, "records"),
          where("teacher_id", "==", teacherDoc.id),
          where("attendance_date", "==", today)
        );
        const todayAttendanceSnapshot = await getDocs(todayAttendanceQuery);

        if (!todayAttendanceSnapshot.empty) {
          const todayDoc = todayAttendanceSnapshot.docs[0];
          const attendanceData = {
            id: todayDoc.id,
            dateFolder: todayFolder,
            ...todayDoc.data(),
          } as AttendanceRecord;
          setTodayAttendance(attendanceData);
        } else {
          setTodayAttendance(null);
        }

        // 🔹 Recent attendance (last 7 days) across multiple folders
        const recentData: AttendanceRecord[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateString = d.toISOString().split("T")[0];
          const folder = getDateFolder(dateString);

          try {
            const snapshot = await getDocs(
              query(
                collection(db, "teacher_attendance", folder, "records"),
                where("teacher_id", "==", teacherDoc.id),
                where("attendance_date", "==", dateString)
              )
            );

            snapshot.forEach((doc) => {
              recentData.push({
                id: doc.id,
                dateFolder: folder,
                ...doc.data(),
              } as AttendanceRecord);
            });
          } catch (error) {
            console.log(`No attendance records for ${folder}`);
          }
        }

        // 🔹 Sort by date (latest first)
        recentData.sort(
          (a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime()
        );
        setRecentAttendance(recentData);
      } else {
        toast.error("Teacher profile not found. Please contact administrator.");
      }
    } catch (error) {
      console.error("Error loading teacher data:", error);
      toast.error("Failed to load teacher data");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  };

  const loadLeaveApplications = async () => {
    if (!teacherInfo) return;

    try {
      const leaveData: LeaveApplication[] = [];
      const today = new Date();

      // Check last 30 days for leave applications
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateFolder = getDateFolder(date);

        try {
          // CORRECTED PATH: collection → document → collection
          const applicationsRef = collection(
            db, 
            "leave_applications", 
            dateFolder, 
            "applications"
          );

          const applicationsQuery = query(
            applicationsRef,
            where("teacher_id", "==", teacherInfo.id),
            orderBy("created_at", "desc")
          );

          const applicationsSnapshot = await getDocs(applicationsQuery);

          applicationsSnapshot.forEach((doc) => {
            leaveData.push({
              id: doc.id,
              dateFolder: dateFolder,
              ...doc.data(),
            } as LeaveApplication);
          });
        } catch (error) {
          console.log(`No leave applications for ${dateFolder} or error:`, error);
          continue;
        }
      }

      // Sort by created_at (latest first)
      leaveData.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setLeaveApplications(leaveData);
    } catch (error) {
      console.error("Error loading leave applications:", error);
    }
  };

  const updateLeaveBalanceOnApproval = async (application: LeaveApplication) => {
    if (!teacherInfo || application.status !== 'approved' || application.processed) return;

    try {
      const duration = calculateLeaveDuration(application.start_date, application.end_date);

      // Update UI immediately for better user experience
      const newBalance = { ...leaveBalance };
      newBalance[application.type as keyof LeaveQuota] -= duration;
      setLeaveBalance(newBalance);

      console.log('Deducting leave:', {
        type: application.type,
        duration,
        before: leaveBalance[application.type as keyof LeaveQuota],
        after: newBalance[application.type as keyof LeaveQuota]
      });

      // Use a transaction to ensure atomic updates
      await runTransaction(db, async (transaction) => {
        // First, get the latest application data to check if it's already processed
        const applicationRef = doc(
          db, 
          "leave_applications", 
          application.dateFolder || getDateFolder(new Date(application.created_at)), 
          "applications", 
          application.id
        );

        const applicationDoc = await getDoc(applicationRef);
        if (!applicationDoc.exists() || applicationDoc.data().processed) {
          console.log('Leave already processed or does not exist, skipping');
          // Revert UI update if already processed
          setLeaveBalance(leaveBalance);
          return;
        }

        // Update the application
        transaction.update(applicationRef, {
          processed: true,
          leave_balance_after: newBalance,
          updated_at: new Date().toISOString()
        });

        // Update the teacher's leave balance
        const balanceRef = doc(db, 'teacher_leave_balance', teacherInfo.id);
        transaction.set(balanceRef, newBalance);
      });

      console.log('Leave processed successfully');

    } catch (error) {
      console.error('Error updating leave balance:', error);
      // Revert UI update on error
      setLeaveBalance(leaveBalance);

      // Don't show toast for transaction conflicts (common in race conditions)
      if (error.code !== 'failed-precondition') {
        toast.error('Failed to update leave balance');
      }
    }
  };

  // Batch process multiple leaves for better performance
  const processLeavesBatch = async (leaves: LeaveApplication[]) => {
    if (!teacherInfo || leaves.length === 0) return;

    try {
      // Get current balance once for all calculations from Firestore (not local state)
      const balanceDoc = await getDoc(doc(db, 'teacher_leave_balance', teacherInfo.id));
      let currentBalance = leaveBalance;

      if (balanceDoc.exists()) {
        const balanceData = balanceDoc.data() as Partial<LeaveQuota>;
        currentBalance = {
          casual: typeof balanceData.casual === 'number' ? balanceData.casual : 12,
          medical: typeof balanceData.medical === 'number' ? balanceData.medical : 15,
          emergency: typeof balanceData.emergency === 'number' ? balanceData.emergency : 5,
          personal: typeof balanceData.personal === 'number' ? balanceData.personal : 8
        };
      }

      // Calculate all deductions first
      const balanceUpdates: {[key: string]: number} = {};
      const leavesToProcess: LeaveApplication[] = [];

      for (const leave of leaves) {
        if (leave.status !== 'approved' || leave.processed) continue;

        const duration = calculateLeaveDuration(leave.start_date, leave.end_date);
        const leaveType = leave.type as keyof LeaveQuota;

        // Check if this deduction would result in negative balance
        if (currentBalance[leaveType] - duration < 0) {
          console.warn(`Cannot process leave ${leave.id}: Would result in negative ${leaveType} balance`);
          continue; // Skip this leave to prevent negative balance
        }

        if (!balanceUpdates[leaveType]) {
          balanceUpdates[leaveType] = 0;
        }
        balanceUpdates[leaveType] += duration;
        leavesToProcess.push(leave);
      }

      if (leavesToProcess.length === 0) return;

      // Calculate new balance based on ACTUAL current balance from Firestore
      const newBalance = { ...currentBalance };
      Object.entries(balanceUpdates).forEach(([type, deduction]) => {
        newBalance[type as keyof LeaveQuota] -= deduction;
      });

      // Process all leaves in a single transaction
      await runTransaction(db, async (transaction) => {
        for (const leave of leavesToProcess) {
          const applicationRef = doc(
            db, 
            "leave_applications", 
            leave.dateFolder || getDateFolder(new Date(leave.created_at)), 
            "applications", 
            leave.id
          );

          const applicationDoc = await getDoc(applicationRef);
          if (!applicationDoc.exists() || applicationDoc.data().processed) {
            continue; // Skip if already processed
          }

          // Update the application
          transaction.update(applicationRef, {
            processed: true,
            leave_balance_after: newBalance,
            updated_at: new Date().toISOString()
          });
        }

        // Update the teacher's leave balance
        const balanceRef = doc(db, 'teacher_leave_balance', teacherInfo.id);
        transaction.set(balanceRef, newBalance);
      });

      // Update UI only AFTER successful transaction
      setLeaveBalance(newBalance);
      console.log(`Processed ${leavesToProcess.length} leaves successfully`);

    } catch (error) {
      console.error('Error batch processing leaves:', error);
      // Reload balance to ensure UI is correct
      loadLeaveBalance(teacherInfo.id);
    }
  };

  // Update the useEffect to use batch processing
  useEffect(() => {
    if (!teacherInfo || allLeaveHistory.length === 0 || processingLeaves.size > 0) return;

    // Find approved applications that haven't been processed yet
    const unprocessedApprovedLeaves = allLeaveHistory.filter(
      leave => leave.status === 'approved' && !leave.processed && !processingLeaves.has(leave.id)
    );

    if (unprocessedApprovedLeaves.length > 0) {
      console.log('Found unprocessed approved leaves:', unprocessedApprovedLeaves.length);

      // Add all to processing set
      setProcessingLeaves(prev => {
        const newSet = new Set(prev);
        unprocessedApprovedLeaves.forEach(leave => newSet.add(leave.id));
        return newSet;
      });

      // Process all leaves in a batch
      processLeavesBatch(unprocessedApprovedLeaves).finally(() => {
        // Remove all from processing set
        setProcessingLeaves(prev => {
          const newSet = new Set(prev);
          unprocessedApprovedLeaves.forEach(leave => newSet.delete(leave.id));
          return newSet;
        });
      });
    }
  }, [allLeaveHistory, teacherInfo]);


  const refreshLeaveData = async () => {
    if (!teacherInfo) return;
    
    try {
      await loadLeaveApplications();
      await loadAllLeaveHistory();
      await loadLeaveBalance(teacherInfo.id);
      toast.success('Leave data refreshed');
    } catch (error) {
      console.error('Error refreshing leave data:', error);
      toast.error('Failed to refresh leave data');
    }
  };

  const loadAllLeaveHistory = async () => {
    if (!teacherInfo) return;

    setLeaveHistoryLoading(true);
    try {
      const leaveData: LeaveApplication[] = [];
      const today = new Date();

      for (let i = 0; i < 365; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateFolder = getDateFolder(date);

        try {
          // CORRECTED PATH: collection → document → collection
          const applicationsRef = collection(
            db, 
            "leave_applications", 
            dateFolder, 
            "applications"
          );

          const applicationsQuery = query(
            applicationsRef,
            where("teacher_id", "==", teacherInfo.id),
            orderBy("created_at", "desc")
          );

          const applicationsSnapshot = await getDocs(applicationsQuery);

          applicationsSnapshot.forEach((doc) => {
            leaveData.push({
              id: doc.id,
              dateFolder: dateFolder,
              ...doc.data(),
            } as LeaveApplication);
          });
        } catch (error) {
          console.log(`No leave applications for ${dateFolder} or error:`, error);
          continue;
        }
      }

      // Sort all by created_at descending
      leaveData.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setAllLeaveHistory(leaveData);
    } catch (error) {
      console.error("Error loading all leave history:", error);
    } finally {
      setLeaveHistoryLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      console.log('Loading students from Firestore...');

      const studentsQuery = query(collection(db, 'students'));
      const studentsSnapshot = await getDocs(studentsQuery);

      console.log('Students snapshot size:', studentsSnapshot.size);

      if (studentsSnapshot.size === 0) {
        console.log('No students found in the database');
        toast.error('No students found in the database. Please add students first.');
        setStudents([]);
        return [];
      }

      const studentsData = studentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.full_name || data.name || 'Unknown Student',
          roll_number: data.roll_number || data.roll_no || 'N/A',
          class: data.class || data.class_name || data.class_id || 'N/A',
        } as Student;
      });

      // Set students first
      setStudents(studentsData);

      // Initialize all as absent by default
      const initialAttendance: Record<string, 'present' | 'absent'> = {};
      studentsData.forEach(student => {
        initialAttendance[student.id] = 'absent';
      });
      setStudentAttendance(initialAttendance);

      // Now load existing attendance data for the selected date
      await loadStudentAttendanceForDate();

      return studentsData;
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students. Please check your database connection.');
      setStudents([]);
      return [];
    }
  };

  const loadStudentAttendanceForDate = async () => {
    if (!teacherInfo || students.length === 0) return;

    try {
      const dateFolder = getDateFolder(new Date(selectedDate)); 
      const attendanceQuery = query(
        collection(db, 'student_attendance', dateFolder, 'records'),
        where('date', '==', selectedDate)
      );

      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceData: Record<string, 'present' | 'absent'> = {};

      // Update with actual attendance data from ALL teachers
      attendanceSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.student_id) {
          attendanceData[data.student_id] = data.status;
        }
      });

      // Merge with existing studentAttendance state
      setStudentAttendance(prev => {
        const updatedAttendance = {...prev};

        // Update ALL students with the attendance records from database
        students.forEach(student => {
          if (attendanceData[student.id]) {
            updatedAttendance[student.id] = attendanceData[student.id];
          } else {
            // If no record exists, default to absent
            updatedAttendance[student.id] = 'absent';
          }
        });

        return updatedAttendance;
      });
    } catch (error) {
      console.error('Error loading student attendance:', error);
      toast.error('Failed to load student attendance data');
    }
  };

  const handleCheckIn = async () => {
    if (!teacherInfo) {
      await loadTeacherData();
      if (!teacherInfo) {
        toast.error("Teacher profile not loaded. Please try again.");
        return;
      }
    }

    setActionLoading("check-in");
    try {
      const location = await getCurrentLocation();
      
      // Calculate distance from fixed location
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        FIXED_LOCATION.latitude,
        FIXED_LOCATION.longitude
      );
      
      // Check if within allowed radius
      if (distance > ALLOWED_RADIUS_METERS) {
        toast.error(`You are ${Math.round(distance)} meters away from the school. Please move within ${ALLOWED_RADIUS_METERS} meters to check in.`);
        setActionLoading(null);
        return;
      }
      
      const address = await getAddressFromCoordinates(
        location.latitude,
        location.longitude
      );

      const today = getLocalDateString();
      const now = new Date().toISOString();

      // 🔹 Helper for folder name
      const getDateFolder = (dateString: string) => {
        const dateObj = new Date(dateString);
        const month = dateObj.toLocaleString("default", { month: "short" });
        const day = dateObj.getDate();
        return `${month}_${day}`;
      };

      const dateFolder = getDateFolder(today);

      // 🔹 Save inside teacher_attendance/{Sep_15}/records/...
      const attendanceRef = collection(
        db,
        "teacher_attendance",
        dateFolder,
        "records"
      );

      await addDoc(attendanceRef, {
        teacher_id: teacherInfo.id,
        attendance_date: today,
        check_in_time: now,
        check_in_location: `${location.latitude},${location.longitude}`,
        check_in_address: address,
        distance_from_school: Math.round(distance),
        created_at: now,
      });

      toast.success("Checked in successfully!");
      loadTeacherData();
    } catch (error: any) {
      console.error("Check-in error:", error);
      if (error.code === 1) {
        toast.error(
          "Location permission denied. Please enable location services to check in."
        );
      } else {
        toast.error(error.message || "Failed to check in");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckOut = async () => {
    if (!teacherInfo) {
      await loadTeacherData();
      if (!teacherInfo) {
        toast.error("Teacher profile not loaded. Please try again.");
        return;
      }
    }

    if (!todayAttendance) {
      toast.error("No check-in record found for today");
      return;
    }

    setActionLoading("check-out");
    try {
      const location = await getCurrentLocation();
      
      // Calculate distance from fixed location
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        FIXED_LOCATION.latitude,
        FIXED_LOCATION.longitude
      );
      
      // Check if within allowed radius
      if (distance > ALLOWED_RADIUS_METERS) {
        toast.error(`You are ${Math.round(distance)} meters away from the school. Please move within ${ALLOWED_RADIUS_METERS} meters to check out.`);
        setActionLoading(null);
        return;
      }

      const address = await getAddressFromCoordinates(
        location.latitude,
        location.longitude
      );

      const now = new Date().toISOString();
      const checkInTime = new Date(todayAttendance.check_in_time!);
      const checkOutTime = new Date(now);
      const totalHours =
        (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      // 🔹 Same helper used in check-in
      const getDateFolder = (dateString: string) => {
        const dateObj = new Date(dateString);
        const month = dateObj.toLocaleString("default", { month: "short" });
        const day = dateObj.getDate();
        return `${month}_${day}`;
      };

      const dateFolder = getDateFolder(todayAttendance.attendance_date);

      // 🔹 Update inside teacher_attendance/{Sep_15}/records/{docId}
      await updateDoc(
        doc(db, "teacher_attendance", dateFolder, "records", todayAttendance.id),
        {
          check_out_time: now,
          check_out_location: `${location.latitude},${location.longitude}`,
          check_out_address: address,
          total_hours: Math.round(totalHours * 100) / 100,
          distance_from_school_checkout: Math.round(distance),
          updated_at: now,
        }
      );

      toast.success("Checked out successfully!");
      loadTeacherData();
    } catch (error: any) {
      if (error.code === 1) {
        toast.error(
          "Location permission denied. Please enable location services to check out."
        );
      } else {
        toast.error(error.message || "Failed to check out");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!teacherInfo) {
      toast.error("Teacher information not loaded");
      return;
    }
  
    // Calculate leave duration
    const duration = calculateLeaveDuration(leaveForm.start_date, leaveForm.end_date);
  
    // Check if teacher has remaining leaves
    if (leaveBalance[leaveForm.type] < duration) {
      toast.error(`Not enough ${leaveForm.type} leaves available. You have ${leaveBalance[leaveForm.type]} days remaining but requested ${duration} days.`);
      return;
    }
  
    // Additional check to prevent negative balance
    if (leaveBalance[leaveForm.type] - duration < 0) {
      toast.error(`Cannot apply for leave: Would result in negative ${leaveForm.type} balance`);
      return;
    }
  
    try {
      const dateFolder = getDateFolder();
    
      // CORRECTED PATH: collection → document → collection
      const applicationsRef = collection(
        db,
        "leave_applications",
        dateFolder,
        "applications"
      );
    
      await addDoc(applicationsRef, {
        teacher_id: teacherInfo.id,
        applicant_name: profile?.full_name || 'Teacher',
        applicant_type: 'teacher',
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        duration: duration,
        reason: leaveForm.reason,
        type: leaveForm.type,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        leave_balance_before: leaveBalance,
        processed: false
      });
    
      toast.success("Leave application submitted successfully!");
      setShowLeaveModal(false);
      setLeaveForm({
        type: "casual",
        start_date: "",
        end_date: "",
        reason: "",
      });
    
      // Reload lists
      loadLeaveApplications();
      loadAllLeaveHistory();
    } catch (error) {
      console.error("Error submitting leave application:", error);
      toast.error("Failed to submit leave application");
    }
  };

  const handleStudentAttendanceSubmit = async () => {
    if (!teacherInfo) {
      toast.error("Teacher information not loaded");
      return;
    }

    try {
      const today = getLocalDateString();
      const dateFolder = getDateFolder(new Date(selectedDate));
      const studentAttendanceRef = collection(
        db,
        "student_attendance",
        dateFolder,
        "records"
      );

      // Check if attendance already exists for this date
      const existingSnapshot = await getDocs(
        query(
          studentAttendanceRef,
          where("date", "==", selectedDate)
        )
      );

      // Create a map of existing records by student_id for easy lookup
      const existingRecords: Record<string, any> = {};
      existingSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.student_id) {
          existingRecords[data.student_id] = { id: doc.id, data: data };
        }
      });

      const attendancePromises = Object.entries(studentAttendance).map(
        ([studentId, status]) => {
          // Check if record already exists for this student and date
          if (existingRecords[studentId]) {
            // Update existing record (regardless of which teacher created it)
            return updateDoc(doc(db, "student_attendance", dateFolder, "records", existingRecords[studentId].id), {
              status: status,
              updated_at: new Date().toISOString(),
              // Keep the original teacher_id who first created the record
              // or update to current teacher if you want to track who made the latest change
              last_updated_by: teacherInfo.id
            });
          } else {
            // Create new record
            return addDoc(studentAttendanceRef, {
              student_id: studentId,
              teacher_id: teacherInfo.id,
              date: selectedDate,
              status: status,
              created_at: new Date().toISOString(),
            });
          }
        }
      );

      await Promise.all(attendancePromises);
      toast.success(
        `Student attendance for ${selectedDate} recorded successfully!`
      );

      setShowStudentAttendanceModal(false);
    } catch (error) {
      console.error("Error recording student attendance:", error);
      toast.error("Failed to record student attendance");
    }
  };

  const toggleStudentAttendance = (studentId: string) => {
    setStudentAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present'
    }));
  };

  const handlePasswordChange = async () => {
    console.log('handlePasswordChange function called');
    const auth = getAuth();
    const user = auth.currentUser;
    console.log('Current user:', user);
  
    if (!user || !user.email) {
      toast.error('User not authenticated');
      return;
    }
  
    // Validate passwords
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
  
    if (passwordForm.newPassword.length < 6) {
      toast.error('Password should be at least 6 characters');
      return;
    }
  
    setPasswordLoading(true);
    
    try {
      // Reauthenticate user first (required for password change)
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordForm.currentPassword
      );
      
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, passwordForm.newPassword);
      
      toast.success('Password changed successfully!');
      setShowChangePassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Password change error:', error);
      
      if (error.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect');
      } else if (error.code === 'auth/requires-recent-login') {
        toast.error('Please log in again to change your password');
      } else {
        toast.error('Failed to change password: ' + error.message);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const loadDetailedData = async (type: 'attendance' | 'leaves' | 'students') => {
    try {
      if (type === 'attendance') {
        setDetailedView('attendance');
      } else if (type === 'leaves') {
        await loadAllLeaveHistory();
        setDetailedView('leaves');
      } else if (type === 'students') {
        await loadStudents();
        setDetailedView('students');
      }
    } catch (error) {
      console.error("Error loading detailed data:", error);
      toast.error("Error loading detailed information");
    }
  };

  // Calculate pagination for leave history
  const totalLeavePages = Math.ceil(allLeaveHistory.length / LEAVES_PER_PAGE);
  const paginatedLeaveHistory = allLeaveHistory.slice(
    (leaveHistoryPage - 1) * LEAVES_PER_PAGE,
    leaveHistoryPage * LEAVES_PER_PAGE
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <ThumbsUp className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <ThumbsDown className="w-4 h-4 text-red-600" />;
      default:
        return <ClockIcon className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Generate weekly calendar data
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Calculate attendance stats
  const attendanceStats = {
    present: recentAttendance.filter(a => a.check_in_time !== null).length,
    absent: 7 - recentAttendance.filter(a => a.check_in_time !== null).length,
    complete: recentAttendance.filter(a => a.check_out_time !== null).length,
    total: 7
  };

  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
    : 0;

  const statCards = [
    {
      title: 'Attendance %',
      value: `${attendancePercentage}%`,
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      onClick: () => loadDetailedData('attendance')
    },
    {
      title: 'Students',
      value: students.length,
      icon: Users,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50',
      iconColor: 'text-pink-600',
      onClick: () => loadDetailedData('students')
    },
    {
      title: 'Present Days',
      value: attendanceStats.present,
      icon: CheckCircleIcon,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      title: 'Absent Days',
      value: attendanceStats.absent,
      icon: XCircle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
    },
    {
      title: 'Complete Days',
      value: attendanceStats.complete,
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Leave Applications',
      value: allLeaveHistory.length,
      icon: FileText,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      onClick: () => loadDetailedData('leaves')
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!teacherInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-500 text-lg font-semibold">Teacher profile not found</div>
        <p className="text-gray-600">Please contact your administrator to set up your teacher profile.</p>
        <button 
          onClick={loadTeacherData}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {profile?.full_name || 'Teacher'}</p>
            {teacherInfo && (
              <div className="flex items-center mt-2 space-x-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <School className="w-4 h-4 mr-1" />
                  {teacherInfo.class || 'Not assigned'}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  <User className="w-4 h-4 mr-1" />
                  Subject: {teacherInfo.subject || 'Not specified'}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <Award className="w-4 h-4 mr-1" />
                  {teacherInfo.employment_type ? teacherInfo.employment_type.charAt(0).toUpperCase() + teacherInfo.employment_type.slice(1) : 'Teacher'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={loadTeacherData}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="flex items-center space-x-2">
              <Award className="w-8 h-8 text-yellow-500" />
              <span className="text-sm text-gray-600">Teacher</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-2xl shadow-sm p-2">
        <div className="flex space-x-1">
          {['overview', 'attendance', 'students', 'leaves', 'announcements', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <button className="flex items-center space-x-1 text-sm text-blue-600 font-medium hover:text-blue-800">
          <Download className="w-4 h-4" />
          <span>Export Report</span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-4 hover:shadow-xl transition-shadow duration-300 ${
                  stat.onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-500' : ''
                }`}
                onClick={stat.onClick}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-10 h-10 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Today's Attendance */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Today's Attendance</h2>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {getLocalFormattedDate()}
                    </span>
                    <button 
                      onClick={loadTeacherData}
                      className="p-1 hover:bg-gray-100 rounded-full"
                      title="Refresh attendance data"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Check In/Out Buttons */}
                  <div className="space-y-4">
                    {!todayAttendance?.check_in_time ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCheckIn}
                        disabled={actionLoading === 'check-in' || locationLoading}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        {actionLoading === 'check-in' ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Checking In...</span>
                          </>
                        ) : (
                          <>
                            <LogIn className="w-5 h-5" />
                            <span>Check In</span>
                          </>
                        )}
                      </motion.button>
                    ) : !todayAttendance?.check_out_time || todayAttendance.check_out_time === "" ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCheckOut}
                        disabled={actionLoading === 'check-out' || locationLoading}
                        className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        {actionLoading === 'check-out' ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Checking Out...</span>
                          </>
                        ) : (
                          <>
                            <LogOut className="w-5 h-5" />
                            <span>Check Out</span>
                          </>
                        )}
                      </motion.button>
                    ) : (
                      <div className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center space-x-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>Day Complete</span>
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      <p className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span>Location services required for attendance</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Must be within {ALLOWED_RADIUS_METERS} meters of school location
                      </p>
                    </div>

                    {locationError?.code === 1 && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm">
                          Location permission denied. Please enable location permissions in your browser settings.
                        </p>
                        <button 
                          onClick={() => window.location.reload()} 
                          className="mt-2 text-yellow-800 underline text-sm flex items-center"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reload page after enabling permissions
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Today's Status */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Today's Status</h3>
                    <div className="space-y-3">
                      {todayAttendance?.check_in_time && todayAttendance.check_in_time !== "" && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Check In:</span>
                          <span className="text-sm font-medium text-green-600">
                            {formatLocalTime(todayAttendance.check_in_time)}
                          </span>
                        </div>
                      )}
                      {todayAttendance?.check_out_time && todayAttendance.check_out_time !== "" && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Check Out:</span>
                          <span className="text-sm font-medium text-red-600">
                            {formatLocalTime(todayAttendance.check_out_time)}
                          </span>
                        </div>
                      )}
                      {todayAttendance?.total_hours && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Total Hours:</span>
                          <span className="text-sm font-medium text-blue-600">
                            {todayAttendance.total_hours} hrs
                          </span>
                        </div>
                      )}
                      {todayAttendance?.check_in_address && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500 flex items-start space-x-1">
                            <MapIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>{todayAttendance.check_in_address}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Weekly Calendar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <CalendarDays className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">This Week</h2>
                  </div>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-800">
                    View Full Calendar
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day, index) => {
                    const dayAttendance = recentAttendance.find(a => 
                      isSameDay(new Date(a.attendance_date), day)
                    );
                    
                    return (
                      <div 
                        key={index} 
                        className={`p-3 text-center rounded-xl ${
                          isToday(day)
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <p className="text-xs font-medium">{format(day, 'EEE')}</p>
                        <p className="text-sm font-bold mt-1">{format(day, 'd')}</p>
                        {dayAttendance && (
                          <div className={`mt-2 w-3 h-3 mx-auto rounded-full ${
                            dayAttendance.check_out_time 
                              ? 'bg-green-500' 
                              : dayAttendance.check_in_time
                              ? 'bg-blue-500'
                              : 'bg-red-500'
                          }`}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Recent Attendance */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Recent Attendance</h2>
                  </div>
                  <button 
                    onClick={() => loadDetailedData('attendance')}
                    className="text-sm text-blue-600 font-medium hover:text-blue-800"
                  >
                    View All
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Check In</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Check Out</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Hours</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAttendance.slice(0, 5).map((record) => (
                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            {format(new Date(record.attendance_date), 'MMM d, yyyy')}
                          </td>
                          <td className="py-3 px-4">
                            {record.check_in_time 
                              ? formatLocalTime(record.check_in_time)
                              : '-'
                            }
                          </td>
                          <td className="py-3 px-4">
                            {record.check_out_time 
                              ? formatLocalTime(record.check_out_time)
                              : '-'
                            }
                          </td>
                          <td className="py-3 px-4">
                            {record.total_hours ? `${record.total_hours}h` : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {record.check_out_time ? (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                Complete
                              </span>
                            ) : record.check_in_time ? (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                In Progress
                              </span>
                            ) : (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                                Absent
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Leave Balance (Yearly)</h3>
                <div className="flex items-center">
                  {processingLeaves.size > 0 && (
                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mr-2" />
                  )}
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(leaveBalance).map(([type, remaining]) => (
                  <div key={type} className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-800 capitalize">{type}</span>
                      <span className="text-lg font-bold text-blue-800">
                        {typeof remaining === 'number' ? remaining : 0}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${((typeof remaining === 'number' ? remaining : 0) / 
                            (type === 'casual' ? 12 : 
                             type === 'medical' ? 15 : 
                             type === 'emergency' ? 5 : 8)) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

              {/* Recent Announcements */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Megaphone className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Recent Announcements</h2>
                  </div>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-800">
                    View All
                  </button>
                </div>
                            
                <div className="space-y-4">
                  {announcements.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No announcements</p>
                    </div>
                  ) : (
                    announcements.slice(0, 3).map((announcement) => (
                      <div
                        key={announcement.id}
                        className="p-4 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                      >
                        <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                        {/* Change 'content' to 'message' */}
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{announcement.message}</p>
                        <div className="flex items-center justify-between mt-3">
                          {/* Change 'author' to 'created_by' */}
                          <span className="text-xs text-gray-500">{announcement.created_by}</span>
                          <span className="text-xs text-gray-500">
                            {/* Use the correct date field - either 'created_at' or format the date properly */}
                            {new Date(announcement.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Leave Applications */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Leave Applications</h2>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={refreshLeaveData}
                      className="p-1 hover:bg-gray-100 rounded-full"
                      title="Refresh leave data"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowLeaveModal(true)}
                      className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Apply</span>
                    </motion.button>
                  </div>
                </div>

                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {leaveApplications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No leave applications</p>
                    </div>
                  ) : (
                    leaveApplications.map((leave) => (
                      <div
                        key={leave.id}
                        className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {leave.type} Leave ({leave.duration || 1} day{leave.duration !== 1 ? 's' : ''})
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              {leave.start_date && format(new Date(leave.start_date), 'MMM d')} - {leave.end_date && format(new Date(leave.end_date), 'MMM d')}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            leave.status === 'approved' 
                              ? 'bg-green-100 text-green-800'
                              : leave.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1) : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{leave.reason}</p>
                        {leave.leave_balance_before && leave.leave_balance_after && (
                          <div className="mt-2 text-xs text-gray-500">
                            Balance: {leave.leave_balance_before[leave.type as keyof LeaveQuota]} → {leave.leave_balance_after[leave.type as keyof LeaveQuota]}
                          </div>
                        )}
                        <div className="flex items-center mt-3 text-xs text-gray-500">
                          <CalendarDays className="w-3 h-3 mr-1" />
                          Applied {leave.created_at ? format(new Date(leave.created_at), 'MMM d, yyyy') : 'Unknown date'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white"
              >
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowStudentAttendanceModal(true)}
                    className="flex items-center justify-between w-full p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <span>Student Attendance</span>
                    <UserCheck className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowLeaveModal(true)}
                    className="flex items-center justify-between w-full p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <span>Apply for Leave</span>
                    <FileText className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => loadDetailedData('students')}
                    className="flex items-center justify-between w-full p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <span>View Students</span>
                    <Users className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'settings' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Settings</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Notification Preferences</h3>
              <div className="flex items-center justify-between py-2">
                <p className="text-gray-600">Email notifications</p>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.emailNotifications}
                    onChange={() => setSettings(prev => ({
                      ...prev,
                      emailNotifications: !prev.emailNotifications
                    }))}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between py-2">
                <p className="text-gray-600">Push notifications</p>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.pushNotifications}
                    onChange={() => setSettings(prev => ({
                      ...prev,
                      pushNotifications: !prev.pushNotifications
                    }))}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Privacy & Security</h3>
                <button 
                  onClick={() => {
                    console.log('Button clicked');
                    setShowChangePassword(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Change Password
                </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Detailed Views */}
      <AnimatePresence>
        {detailedView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setDetailedView(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setDetailedView(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900 capitalize">
                    {detailedView === 'attendance' && 'Attendance Records'}
                    {detailedView === 'leaves' && 'Leave History'}
                    {detailedView === 'students' && 'Student List'}
                  </h2>
                </div>
                <button 
                  onClick={() => setDetailedView(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 max-h-[calc(90vh-80px)] overflow-y-auto">
                {detailedView === 'attendance' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Attendance History (Last 7 Days)</h3>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">
                          Total Records: {recentAttendance.length}
                        </span>
                        <span className="text-sm text-green-600">
                          Present: {attendanceStats.present}
                        </span>
                        <span className="text-sm text-red-600">
                          Absent: {attendanceStats.absent}
                        </span>
                        <span className="text-sm text-blue-600">
                          Complete: {attendanceStats.complete}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left p-4 font-semibold text-gray-700">Date</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Check In</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Check Out</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Hours</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentAttendance.map((record) => (
                            <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-4">
                                {format(new Date(record.attendance_date), 'MMM d, yyyy')}
                              </td>
                              <td className="p-4">
                                {record.check_in_time 
                                  ? formatLocalTime(record.check_in_time)
                                  : '-'
                                }
                              </td>
                              <td className="p-4">
                                {record.check_out_time 
                                  ? formatLocalTime(record.check_out_time)
                                  : '-'
                                }
                              </td>
                              <td className="p-4">
                                {record.total_hours ? `${record.total_hours}h` : '-'}
                              </td>
                              <td className="p-4">
                                {record.check_out_time ? (
                                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                    Complete
                                  </span>
                                ) : record.check_in_time ? (
                                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                    In Progress
                                  </span>
                                ) : (
                                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                                    Absent
                                  </span>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="max-w-xs truncate text-sm text-gray-500">
                                  {record.check_in_address || '-'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {detailedView === 'leaves' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Leave History</h3>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">
                          Total: {allLeaveHistory.length}
                        </span>
                        <button 
                          onClick={loadAllLeaveHistory}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                          disabled={leaveHistoryLoading}
                        >
                          {leaveHistoryLoading ? (
                            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span>Refresh</span>
                        </button>
                      </div>
                    </div>

                    {leaveHistoryLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                      </div>
                    ) : allLeaveHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p>No leave applications found</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white rounded-xl border border-gray-200">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left p-4 font-semibold text-gray-700">Start Date</th>
                                <th className="text-left p-4 font-semibold text-gray-700">End Date</th>
                                <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                                <th className="text-left p-4 font-semibold text-gray-700">Reason</th>
                                <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                                <th className="text-left p-4 font-semibold text-gray-700">Applied On</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedLeaveHistory.map((application) => (
                                <tr key={application.id} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="p-4">
                                    {format(new Date(application.start_date), 'MMM d, yyyy')}
                                  </td>
                                  <td className="p-4">
                                    {format(new Date(application.end_date), 'MMM d, yyyy')}
                                  </td>
                                  <td className="p-4 capitalize">
                                    {application.type}
                                  </td>
                                  <td className="p-4">
                                    <div className="max-w-xs">
                                      <p className="text-sm text-gray-600 line-clamp-2">{application.reason}</p>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                                        {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                                      </span>
                                      {getStatusIcon(application.status)}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    {format(new Date(application.created_at), 'MMM d, yyyy')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {totalLeavePages > 1 && (
                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                              Showing {((leaveHistoryPage - 1) * LEAVES_PER_PAGE) + 1} to{' '}
                              {Math.min(leaveHistoryPage * LEAVES_PER_PAGE, allLeaveHistory.length)} of{' '}
                              {allLeaveHistory.length} entries
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setLeaveHistoryPage(prev => Math.max(prev - 1, 1))}
                                disabled={leaveHistoryPage === 1}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <span className="text-sm font-medium">
                                Page {leaveHistoryPage} of {totalLeavePages}
                              </span>
                              <button
                                onClick={() => setLeaveHistoryPage(prev => Math.min(prev + 1, totalLeavePages))}
                                disabled={leaveHistoryPage === totalLeavePages}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {detailedView === 'students' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Student List</h3>
                      <span className="text-sm text-gray-600">
                        Total: {students.length}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left p-4 font-semibold text-gray-700">Roll No.</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Student Name</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Class</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-4 font-medium">{student.roll_number}</td>
                              <td className="p-4">{student.name}</td>
                              <td className="p-4">{student.class}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Application Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowLeaveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Apply for Leave</h2>
                <button 
                  onClick={() => setShowLeaveModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
        
              <form onSubmit={handleLeaveSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type (Remaining: {leaveBalance[leaveForm.type]} days)
                  </label>
                  <select
                    required
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm({...leaveForm, type: e.target.value as any})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="casual">Casual Leave ({leaveBalance.casual} days remaining)</option>
                    <option value="medical">Medical Leave ({leaveBalance.medical} days remaining)</option>
                    <option value="emergency">Emergency Leave ({leaveBalance.emergency} days remaining)</option>
                    <option value="personal">Personal Leave ({leaveBalance.personal} days remaining)</option>
                  </select>
                  {leaveBalance[leaveForm.type] <= 0 && (
                    <p className="text-red-500 text-xs mt-1">No remaining leaves of this type</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveForm.start_date}
                      onChange={(e) => {
                        setLeaveForm({...leaveForm, start_date: e.target.value});
                        if (leaveForm.end_date && new Date(e.target.value) > new Date(leaveForm.end_date)) {
                          setLeaveForm({...leaveForm, start_date: e.target.value, end_date: e.target.value});
                        }
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({...leaveForm, end_date: e.target.value})}
                      min={leaveForm.start_date || new Date().toISOString().split('T')[0]}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {leaveForm.start_date && leaveForm.end_date && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Duration: {calculateLeaveDuration(leaveForm.start_date, leaveForm.end_date)} day(s)
                    </p>
                    <p className="text-sm text-blue-800 mt-1">
                      Remaining after leave: {leaveBalance[leaveForm.type] - calculateLeaveDuration(leaveForm.start_date, leaveForm.end_date)} day(s)
                    </p>
                  </div>
                )}
        
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <textarea
                    required
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Please provide a reason for your leave..."
                  />
                </div>
        
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={leaveBalance[leaveForm.type] <= 0 || 
                              (leaveForm.start_date && leaveForm.end_date && 
                              leaveBalance[leaveForm.type] < calculateLeaveDuration(leaveForm.start_date, leaveForm.end_date))}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Application
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student Attendance Modal */}
      <AnimatePresence>
        {showStudentAttendanceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-auto"
            onClick={() => setShowStudentAttendanceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Mark Student Attendance</h3>
                <button 
                  onClick={() => setShowStudentAttendanceModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
        
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {selectedDate === getLocalDateString() ? (
                  <p className="text-sm text-green-600 mt-1">✓ Today's date - will update existing records</p>
                ) : (
                  <p className="text-sm text-blue-600 mt-1">Different date - will create new records</p>
                )}
              </div>
        
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading students...</p>
                  <button 
                    onClick={loadStudents}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Retry Loading Students
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      {students.length} students found
                    </p>
                    <button 
                      onClick={() => {
                        const allPresent: Record<string, 'present' | 'absent'> = {};
                        students.forEach(student => {
                          allPresent[student.id] = 'present';
                        });
                        setStudentAttendance(allPresent);
                      }}
                      className="text-sm text-green-600 hover:text-green-800"
                    >
                      Mark All Present
                    </button>
                  </div>
                    
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Roll No.</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Student Name</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Class</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{student.roll_number}</td>
                            <td className="py-3 px-4">{student.name}</td>
                            <td className="py-3 px-4">{student.class}</td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setStudentAttendance(prev => ({
                                    ...prev,
                                    [student.id]: 'present'
                                  }))}
                                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                    studentAttendance[student.id] === 'present' 
                                      ? 'bg-green-500 text-white' 
                                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                                  }`}
                                >
                                  Present
                                </button>
                                <button
                                  onClick={() => setStudentAttendance(prev => ({
                                    ...prev,
                                    [student.id]: 'absent'
                                  }))}
                                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                    studentAttendance[student.id] === 'absent' 
                                      ? 'bg-red-500 text-white' 
                                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                                  }`}
                                >
                                  Absent
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                      
                  <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      {Object.values(studentAttendance).filter(status => status === 'present').length} present, 
                      {Object.values(studentAttendance).filter(status => status === 'absent').length} absent
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setShowStudentAttendanceModal(false)}
                        className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleStudentAttendanceSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Save Attendance
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setShowChangePassword(false);
              setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Change Password</h3>
                <button 
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  disabled={passwordLoading}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
                
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter current password"
                    disabled={passwordLoading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new password (min. 6 characters)"
                    disabled={passwordLoading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm new password"
                    disabled={passwordLoading}
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowChangePassword(false);
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    }}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    disabled={passwordLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    disabled={passwordLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {passwordLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Changing...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}