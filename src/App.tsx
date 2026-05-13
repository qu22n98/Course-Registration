/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, 
  Calendar, 
  MapPin, 
  User, 
  IdCard, 
  Mail, 
  CheckCircle2, 
  Lock, 
  FileSpreadsheet,
  Users,
  Download,
  LogIn,
  LogOut,
  AlertCircle
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy,
  doc,
  getDoc
} from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import * as XLSX from 'xlsx';
import { db, auth } from "./lib/firebase";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  const errorString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorString);
  throw new Error(errorString);
}

// Fallback for when Firebase is not yet configured
const isFirebaseConfigured = () => {
  try {
    return !!db;
  } catch {
    return false;
  }
};

interface Registration {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  courseId: string;
  courseName: string;
  createdAt: any;
}

interface Course {
  id: string;
  level: string;
  competency: string; // Add competency field
  title: string;
  date: string;
  location: string;
  available: boolean;
  regDeadline?: string;
  noticeDate?: string;
  description: string;
  duration: string;
  capacity: string;
}

const COURSES: Course[] = [
  {
    id: "course-1",
    level: "Level 2-3",
    competency: "글로벌 비즈니스 실무어학",
    title: "Effective Meeting Skills",
    date: "5/26(화) 13:30~16:30",
    location: "본사 1층 강당",
    available: true,
    regDeadline: "5/20(수)",
    noticeDate: "5/21(목)",
    duration: "3시간",
    capacity: "30명",
    description: "기본적인 미팅 프로세스와 표현 외에 효과적인 오프닝, 동의 비동의 및 포멀한 표현들을 숙지하고 실습과 피드백을 통해 이를 체득화한다."
  },
  {
    id: "course-2",
    level: "Level 2-3",
    competency: "글로벌 비즈니스 실무어학",
    title: "Effective Negotiation Skills",
    date: "7/15(수) 13:30~16:30",
    location: "본사 1층 강당",
    available: false,
    duration: "3시간",
    capacity: "30명",
    description: "협상의 기본을 (ZoPA, BATNA 등) 익히고 주요 표현을 상황별 시뮬레이션을 통해 학습한다."
  },
  {
    id: "course-3",
    level: "Level 2-3",
    competency: "글로벌 비즈니스 실무어학",
    title: "Effective Presentation Skills",
    date: "9/23(수) 13:30~16:30",
    location: "본사 1층 강당",
    available: false,
    duration: "3시간",
    capacity: "30명",
    description: "효과적인 프레젠테이션 진행을 위한 표현, 그래프 및 수치 읽는법, 설득력 높은 표현 등을 익히고 실습 및 피드백을 통해 실전 감각을 기른다."
  }
];

