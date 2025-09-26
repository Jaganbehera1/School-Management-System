import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'student';
  phone?: string;
  created_at: string;
  updated_at: string;
};

export interface AuthUser extends FirebaseUser {
  profile?: Profile;
}

type AuthRole = 'student' | 'teacher' | 'admin';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      try {
        if (firebaseUser) {
          console.log('User found, loading profile...');
          await loadUserProfile(firebaseUser);
        } else {
          console.log('No user found');
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Add this function to validate role before login
  const validateRole = async (email: string, selectedRole: AuthRole): Promise<boolean> => {
    try {
      // Query profiles collection to find user with this email and role
      const profilesQuery = query(
        collection(db, 'profiles'), 
        where('email', '==', email),
        where('role', '==', selectedRole)
      );
      
      const querySnapshot = await getDocs(profilesQuery);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error validating role:', error);
      return false;
    }
  };

  const loadUserProfile = async (firebaseUser: FirebaseUser) => {
    try {
      console.log('Loading profile for user:', firebaseUser.uid);
      
      const profileDoc = await getDoc(doc(db, 'profiles', firebaseUser.uid));
      
      if (profileDoc.exists()) {
        const profileData = profileDoc.data() as Profile;
        setUser({
          ...firebaseUser,
          profile: profileData,
        });
      } else {
        console.warn('No profile found for user');
        setUser({
          ...firebaseUser,
          profile: undefined,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setUser({
        ...firebaseUser,
        profile: undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  // Update signIn function to accept and validate role
  const signIn = async (email: string, password: string, selectedRole?: AuthRole) => {
    try {
      console.log('Attempting sign in...');
      
      // If role is provided, validate it first
      if (selectedRole) {
        const isValidRole = await validateRole(email, selectedRole);
        if (!isValidRole) {
          return { 
            error: { 
              message: `This email is not registered as a ${selectedRole} account. Please select the correct role.` 
            } 
          };
        }
      }

      await signInWithEmailAndPassword(auth, email, password);
      console.log('Sign in successful');
      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      let errorMessage = 'An error occurred during sign in';
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      return { error: { message: errorMessage } };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'teacher' | 'student' | 'admin' = 'student',
    roll_no?: string,
    className?: string,
    autoSignIn: boolean = true
  ) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
    
      // Update display name
      await updateProfile(user, { displayName: fullName });
    
      // Create profile doc
      const profileData: Profile = {
        id: user.uid,
        email,
        full_name: fullName,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await setDoc(doc(db, "profiles", user.uid), profileData);
    
      // Create a student record if role is student
      if (role === "student") {
        await addDoc(collection(db, "students"), {
          user_id: user.uid,
          full_name: fullName,
          email: email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          roll_no: roll_no || "",
          class: className || "",
        });
      }
      
      // Create a teacher record if role is teacher
      if (role === "teacher") {
        await addDoc(collection(db, "teachers"), {
          user_id: user.uid,
          full_name: fullName,
          subject: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email: email,
        });
      }
    
      // Sign out if autoSignIn is false (for admin-created accounts)
      if (!autoSignIn) {
        await firebaseSignOut(auth);
      }
    
      return { data: { user }, error: null };
    } catch (error: any) {
      console.error("Sign up error:", error);
      let errorMessage = "An error occurred during sign up";
    
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please sign in instead.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please choose a stronger password.";
      }
    
      return { data: null, error: { message: errorMessage } };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    validateRole, // Export the validateRole function
  };
}