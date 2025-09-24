import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collectionGroup } from 'firebase/firestore';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  orderBy,
  limit,
  getDoc,
  addDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  Award,
  FileText,
  RefreshCw,
  GraduationCap,
  X,
  User,
  ChevronLeft,
  Plus,
  Bookmark,
  BarChart3,
  Download,
  Bell,
  BookCheck,
  School,
  CalendarDays,
  FileStack,
  ClipboardList,
  Mail,
  Settings,
  Eye,
  Edit,
  Trash2,
  Upload,
  BookText,
  Calculator,
  Save,
  MapPin,
  Megaphone,
  Target,
  Library,
  Bus,
  Package,
  CreditCard,
  ChartBar,
  Filter,
  Search,
  Home,
  Book,
  Star,
  AlertTriangle,
  CheckSquare,
  Clock4,
  DollarSign,
  Truck,
  Box,
  PieChart,
  Users as UsersIcon,
  Bookmark as BookmarkIcon,
  Calendar as CalendarIcon,
  FileText as FileTextIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthForm } from '../AuthForm';

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  pendingLeaves: number;
  presentToday: number;
  totalClasses: number;
  assignmentsDue: number;
  upcomingEvents: number;
  pendingFees: number;
  lowStockBooks: number;
  transportRoutes: number;
}

interface LeaveApplication {
  id: string;
  teacher_id?: string;
  user_id?: string;
  student_id?: string;
  applicant_name: string;
  applicant_type: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
  dateFolder?: string;
  leave_balance?: {
    casual: number;
    medical: number;
    emergency: number;
    personal: number;
  };
}

interface Person {
  id: string;
  name: string;
  type: 'teacher' | 'student';
  present: boolean;
  email?: string;
  class?: string;
  subject?: string;
  dateFolder?: string;
}

interface ClassSchedule {
  id?: string;
  class_name: string;
  subject: string;
  teacher_name: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
}

interface Assignment {
  id?: string;
  title: string;
  description: string;
  class_name: string;
  subject: string;
  due_date: string;
  max_marks: number;
  created_at: string;
  attachments?: string[];
}

interface StudyMaterial {
  id?: string;
  title: string;
  description: string;
  class_name: string;
  subject: string;
  type: 'notes' | 'presentation' | 'video' | 'other';
  file_url: string;
  uploaded_at: string;
}

interface LeaveQuota {
  casual: number;
  medical: number;
  emergency: number;
  personal: number;
}

interface LeaveQuotas {
  student: LeaveQuota;
  teacher: LeaveQuota;
}

// New interfaces for additional features
interface Holiday {
  id?: string;
  date: string;
  name: string;
  type: 'national' | 'state' | 'religious';
  description?: string;
}

interface Announcement {
  id?: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  target_audience: 'all' | 'students' | 'teachers' | 'parents';
  expiry_date: string;
  created_at: string;
  created_by: string;
}

interface Event {
  id?: string;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  type: 'academic' | 'cultural' | 'sports' | 'other';
  participants: string[];
  created_at: string;
}

interface StudentPerformance {
  student_id: string;
  student_name: string;
  class: string;
  subjects: {
    subject: string;
    marks: number;
    max_marks: number;
    grade: string;
  }[];
  attendance_percentage: number;
  overall_percentage: number;
}

interface LibraryBook {
  id?: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  total_copies: number;
  available_copies: number;
  publication_year: number;
  shelf_location: string;
}

interface FeeRecord {
  id?: string;
  student_id: string;
  student_name: string;
  class: string;
  fee_type: 'tuition' | 'transport' | 'hostel' | 'other';
  amount: number;
  due_date: string;
  status: 'paid' | 'pending' | 'overdue';
  paid_date?: string;
  transaction_id?: string;
}

interface TransportRoute {
  id?: string;
  route_name: string;
  driver_name: string;
  driver_contact: string;
  vehicle_number: string;
  stops: string[];
  start_time: string;
  estimated_duration: string;
  capacity: number;
  current_students: number;
}

interface InventoryItem {
  id?: string;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit: string;
  location: string;
  last_restocked: string;
  supplier: string;
}