export default function App() {
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState(COURSES[0].id);
  const [rightView, setRightView] = useState<"info" | "form">("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [isAdminUnauthorized, setIsAdminUnauthorized] = useState(false);
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);
  const [checkedItems, setCheckedItems] = useState([false, false, false]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [employeeIdError, setEmployeeIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "admin") {
      setShowAdmin(true);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !showAdmin) {
      setRegistrations([]);
      return;
    }

    const q = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Registration[];
      setRegistrations(docs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "registrations");
    });

    return () => unsubscribe();
  }, [showAdmin]);

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    setRightView("info");
  };

   const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeIdError(null);
    setEmailError(null);

    if (!name || !employeeId || !email) return;

    // Validation
    let hasError = false;
    const idRegex = /^\d{6}$/;
    if (!idRegex.test(employeeId.trim())) {
      setEmployeeIdError("사번을 다시 한번 확인해주세요.");
      hasError = true;
    }

    if (!email.trim().toLowerCase().endsWith("@samyang.com")) {
      setEmailError("이메일 도메인을 다시 한번 확인해주세요.");
      hasError = true;
    }

    if (hasError) return;

    setCheckedItems([false, false, false]);
    setIsConfirming(true);
  };

  const handleConfirmSubmit = async () => {
    const selectedCourse = COURSES.find(c => c.id === selectedCourseId);
    if (!selectedCourse) return;

    setIsConfirming(false);
    setIsSubmitting(true);
    setError(null);

    try {
      if (!isFirebaseConfigured()) {
        throw new Error("Firebase 설정 중입니다. 잠시 후 다시 시도해주세요.");
      }

      const registrationData = {
        name: name.trim(),
        employeeId: employeeId.trim(),
        email: email.trim(),
        courseId: selectedCourse.id,
        courseName: selectedCourse.title,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "registrations"), registrationData);

      setIsSuccess(true);
      setName("");
      setEmployeeId("");
      setEmail("");
      
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err: any) {
      console.error("Submit Error:", err);
      try {
        const parsedError = JSON.parse(err.message);
        setError(`신청 실패: ${parsedError.error}`);
      } catch {
        handleFirestoreError(err, OperationType.WRITE, "registrations");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminLogin = async () => {
    setIsAdminLoggingIn(true);
    setIsAdminUnauthorized(false);
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user) {
        // Special bootstrapping for request email
        if (user.email === 'qu22n98@gmail.com') {
          setShowAdmin(true);
          return;
        }

        // Check if user is in admins collection
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        if (adminDoc.exists()) {
          setShowAdmin(true);
        } else {
          // Check by email as fallback or if configured that way
          // For now, assume UIDs are used for security
          // Signing out immediately if not authorized
          await signOut(auth);
          setIsAdminUnauthorized(true);
          setShowAdmin(false);
        }
      }
    } catch (err: any) {
      console.error("Admin Login Error:", err);
      // Don't show error if user closed the popup
      if (err.code !== 'auth/popup-closed-by-user') {
        setError("로그인 중 오류가 발생했습니다.");
      }
    } finally {
      setIsAdminLoggingIn(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    setShowAdmin(false);
  };

  const exportToExcel = () => {
    if (registrations.length === 0) return;
    
    // Prepare data for XLSX
    const data = registrations.map(reg => ({
      "이름": reg.name,
      "사번": reg.employeeId,
      "이메일": reg.email,
      "과정명": reg.courseName,
      "신청시간": reg.createdAt?.toDate ? reg.createdAt.toDate().toLocaleString() : ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

    // Write file
    XLSX.writeFile(workbook, `registrations_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#fdf8f6] flex flex-col font-sans text-slate-800">
      {/* Alert Portal */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-rose-600 text-white font-bold rounded-full shadow-2xl flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {alertMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation */}
      <header className="w-full p-6 md:p-8 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <img 
            src="/SAMYANG_SINCE1924_Logotype_Legacy Blue_Positive_RGB.png" 
            alt="Samyang Logo" 
            className="h-12 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="text-xl font-extrabold tracking-tight text-corporate whitespace-nowrap">교육과정 수강신청</span>
        </div>
        <nav className="hidden md:flex space-x-8 text-sm font-semibold text-slate-500 items-center">
          <a href="#" className="text-corporate underline underline-offset-4">교육안내</a>
          <button 
            onClick={() => {
              setAlertMessage("준비중입니다");
              setTimeout(() => setAlertMessage(null), 3000);
            }}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            만족도 조사
          </button>
          <button 
            onClick={() => setIsEnquiryOpen(true)}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            문의하기
          </button>
          {!showAdmin ? (
            <button 
              onClick={handleAdminLogin}
              disabled={isAdminLoggingIn}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {isAdminLoggingIn ? "확인 중..." : "관리자"}
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors"
              >
                <Download className="w-4 h-4" /> 엑셀 다운로드(.xlsx)
              </button>
              <button 
                onClick={handleAdminLogout}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> 로그아웃
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex flex-col lg:flex-row px-6 md:px-12 pb-12 gap-12 max-w-7xl mx-auto w-full">
        
        {/* Left Section: Course List */}
        <div className="w-full lg:w-7/12 flex flex-col justify-center py-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight mb-8">
              Global 교육과정 <span className="text-corporate">List</span>
            </h1>

            <div className="space-y-4">
              {COURSES.map((course, idx) => (
                <motion.div
                  key={course.id}
                  whileHover={course.available ? { x: 4 } : {}}
                  onClick={() => handleCourseSelect(course.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-6 ${
                    selectedCourseId === course.id 
                    ? 'bg-corporate/5 border-corporate/20 shadow-md ring-2 ring-corporate ring-offset-2' 
                    : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
                  } ${!course.available ? 'opacity-60 cursor-not-allowed grayscale' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                    selectedCourseId === course.id ? 'bg-corporate text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {idx + 1}
                  </div>
                    <div className="flex-grow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-500 uppercase">{course.competency}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 rounded text-blue-600 uppercase">{course.level}</span>
                        {!course.available && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 rounded text-rose-600 uppercase italic">Preparing</span>
                        )}
                      </div>
                      <h3 className={`font-bold text-lg ${selectedCourseId === course.id ? 'text-corporate' : 'text-slate-800'}`}>
                        {course.title}
                      </h3>
                      <div className="flex flex-wrap gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-rose-400" />
                          {course.date}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          {course.location}
                        </div>
                      </div>
                    </div>
                    {course.available && course.regDeadline && (
                      <div className="flex flex-col sm:items-end gap-1.5 p-3 sm:px-4 sm:py-3 bg-slate-50/80 rounded-2xl border border-slate-200 min-w-[140px]">
                        <div className="flex items-center gap-3 sm:gap-2 sm:flex-row-reverse">
                          <span className="text-[10px] font-bold text-slate-400 min-w-[40px] sm:text-right">접수마감</span>
                          <span className="text-[12px] font-black text-slate-800 tracking-tight">{course.regDeadline}</span>
                        </div>
                        <div className="w-full h-px bg-slate-200/60" />
                        <div className="flex items-center gap-3 sm:gap-2 sm:flex-row-reverse">
                          <span className="text-[10px] font-bold text-slate-400 min-w-[40px] sm:text-right">안내일자</span>
                          <span className="text-[12px] font-black text-corporate tracking-tight">{course.noticeDate}</span>
                        </div>
                      </div>
                    )}
                    </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Section: Info or Form */}
        <div className="w-full lg:w-5/12 flex flex-col justify-center min-h-[600px]">
          <AnimatePresence mode="wait">
            {rightView === "info" ? (
              <motion.div 
                key="info-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] border border-slate-50 flex flex-col h-full"
              >
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="inline-block px-4 py-1.5 bg-slate-100 text-slate-600 text-[11px] font-black rounded-full uppercase tracking-wider shadow-sm">
                      {COURSES.find(c => c.id === selectedCourseId)?.competency}
                    </div>
                    <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-black rounded-full uppercase tracking-wider shadow-sm">
                      {COURSES.find(c => c.id === selectedCourseId)?.level}
                    </div>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-3">
                    {COURSES.find(c => c.id === selectedCourseId)?.title}
                  </h2>
                  <p className="text-slate-600 leading-relaxed font-medium break-keep">
                    {COURSES.find(c => c.id === selectedCourseId)?.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> 교육일시
                    </p>
                    <p className="font-extrabold text-slate-900 text-sm">
                      {COURSES.find(c => c.id === selectedCourseId)?.date}
                    </p>
                    <p className="text-[10px] font-bold text-corporate mt-0.5">
                      총 {COURSES.find(c => c.id === selectedCourseId)?.duration} 과정
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> 교육장소
                    </p>
                    <p className="font-extrabold text-slate-900 text-sm">
                      {COURSES.find(c => c.id === selectedCourseId)?.location}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> 모집인원
                    </p>
                    <p className="font-extrabold text-slate-900 text-sm">
                      정원 {COURSES.find(c => c.id === selectedCourseId)?.capacity}
                    </p>
                  </div>
                  {COURSES.find(c => c.id === selectedCourseId)?.available && COURSES.find(c => c.id === selectedCourseId)?.regDeadline && (
                    <div className="p-4 bg-corporate/5 rounded-2xl border border-corporate/10 font-bold overflow-hidden">
                      <p className="text-[10px] font-bold text-corporate uppercase mb-1">
                        접수마감 및 안내
                      </p>
                      <p className="font-extrabold text-slate-900 text-sm">
                        마감: {COURSES.find(c => c.id === selectedCourseId)?.regDeadline}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                        안내: {COURSES.find(c => c.id === selectedCourseId)?.noticeDate}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-800">우선 선발 안내</p>
                      <p className="text-[11px] text-amber-700 leading-normal mt-1">
                        본 과정은 <span className="font-black underline decoration-2 underline-offset-2">Global Level 1 달성자</span>를 우선적으로 선발합니다.
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const course = COURSES.find(c => c.id === selectedCourseId);
                    if (course && !course.available) {
                      setAlertMessage("아직 신청기간이 아닙니다.");
                      setTimeout(() => setAlertMessage(null), 3000);
                      return;
                    }
                    setRightView("form");
                  }}
                  className={`w-full py-5 font-black rounded-2xl shadow-xl transition-all text-lg mt-auto flex items-center justify-center gap-2 ${
                    COURSES.find(c => c.id === selectedCourseId)?.available
                    ? 'bg-corporate hover:scale-[1.02] active:scale-[0.98] text-white shadow-corporate/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {COURSES.find(c => c.id === selectedCourseId)?.available ? "수강신청 하기" : "준비중"}
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="form-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] border border-slate-50 relative"
              >
                <button 
                  onClick={() => setRightView("info")}
                  className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    ← Back
                  </span>
                </button>

                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">수강 신청서</h2>
                <p className="text-slate-500 text-sm mb-8">
                  과정명: <span className="text-corporate font-bold underline underline-offset-4">
                    {COURSES.find(c => c.id === selectedCourseId)?.title}
                  </span>
                </p>

                <form onSubmit={handleOpenConfirm} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> 성명
                    </label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="홍길동" 
                      required
                      className="w-full px-5 py-4 bg-slate-50 border-0 rounded-2xl focus:ring-2 focus:ring-corporate text-slate-900 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2 ml-1">
                      <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                        <IdCard className="w-3 h-3" /> 사번
                      </label>
                      {employeeIdError && (
                        <span className="text-[10px] font-bold text-rose-500 animate-pulse">
                          {employeeIdError}
                        </span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      value={employeeId}
                      onChange={(e) => {
                        setEmployeeId(e.target.value);
                        if (employeeIdError) setEmployeeIdError(null);
                      }}
                      placeholder="숫자만 입력(예. 221269)" 
                      required
                      className={`w-full px-5 py-4 bg-slate-50 border-0 rounded-2xl focus:ring-2 text-slate-900 outline-none transition-all ${
                        employeeIdError ? 'ring-2 ring-rose-500 bg-rose-50' : 'focus:ring-corporate'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2 ml-1">
                      <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> 이메일
                      </label>
                      {emailError && (
                        <span className="text-[10px] font-bold text-rose-500 animate-pulse">
                          {emailError}
                        </span>
                      )}
                    </div>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      placeholder="example@samyang.com" 
                      required
                      className={`w-full px-5 py-4 bg-slate-50 border-0 rounded-2xl focus:ring-2 text-slate-900 outline-none transition-all ${
                        emailError ? 'ring-2 ring-rose-500 bg-rose-50' : 'focus:ring-corporate'
                      }`}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-5 bg-corporate hover:opacity-90 text-white font-bold rounded-2xl shadow-lg shadow-corporate/20 transition-all text-lg mt-4 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? "처리 중..." : "수강 신청 완료하기"}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
              {isConfirming && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsConfirming(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white rounded-[32px] p-8 md:p-10 shadow-2xl max-w-xl w-full"
                  >
                    <div className="w-16 h-16 bg-corporate/10 rounded-full flex items-center justify-center mb-6 mx-auto text-corporate">
                      <Lock className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 text-center mb-6">제출 전 확인해주세요</h3>
                    
                    <div className="space-y-4 text-sm mb-8 overflow-x-auto">
                      {[
                        { label: "교육 진행일정을 다시 한번 확인해주세요." },
                        { label: "제출한 내용이 사실과 다를 경우, 교육 안내가 불가합니다." },
                        { label: "교육 안내는 최종 선정되신 분들에 한해 안내 메일이 발송됩니다." }
                      ].map((item, idx) => (
                        <label key={idx} className="flex items-center gap-3 cursor-pointer group whitespace-nowrap">
                          <div className="relative flex items-center flex-shrink-0">
                            <input 
                              type="checkbox" 
                              checked={checkedItems[idx]}
                              onChange={(e) => {
                                const newChecked = [...checkedItems];
                                newChecked[idx] = e.target.checked;
                                setCheckedItems(newChecked);
                              }}
                              className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:bg-corporate checked:border-corporate"
                            />
                            <CheckCircle2 className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity" />
                          </div>
                          <span className="font-bold text-slate-700">
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    <p className="text-center font-extrabold text-slate-800 text-lg mb-8">제출 하시겠습니까?</p>

                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setIsConfirming(false)}
                        className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
                      >
                        취소
                      </button>
                      <button 
                        onClick={handleConfirmSubmit}
                        disabled={!checkedItems.every(Boolean)}
                        className={`py-4 font-bold rounded-2xl shadow-lg transition-all ${
                          checkedItems.every(Boolean) 
                          ? 'bg-corporate hover:opacity-90 text-white shadow-corporate/20' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        네, 제출합니다
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
              {isEnquiryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsEnquiryOpen(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white rounded-[32px] p-8 md:p-10 shadow-2xl max-w-md w-full"
                  >
                    <div className="w-16 h-16 bg-corporate/10 rounded-full flex items-center justify-center mb-6 mx-auto text-corporate">
                      <Mail className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 text-center mb-6">교육 문의 안내</h3>
                    
                    <div className="bg-slate-50 p-6 rounded-2xl space-y-4 mb-8">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">담당자</p>
                        <p className="text-slate-900 font-bold">HRD팀 김민경 매니저</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">이메일</p>
                        <p className="text-slate-900 font-bold">minkyung.kim@samyang.com</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">연락처</p>
                        <p className="text-slate-900 font-bold">02-740-7944</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setIsEnquiryOpen(false)}
                      className="w-full py-4 bg-corporate text-white font-bold rounded-2xl shadow-lg shadow-corporate/20 transition-all"
                    >
                      닫기
                    </button>
                  </motion.div>
                </div>
              )}
              {isAdminUnauthorized && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsAdminUnauthorized(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-white rounded-[32px] p-8 md:p-10 shadow-2xl max-w-md w-full"
                  >
                    <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-6 mx-auto text-rose-600">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 text-center mb-4">권한 없음</h3>
                    <p className="text-slate-600 text-center mb-8 font-medium">관리자만 로그인 가능합니다.</p>

                    <button 
                      onClick={() => setIsAdminUnauthorized(false)}
                      className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg transition-all"
                    >
                      확인
                    </button>
                  </motion.div>
                </div>
              )}
              {isSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 p-4 bg-green-50 text-green-700 rounded-2xl flex items-center justify-center gap-2 border border-green-100"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-bold">신청이 완료되었습니다!</span>
                </motion.div>
              )}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 p-4 bg-rose-50 text-rose-700 rounded-2xl flex items-center justify-center gap-2 border border-rose-100"
                >
                  <span className="text-sm font-bold">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
        </div>

      </main>

      {/* Bottom Status Bar */}
      <footer className="w-full px-6 md:px-12 py-6 bg-white border-t border-slate-100 flex justify-center items-center">
        <div className="text-xs text-slate-400">
          © 2026 Human Resources Development Team.
        </div>
      </footer>
    </div>
  );
}
