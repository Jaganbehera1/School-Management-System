import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection,
  query, 
  where, 
  getDocs, 
  setDoc,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { 
  Calendar, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  Award,
  TrendingUp,
  User,
  BarChart3,
  Download,
  Plus,
  BookCheck,
  CalendarDays,
  School,
  Megaphone,
  X,
  ChevronLeft,
  ChevronRight,
  BookText,
  ClipboardList,
  RefreshCw,
  CheckSquare,
  Square
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isToday, 
  isSameMonth, 
  isSameDay,
  differenceInDays,
  addMonths,
  subMonths 
} from 'date-fns';

interface StudentInfo {
  id: string;
  roll_number: string;
  class_id: string;
  class_name: string;
  class_section: string;
  grade: number;
  user_id: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  marked_at: string;
  dateFolder?: string;
}

interface LeaveApplication {
  id: string;
  user_id: string;
  student_id: string;
  leave_type?: string;
  reason?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  dateFolder?: string;
  duration?: number;
  leave_balance_before?: LeaveQuota;
  leave_balance_after?: LeaveQuota;
  processed?: boolean;
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

interface Assignment {
  id: string;
  title: string;
  description: string;
  class_name: string;
  subject: string;
  due_date: string;
  max_marks: number;
  created_at: string;
  status?: 'not_started' | 'in_progress' | 'submitted' | 'completed' | 'reviewed';
}

interface StudyMaterial {
  id: string;
  title: string;
  description: string;
  class_name: string;
  subject: string;
  type: 'notes' | 'presentation' | 'video' | 'other';
  file_url: string;
  uploaded_at: string;
}

interface Grade {
  id: string;
  subject: string;
  marks: number;
  max_marks: number;
  assignment_title: string;
  date: string;
}

interface ClassSchedule {
  id: string;
  class_name: string;
  subject: string;
  teacher_name: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
}

interface LeaveQuota {
  casual: number;
  medical: number;
  emergency: number;
  personal: number;
}

interface CompletedAssignment {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  completed_at: string;
  assignment_title: string;
  subject: string;
  class_name: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isHoliday: boolean;
  isLeaveDay: boolean;
  attendanceStatus?: 'present' | 'absent' | 'late' | 'holiday' | 'leave';
  holidayInfo?: Holiday;
  leaveInfo?: LeaveApplication;
}

interface Holiday {
  date: string;
  name: string;
  type: 'national' | 'state' | 'religious' | 'regional' | 'public';
  description?: string;
}

const getDateFolder = (date: Date = new Date()) => {
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month}_${day}`;
};

const getISODate = (date: Date = new Date()) => {
  return date.toISOString().split('T')[0];
};

const calculateLeaveDuration = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return differenceInDays(end, start) + 1;
};

export function StudentDashboard() {
  const { user } = useAuth();
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [completedAssignments, setCompletedAssignments] = useState<CompletedAssignment[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [detailedView, setDetailedView] = useState<'attendance' | 'assignments' | 'materials' | 'grades' | 'schedule' | 'completed' | null>(null);
  const [classSchedules, setClassSchedules] = useState<ClassSchedule[]>([]);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState<LeaveQuota>({
    casual: 10,
    medical: 15,
    emergency: 5,
    personal: 5
  });
  
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'casual' as 'casual' | 'medical' | 'emergency' | 'personal',
    start_date: '',
    end_date: '',
    reason: '',
  });

  useEffect(() => {
    // Reset states when component mounts
    setAssignments([]);
    setCompletedAssignments([]);
    
    if (user?.uid) {
      loadStudentData();
    }
  }, [user]);
  
  useEffect(() => {
    console.log('Recent attendance data:', recentAttendance);
    console.log('Attendance stats:', attendanceStats);
  }, [recentAttendance]);

  useEffect(() => {
    if (leaveBalance && (
      typeof leaveBalance.casual !== 'number' ||
      typeof leaveBalance.medical !== 'number' ||
      typeof leaveBalance.emergency !== 'number' ||
      typeof leaveBalance.personal !== 'number'
    )) {
      setLeaveBalance({
        casual: 10,
        medical: 15,
        emergency: 5,
        personal: 5
      });
    }
  }, [leaveBalance]);

  useEffect(() => {
    if (!studentInfo) return;

    const today = new Date();
    const dateFoldersToCheck = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      dateFoldersToCheck.push(getDateFolder(date));
    }

    const unsubscribeFunctions: (() => void)[] = [];

    dateFoldersToCheck.forEach(dateFolder => {
      try {
        const applicationsRef = collection(db, 'leave_applications', dateFolder, 'applications');
        const applicationsQuery = query(
          applicationsRef,
          where("student_id", "==", studentInfo.id),
          where("status", "==", "approved"),
          where("processed", "!=", true)
        );

        const unsubscribe = onSnapshot(applicationsQuery, (snapshot) => {
          if (!snapshot.empty) {
            console.log("Found approved leaves to process");
            processApprovedLeaves();
          }
        });

        unsubscribeFunctions.push(unsubscribe);
      } catch (error) {
        console.log(`No leave applications for ${dateFolder} or error:`, error);
      }
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [studentInfo]);

  useEffect(() => {
    if (recentAttendance.length > 0 && holidays.length > 0) {
      const calendarData = generateCalendar(currentMonth, recentAttendance, holidays);
      setCalendarDays(calendarData);
    }
  }, [currentMonth, recentAttendance, holidays]);

  const loadHolidays = async () => {
    try {
      const holidaysQuery = query(collection(db, 'holidays'));
      const holidaysSnapshot = await getDocs(holidaysQuery);
      const holidaysData = holidaysSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as unknown as Holiday));

      // Add Odisha state holidays as default
      const odishaHolidays: Holiday[] = [
        { date: '2025-01-14', name: 'Makar Sankranti', type: 'regional' },
        { date: '2025-01-23', name: 'Subhas Chandra Bose Jayanti / Veer Surendra Sai Jayanti', type: 'regional' },
        { date: '2025-01-26', name: 'Republic Day', type: 'national' },
        { date: '2025-02-02', name: 'Vasant Panchami', type: 'regional' },
        { date: '2025-02-26', name: 'Maha Shivaratri', type: 'religious' },
        { date: '2025-03-05', name: 'Panchayati Raj Divas', type: 'public' },
        { date: '2025-03-14', name: 'Dola Purnima', type: 'religious' },
        { date: '2025-03-15', name: 'Holi', type: 'religious' },
        { date: '2025-03-31', name: 'Id-ul-Fitr', type: 'religious' },
        { date: '2025-04-01', name: 'Utkal Divas / Odisha Day', type: 'state' },
        { date: '2025-04-06', name: 'Ram Navami', type: 'religious' },
        { date: '2025-04-14', name: 'Maha Vishuba Sankranti (Maha Bishuba Sankranti)', type: 'regional' },
        { date: '2025-04-14', name: 'Dr B. R. Ambedkar Jayanti', type: 'national' },
        { date: '2025-04-18', name: 'Good Friday', type: 'religious' },
        { date: '2025-04-24', name: 'Panchayati Raj Diwas (alternate in some lists)', type: 'public' },
        { date: '2025-05-12', name: 'Buddha Purnima / Birth of Pt. Raghunath Murmu', type: 'public' },
        { date: '2025-05-26', name: 'Savitri Amavasya', type: 'regional' },
        { date: '2025-06-07', name: 'Id-ul-Zuha (Bakrid / Eid al Adha)', type: 'religious' },
        { date: '2025-06-14', name: 'Pahili Raja', type: 'regional' },
        { date: '2025-06-15', name: 'Raja Sankranti', type: 'state' },
        { date: '2025-06-27', name: 'Ratha Yatra', type: 'regional' },
        { date: '2025-07-06', name: 'Muharram', type: 'religious' },
        { date: '2025-08-15', name: 'Independence Day', type: 'national' },
        { date: '2025-08-15', name: 'Janmashtami', type: 'religious' },
        { date: '2025-08-27', name: 'Ganesh Puja / Ganesh Chaturthi', type: 'religious' },
        { date: '2025-08-28', name: 'Nuakhai', type: 'regional' },
        { date: '2025-09-05', name: 'Birthday of Prophet Muhammad (Eid Milad)', type: 'religious' },
        { date: '2025-09-29', name: 'Maha Saptami', type: 'religious' },
        { date: '2025-09-30', name: 'Maha Astami', type: 'religious' },
        { date: '2025-10-01', name: 'Mahanavami', type: 'religious' },
        { date: '2025-10-02', name: 'Vijaya Dashami / Gandhi Jayanti', type: 'public' },
        { date: '2025-10-06', name: 'Kumar Purnima', type: 'regional' },
        { date: '2025-10-07', name: 'Kumar Purnima (alternate in some lists)', type: 'regional' },
        { date: '2025-10-21', name: 'Diwali / Kali Puja', type: 'religious' },
        { date: '2025-11-05', name: 'Rasa Purnima', type: 'religious' },
        { date: '2025-12-25', name: 'Christmas Day', type: 'national' },
      ];


      const allHolidays = [...odishaHolidays, ...holidaysData];
      setHolidays(allHolidays);
      return allHolidays;
    } catch (error) {
      console.error('Error loading holidays:', error);
      return [];
    }
  };
  
  const generateCalendar = (month: Date, attendanceRecords: AttendanceRecord[], holidaysList: Holiday[], leaves: LeaveApplication[] = []): CalendarDay[] => {
      const year = month.getFullYear();
      const monthIndex = month.getMonth();

      // First day of the month
      const firstDay = new Date(year, monthIndex, 1);
      // Last day of the month
      const lastDay = new Date(year, monthIndex + 1, 0);

      // Start from the first Sunday of the week containing the first day
      const startDate = new Date(firstDay);
      startDate.setDate(firstDay.getDate() - firstDay.getDay());

      // End on the last Saturday of the week containing the last day
      const endDate = new Date(lastDay);
      endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

      const days: CalendarDay[] = [];
      const currentDate = new Date(startDate);

      // Helper function to check if two dates are the same day
      const isSameDate = (date1: Date, date2: Date) => {
        return date1.getDate() === date2.getDate() && 
               date1.getMonth() === date2.getMonth() && 
               date1.getFullYear() === date2.getFullYear();
      };
    
      // Helper function to check if today
      const isTodayDate = (date: Date) => {
        const today = new Date();
        return isSameDate(date, today);
      };
    
      // FIX: Create a consistent date string format for comparison
      const formatDateForComparison = (date: Date) => {
        // Use local date components to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
    
      while (currentDate <= endDate) {
        // FIX: Use the new format function instead of toISOString()
        const dateStr = formatDateForComparison(currentDate);

        // FIX: Also ensure holiday dates are in the same format
        const isHoliday = holidaysList.some(holiday => {
          // Make sure holiday.date is in YYYY-MM-DD format
          return holiday.date === dateStr;
        });

        const holidayInfo = holidaysList.find(holiday => holiday.date === dateStr);

        // Check if it's a leave day (approved leaves only)
        const leaveDay = leaves.find(leave => {
          if (leave.status !== 'approved') return false;

          const startDate = leave.start_date ? new Date(leave.start_date) : null;
          const endDate = leave.end_date ? new Date(leave.end_date) : null;

          return startDate && endDate && currentDate >= startDate && currentDate <= endDate;
        });
      
        // Find attendance record for this date
        const attendanceRecord = attendanceRecords.find(record => {
          const recordDate = new Date(record.date);
          return isSameDate(recordDate, currentDate);
        });
      
        let attendanceStatus: 'present' | 'absent' | 'late' | 'holiday' | 'leave' | undefined;
      
        if (isHoliday) {
          attendanceStatus = 'holiday';
        } else if (leaveDay) {
          attendanceStatus = 'leave';
        } else if (attendanceRecord) {
          attendanceStatus = attendanceRecord.status;
        } else if (currentDate < new Date() && currentDate.getMonth() === monthIndex) {
          // Only mark as absent for past dates in current month
          attendanceStatus = 'absent';
        }
      
        days.push({
          date: new Date(currentDate),
          isCurrentMonth: currentDate.getMonth() === monthIndex, // Add this property
          isToday: isTodayDate(currentDate),
          isHoliday,
          isLeaveDay: !!leaveDay, // Add this property
          attendanceStatus,
          holidayInfo,
          leaveInfo: leaveDay // Add this property
        } as CalendarDay);
      
        currentDate.setDate(currentDate.getDate() + 1);
      }
    
      return days;
  };

  const loadLeaveBalance = async (studentId: string) => {
    try {
      const balanceDoc = await getDoc(doc(db, 'student_leave_balance', studentId));

      if (balanceDoc.exists()) {
        const balanceData = balanceDoc.data();
        if (balanceData && typeof balanceData === 'object') {
          const currentBalance: LeaveQuota = {
            casual: typeof balanceData.casual === 'number' ? balanceData.casual : 10,
            medical: typeof balanceData.medical === 'number' ? balanceData.medical : 15,
            emergency: typeof balanceData.emergency === 'number' ? balanceData.emergency : 5,
            personal: typeof balanceData.personal === 'number' ? balanceData.personal : 5
          };

          setLeaveBalance(currentBalance);
          return currentBalance;
        }
      }

      const defaultQuotasDoc = await getDoc(doc(db, 'leave_quotas', 'student'));
      let defaultQuotas: LeaveQuota = {
        casual: 10,
        medical: 15,
        emergency: 5,
        personal: 5
      };

      if (defaultQuotasDoc.exists()) {
        const quotasData = defaultQuotasDoc.data();
        defaultQuotas = {
          casual: typeof quotasData.casual === 'number' ? quotasData.casual : 10,
          medical: typeof quotasData.medical === 'number' ? quotasData.medical : 15,
          emergency: typeof quotasData.emergency === 'number' ? quotasData.emergency : 5,
          personal: typeof quotasData.personal === 'number' ? quotasData.personal : 5
        };
      }

      await setDoc(doc(db, 'student_leave_balance', studentId), defaultQuotas);
      setLeaveBalance(defaultQuotas);
      return defaultQuotas;

    } catch (error) {
      console.error('Error loading leave balance:', error);
      const defaultQuotas: LeaveQuota = {
        casual: 10,
        medical: 15,
        emergency: 5,
        personal: 5
      };
      setLeaveBalance(defaultQuotas);
      return defaultQuotas;
    }
  };

  const checkAndResetLeaveBalance = async (studentId: string, currentBalance: LeaveQuota) => {
    try {
      const resetDoc = await getDoc(doc(db, 'leave_reset_dates', studentId));
      const currentYear = new Date().getFullYear();

      let needsReset = false;

      if (!resetDoc.exists()) {
        needsReset = true;
      } else {
        const resetData = resetDoc.data();
        needsReset = resetData.year < currentYear;
      }

      if (needsReset) {
        const usedLeaves = await calculateUsedLeaves(studentId);

        const defaultQuotasDoc = await getDoc(doc(db, 'leave_quotas', 'student'));
        let defaultQuotas: LeaveQuota = {
          casual: 10,
          medical: 15,
          emergency: 5,
          personal: 5
        };

        if (defaultQuotasDoc.exists()) {
          const quotasData = defaultQuotasDoc.data();
          defaultQuotas = {
            casual: typeof quotasData.casual === 'number' ? quotasData.casual : 10,
            medical: typeof quotasData.medical === 'number' ? quotasData.medical : 15,
            emergency: typeof quotasData.emergency === 'number' ? quotasData.emergency : 5,
            personal: typeof quotasData.personal === 'number' ? quotasData.personal : 5
          };
        }

        await runTransaction(db, async (transaction) => {
          transaction.set(doc(db, 'student_leave_balance', studentId), defaultQuotas);
          transaction.set(doc(db, 'leave_reset_dates', studentId), { 
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

  const processApprovedLeaves = async () => {
    if (!studentInfo) return;

    try {
      console.log("Processing approved leaves...");
      const today = new Date();

      for (let i = 0; i < 60; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateFolder = getDateFolder(date);
      
        try {
          const applicationsRef = collection(db, 'leave_applications', dateFolder, 'applications');
          const applicationsQuery = query(
            applicationsRef,
            where("student_id", "==", studentInfo.id),
            where("status", "==", "approved"),
            where("processed", "!=", true)
          );
        
          const applicationsSnapshot = await getDocs(applicationsQuery);
          console.log(`Found ${applicationsSnapshot.size} unprocessed leaves in ${dateFolder}`);

          for (const applicationDoc of applicationsSnapshot.docs) {
            const data = applicationDoc.data();
            const leaveType = data.leave_type as string;
            const duration = data.duration || 1;

            console.log(`Processing ${leaveType} leave for ${duration} days`);

            const currentBalanceDoc = await getDoc(doc(db, 'student_leave_balance', studentInfo.id));
            let currentBalance = leaveBalance;

            if (currentBalanceDoc.exists()) {
              const balanceData = currentBalanceDoc.data() as Partial<LeaveQuota>;
              currentBalance = {
                casual: typeof balanceData.casual === 'number' ? balanceData.casual : 10,
                medical: typeof balanceData.medical === 'number' ? balanceData.medical : 15,
                emergency: typeof balanceData.emergency === 'number' ? balanceData.emergency : 5,
                personal: typeof balanceData.personal === 'number' ? balanceData.personal : 5
              };
            }

            const newBalance = { ...currentBalance };

            if (leaveType === 'casual') {
              newBalance.casual -= duration;
            } else if (leaveType === 'medical') {
              newBalance.medical -= duration;
            } else if (leaveType === 'emergency') {
              newBalance.emergency -= duration;
            } else if (leaveType === 'personal') {
              newBalance.personal -= duration;
            }

            console.log(`New balance: ${JSON.stringify(newBalance)}`);

            await updateDoc(applicationDoc.ref, {
              processed: true,
              leave_balance_after: newBalance
            });

            await updateDoc(doc(db, 'student_leave_balance', studentInfo.id), newBalance);

            setLeaveBalance(newBalance);
            console.log("Leave processed successfully");
          }
        } catch (error) {
          console.log(`No unprocessed approved leaves for ${dateFolder} or error:`, error);
        }
      }
    } catch (error) {
      console.error("Error processing approved leaves:", error);
    }
  };

  const getAttendanceStatusText = (status: string) => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'absent':
        return 'Absent';
      case 'late':
        return 'Late';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getAttendanceStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDownloadAlternative = async (material: StudyMaterial) => {
    try {
      setDownloadingFile(material.id);
      
      if (material.file_url && material.file_url.startsWith('http')) {
        const response = await fetch(material.file_url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', `${material.title || 'document'}.pdf`);
        document.body.appendChild(link);
        link.click();
        
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        
        toast.success('Download started');
      } else {
        toast.error('No valid file URL available');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      if (material.file_url) {
        window.open(material.file_url, '_blank');
        toast.success('Opening file in new tab');
      } else {
        toast.error('Error accessing file');
      }
    } finally {
      setDownloadingFile(null);
    }
  };

  const loadClassSchedules = async (className: string) => {
    try {
      if (!className || className === "Not assigned") {
        console.log("No valid class name provided");
        setClassSchedules([]);
        return;
      }
      
      console.log("Loading class schedules for class:", className);

      const schedulesQuery = query(
        collection(db, "class_schedules"),
        where("class_name", "==", className),
        orderBy("day"),
        orderBy("start_time")
      );
      
      const schedulesSnapshot = await getDocs(schedulesQuery);
      console.log("Found class schedules:", schedulesSnapshot.size);
      
      let schedulesData = schedulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClassSchedule[];
      
      const today = new Date();
      const currentDay = today.getDay();
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const currentDayName = daysOfWeek[currentDay];
      
      schedulesData = schedulesData.filter(schedule => {
        const scheduleDayIndex = daysOfWeek.indexOf(schedule.day);
        return scheduleDayIndex >= currentDay;
      });
      
      console.log("Filtered class schedules data:", schedulesData);
      setClassSchedules(schedulesData);
      
    } catch (error) {
      console.error("Error loading class schedules:", error);
      
      const today = new Date();
      const currentDay = today.getDay();
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", 'Friday', 'Saturday'];
      const currentDayName = daysOfWeek[currentDay];
      
      const mockSchedules: ClassSchedule[] = [
        {
          id: '1',
          class_name: className || 'Math',
          subject: 'Mathematics',
          teacher_name: 'Dr. Smith',
          day: daysOfWeek[(currentDay + 1) % 7],
          start_time: '09:00',
          end_time: '10:00',
          room: 'Room 101'
        },
        {
          id: '2',
          class_name: className || 'Math',
          subject: 'Physics',
          teacher_name: 'Prof. Johnson',
          day: daysOfWeek[(currentDay + 1) % 7],
          start_time: '10:30',
          end_time: '11:30',
          room: 'Lab B'
        },
        {
          id: '3',
          class_name: className || 'Math',
          subject: 'English',
          teacher_name: 'Ms. Davis',
          day: daysOfWeek[(currentDay + 2) % 7],
          start_time: '09:00',
          end_time: '10:00',
          room: 'Room 204'
        }
      ].filter(schedule => {
        const scheduleDayIndex = daysOfWeek.indexOf(schedule.day);
        return scheduleDayIndex >= currentDay;
      });
      
      setClassSchedules(mockSchedules);
    }
  };

  const calculateUsedLeaves = async (studentId: string): Promise<LeaveQuota> => {
    const usedLeaves: LeaveQuota = {
      casual: 0,
      medical: 0,
      emergency: 0,
      personal: 0
    };

    try {
      const today = new Date();
      const currentYear = today.getFullYear();

      for (let i = 0; i < 365; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);

        if (date.getFullYear() !== currentYear) continue;

        const dateFolder = getDateFolder(date);

        try {
          const applicationsRef = collection(db, 'leave_applications', dateFolder, 'applications');
          const applicationsQuery = query(
            applicationsRef,
            where("student_id", "==", studentId),
            where("status", "==", "approved")
          );

          const applicationsSnapshot = await getDocs(applicationsQuery);

          applicationsSnapshot.forEach(doc => {
            const data = doc.data();
            const leaveType = data.leave_type;
            const duration = data.duration || 1;

            if (leaveType && usedLeaves.hasOwnProperty(leaveType)) {
              usedLeaves[leaveType as keyof LeaveQuota] += duration;
            }
          });
        } catch (error) {
          console.log(`Error checking leave applications for ${dateFolder}:`, error);
          continue;
        }
      }

      return usedLeaves;
    } catch (error) {
      console.error("Error calculating used leaves:", error);
      return usedLeaves;
    }
  };

  const loadLeaveApplications = async (studentId: string, userId: string) => {
    try {
      console.log("Loading leave applications for student:", studentId);

      const leavesData: LeaveApplication[] = [];
      const today = new Date();

      for (let i = 0; i < 60; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateFolder = getDateFolder(date);

        try {
          const applicationsRef = collection(db, 'leave_applications', dateFolder, 'applications');
          const applicationsQuery = query(
            applicationsRef,
            where("student_id", "==", studentId),
            orderBy("created_at", "desc")
          );

          const applicationsSnapshot = await getDocs(applicationsQuery);

          applicationsSnapshot.forEach(doc => {
            const data = doc.data();
            leavesData.push({
              id: doc.id,
              dateFolder,
              ...data
            } as LeaveApplication);
          });
        } catch (error) {
          console.log(`No leave applications for ${dateFolder} or error:`, error);
          continue;
        }
      }

      console.log("Loaded leave applications:", leavesData.length);
      setLeaveApplications(leavesData);

    } catch (error) {
      console.error("Error loading leave applications:", error);
      toast.error("Error loading leave applications");
    }
  };

  const loadAssignmentStatuses = async (assignmentsData: Assignment[]) => {
    if (!studentInfo) return assignmentsData;

    try {
      console.log(`Checking statuses for ${assignmentsData.length} assignments`);

      const assignmentsWithStatus = await Promise.all(
        assignmentsData.map(async (assignment) => {
          try {
            const statusDocRef = doc(db, 'assignment_status', `${assignment.id}_${studentInfo.id}`);
            const statusDoc = await getDoc(statusDocRef);

            if (statusDoc.exists()) {
              const statusData = statusDoc.data();
              return {
                ...assignment,
                status: statusData.status || 'not_started'
              };
            }

            return {
              ...assignment,
              status: 'not_started'
            };
          } catch (error) {
            console.error(`Error loading status for assignment ${assignment.id}:`, error);
            return { ...assignment, status: 'not_started' };
          }
        })
      );

      return assignmentsWithStatus;
    } catch (error) {
      console.error("Error loading assignment statuses:", error);
      return assignmentsData.map(assignment => ({ ...assignment, status: 'not_started' }));
    }
  };

  const loadCompletedAssignments = async (studentId: string) => {
    try {
      const completedQuery = query(
        collection(db, "completed_assignments"),
        where("student_id", "==", studentId),
        orderBy("completed_at", "desc"),
        limit(10)
      );
    
      const completedSnapshot = await getDocs(completedQuery);
      const completedData = completedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CompletedAssignment[];
    
      // Get unique assignments by assignment_id
      const uniqueCompleted = completedData.reduce((unique: CompletedAssignment[], item) => {
        return unique.findIndex(u => u.assignment_id === item.assignment_id) === -1 
          ? [...unique, item] 
          : unique;
      }, []);
    
      setCompletedAssignments(uniqueCompleted);
    } catch (error) {
      console.error("Error loading completed assignments:", error);
    }
  };

  const markAssignmentAsCompleted = async (assignment: Assignment) => {
    if (!studentInfo || !user) {
      toast.error("Student information not available");
      return;
    }

    try {
      // First check if this assignment is already completed
      const isAlreadyCompleted = completedAssignments.some(
        completed => completed.assignment_id === assignment.id
      );
      
      if (isAlreadyCompleted) {
        toast.error("This assignment is already completed");
        return;
      }

      // Update the assignment status to 'completed'
      const assignmentStatusRef = doc(db, 'assignment_status', `${assignment.id}_${studentInfo.id}`);
      await setDoc(assignmentStatusRef, {
        assignment_id: assignment.id,
        student_id: studentInfo.id,
        status: 'completed',
        updated_at: new Date().toISOString()
      }, { merge: true });

      // Add to completed_assignments collection
      const completedRef = doc(collection(db, "completed_assignments"));
      await setDoc(completedRef, {
        assignment_id: assignment.id,
        student_id: studentInfo.id,
        student_name: user.profile?.full_name || "Student",
        completed_at: new Date().toISOString(),
        assignment_title: assignment.title,
        subject: assignment.subject,
        class_name: assignment.class_name
      });

      // Remove from the assignments list immediately
      setAssignments(prev => prev.filter(a => a.id !== assignment.id));

      // Add to completed assignments list
      const newCompletedAssignment: CompletedAssignment = {
        id: completedRef.id,
        assignment_id: assignment.id,
        student_id: studentInfo.id,
        student_name: user.profile?.full_name || "Student",
        completed_at: new Date().toISOString(),
        assignment_title: assignment.title,
        subject: assignment.subject,
        class_name: assignment.class_name
      };

      setCompletedAssignments(prev => [newCompletedAssignment, ...prev]);

      toast.success("Assignment marked as completed!");
    } catch (error) {
      console.error("Error marking assignment as completed:", error);
      toast.error("Failed to mark assignment as completed");
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, status: Assignment['status']) => {
    if (!studentInfo) return;

    try {
      const assignmentStatusRef = doc(db, 'assignment_status', `${assignmentId}_${studentInfo.id}`);
      await setDoc(assignmentStatusRef, {
        assignment_id: assignmentId,
        student_id: studentInfo.id,
        status: status,
        updated_at: new Date().toISOString()
      }, { merge: true });

      if (status === 'completed') {
        // Find the assignment to complete
        const assignmentToComplete = assignments.find(a => a.id === assignmentId);
        if (assignmentToComplete) {
          // Remove from assignments list
          setAssignments(prev => prev.filter(a => a.id !== assignmentId));
          
          // Check if it's already in completed list
          const isAlreadyCompleted = completedAssignments.some(
            completed => completed.assignment_id === assignmentId
          );
          
          if (!isAlreadyCompleted && user) {
            // Add to completed_assignments collection
            const completedRef = doc(collection(db, "completed_assignments"));
            await setDoc(completedRef, {
              assignment_id: assignmentId,
              student_id: studentInfo.id,
              student_name: user.profile?.full_name || "Student",
              completed_at: new Date().toISOString(),
              assignment_title: assignmentToComplete.title,
              subject: assignmentToComplete.subject,
              class_name: assignmentToComplete.class_name
            });

            // Add to completed assignments list
            const newCompletedAssignment: CompletedAssignment = {
              id: completedRef.id,
              assignment_id: assignmentId,
              student_id: studentInfo.id,
              student_name: user.profile?.full_name || "Student",
              completed_at: new Date().toISOString(),
              assignment_title: assignmentToComplete.title,
              subject: assignmentToComplete.subject,
              class_name: assignmentToComplete.class_name
            };

            setCompletedAssignments(prev => [newCompletedAssignment, ...prev]);
          }
        }
      } else {
        // Just update the status for non-completed status changes
        setAssignments(prev => prev.map(assignment => 
          assignment.id === assignmentId 
            ? { ...assignment, status } 
            : assignment
        ));
      }

      if (status === 'completed') {
        toast.success("Assignment marked as completed!");
      } else {
        toast.success(`Assignment status updated to ${status}`);
      }
    } catch (error) {
      console.error("Error updating assignment status:", error);
      toast.error("Failed to update assignment status");
    }
  };

  const loadStudentData = async () => {
    try {
      setRefreshing(true);
      if (!user?.uid) {
        console.error("No authenticated user UID found");
        return;
      }
      const holidaysList = await loadHolidays();


      const studentsQuery = query(
        collection(db, "students"),
        where("user_id", "==", user.uid)
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      if (studentsSnapshot.empty) {
        console.warn("No student found for UID:", user.uid);
        return;
      }

      const studentDoc = studentsSnapshot.docs[0];
      const studentData = studentDoc.data();

      console.log("Student data from Firestore:", studentData);

      const studentInfoData: StudentInfo = {
        id: studentDoc.id,
        roll_number: studentData.roll_no || studentData.roll_number || "N/A",
        class_name: studentData.class || studentData.class_name || "Not assigned",
        class_section: studentData.section || studentData.class_section || "",
        grade: studentData.grade || 0,
        class_id: studentData.class_id || "",
        user_id: user.uid
      };

      console.log("Processed student info:", studentInfoData);
      setStudentInfo(studentInfoData);

      const currentBalance = await loadLeaveBalance(studentDoc.id);
      await checkAndResetLeaveBalance(studentDoc.id, currentBalance);

      if (studentInfoData.class_name && studentInfoData.class_name !== "Not assigned") {
        await loadClassSchedules(studentInfoData.class_name);
      } else {
        console.log("Skipping class schedules load - no class assigned");
        setClassSchedules([]);
      }

      await loadLeaveApplications(studentDoc.id, user.uid);
      await loadCompletedAssignments(studentDoc.id);

    const attendanceData: AttendanceRecord[] = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateFolder = getDateFolder(date);
      const dateStr = getISODate(date);

      try {
        const recordsQuery = query(
          collection(db, 'student_attendance', dateFolder, 'records'),
          where("student_id", "==", studentDoc.id),
          where("date", "==", dateStr)
        );

        const recordsSnapshot = await getDocs(recordsQuery);

        recordsSnapshot.forEach(doc => {
          const data = doc.data();
          attendanceData.push({
            id: doc.id,
            date: data.date || dateStr,
            status: data.status || 'absent',
            marked_at: data.marked_at || data.created_at || new Date().toISOString(),
            dateFolder
          } as AttendanceRecord);
        });
      } catch (error) {
        console.log(`No student attendance records for ${dateFolder} or error:`, error);
        continue;
      }
    }

      setRecentAttendance(attendanceData);
      console.log("Loaded attendance records:", attendanceData.length);
      setCalendarLoading(true);

      if (holidaysList.length > 0) {
        const calendarData = generateCalendar(currentMonth, attendanceData, holidaysList);
        setCalendarDays(calendarData);
        console.log("Generated calendar with", calendarData.length, "days");
      }
      setCalendarLoading(false);

      if (studentInfoData.class_name && studentInfoData.class_name !== "Not assigned") {
        const assignmentsQuery = query(
          collection(db, "assignments"),
          where("class_name", "==", studentInfoData.class_name),
          orderBy("due_date", "desc"),
          limit(20)
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        let assignmentsData = assignmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Assignment[];

        // Load statuses for all assignments
        assignmentsData = await loadAssignmentStatuses(assignmentsData);

        // Filter out completed assignments
        const pendingAssignments = assignmentsData.filter(a => a.status !== 'completed');
        setAssignments(pendingAssignments);

        console.log("Total assignments:", assignmentsData.length);
        console.log("Pending assignments:", pendingAssignments.length);
      }

      // Load announcements
      await loadAnnouncements();

    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Error loading student data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };
  // In your Teacher Dashboard component
  const loadAnnouncements = async () => {
    try {
      const today = new Date().toISOString();

      // Query announcements that haven't expired and are targeted to teachers or all
      const announcementsQuery = query(
        collection(db, 'announcements'),
        where('expiry_date', '>=', today),
        where('target_audience', 'in', ['all', 'students']),
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

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentInfo) {
      toast.error("Student info not loaded");
      return;
    }

    const duration = calculateLeaveDuration(leaveForm.start_date, leaveForm.end_date);
    
    if (leaveBalance[leaveForm.leave_type] < duration) {
      toast.error(`Not enough ${leaveForm.leave_type} leaves available. You have ${leaveBalance[leaveForm.leave_type]} days remaining but requested ${duration} days.`);
      return;
    }

    try {
      const dateFolder = getDateFolder();
      
      const applicationRef = doc(collection(db, "leave_applications", dateFolder, "applications"));
      await setDoc(applicationRef, {
        student_id: studentInfo.id,
        user_id: user?.uid,
        applicant_name: user?.profile?.full_name || 'Student',
        applicant_type: 'student',
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        duration: duration,
        reason: leaveForm.reason,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        leave_balance_before: leaveBalance,
        processed: false
      });

      toast.success("Leave application submitted successfully!");
      setShowLeaveForm(false);
      setLeaveForm({
        leave_type: "casual",
        start_date: "",
        end_date: "",
        reason: "",
      });

      if (studentInfo) {
        await loadLeaveApplications(studentInfo.id, user?.uid || '');
      }
    } catch (error: any) {
      console.error("Error submitting leave application:", error);
      toast.error(error.message || "Failed to submit leave application");
    }
  };

  const loadDetailedData = async (type: 'attendance' | 'assignments' | 'materials' | 'grades' | 'schedule' | 'completed') => {
    try {
      if (type === 'attendance') {
        setDetailedView('attendance');
      } else if (type === 'assignments' && studentInfo && studentInfo.class_name !== "Not assigned") {
        const assignmentsQuery = query(
          collection(db, "assignments"),
          where("class_name", "==", studentInfo.class_name),
          orderBy("due_date", "desc")
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        let assignmentsData = assignmentsSnapshot.docs.map(doc => ({
          id: doc.id,
        ...doc.data()
        })) as Assignment[];
        
        assignmentsData = await loadAssignmentStatuses(assignmentsData);
        // Filter out completed assignments
        const pendingAssignments = assignmentsData.filter(a => a.status !== 'completed');
        setAssignments(pendingAssignments);
        setDetailedView('assignments');
      } else if (type === 'completed' && studentInfo) {
        await loadCompletedAssignments(studentInfo.id);
        setDetailedView('completed');
      } else if (type === 'materials' && studentInfo && studentInfo.class_name !== "Not assigned") {
        const materialsQuery = query(
          collection(db, "study_materials"),
          where("class_name", "==", studentInfo.class_name),
          orderBy("uploaded_at", "desc")
        );
        const materialsSnapshot = await getDocs(materialsQuery);
        const materialsData = materialsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StudyMaterial[];
        setStudyMaterials(materialsData);
        setDetailedView('materials');
      } else if (type === 'grades') {
        const gradesQuery = query(
          collection(db, "grades"),
          where("student_id", "==", studentInfo?.id),
          orderBy("date", "desc")
        );
        const gradesSnapshot = await getDocs(gradesQuery);
        const gradesData = gradesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Grade[];
        setGrades(gradesData);
        setDetailedView('grades');
      } else if (type === 'schedule') {
        setDetailedView('schedule');
      }
    } catch (error) {
      console.error("Error loading detailed data:", error);
      toast.error("Error loading detailed information");
    }
  };

  const calculateAttendancePercentage = (records: AttendanceRecord[], holidaysList: Holiday[]) => {
    if (records.length === 0) return 0;
    
    const today = new Date();
    const startOfAcademicYear = new Date(today.getFullYear(), 3, 1); // April 1st (academic year start)
    
    // Filter records for current academic year and exclude future dates
    const validRecords = records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= startOfAcademicYear && recordDate <= today;
    });

    // Count working days (excluding holidays and weekends)
    let workingDays = 0;
    let presentDays = 0;

    const currentDate = new Date(startOfAcademicYear);
    while (currentDate <= today) {
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const isHoliday = holidaysList.some(holiday => holiday.date === dateStr);

        if (!isHoliday) {
          workingDays++;

          const record = validRecords.find(r => r.date === dateStr);
          if (record && record.status === 'present') {
            presentDays++;
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
  };

  const attendanceStats = {
    present: recentAttendance.filter(a => a.status === 'present').length,
    absent: recentAttendance.filter(a => a.status === 'absent').length,
    late: recentAttendance.filter(a => a.status === 'late').length,
    total: recentAttendance.length
  };

  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
    : 0;

  // const attendancePercentage = calculateAttendancePercentage(recentAttendance, holidays);

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const averageGrade = grades.length > 0
    ? Math.round(grades.reduce((sum, grade) => sum + (grade.marks / grade.max_marks) * 100, 0) / grades.length)
    : 0;

  const statCards = [
    {
      title: 'Attendance %',
      value: `${attendancePercentage}%`,
      subtitle: 'Excluding holidays',
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      onClick: () => loadDetailedData('attendance')
    },
    {
      title: 'Weekly Classes',
      value: studentInfo?.class_name === "Not assigned" ? "N/A" : classSchedules.length,
      icon: CalendarDays,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50',
      iconColor: 'text-pink-600',
      onClick: studentInfo?.class_name !== "Not assigned" ? () => loadDetailedData('schedule') : undefined
    },
    {
      title: 'Present Days',
      value: attendanceStats.present,
      icon: CheckCircle,
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
      title: 'Late Days',
      value: attendanceStats.late,
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Average Grade',
      value: `${averageGrade}%`,
      icon: BarChart3,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      onClick: () => loadDetailedData('grades')
    },
    {
      title: 'Pending Assignments',
      value: assignments.filter(a => new Date(a.due_date) > new Date()).length,
      icon: FileText,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      onClick: () => loadDetailedData('assignments')
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {user?.profile?.full_name || 'Student'}</p>
            {studentInfo && (
              <div className="flex items-center mt-2 space-x-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <School className="w-4 h-4 mr-1" />
                  {studentInfo.class_name}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  <User className="w-4 h-4 mr-1" />
                  Roll No: {studentInfo.roll_number}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={loadStudentData}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {/* <button 
              onClick={processApprovedLeaves}
              className="flex items-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Update Leaves</span>
            </button> */}
            <div className="flex items-center space-x-2">
              <Award className="w-8 h-8 text-yellow-500" />
              <span className="text-sm text-gray-600">Student</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 bg-white rounded-2xl shadow-sm p-3">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            'overview',
            'attendance',
            'schedule',
            'assignments',
            'completed',
            'materials',
            'grades',
            'announcements',
          ].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        
        {/* Export button */}
        <button className="flex items-center space-x-1 text-sm text-blue-600 font-medium hover:text-blue-800 mt-3 md:mt-0">
          <Download className="w-4 h-4" />
          <span>Export Report</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <CalendarDays className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {format(currentMonth, 'MMMM yyyy')} Attendance Calendar
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={goToPreviousMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={calendarLoading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  disabled={calendarLoading}
                >
                  Today
                </button>
                <button 
                  onClick={goToNextMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={calendarLoading}
                >
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>

            {calendarLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => {
                    const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth();

                    let dayClass = "p-2 text-center rounded-lg text-sm font-medium transition-colors ";
                    let statusIndicator = null;

                    if (!isCurrentMonth) {
                      dayClass += "text-gray-300 bg-gray-50 ";
                    } else if (day.isToday) {
                      dayClass += "bg-blue-500 text-white shadow-md ";
                    } else if (day.isHoliday) {
                      dayClass += "bg-red-100 text-red-800 border border-red-200 ";
                    } else {
                      dayClass += "text-gray-700 bg-white border border-gray-200 ";
                    }

                    // Add hover effect for current month days
                    if (isCurrentMonth && !day.isToday && !day.isHoliday) {
                      dayClass += "hover:bg-gray-50 hover:border-gray-300 ";
                    }

                    // Status indicator
                    if (day.attendanceStatus && isCurrentMonth) {
                      let indicatorColor = "";
                      let indicatorTitle = "";

                      switch (day.attendanceStatus) {
                        case 'present':
                          indicatorColor = "bg-green-500";
                          indicatorTitle = "Present";
                          break;
                        case 'absent':
                          indicatorColor = "bg-red-500";
                          indicatorTitle = "Absent";
                          break;
                        case 'late':
                          indicatorColor = "bg-orange-500";
                          indicatorTitle = "Late";
                          break;
                        case 'holiday':
                          indicatorColor = "bg-red-300";
                          indicatorTitle = day.holidayInfo?.name || "Holiday";
                          break;
                      }

                      statusIndicator = (
                        <div 
                          className={`w-2 h-2 mx-auto mt-1 rounded-full ${indicatorColor}`}
                          title={indicatorTitle}
                        ></div>
                      );
                    }

                    return (
                      <div 
                        key={index}
                        className={dayClass}
                        title={day.holidayInfo ? `${day.holidayInfo.name} (${day.holidayInfo.type})` : 
                               day.attendanceStatus ? `${format(day.date, 'MMM d, yyyy')} - ${day.attendanceStatus.charAt(0).toUpperCase() + day.attendanceStatus.slice(1)}` : 
                               format(day.date, 'MMM d, yyyy')}
                      >
                        <div className="flex flex-col items-center justify-center h-full">
                          <span className={day.isToday ? "font-bold" : ""}>
                            {format(day.date, 'd')}
                          </span>
                          {statusIndicator}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center mt-4 gap-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Present</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Absent</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span>Late</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-red-300 rounded-full"></div>
                    <span>Holiday</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Today</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Recent Assignments</h2>
              </div>
              <button 
                onClick={() => loadDetailedData('assignments')}
                className="text-sm text-blue-600 font-medium hover:text-blue-800"
              >
                View All
              </button>
            </div>

            <div className="space-y-4">
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No pending assignments</p>
                  <p className="text-sm mt-1">All assignments are completed!</p>
                </div>
              ) : (
                assignments.filter(a => a.status !== 'completed').slice(0, 3).map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{assignment.description}</p>
                        <div className="flex items-center mt-3 text-sm text-gray-500 space-x-4">
                          <span>Subject: {assignment.subject}</span>
                          <span>Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}</span>
                          <span>{assignment.max_marks} marks</span>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end space-y-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          new Date(assignment.due_date) > new Date()
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {new Date(assignment.due_date) > new Date() ? 'Pending' : 'Overdue'}
                        </span>
                        
                        <button
                          onClick={() => markAssignmentAsCompleted(assignment)}
                          className="flex items-center space-x-1 bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 transition-colors"
                        >
                          <CheckSquare className="w-3 h-3" />
                          <span>Mark Completed</span>
                        </button>
                        
                        <select
                          value={assignment.status || 'not_started'}
                          onChange={(e) => updateAssignmentStatus(assignment.id, e.target.value as Assignment['status'])}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="submitted">Submitted</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {completedAssignments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Recently Completed</h2>
                </div>
                <button 
                  onClick={() => loadDetailedData('completed')}
                  className="text-sm text-blue-600 font-medium hover:text-blue-800"
                >
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {completedAssignments.slice(0, 3).map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900">{assignment.assignment_title}</h3>
                      <p className="text-xs text-gray-600">{assignment.subject}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-green-800 bg-green-200 px-2 py-1 rounded-full">
                        Completed
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(assignment.completed_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
            >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Calendar className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Attendance History</h2>
              </div>
                  <button 
                    onClick={() => loadDetailedData('attendance')}
                    className="text-sm text-blue-600 font-medium hover:text-blue-800"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {recentAttendance.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No attendance records found</p>
                      <p className="text-sm mt-1">Attendance will appear here once marked by your teacher</p>
                    </div>
                  ) : (
                    recentAttendance.slice(0, 5).map((record, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${
                            record.status === 'present' 
                              ? 'bg-green-500' 
                              : record.status === 'late'
                              ? 'bg-orange-500'
                              : 'bg-red-500'
                          }`}></div>
                          <span className="text-sm font-medium text-gray-700">
                            {format(new Date(record.date), 'EEEE, MMM d, yyyy')}
                          </span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          record.status === 'present' 
                            ? 'bg-green-100 text-green-800'
                            : record.status === 'late'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Leave Balance (Yearly)</h3>
                  <BookOpen className="w-5 h-5 text-blue-600" />
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
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ 
                            width: `${((typeof remaining === 'number' ? remaining : 0) / 
                              (type === 'casual' ? 10 : 
                               type === 'medical' ? 15 : 
                               type === 'emergency' ? 5 : 5)) * 100}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

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

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <CalendarDays className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Class Schedule</h2>
                  </div>
                  <button className="text-sm text-blue-600 font-medium hover:text-blue-800">
                    View Full Schedule
                  </button>
                </div>

                <div className="space-y-3">
                  {studentInfo?.class_name === "Not assigned" ? (
                    <div className="text-center py-6 text-gray-500">
                      <School className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No class assigned yet</p>
                      <p className="text-sm mt-1">Please contact administration</p>
                    </div>
                  ) : classSchedules.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No class schedule found</p>
                      {studentInfo?.class_name && (
                        <p className="text-sm mt-1">Class: {studentInfo.class_name}</p>
                      )}
                    </div>
                  ) : (
                    classSchedules.slice(0, 4).map((schedule) => (
                      <div
                        key={schedule.id}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">{schedule.subject}</h3>
                            <p className="text-sm text-gray-600">{schedule.teacher_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {schedule.start_time} - {schedule.end_time}
                            </p>
                            <p className="text-xs text-gray-500">{schedule.day}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">{schedule.room}</span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            {schedule.day.slice(0, 3)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Leave Applications</h2>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowLeaveForm(true)}
                    className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Apply</span>
                  </motion.button>
                </div>

                <div className="space-y-4">
                  {leaveApplications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No leave applications</p>
                    </div>
                  ) : (
                    leaveApplications.slice(0, 3).map((leave) => (
                      <div
                        key={leave.id}
                        className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {leave.leave_type} Leave ({leave.duration || 1} day{leave.duration !== 1 ? 's' : ''})
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
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1) : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{leave.reason}</p>
                        {leave.leave_balance_before && leave.leave_balance_after && (
                          <div className="mt-2 text-xs text-gray-500">
                            Balance: {leave.leave_balance_before[leave.leave_type as keyof LeaveQuota]} → {leave.leave_balance_after[leave.leave_type as keyof LeaveQuota]}
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

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white"
              >
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => loadDetailedData('assignments')}
                    className="flex items-center justify-between w-full p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <span>View Assignments</span>
                    <ClipboardList className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => loadDetailedData('materials')}
                    className="flex items-center justify-between w-full p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <span>Study Materials</span>
                    <BookText className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowLeaveForm(true)}
                    className="flex items-center justify-between w-full p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                  >
                    <span>Apply for Leave</span>
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>

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
                    {detailedView === 'assignments' && 'Assignments'}
                    {detailedView === 'completed' && 'Completed Assignments'}
                    {detailedView === 'materials' && 'Study Materials'}
                    {detailedView === 'grades' && 'Grades'}
                    {detailedView === 'schedule' && 'Class Schedule'}
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
                      <h3 className="text-lg font-semibold">Attendance History (Last 30 Days)</h3>
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
                        <span className="text-sm text-orange-600">
                          Late: {attendanceStats.late}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left p-4 font-semibold text-gray-700">Date</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Day</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Marked At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentAttendance.map((record) => (
                            <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-4">
                                {format(new Date(record.date), 'MMM d, yyyy')}
                              </td>
                              <td className="p-4">
                                {format(new Date(record.date), 'EEEE')}
                              </td>
                              <td className="p-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  record.status === 'present' 
                                    ? 'bg-green-100 text-green-800'
                                    : record.status === 'late'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                </span>
                              </td>
                              <td className="p-4">
                                {record.marked_at ? format(new Date(record.marked_at), 'h:mm a') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {detailedView === 'assignments' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">All Assignments</h3>
                      <span className="text-sm text-gray-600">
                        Total: {assignments.length}
                      </span>
                    </div>

                    <div className="grid gap-4">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                              <p className="text-sm text-gray-600 mt-1">{assignment.description}</p>
                              <div className="flex items-center mt-3 text-sm text-gray-500 space-x-4">
                                <span>Subject: {assignment.subject}</span>
                                <span>Class: {assignment.class_name}</span>
                                <span>Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}</span>
                                <span>{assignment.max_marks} marks</span>
                              </div>
                            </div>
                            <div className="ml-4 flex flex-col items-end space-y-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                new Date(assignment.due_date) > new Date()
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {new Date(assignment.due_date) > new Date() ? 'Pending' : 'Overdue'}
                              </span>
                              
                              <button
                                onClick={() => markAssignmentAsCompleted(assignment)}
                                className="flex items-center space-x-1 bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 transition-colors"
                              >
                                <CheckSquare className="w-3 h-3" />
                                <span>Mark Completed</span>
                              </button>
                              
                              <select
                                value={assignment.status || 'not_started'}
                                onChange={(e) => updateAssignmentStatus(assignment.id, e.target.value as Assignment['status'])}
                                className="text-xs border border-gray-300 rounded px-2 py-1"
                              >
                                <option value="not_started">Not Started</option>
                                <option value="in_progress">In Progress</option>
                                <option value="submitted">Submitted</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailedView === 'completed' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Completed Assignments</h3>
                      <span className="text-sm text-gray-600">
                        Total: {completedAssignments.length}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left p-4 font-semibold text-gray-700">Assignment</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Subject</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Class</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Completed On</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Student</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedAssignments.map((assignment) => (
                            <tr key={assignment.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-4 font-medium">{assignment.assignment_title}</td>
                              <td className="p-4">{assignment.subject}</td>
                              <td className="p-4">{assignment.class_name}</td>
                              <td className="p-4">
                                {format(new Date(assignment.completed_at), 'MMM d, yyyy')}
                              </td>
                              <td className="p-4">{assignment.student_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {detailedView === 'materials' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Study Materials</h3>
                      <span className="text-sm text-gray-600">
                        Total: {studyMaterials.length}
                      </span>
                    </div>

                    <div className="grid gap-4">
                      {studyMaterials.map((material) => (
                        <div
                          key={material.id}
                          className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{material.title}</h3>
                              <p className="text-sm text-gray-600 mt-1">{material.description}</p>
                              <div className="flex items-center mt-3 text-sm text-gray-500 space-x-4">
                                <span>Subject: {material.subject}</span>
                                <span>Class: {material.class_name}</span>
                                <span>Type: {material.type}</span>
                                <span>Uploaded: {format(new Date(material.uploaded_at), 'MMM d, yyyy')}</span>
                              </div>
                            </div>
                            <div className="ml-4 flex flex-col space-y-2">
                              <button 
                                onClick={() => handleDownloadAlternative(material)}
                                disabled={downloadingFile === material.id}
                                className="flex items-center space-x-2 bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                              >
                                {downloadingFile === material.id ? (
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                                <span>Download</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailedView === 'grades' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Grades & Performance</h3>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">
                          Total: {grades.length}
                        </span>
                        <span className="text-sm font-medium text-blue-600">
                          Average: {averageGrade}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left p-4 font-semibold text-gray-700">Subject</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Assignment</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Date</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Marks</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grades.map((grade) => {
                            const percentage = Math.round((grade.marks / grade.max_marks) * 100);
                            return (
                              <tr key={grade.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-4 font-medium">{grade.subject}</td>
                                <td className="p-4">{grade.assignment_title}</td>
                                <td className="p-4">
                                  {format(new Date(grade.date), 'MMM d, yyyy')}
                                </td>
                                <td className="p-4">
                                  {grade.marks}/{grade.max_marks}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    percentage >= 80
                                      ? 'bg-green-100 text-green-800'
                                      : percentage >= 60
                                      ? 'bg-blue-100 text-blue-800'
                                      : percentage >= 40
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {percentage}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {detailedView === 'schedule' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Class Schedule</h3>
                      <span className="text-sm text-gray-600">
                        Total Classes: {classSchedules.length}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left p-4 font-semibold text-gray-700">Day</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Time</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Subject</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Teacher</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Room</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classSchedules.map((schedule) => (
                            <tr key={schedule.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-4 font-medium">{schedule.day}</td>
                              <td className="p-4">
                                {schedule.start_time} - {schedule.end_time}
                              </td>
                              <td className="p-4">{schedule.subject}</td>
                              <td className="p-4">{schedule.teacher_name}</td>
                              <td className="p-4">{schedule.room}</td>
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

      <AnimatePresence>
        {showLeaveForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowLeaveForm(false)}
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
                  onClick={() => setShowLeaveForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
        
              <form onSubmit={handleLeaveSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type (Remaining: {leaveBalance[leaveForm.leave_type]} days)
                  </label>
                  <select
                    required
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({...leaveForm, leave_type: e.target.value as any})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="casual">Casual Leave ({leaveBalance.casual} days remaining)</option>
                    <option value="medical">Medical Leave ({leaveBalance.medical} days remaining)</option>
                    <option value="emergency">Emergency Leave ({leaveBalance.emergency} days remaining)</option>
                    <option value="personal">Personal Leave ({leaveBalance.personal} days remaining)</option>
                  </select>
                  {leaveBalance[leaveForm.leave_type] <= 0 && (
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
                      Remaining after leave: {leaveBalance[leaveForm.leave_type] - calculateLeaveDuration(leaveForm.start_date, leaveForm.end_date)} day(s)
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
                    onClick={() => setShowLeaveForm(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={leaveBalance[leaveForm.leave_type] <= 0 || 
                             (leaveForm.start_date && leaveForm.end_date && 
                              leaveBalance[leaveForm.leave_type] < calculateLeaveDuration(leaveForm.start_date, leaveForm.end_date))}
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
    </div>
  );
}