// Helper function to get date folder name (matches your DB structure)
const getDateFolder = (date: Date = new Date()) => {
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month}_${day}`;
};

// Helper function to get date in YYYY-MM-DD format
const getISODate = (date: Date = new Date()) => {
  return date.toISOString().split('T')[0];
};

// Odisha State Holidays 2024
const ODISHA_HOLIDAYS_2024: Holiday[] = [
  { date: '2024-01-01', name: 'New Year\'s Day', type: 'national' },
  { date: '2024-01-17', name: 'Maha Bisuba Sankranti', type: 'state' },
  { date: '2024-01-26', name: 'Republic Day', type: 'national' },
  { date: '2024-03-08', name: 'Maha Shivaratri', type: 'religious' },
  { date: '2024-03-25', name: 'Dola Purnima', type: 'religious' },
  { date: '2024-04-01', name: 'Odisha Day', type: 'state' },
  { date: '2024-04-17', name: 'Ram Navami', type: 'religious' },
  { date: '2024-04-21', name: 'Mahavir Jayanti', type: 'religious' },
  { date: '2024-05-01', name: 'Labour Day', type: 'national' },
  { date: '2024-06-17', name: 'Raja Sankranti', type: 'state' },
  { date: '2024-07-17', name: 'Muharram', type: 'religious' },
  { date: '2024-08-15', name: 'Independence Day', type: 'national' },
  { date: '2024-08-19', name: 'Raksha Bandhan', type: 'religious' },
  { date: '2024-09-07', name: 'Janmashtami', type: 'religious' },
  { date: '2024-10-02', name: 'Gandhi Jayanti', type: 'national' },
  { date: '2024-10-12', name: 'Dussehra', type: 'religious' },
  { date: '2024-11-01', name: 'Kali Puja', type: 'religious' },
  { date: '2024-12-25', name: 'Christmas', type: 'religious' },
];

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    pendingLeaves: 0,
    presentToday: 0,
    totalClasses: 0,
    assignmentsDue: 0,
    upcomingEvents: 0,
    pendingFees: 0,
    lowStockBooks: 0,
    transportRoutes: 0,
  });
  const [recentLeaves, setRecentLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [signupRole, setSignupRole] = useState<'student' | 'teacher'>('student');
  
  // State for managing the detailed view
  const [detailedView, setDetailedView] = useState<'teachers' | 'students' | 'classes' | 'assignments' | 'materials' | null>(null);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [classSchedules, setClassSchedules] = useState<ClassSchedule[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Form states
  const [showClassForm, setShowClassForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Form data
  const [classForm, setClassForm] = useState<ClassSchedule>({
    class_name: '',
    subject: '',
    teacher_name: '',
    day: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    room: ''
  });
  
  const [assignmentForm, setAssignmentForm] = useState<Assignment>({
    title: '',
    description: '',
    class_name: '',
    subject: '',
    due_date: '',
    max_marks: 100,
    created_at: new Date().toISOString(),
    attachments: []
  });
  
  const [materialForm, setMaterialForm] = useState<StudyMaterial>({
    title: '',
    description: '',
    class_name: '',
    subject: '',
    type: 'notes',
    file_url: '',
    uploaded_at: new Date().toISOString()
  });
  
  // Leave quotas
  const [leaveQuotas, setLeaveQuotas] = useState<LeaveQuotas>({
    student: {
      casual: 10,
      medical: 15,
      emergency: 5,
      personal: 5
    },
    teacher: {
      casual: 12,
      medical: 20,
      emergency: 7,
      personal: 7
    }
  });

  const [editingQuotas, setEditingQuotas] = useState<{student: boolean, teacher: boolean}>({
    student: false,
    teacher: false
  });

  // New states for additional features
  const [holidays, setHolidays] = useState<Holiday[]>(ODISHA_HOLIDAYS_2024);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [transportRoutes, setTransportRoutes] = useState<TransportRoute[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // New form states
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [showTransportForm, setShowTransportForm] = useState(false);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  
  // New form data
  const [holidayForm, setHolidayForm] = useState<Holiday>({
    date: '',
    name: '',
    type: 'national',
    description: ''
  });
  
  const [announcementForm, setAnnouncementForm] = useState<Announcement>({
    title: '',
    message: '',
    priority: 'medium',
    target_audience: 'all',
    expiry_date: '',
    created_at: new Date().toISOString(),
    created_by: 'admin'
  });
  
  const [eventForm, setEventForm] = useState<Event>({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    venue: '',
    type: 'academic',
    participants: [],
    created_at: new Date().toISOString()
  });
  
  const [libraryForm, setLibraryForm] = useState<LibraryBook>({
    title: '',
    author: '',
    isbn: '',
    category: '',
    total_copies: 1,
    available_copies: 1,
    publication_year: new Date().getFullYear(),
    shelf_location: ''
  });
  
  const [feeForm, setFeeForm] = useState<FeeRecord>({
    student_id: '',
    student_name: '',
    class: '',
    fee_type: 'tuition',
    amount: 0,
    due_date: '',
    status: 'pending'
  });
  
  const [transportForm, setTransportForm] = useState<TransportRoute>({
    route_name: '',
    driver_name: '',
    driver_contact: '',
    vehicle_number: '',
    stops: [],
    start_time: '',
    estimated_duration: '',
    capacity: 40,
    current_students: 0
  });
  
  const [inventoryForm, setInventoryForm] = useState<InventoryItem>({
    name: '',
    category: '',
    quantity: 0,
    min_quantity: 5,
    unit: 'pieces',
    location: '',
    last_restocked: new Date().toISOString(),
    supplier: ''
  });

  useEffect(() => {
    loadDashboardData();
    loadLeaveQuotas();
    loadAdditionalData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      console.log('Loading admin dashboard data...');

      const today = getISODate();
      const dateFolder = getDateFolder();
      console.log('Using date folder:', dateFolder);

      // Get total students count
      const studentsCountQuery = query(collection(db, 'students'));
      const studentsCountSnapshot = await getDocs(studentsCountQuery);
      const studentCount = studentsCountSnapshot.size;

      // Get total teachers count
      const teachersCountQuery = query(collection(db, 'teachers'));
      const teachersCountSnapshot = await getDocs(teachersCountQuery);
      const teacherCount = teachersCountSnapshot.size;

      // Get class schedules count
      const classesQuery = query(collection(db, 'class_schedules'));
      const classesSnapshot = await getDocs(classesQuery);
      const classCount = classesSnapshot.size;

      // Get assignments due count
      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('due_date', '>=', today)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsDueCount = assignmentsSnapshot.size;

      // Get pending leaves
      let pendingCount = 0;
      const allPendingLeaves: LeaveApplication[] = [];
      
      try {
        const pendingLeavesQuery = query(
          collectionGroup(db, 'applications'),
          where('status', '==', 'pending')
        );
        const pendingLeavesSnapshot = await getDocs(pendingLeavesQuery);
        pendingCount = pendingLeavesSnapshot.size;

        pendingLeavesSnapshot.forEach(doc => {
          const pathParts = doc.ref.path.split('/');
          const parentFolderIndex = pathParts.findIndex(part => part === 'leave_applications') + 1;
          const folderName = pathParts[parentFolderIndex] || dateFolder;

          allPendingLeaves.push({
            id: doc.id,
            ...doc.data(),
            dateFolder: folderName
          } as LeaveApplication);
        });
      } catch (error) {
        console.error('Error loading leave applications:', error);
      }

      // Get today's student attendance from date folder
      let presentStudentsCount = 0;
      try {
        const studentDateFolderRef = collection(db, 'student_attendance', dateFolder, 'records');
        const studentAttendanceQuery = query(
          studentDateFolderRef,
          where('date', '==', today)
        );
        const studentAttendanceSnapshot = await getDocs(studentAttendanceQuery);

        studentAttendanceSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.status === 'present') {
            presentStudentsCount++;
          }
        });
      } catch (error) {
        console.error('Error loading student attendance:', error);
      }

      // Get today's teacher attendance from date folder
      let presentTeachersCount = 0;
      try {
        const teacherDateFolderRef = collection(db, 'teacher_attendance', dateFolder, 'records');
        const teacherAttendanceQuery = query(
          teacherDateFolderRef,
          where('attendance_date', '==', today)
        );
        const teacherAttendanceSnapshot = await getDocs(teacherAttendanceQuery);

        teacherAttendanceSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.check_in_time) {
            presentTeachersCount++;
          }
        });
      } catch (error) {
        console.error('Error loading teacher attendance:', error);
      }

      const totalPresentToday = presentStudentsCount + presentTeachersCount;

      // Mapping teachers and students for leave names
      const [allTeachersSnapshot, allStudentsSnapshot] = await Promise.all([
        getDocs(collection(db, 'teachers')),
        getDocs(collection(db, 'students'))
      ]);

      const teacherMap = new Map();
      const studentMap = new Map();

      allTeachersSnapshot.forEach(teacherDoc => {
        const teacherData = teacherDoc.data();
        teacherMap.set(teacherDoc.id, teacherData);
        if (teacherData.user_id) teacherMap.set(teacherData.user_id, teacherData);
      });

      allStudentsSnapshot.forEach(studentDoc => {
        const studentData = studentDoc.data();
        studentMap.set(studentDoc.id, studentData);
        if (studentData.user_id) studentMap.set(studentData.user_id, studentData);
      });

      // Add names to pending leaves
      const leavesWithNames = allPendingLeaves.map((leave) => {
        let applicantName = 'Unknown';
        let applicantType = 'Unknown';
        let applicantId = '';

        if (leave.teacher_id) {
          const teacherData = teacherMap.get(leave.teacher_id);
          if (teacherData) {
            applicantName = teacherData.full_name || teacherData.name || 'Unknown Teacher';
            applicantType = 'Teacher';
            applicantId = leave.teacher_id;
          }
        }

        if (leave.user_id || leave.student_id) {
          const studentId = leave.user_id || leave.student_id;
          const studentData = studentMap.get(studentId || '');
          if (studentData) {
            applicantName = studentData.full_name || studentData.name || 'Unknown Student';
            applicantType = 'Student';
            applicantId = studentId || '';
          }
        }

        return {
          ...leave,
          applicant_name: applicantName,
          applicant_type: applicantType,
          applicant_id: applicantId,
          dateFolder: leave.dateFolder,
        };
      });

      // Sort by creation date and take the 10 most recent
      const recentLeaves = leavesWithNames
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      // Update state
      setStats(prev => ({
        ...prev,
        totalStudents: studentCount,
        totalTeachers: teacherCount,
        pendingLeaves: pendingCount,
        presentToday: totalPresentToday,
        totalClasses: classCount,
        assignmentsDue: assignmentsDueCount,
      }));
      setRecentLeaves(recentLeaves);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Error loading dashboard data. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadLeaveQuotas = async () => {
    try {
      const studentQuotaDoc = await getDoc(doc(db, 'leave_quotas', 'student'));
      const teacherQuotaDoc = await getDoc(doc(db, 'leave_quotas', 'teacher'));
      
      if (studentQuotaDoc.exists()) {
        setLeaveQuotas(prev => ({ 
          ...prev, 
          student: { ...prev.student, ...studentQuotaDoc.data() } 
        }));
      }
      
      if (teacherQuotaDoc.exists()) {
        setLeaveQuotas(prev => ({ 
          ...prev, 
          teacher: { ...prev.teacher, ...teacherQuotaDoc.data() } 
        }));
      }
    } catch (error) {
      console.error('Error loading leave quotas:', error);
    }
  };

  const loadAdditionalData = async () => {
    try {
      const today = getISODate();

      // Load events
      const eventsQuery = query(
        collection(db, 'events'), 
        where('date', '>=', today), 
        orderBy('date'), 
        limit(5)
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(eventsData);

      // Load pending fees
      const feesQuery = query(
        collection(db, 'fee_records'), 
        where('status', '==', 'pending'), 
        orderBy('due_date'), 
        limit(5)
      );
      const feesSnapshot = await getDocs(feesQuery);
      const feesData = feesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FeeRecord[];
      setFeeRecords(feesData);

      // Load library books (low stock)
      const libraryQuery = query(
        collection(db, 'library_books'), 
        where('available_copies', '<=', 2), 
        limit(5)
      );
      const librarySnapshot = await getDocs(libraryQuery);
      const libraryData = librarySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LibraryBook[];
      setLibraryBooks(libraryData);

      // Load transport routes
      const transportQuery = query(collection(db, 'transport_routes'), limit(5));
      const transportSnapshot = await getDocs(transportQuery);
      const transportData = transportSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TransportRoute[];
      setTransportRoutes(transportData);

      // Load announcements
      const announcementsQuery = query(
        collection(db, 'announcements'), 
        orderBy('created_at', 'desc'), 
        limit(5)
      );
      const announcementsSnapshot = await getDocs(announcementsQuery);
      const announcementsData = announcementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      setAnnouncements(announcementsData);

      // Update stats with additional data
      setStats(prev => ({
        ...prev,
        upcomingEvents: eventsData.length,
        pendingFees: feesData.length,
        lowStockBooks: libraryData.length,
        transportRoutes: transportData.length,
      }));

    } catch (error) {
      console.error('Error loading additional data:', error);
    }
  };

  const updateLeaveQuotas = async (type: 'student' | 'teacher', newQuotas: LeaveQuota) => {
    try {
      await setDoc(doc(db, 'leave_quotas', type), newQuotas);
      setLeaveQuotas(prev => ({ ...prev, [type]: newQuotas }));
      setEditingQuotas(prev => ({ ...prev, [type]: false }));
      toast.success(`${type} leave quotas updated successfully!`);
    } catch (error) {
      console.error('Error updating leave quotas:', error);
      toast.error('Error updating leave quotas');
    }
  };

  const handleLeaveAction = async (
    leaveId: string,
    dateFolder: string | undefined,
    action: 'approved' | 'rejected',
    leaveType: string,
    applicantType: 'student' | 'teacher',
    applicantId: string
  ) => {
    if (!dateFolder) {
      console.error('❌ Missing dateFolder for leaveId:', leaveId);
      toast.error('Invalid leave application (missing folder)');
      return;
    }

    try {
      const leaveRef = doc(db, 'leave_applications', dateFolder, 'applications', leaveId);

      await updateDoc(leaveRef, {
        status: action,
        updated_at: new Date().toISOString(),
        reviewed_by: 'admin',
        reviewed_at: new Date().toISOString(),
      });

      // If approved, decrement the leave balance
      if (action === 'approved') {
        const balanceDocRef = doc(
          db, 
          `${applicantType}_leave_balance`, 
          applicantId
        );
        
        const balanceDoc = await getDoc(balanceDocRef);
        
        if (balanceDoc.exists()) {
          const currentBalance = balanceDoc.data() as LeaveQuota;
          await updateDoc(balanceDocRef, {
            [leaveType]: Math.max(0, (currentBalance[leaveType as keyof LeaveQuota] || 0) - 1)
          });
        } else {
          // Create initial balance using default quotas
          const defaultQuotas = leaveQuotas[applicantType];
          
          await setDoc(balanceDocRef, {
            ...defaultQuotas,
            [leaveType]: Math.max(0, (defaultQuotas[leaveType as keyof LeaveQuota] || 0) - 1)
          });
        }
      }

      toast.success(`Leave application ${action} successfully`);
      loadDashboardData(); // refresh
    } catch (error) {
      console.error('Error updating leave application:', error);
      toast.error('Error updating leave application');
    }
  };

  const loadDetailedData = async (type: 'teachers' | 'students' | 'classes' | 'assignments' | 'materials') => {
    try {
      setLoadingDetails(true);
      
      if (type === 'teachers' || type === 'students') {
        const today = getISODate();
        const dateFolder = getDateFolder();
        
        if (type === 'teachers') {
          // Get all teachers
          const teachersQuery = query(collection(db, 'teachers'));
          const teachersSnapshot = await getDocs(teachersQuery);
        
          // Get today's teacher attendance from date folder
          const presentTeacherIds = new Set();
          try {
            const teacherAttendanceRef = collection(db, 'teacher_attendance', dateFolder, 'records');
            const teacherAttendanceQuery = query(
              teacherAttendanceRef,
              where('attendance_date', '==', today)
            );
            const teacherAttendanceSnapshot = await getDocs(teacherAttendanceQuery);
          
            teacherAttendanceSnapshot.forEach(doc => {
              const data = doc.data();
              if (data.teacher_id && data.check_in_time) {
                presentTeacherIds.add(data.teacher_id);
              }
            });
          } catch (error) {
            console.error('Error loading teacher attendance details:', error);
          }
        
          // Map teachers with their presence status
          const teachersData: Person[] = teachersSnapshot.docs.map(doc => {
            const teacherData = doc.data();
            return {
              id: doc.id,
              name: teacherData.full_name || teacherData.name || 'Unknown Teacher',
              type: 'teacher',
              present: presentTeacherIds.has(doc.id),
              email: teacherData.email,
              subject: teacherData.subject,
              dateFolder: dateFolder,
            };
          });
        
          setTeachers(teachersData);
        } else {
          // Get all students
          const studentsQuery = query(collection(db, 'students'));
          const studentsSnapshot = await getDocs(studentsQuery);
        
          // Get today's student attendance from date folder
          const studentAttendanceMap = new Map();
          try {
            const studentAttendanceRef = collection(db, 'student_attendance', dateFolder, 'records');
            const studentAttendanceQuery = query(
              studentAttendanceRef,
              where('date', '==', today)
            );
            const studentAttendanceSnapshot = await getDocs(studentAttendanceQuery);
          
            studentAttendanceSnapshot.forEach(doc => {
              const data = doc.data();
              if (data.student_id) {
                studentAttendanceMap.set(data.student_id, data.status === 'present');
              }
            });
          } catch (error) {
            console.error('Error loading student attendance details:', error);
          }
        
          // Map students with their presence status
          const studentsData: Person[] = studentsSnapshot.docs.map(doc => {
            const studentData = doc.data();
            return {
              id: doc.id,
              name: studentData.full_name || studentData.name || 'Unknown Student',
              type: 'student',
              present: studentAttendanceMap.get(doc.id) || false,
              email: studentData.email,
              class: studentData.class,
              dateFolder: dateFolder,
            };
          });
        
          setStudents(studentsData);
        }
        setDetailedView(type);
      } else if (type === 'classes') {
        // Load class schedules
        const classesQuery = query(collection(db, 'class_schedules'), orderBy('day'));
        const classesSnapshot = await getDocs(classesQuery);
        const classesData = classesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ClassSchedule[];
        setClassSchedules(classesData);
        setDetailedView('classes');
      } else if (type === 'assignments') {
        // Load assignments
        const assignmentsQuery = query(collection(db, 'assignments'), orderBy('due_date', 'desc'));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        const assignmentsData = assignmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Assignment[];
        setAssignments(assignmentsData);
        setDetailedView('assignments');
      } else if (type === 'materials') {
        // Load study materials
        const materialsQuery = query(collection(db, 'study_materials'), orderBy('uploaded_at', 'desc'));
        const materialsSnapshot = await getDocs(materialsQuery);
        const materialsData = materialsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StudyMaterial[];
        setStudyMaterials(materialsData);
        setDetailedView('materials');
      }
    } catch (error) {
      console.error('Error loading detailed data:', error);
      toast.error('Error loading detailed information');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Form submission handlers
  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (classForm.id) {
        const classRef = doc(db, 'class_schedules', classForm.id);
        await updateDoc(classRef, classForm);
        toast.success('Class schedule updated successfully!');
      } else {
        await addDoc(collection(db, 'class_schedules'), classForm);
        toast.success('Class schedule added successfully!');
      }
      setShowClassForm(false);
      setClassForm({
        class_name: '',
        subject: '',
        teacher_name: '',
        day: 'Monday',
        start_time: '09:00',
        end_time: '10:00',
        room: ''
      });
      loadDashboardData();
    } catch (error) {
      console.error('Error saving class schedule:', error);
      toast.error('Error saving class schedule');
    }
  };

  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (assignmentForm.id) {
        const assignmentRef = doc(db, 'assignments', assignmentForm.id);
        await updateDoc(assignmentRef, assignmentForm);
        toast.success('Assignment updated successfully!');
      } else {
        await addDoc(collection(db, 'assignments'), assignmentForm);
        toast.success('Assignment added successfully!');
      }
      setShowAssignmentForm(false);
      setAssignmentForm({
        title: '',
        description: '',
        class_name: '',
        subject: '',
        due_date: '',
        max_marks: 100,
        created_at: new Date().toISOString(),
        attachments: []
      });
      loadDashboardData();
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast.error('Error saving assignment');
    }
  };

  const handleMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (materialForm.id) {
        const materialRef = doc(db, 'study_materials', materialForm.id);
        await updateDoc(materialRef, materialForm);
        toast.success('Study material updated successfully!');
      } else {
        await addDoc(collection(db, 'study_materials'), materialForm);
        toast.success('Study material added successfully!');
      }
      setShowMaterialForm(false);
      setMaterialForm({
        title: '',
        description: '',
        class_name: '',
        subject: '',
        type: 'notes',
        file_url: '',
        uploaded_at: new Date().toISOString()
      });
      loadDashboardData();
    } catch (error) {
      console.error('Error saving study material:', error);
      toast.error('Error saving study material');
    }
  };

  // New form submission handlers
  const handleHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'holidays'), holidayForm);
      toast.success('Holiday added successfully!');
      setShowHolidayForm(false);
      setHolidayForm({ date: '', name: '', type: 'national', description: '' });
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Error adding holiday');
    }
  };

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'announcements'), announcementForm);
      toast.success('Announcement published successfully!');
      setShowAnnouncementForm(false);
      setAnnouncementForm({
        title: '',
        message: '',
        priority: 'medium',
        target_audience: 'all',
        expiry_date: '',
        created_at: new Date().toISOString(),
        created_by: 'admin'
      });
      loadAdditionalData();
    } catch (error) {
      console.error('Error publishing announcement:', error);
      toast.error('Error publishing announcement');
    }
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'events'), eventForm);
      toast.success('Event created successfully!');
      setShowEventForm(false);
      setEventForm({
        title: '',
        description: '',
        date: '',
        start_time: '',
        end_time: '',
        venue: '',
        type: 'academic',
        participants: [],
        created_at: new Date().toISOString()
      });
      loadAdditionalData();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Error creating event');
    }
  };

  const handleLibrarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'library_books'), libraryForm);
      toast.success('Book added to library successfully!');
      setShowLibraryForm(false);
      setLibraryForm({
        title: '',
        author: '',
        isbn: '',
        category: '',
        total_copies: 1,
        available_copies: 1,
        publication_year: new Date().getFullYear(),
        shelf_location: ''
      });
      loadAdditionalData();
    } catch (error) {
      console.error('Error adding book:', error);
      toast.error('Error adding book');
    }
  };

  // Delete handlers
  const deleteClass = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this class schedule?')) {
      try {
        await deleteDoc(doc(db, 'class_schedules', id));
        toast.success('Class schedule deleted successfully!');
        loadDashboardData();
      } catch (error) {
        console.error('Error deleting class schedule:', error);
        toast.error('Error deleting class schedule');
      }
    }
  };

  const deleteAssignment = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        await deleteDoc(doc(db, 'assignments', id));
        toast.success('Assignment deleted successfully!');
        loadDashboardData();
      } catch (error) {
        console.error('Error deleting assignment:', error);
        toast.error('Error deleting assignment');
      }
    }
  };

  const deleteMaterial = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this study material?')) {
      try {
        await deleteDoc(doc(db, 'study_materials', id));
        toast.success('Study material deleted successfully!');
        loadDashboardData();
      } catch (error) {
        console.error('Error deleting study material:', error);
        toast.error('Error deleting study material');
      }
    }
  };

  // Stat cards with enhanced data
  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      onClick: () => loadDetailedData('students')
    },
    {
      title: 'Total Teachers',
      value: stats.totalTeachers,
      icon: BookOpen,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      onClick: () => loadDetailedData('teachers')
    },
    {
      title: 'Pending Leaves',
      value: stats.pendingLeaves,
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Present Today',
      value: stats.presentToday,
      icon: CheckCircle,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Class Schedules',
      value: stats.totalClasses,
      icon: CalendarDays,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      onClick: () => loadDetailedData('classes')
    },
    {
      title: 'Assignments Due',
      value: stats.assignmentsDue,
      icon: FileStack,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      onClick: () => loadDetailedData('assignments')
    },
    {
      title: 'Upcoming Events',
      value: stats.upcomingEvents,
      icon: Calendar,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50',
      iconColor: 'text-pink-600',
    },
    {
      title: 'Pending Fees',
      value: stats.pendingFees,
      icon: CreditCard,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ];

  // Upcoming holidays
  const upcomingHolidays = holidays
    .filter(holiday => new Date(holiday.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  // Quick actions
  const quickActions = [
    { label: 'Add Class Schedule', icon: Plus, action: () => setShowClassForm(true) },
    { label: 'Create Assignment', icon: ClipboardList, action: () => setShowAssignmentForm(true) },
    { label: 'Upload Study Material', icon: Upload, action: () => setShowMaterialForm(true) },
    { label: 'Publish Announcement', icon: Megaphone, action: () => setShowAnnouncementForm(true) },
    { label: 'Schedule Event', icon: Calendar, action: () => setShowEventForm(true) },
    { label: 'Add Library Book', icon: Library, action: () => setShowLibraryForm(true) },
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
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your school operations</p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => {
                loadDashboardData();
                loadAdditionalData();
              }}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="flex items-center space-x-2">
              <Award className="w-8 h-8 text-yellow-500" />
              <span className="text-sm text-gray-600">Administrator</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-2xl shadow-sm p-2">
        <div className="flex space-x-1">
          {['dashboard', 'attendance', 'leaves', 'classes', 'assignments', 'materials', 'events', 'settings'].map((tab) => (
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-6">
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

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Leave Applications */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Pending Leave Applications</h2>
              </div>
              <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                {stats.pendingLeaves} Pending
              </span>
            </div>

            <div className="space-y-4">
              {recentLeaves.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No pending leave applications</p>
                </div>
              ) : (
                recentLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{leave.applicant_name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                            leave.applicant_type === 'Teacher' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>{leave.applicant_type}</span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium capitalize">{leave.leave_type}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{leave.reason}</p>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <span>From: {new Date(leave.start_date).toLocaleDateString()}</span>
                          <span>To: {new Date(leave.end_date).toLocaleDateString()}</span>
                          <span>Applied: {new Date(leave.created_at).toLocaleDateString()}</span>
                          {leave.dateFolder && <span>Date: {leave.dateFolder}</span>}
                        </div>
                        {leave.leave_balance && (
                          <div className="mt-2 text-xs text-gray-500">
                            Leave Balance: {leave.leave_balance.casual} Casual, {leave.leave_balance.medical} Medical, {leave.leave_balance.emergency} Emergency, {leave.leave_balance.personal} Personal
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <motion.button
                          onClick={() => handleLeaveAction(
                            leave.id, 
                            leave.dateFolder, 
                            'approved',
                            leave.leave_type,
                            leave.applicant_type.toLowerCase() as 'student' | 'teacher',
                            leave.teacher_id || leave.user_id || leave.student_id || ''
                          )}
                          className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </motion.button>

                        <motion.button
                          onClick={() => handleLeaveAction(
                            leave.id, 
                            leave.dateFolder, 
                            'rejected',
                            leave.leave_type,
                            leave.applicant_type.toLowerCase() as 'student' | 'teacher',
                            leave.teacher_id || leave.user_id || leave.student_id || ''
                          )}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white"
          >
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, index) => (
                <button 
                  key={action.label}
                  onClick={action.action}
                  className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left"
                >
                  <span className="text-sm">{action.label}</span>
                  <action.icon className="w-4 h-4 flex-shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>

          {/* Upcoming Holidays */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Odisha State Holidays</h3>
              <MapPin className="w-5 h-5 text-orange-500" />
            </div>
            <div className="space-y-3">
              {upcomingHolidays.map((holiday, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{holiday.name}</p>
                    <p className="text-xs text-gray-600">{new Date(holiday.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    holiday.type === 'state' ? 'bg-orange-100 text-orange-800' :
                    holiday.type === 'national' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {holiday.type}
                  </span>
                </div>
              ))}
              <button 
                onClick={() => setShowHolidayForm(true)}
                className="w-full flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-800 text-sm font-medium pt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Holiday</span>
              </button>
            </div>
          </motion.div>

          {/* Recent Announcements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Announcements</h3>
              <Megaphone className="w-5 h-5 text-blue-500" />
            </div>
            <div className="space-y-3">
              {announcements.slice(0, 3).map((announcement) => (
                <div key={announcement.id} className="border-l-4 border-blue-500 pl-3 py-1">
                  <p className="text-sm font-medium text-gray-900">{announcement.title}</p>
                  <p className="text-xs text-gray-600 truncate">{announcement.message}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      For: {announcement.target_audience}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(announcement.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setShowAnnouncementForm(true)}
                className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium pt-2"
              >
                View All Announcements
              </button>
            </div>
          </motion.div>

          {/* Alerts Section */}
          <div className="space-y-4">
            {/* Library Alerts */}
            {libraryBooks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-red-50 border border-red-200 rounded-2xl p-6"
              >
                <div className="flex items-center space-x-2 mb-3">
                  <Library className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-800">Low Stock Alert</h3>
                </div>
                <div className="space-y-2">
                  {libraryBooks.slice(0, 2).map((book) => (
                    <div key={book.id} className="flex justify-between items-center text-sm">
                      <span className="text-red-700">{book.title}</span>
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                        {book.available_copies} left
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Fee Reminders */}
            {feeRecords.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-6"
              >
                <div className="flex items-center space-x-2 mb-3">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-800">Fee Reminders</h3>
                </div>
                <div className="space-y-2">
                  {feeRecords.slice(0, 3).map((fee) => (
                    <div key={fee.id} className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-amber-700">{fee.student_name}</span>
                        <span className="text-amber-800 font-medium">₹{fee.amount}</span>
                      </div>
                      <div className="text-xs text-amber-600">Due: {new Date(fee.due_date).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Leave Quotas Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mt-6"
      >
        <h3 className="font-semibold text-gray-900 mb-4">Leave Quotas Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Student Quotas */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-700">Students</h4>
              {editingQuotas.student ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateLeaveQuotas('student', leaveQuotas.student)}
                    className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingQuotas(prev => ({ ...prev, student: false }));
                      loadLeaveQuotas();
                    }}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingQuotas(prev => ({ ...prev, student: true }))}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(leaveQuotas.student).map(([type, value]) => (
                <div key={type} className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700 capitalize">{type}:</span>
                    {editingQuotas.student ? (
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value) || 0;
                          setLeaveQuotas(prev => ({
                            ...prev,
                            student: { ...prev.student, [type]: newValue }
                          }));
                        }}
                        className="w-16 px-2 py-1 text-sm border border-blue-200 rounded"
                        min="0"
                      />
                    ) : (
                      <span className="text-lg font-bold text-blue-800">{value}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Teacher Quotas */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-700">Teachers</h4>
              {editingQuotas.teacher ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateLeaveQuotas('teacher', leaveQuotas.teacher)}
                    className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingQuotas(prev => ({ ...prev, teacher: false }));
                      loadLeaveQuotas();
                    }}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingQuotas(prev => ({ ...prev, teacher: true }))}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(leaveQuotas.teacher).map(([type, value]) => (
                <div key={type} className="bg-green-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-700 capitalize">{type}:</span>
                    {editingQuotas.teacher ? (
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value) || 0;
                          setLeaveQuotas(prev => ({
                            ...prev,
                            teacher: { ...prev.teacher, [type]: newValue }
                          }));
                        }}
                        className="w-16 px-2 py-1 text-sm border border-green-200 rounded"
                        min="0"
                      />
                    ) : (
                      <span className="text-lg font-bold text-green-800">{value}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Detailed Views Modal */}
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
                    {detailedView === 'teachers' && 'Teachers List'}
                    {detailedView === 'students' && 'Students List'}
                    {detailedView === 'classes' && 'Class Schedules'}
                    {detailedView === 'assignments' && 'Assignments'}
                    {detailedView === 'materials' && 'Study Materials'}
                  </h2>
                </div>
                <button 
                  onClick={() => setDetailedView(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {loadingDetails ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {detailedView === 'teachers' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-gray-600">{teachers.length} teachers found</p>
                          <button 
                            onClick={() => {
                              setSignupRole('teacher');
                              setShowAuthForm(true);
                            }}
                            className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Teacher</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {teachers.map((teacher) => (
                            <div key={teacher.id} className="border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center space-x-3 mb-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900">{teacher.name}</h3>
                                  <p className="text-sm text-gray-500">{teacher.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">{teacher.subject}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  teacher.present 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {teacher.present ? 'Present' : 'Absent'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detailedView === 'students' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-gray-600">{students.length} students found</p>
                          <button 
                            onClick={() => {
                              setSignupRole('student');
                              setShowAuthForm(true);
                            }}
                            className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Student</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {students.map((student) => (
                            <div key={student.id} className="border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center space-x-3 mb-3">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900">{student.name}</h3>
                                  <p className="text-sm text-gray-500">{student.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Class {student.class}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  student.present 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {student.present ? 'Present' : 'Absent'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ... other detailed views remain the same ... */}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Modals */}
      <AnimatePresence>
        {/* Holiday Form Modal */}
        {showHolidayForm && (
          <FormModal
            title="Add Custom Holiday"
            onClose={() => setShowHolidayForm(false)}
          >
            <form onSubmit={handleHolidaySubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({...holidayForm, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    required
                    value={holidayForm.type}
                    onChange={(e) => setHolidayForm({...holidayForm, type: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="national">National</option>
                    <option value="state">State</option>
                    <option value="religious">Religious</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Holiday Name</label>
                  <input
                    type="text"
                    required
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm({...holidayForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowHolidayForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  Add Holiday
                </button>
              </div>
            </form>
          </FormModal>
        )}

        {/* Announcement Form Modal */}
        {showAnnouncementForm && (
          <FormModal
            title="Publish New Announcement"
            onClose={() => setShowAnnouncementForm(false)}
          >
            <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    required
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm({...announcementForm, priority: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                  <select
                    required
                    value={announcementForm.target_audience}
                    onChange={(e) => setAnnouncementForm({...announcementForm, target_audience: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="students">Students</option>
                    <option value="teachers">Teachers</option>
                    <option value="parents">Parents</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={announcementForm.expiry_date}
                    onChange={(e) => setAnnouncementForm({...announcementForm, expiry_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={announcementForm.message}
                    onChange={(e) => setAnnouncementForm({...announcementForm, message: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  Publish Announcement
                </button>
              </div>
            </form>
          </FormModal>
        )}

        {/* Event Form Modal */}
        {showEventForm && (
          <FormModal
            title="Schedule New Event"
            onClose={() => setShowEventForm(false)}
          >
            <form onSubmit={handleEventSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                  <input
                    type="text"
                    required
                    value={eventForm.title}
                    onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    required
                    value={eventForm.type}
                    onChange={(e) => setEventForm({...eventForm, type: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="academic">Academic</option>
                    <option value="cultural">Cultural</option>
                    <option value="sports">Sports</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={eventForm.start_time}
                    onChange={(e) => setEventForm({...eventForm, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={eventForm.end_time}
                    onChange={(e) => setEventForm({...eventForm, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <input
                    type="text"
                    required
                    value={eventForm.venue}
                    onChange={(e) => setEventForm({...eventForm, venue: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    required
                    rows={3}
                    value={eventForm.description}
                    onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEventForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  Schedule Event
                </button>
              </div>
            </form>
          </FormModal>
        )}

        {showClassForm && (
          <FormModal
            title={classForm.id ? "Edit Class Schedule" : "Add Class Schedule"}
            onClose={() => {
              setShowClassForm(false);
              setClassForm({
                class_name: '',
                subject: '',
                teacher_name: '',
                day: 'Monday',
                start_time: '09:00',
                end_time: '10:00',
                room: ''
              });
            }}
            >
            <form onSubmit={handleClassSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                  <input
                    type="text"
                    required
                    value={classForm.class_name}
                    onChange={(e) => setClassForm({...classForm, class_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={classForm.subject}
                    onChange={(e) => setClassForm({...classForm, subject: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher Name</label>
                  <input
                    type="text"
                    required
                    value={classForm.teacher_name}
                    onChange={(e) => setClassForm({...classForm, teacher_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                  <select
                    required
                    value={classForm.day}
                    onChange={(e) => setClassForm({...classForm, day: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <input
                    type="text"
                    value={classForm.room}
                    onChange={(e) => setClassForm({...classForm, room: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={classForm.start_time}
                    onChange={(e) => setClassForm({...classForm, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={classForm.end_time}
                    onChange={(e) => setClassForm({...classForm, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowClassForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  {classForm.id ? "Update" : "Create"} Class
                </button>
              </div>
            </form>
          </FormModal>
        )}

        {showAssignmentForm && (
          <FormModal
            title={assignmentForm.id ? "Edit Assignment" : "Create Assignment"}
            onClose={() => {
              setShowAssignmentForm(false);
              setAssignmentForm({
                title: '',
                description: '',
                class_name: '',
                subject: '',
                due_date: '',
                max_marks: 100,
                created_at: new Date().toISOString(),
                attachments: []
              });
            }}
          >
            <form onSubmit={handleAssignmentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={assignmentForm.title}
                    onChange={(e) => setAssignmentForm({...assignmentForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <input
                    type="text"
                    required
                    value={assignmentForm.class_name}
                    onChange={(e) => setAssignmentForm({...assignmentForm, class_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={assignmentForm.subject}
                    onChange={(e) => setAssignmentForm({...assignmentForm, subject: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Marks</label>
                  <input
                    type="number"
                    required
                    value={assignmentForm.max_marks}
                    onChange={(e) => setAssignmentForm({...assignmentForm, max_marks: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={assignmentForm.due_date}
                    onChange={(e) => setAssignmentForm({...assignmentForm, due_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    required
                    rows={3}
                    value={assignmentForm.description}
                    onChange={(e) => setAssignmentForm({...assignmentForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignmentForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  {assignmentForm.id ? "Update" : "Create"} Assignment
                </button>
              </div>
            </form>
          </FormModal>
        )}

        {showMaterialForm && (
          <FormModal
            title={materialForm.id ? "Edit Study Material" : "Upload Study Material"}
            onClose={() => {
              setShowMaterialForm(false);
              setMaterialForm({
                title: '',
                description: '',
                class_name: '',
                subject: '',
                type: 'notes',
                file_url: '',
                uploaded_at: new Date().toISOString()
              });
            }}
          >
            <form onSubmit={handleMaterialSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={materialForm.title}
                    onChange={(e) => setMaterialForm({...materialForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <input
                    type="text"
                    required
                    value={materialForm.class_name}
                    onChange={(e) => setMaterialForm({...materialForm, class_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={materialForm.subject}
                    onChange={(e) => setMaterialForm({...materialForm, subject: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    required
                    value={materialForm.type}
                    onChange={(e) => setMaterialForm({...materialForm, type: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="notes">Notes</option>
                    <option value="presentation">Presentation</option>
                    <option value="video">Video</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">File URL</label>
                  <input
                    type="url"
                    required
                    value={materialForm.file_url}
                    onChange={(e) => setMaterialForm({...materialForm, file_url: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={materialForm.description}
                    onChange={(e) => setMaterialForm({...materialForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMaterialForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  {materialForm.id ? "Update" : "Upload"} Material
                </button>
              </div>
            </form>
          </FormModal>
        )}

        {showAuthForm && (
          <FormModal
            title={`Add New ${signupRole === 'teacher' ? 'Teacher' : 'Student'}`}
            onClose={() => setShowAuthForm(false)}
          >
            <AuthForm 
              role={signupRole} 
              onSuccess={() => {
                setShowAuthForm(false);
                loadDashboardData();
                toast.success(`${signupRole === 'teacher' ? 'Teacher' : 'Student'} added successfully!`);
              }}
              onCancel={() => setShowAuthForm(false)}
            />
          </FormModal>
        )}



        {/* Add other form modals similarly for Library, etc. */}

        {/* Existing form modals (Class, Assignment, Material, Auth) remain the same */}
        {/* ... existing form modals ... */}

      </AnimatePresence>
    </div>
  );
}

// Form Modal Component
function FormModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}