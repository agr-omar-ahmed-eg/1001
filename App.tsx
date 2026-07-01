import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  Plus, 
  Trash2, 
  CheckCircle, 
  ExternalLink, 
  Copy, 
  AlertCircle, 
  LogOut, 
  Loader2, 
  Sparkles, 
  Check, 
  ChevronDown, 
  RefreshCw, 
  Layers, 
  Clipboard,
  FileSpreadsheet,
  X,
  HelpCircle,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initAuth, googleSignIn, googleSignInRedirect, logout, getAccessToken } from './firebase';
import { Question, FormStructure } from './types';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [showAuthPopupNotice, setShowAuthPopupNotice] = useState<boolean>(false);

  // App workflow state
  const [inputMode, setInputMode] = useState<'image' | 'text'>('image');
  const [rawText, setRawText] = useState<string>('');
  
  // Image upload state - supporting up to 7 images
  interface ImageItem {
    id: string;
    file: File;
    preview: string;
    base64: string;
    mimeType: string;
  }
  const [uploadedImages, setUploadedImages] = useState<ImageItem[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Extracted data state
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hasExtracted, setHasExtracted] = useState<boolean>(false);

  // Status/Error state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMsg, setLoadingMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Confirmation state
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Created Form state
  const [createdFormId, setCreatedFormId] = useState<string | null>(null);
  const [createdFormUrl, setCreatedFormUrl] = useState<string | null>(null); // responderUri
  const [editFormUrl, setEditFormUrl] = useState<string | null>(null);
  const [copiedLinkType, setCopiedLinkType] = useState<'fill' | 'edit' | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        setShowAuthPopupNotice(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    setShowAuthPopupNotice(false);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const isPopupError = err?.code === 'auth/popup-closed-by-user' || 
                           err?.code === 'auth/cancelled-popup-request' ||
                           err?.message?.includes('popup-closed-by-user') ||
                           err?.message?.includes('popup');
      
      if (isPopupError) {
        setShowAuthPopupNotice(true);
        setErrorMsg('تم إغلاق نافذة تسجيل الدخول المنبثقة أو حظرها بواسطة المتصفح. يمكنك استخدام خيار "تسجيل الدخول البديل (إعادة التوجيه)" أدناه أو فتح التطبيق في نافذة مستقلة.');
      } else {
        setErrorMsg('عذراً، فشل تسجيل الدخول باستخدام Google. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLoginRedirect = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      await googleSignInRedirect();
    } catch (err: any) {
      console.error('Login redirect error:', err);
      setErrorMsg('عذراً، فشل تسجيل الدخول باستخدام Google عن طريق إعادة التوجيه. يرجى فتح التطبيق في نافذة مستقلة (علامة تبويب جديدة) وتجربته.');
      setIsLoggingIn(false);
    }
  };


  const handleLogout = async () => {
    try {
      await logout();
      // Reset everything on logout
      setQuestions([]);
      setFormTitle('');
      setFormDescription('');
      setHasExtracted(false);
      setUploadedImages([]);
      setRawText('');
      setCreatedFormId(null);
      setCreatedFormUrl(null);
      setEditFormUrl(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const compressAndResizeImage = (file: File): Promise<{ base64: string, preview: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Use image/jpeg with 0.7 quality to keep file size extremely small but perfectly readable
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, preview: dataUrl });
        };
        img.onerror = (err) => reject(err);
        img.src = event.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Image helpers for multiple uploads (max 7)
  const processFiles = async (files: File[] | FileList) => {
    const list = Array.from(files);
    const validImages = list.filter(f => f.type.startsWith('image/'));
    
    if (validImages.length === 0) {
      if (list.length > 0) {
        setErrorMsg('عذراً، يجب اختيار ملفات صور صالحة (PNG, JPG, WEBP).');
      }
      return;
    }

    if (uploadedImages.length + validImages.length > 7) {
      setErrorMsg('عذراً، يمكنك رفع ٧ صور كحد أقصى في المرة الواحدة.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);
    setLoadingMsg('جاري تحسين وضغط الصور للحفاظ على سرعة الرفع والأداء...');

    try {
      for (const file of validImages) {
        const { base64, preview } = await compressAndResizeImage(file);
        
        setUploadedImages(prev => {
          if (prev.length >= 7) return prev;
          
          return [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              file,
              preview,
              base64,
              mimeType: 'image/jpeg' // forced to jpeg through compression
            }
          ];
        });
      }
    } catch (err) {
      console.error('Error processing images:', err);
      setErrorMsg('حدث خطأ أثناء معالجة الصور وضغطها. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Analyze trigger
  const handleAnalyze = async () => {
    setErrorMsg('');
    setIsLoading(true);
    setCreatedFormId(null);

    try {
      if (inputMode === 'image') {
        if (uploadedImages.length === 0) {
          throw new Error('يرجى رفع صورة واحدة على الأقل لورقة الأسئلة.');
        }
        setLoadingMsg('جاري قراءة وتحليل صور الأسئلة بالذكاء الاصطناعي وصياغتها...');
        
        // Prepare images array for API
        const payloadImages = uploadedImages.map(img => ({
          imageBase64: img.base64,
          mimeType: img.mimeType
        }));

        const response = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: payloadImages })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'فشلت عملية تحليل الصور.');
        }

        const data: FormStructure = await response.json();
        setFormTitle(data.title || 'نموذج أسئلة جديد');
        setFormDescription(data.description || 'تم إنشاؤه تلقائياً بواسطة تطبيق ورقتي');
        
        // Ensure total extracted questions are capped at 100 max
        let extractedQuestions = data.questions || [];
        if (extractedQuestions.length > 100) {
          extractedQuestions = extractedQuestions.slice(0, 100);
          setErrorMsg('تنبيه: تم استخراج أكثر من ١٠٠ سؤال، وتم الاكتفاء بأول ١٠٠ سؤال كحد أقصى.');
        }
        setQuestions(extractedQuestions);
        setHasExtracted(true);
      } else {
        if (!rawText.trim()) {
          throw new Error('يرجى كتابة أو لصق نص الأسئلة أولاً.');
        }
        setLoadingMsg('جاري تحليل نص الأسئلة وإعادة تنظيمها...');

        const response = await fetch('/api/analyze-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'فشلت عملية تحليل النص.');
        }

        const data: FormStructure = await response.json();
        setFormTitle(data.title || 'نموذج أسئلة جديد');
        setFormDescription(data.description || 'تم إنشاؤه تلقائياً بواسطة تطبيق ورقتي');
        
        // Ensure total extracted questions are capped at 100 max
        let extractedQuestions = data.questions || [];
        if (extractedQuestions.length > 100) {
          extractedQuestions = extractedQuestions.slice(0, 100);
          setErrorMsg('تنبيه: تم استخراج أكثر من ١٠٠ سؤال، وتم الاكتفاء بأول ١٠٠ سؤال كحد أقصى.');
        }
        setQuestions(extractedQuestions);
        setHasExtracted(true);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ ما غير متوقع أثناء تحليل الأسئلة.');
    } finally {
      setIsLoading(false);
    }
  };

  // Question manipulation
  const handleQuestionTextChange = (index: number, val: string) => {
    const updated = [...questions];
    updated[index].text = val;
    setQuestions(updated);
  };

  const handleQuestionTypeChange = (index: number, type: any) => {
    const updated = [...questions];
    updated[index].type = type;
    // Initialize default options if converting to choice type and options are empty
    if (['multiple_choice', 'checkbox', 'dropdown'].includes(type) && (!updated[index].options || updated[index].options.length === 0)) {
      updated[index].options = ['الخيار الأول', 'الخيار الثاني'];
    }
    setQuestions(updated);
  };

  const handleRequiredToggle = (index: number) => {
    const updated = [...questions];
    updated[index].required = !updated[index].required;
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = val;
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    const currentOpts = updated[qIndex].options || [];
    updated[qIndex].options = [...currentOpts, `خيار جديد ${currentOpts.length + 1}`];
    setQuestions(updated);
  };

  const deleteOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options.splice(optIndex, 1);
    setQuestions(updated);
  };

  const deleteQuestion = (index: number) => {
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
  };

  const addNewQuestion = () => {
    const newQ: Question = {
      text: 'اكتب نص السؤال الجديد هنا...',
      type: 'short_answer',
      options: [],
      required: true
    };
    setQuestions([...questions, newQ]);
  };

  // Create Google Form API sequence
  const executeCreateForm = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    setErrorMsg('');
    setLoadingMsg('جاري الاتصال بـ Google لإنشاء النموذج الفارغ...');

    try {
      const activeToken = token || (await getAccessToken());
      if (!activeToken) {
        throw new Error('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.');
      }

      // Step 1: Create Form
      const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          info: {
            title: formTitle,
            documentTitle: formTitle,
          }
        })
      });

      if (!createRes.ok) {
        const errObj = await createRes.json();
        throw new Error(errObj.error?.message || 'فشل إنشاء النموذج الأساسي على Google Forms.');
      }

      const createdForm = await createRes.json();
      const formId = createdForm.formId;
      const responderUri = createdForm.responderUri;

      setLoadingMsg('جاري تعبئة النموذج بالأسئلة والخيارات المطلوبة...');

      // Step 2: Build batchUpdate payload to add questions
      const batchRequests = questions.map((q, idx) => {
        const item: any = {
          title: q.text,
          questionItem: {
            question: {
              required: q.required,
            }
          }
        };

        if (['short_answer', 'paragraph'].includes(q.type)) {
          item.questionItem.question.textQuestion = {
            paragraph: q.type === 'paragraph'
          };
        } else {
          // Choice questions must have options
          const finalOptions = q.options && q.options.length > 0 
            ? q.options.map(o => ({ value: o }))
            : [{ value: 'الخيار الأول' }];

          let typeVal = 'RADIO';
          if (q.type === 'checkbox') typeVal = 'CHECKBOX';
          if (q.type === 'dropdown') typeVal = 'DROP_DOWN';

          item.questionItem.question.choiceQuestion = {
            type: typeVal,
            options: finalOptions
          };
        }

        return {
          createItem: {
            item,
            location: {
              index: idx
            }
          }
        };
      });

      // Execute batchUpdate
      const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: batchRequests
        })
      });

      if (!updateRes.ok) {
        const errObj = await updateRes.json();
        throw new Error(errObj.error?.message || 'حدث خطأ أثناء إضافة الأسئلة للنموذج.');
      }

      // Success
      setCreatedFormId(formId);
      setCreatedFormUrl(responderUri);
      setEditFormUrl(`https://docs.google.com/forms/d/${formId}/edit`);
      
      // Clear workspace to show success
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'فشلت عملية إنشاء النموذج على حساب Google الخاص بك.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'fill' | 'edit') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLinkType(type);
      setTimeout(() => setCopiedLinkType(null), 2000);
    });
  };

  return (
    <div className="min-h-screen font-sans antialiased text-slate-900 bg-[#f8fafc] pb-20" dir="rtl">
      
      {/* Header */}
      <header className="border-b-4 border-slate-900 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-[#673ab7] rounded-xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-slate-900 text-white">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                ورقتي <span className="text-white text-xs font-black bg-[#673ab7] px-2.5 py-1 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Google Forms →</span>
              </h1>
              <p className="text-xs text-slate-600 hidden sm:block">توليد نماذج Google Forms ذكية من صور أسئلتك أو نصوصك</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-white rounded-full py-1.5 pl-4 pr-1.5 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="h-7 w-7 rounded-full border border-slate-900" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-[#673ab7] flex items-center justify-center text-white font-bold text-xs">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="text-xs text-slate-900 font-bold hidden md:block">{user.displayName}</span>
                <button 
                  onClick={handleLogout} 
                  title="تسجيل الخروج"
                  className="p-1 text-slate-500 hover:text-red-500 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="gsi-material-button flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-xl font-bold text-sm border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  )}
                  <span>ربط حساب Google</span>
                </button>
                <button
                  onClick={handleLoginRedirect}
                  disabled={isLoggingIn}
                  title="تسجيل دخول بديل بإعادة التوجيه (في حال فشل النافذة المنبثقة)"
                  className="p-2 bg-white text-slate-700 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 hidden md:flex items-center gap-1.5 text-xs font-bold"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>دخول بديل (إعادة توجيه)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Error Notification banner */}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3"
          >
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800">تنبيه:</p>
              <p className="text-xs text-red-700 mt-0.5 font-semibold">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-red-100 rounded text-red-600">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {showAuthPopupNotice && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-5 rounded-2xl bg-amber-50 border-2 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-right space-y-4"
          >
            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-black text-amber-950">💡 حلول مقترحة لتسجيل الدخول في بيئة المعاينة (Iframe):</p>
                <p className="text-xs text-amber-900 mt-2 font-bold leading-relaxed">
                  تطبيقات الويب التي تعمل داخل إطار (Iframe) تجريبي قد تواجه حظراً للنوافذ المنبثقة من قبل المتصفح أو بسبب حجب ملفات تعريف الارتباط للطرف الثالث (Third-party cookies). يمكنك تجاوز هذا العائق بسهولة عبر تجربة أحد الحلول السريعة التالية:
                </p>
              </div>
              <button onClick={() => setShowAuthPopupNotice(false)} className="p-1 hover:bg-amber-100 rounded text-amber-600 flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-4 bg-white border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                <div>
                  <p className="text-xs font-black text-slate-900 mb-1">١. فتح التطبيق في نافذة مستقلة (موصى به) 🌐</p>
                  <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                    انقر على أيقونة <strong className="text-[#673ab7]">"فتح في نافذة مستقلة" (Open in new tab)</strong> التي تظهر في شريط الأدوات العلوي للمعاينة في AI Studio لفتح التطبيق خارج الإطار (Iframe)، ومن ثم سجل دخولك بشكل طبيعي وآمن.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-slate-900 mb-1">٢. تسجيل الدخول بآلية إعادة التوجيه البديلة 🔄</p>
                  <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                    استخدم آلية تسجيل الدخول التي تقوم بتوجيه الصفحة مباشرة دون الحاجة لأي نوافذ منبثقة إضافية:
                  </p>
                </div>
                <button
                  onClick={handleLoginRedirect}
                  disabled={isLoggingIn}
                  className="w-full py-2 px-3 bg-[#673ab7] hover:bg-[#5e35b1] text-white rounded-lg text-xs font-black border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5"
                >
                  {isLoggingIn ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>تسجيل الدخول بإعادة التوجيه الآن</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Global Loading Spinner for processes */}
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#f8fafc]/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center"
            >
              <div className="relative mb-6">
                <div className="h-20 w-20 rounded-full border-4 border-slate-200 border-t-[#673ab7] animate-spin" />
                <Sparkles className="h-8 w-8 text-[#673ab7] absolute inset-0 m-auto animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">جاري العمل...</h3>
              <p className="text-sm text-slate-600 max-w-sm font-bold">{loadingMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WORKFLOW STEPS VIEW */}
        
        {/* SUCCESS SCREEN: Form successfully created */}
        {createdFormId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 rounded-3xl bg-white border-4 border-slate-900 text-center relative overflow-hidden mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="absolute top-0 right-0 h-40 w-40 bg-[#f3e5f5] rounded-full blur-3xl -mr-10 -mt-10" />
            
            <div className="h-16 w-16 bg-[#f3e5f5] text-[#673ab7] rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CheckCircle className="h-8 w-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-2">تهانينا! تم إنشاء الـ Google Form بنجاح 🎉</h2>
            <p className="text-slate-600 text-sm max-w-md mx-auto mb-8 font-bold">
              تم إعداد وتنسيق وحفظ نموذج الأسئلة "[{formTitle}]" مباشرة على حساب Google الخاص بك في Google Drive.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
              
              {/* Box 1: Student Link */}
              <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 text-right flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div>
                  <div className="flex items-center gap-2 text-green-700 text-sm font-black mb-3">
                    <Eye className="h-4 w-4" />
                    <span>رابط ملء النموذج (للطلاب والمشاركين)</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 font-semibold leading-relaxed">
                    هذا هو الرابط العام الذي ترسله لطلابك أو المشاركين للإجابة على الأسئلة.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(createdFormUrl || '', 'fill')}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-900 border-2 border-slate-900 transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    {copiedLinkType === 'fill' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-700" />
                        <span>نسخ الرابط</span>
                      </>
                    )}
                  </button>
                  <a
                    href={createdFormUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-4 rounded-xl bg-green-400 hover:bg-green-500 text-slate-950 font-black text-xs border-2 border-slate-900 transition-all flex items-center justify-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <span>فتح</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Box 2: Owner Edit Link */}
              <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 text-right flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div>
                  <div className="flex items-center gap-2 text-[#673ab7] text-sm font-black mb-3">
                    <FileText className="h-4 w-4" />
                    <span>رابط تعديل وتنسيق النموذج (لك كمعلم)</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 font-semibold leading-relaxed">
                    رابط خاص بك لتعديل الأسئلة، مشاهدة استجابات الطلاب، وتغيير سمات ومظهر النموذج.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(editFormUrl || '', 'edit')}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-900 border-2 border-slate-900 transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    {copiedLinkType === 'edit' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-700" />
                        <span>نسخ الرابط</span>
                      </>
                    )}
                  </button>
                  <a
                    href={editFormUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-4 rounded-xl bg-[#673ab7] hover:bg-[#5e35b1] text-white font-black text-xs border-2 border-slate-900 transition-all flex items-center justify-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <span>تعديل النموذج</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

            </div>

            <button
              onClick={() => {
                setQuestions([]);
                setFormTitle('');
                setFormDescription('');
                setHasExtracted(false);
                setCreatedFormId(null);
                setCreatedFormUrl(null);
                setEditFormUrl(null);
                setUploadedImages([]);
                setRawText('');
              }}
              className="py-3 px-6 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-50 text-sm font-black text-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              تحويل ورقة أسئلة جديدة ＋
            </button>
          </motion.div>
        )}

        {/* NO QUESTIONS EXTRACTED YET: SHOW INPUT AREA */}
        {!hasExtracted && !createdFormId && (
          <div className="space-y-8">
            
            {/* Brief Instructions banner */}
            <div className="p-6 rounded-3xl bg-[#f3e5f5] border-2 border-slate-900 text-right relative overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="absolute -left-10 -bottom-10 h-36 w-36 bg-[#673ab7]/10 rounded-full blur-2xl" />
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#673ab7] flex items-center justify-center text-white flex-shrink-0 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-1.5">أهلاً بك في تطبيق "ورقتي"</h3>
                  <p className="text-slate-700 text-xs sm:text-sm leading-relaxed max-w-2xl font-bold">
                    هل لديك ورقة امتحان مكتوبة بخط اليد؟ أو امتحان مطبوع وتريد تحويله إلى اختبار تفاعلي سريع؟ 
                    فقط قم برفع الصورة أو كتابة الأسئلة، وسيقوم الذكاء الاصطناعي باستخراجها وتصنيفها، ثم إنشائها كنموذج Google Form تفاعلي ومباشر على حسابك بضغطة زر واحدة!
                  </p>
                </div>
              </div>
            </div>

            {/* Input Options (Tabs) */}
            <div className="bg-white p-2 rounded-2xl border-2 border-slate-900 flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <button
                onClick={() => setInputMode('image')}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                  inputMode === 'image' 
                    ? 'bg-[#673ab7] text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ImageIcon className="h-4 w-4" />
                <span>رفع صورة ورقة الأسئلة 📷</span>
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                  inputMode === 'text' 
                    ? 'bg-[#673ab7] text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>كتابة أو لصق الأسئلة يدوياً ✍️</span>
              </button>
            </div>

            {/* Inputs Container */}
            <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              {inputMode === 'image' ? (
                <div className="space-y-6">
                  <div className="text-right">
                    <h4 className="text-sm font-black text-slate-800 mb-1">صورة الامتحان أو الأسئلة</h4>
                    <p className="text-xs text-slate-500 font-bold">ارفع صورة واضحة للامتحان المكتوب بخط اليد أو المطبوع.</p>
                  </div>

                  {/* Drag-and-Drop Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isDragOver 
                        ? 'border-[#673ab7] bg-[#f3e5f5]' 
                        : 'border-slate-300 hover:border-[#673ab7] bg-slate-50 hover:bg-slate-100/50'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      multiple
                      className="hidden" 
                    />
                    
                    {uploadedImages.length > 0 ? (
                      <div className="space-y-6" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {uploadedImages.map((img, idx) => (
                            <div key={img.id} className="relative group bg-slate-50 border-2 border-slate-900 rounded-xl p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              <img 
                                src={img.preview} 
                                alt={`صورة ${idx + 1}`} 
                                className="h-24 w-full object-cover rounded-lg"
                              />
                              <div className="absolute top-1.5 right-1.5 flex gap-1">
                                <span className="bg-[#673ab7] text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold border border-slate-900 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                                  {idx + 1}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUploadedImages(prev => prev.filter(item => item.id !== img.id));
                                }}
                                className="absolute -top-2 -left-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all hover:scale-105 animate-fade-in"
                                title="حذف الصورة"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <div className="text-[10px] text-slate-500 font-bold truncate mt-1 text-center px-1">
                                {img.file.name}
                              </div>
                            </div>
                          ))}

                          {uploadedImages.length < 7 && (
                            <div 
                              onClick={() => fileInputRef.current?.click()}
                              className="border-2 border-dashed border-slate-300 hover:border-[#673ab7] bg-white hover:bg-slate-50 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Plus className="h-5 w-5 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-500 mt-1">إضافة صورة</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 py-3 px-4 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-black text-slate-800">
                              تم اختيار {uploadedImages.length} صور من أصل ٧ كحد أقصى.
                            </span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedImages([]);
                            }}
                            className="text-xs text-red-600 hover:text-red-500 font-black hover:underline"
                          >
                            مسح جميع الصور 🗑️
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 py-6">
                        <div className="h-14 w-14 rounded-full bg-[#f3e5f5] border-2 border-slate-900 flex items-center justify-center mx-auto text-[#673ab7] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <Upload className="h-6 w-6" />
                        </div>
                        <p className="text-sm text-slate-800 font-black">اسحب وأفلت صور الامتحان هنا (حتى ٧ صور)</p>
                        <p className="text-xs text-slate-500 font-bold">أو اضغط للتصفح من جهازك (PNG, JPG, WEBP)</p>
                        <div className="inline-block bg-[#f3e5f5] text-[#673ab7] text-[10px] px-2 py-1 rounded-md font-bold border border-slate-900">
                          الحد الأقصى ١٠٠ سؤال في المرة الواحدة
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-right">
                    <h4 className="text-sm font-black text-slate-800 mb-1">الصق نص الأسئلة هنا</h4>
                    <p className="text-xs text-slate-500 font-bold">اكتب الأسئلة أو الصق نص الامتحان من أي ملف وسيقوم الذكاء الاصطناعي بتنظيمها وتصنيفها.</p>
                  </div>
                  <textarea
                    rows={8}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="مثال:&#10;السؤال الأول: اختر الإجابة الصحيحة:&#10;ما هي عاصمة مصر؟ (القاهرة - الجيزة - الإسكندرية)&#10;السؤال الثاني: ما هي أهمية الذكاء الاصطناعي في التعليم؟"
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-2xl p-4 text-sm font-semibold focus:border-[#673ab7] focus:ring-2 focus:ring-[#673ab7]/20 focus:outline-none transition-all text-right placeholder-slate-400 leading-relaxed text-slate-900"
                  />
                </div>
              )}

              {/* API authorization hint */}
              {needsAuth && (
                <div className="mt-6 p-4 rounded-xl bg-amber-50 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3 text-right text-slate-900">
                  <HelpCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-black text-amber-800">ملاحظة هامة قبل البدء:</p>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed font-bold">
                      لإنشاء الـ Google Form على حسابك، يرجى ربط حساب Google الخاص بك أولاً بالضغط على زر "ربط حساب Google" في الأعلى. 
                      هذا يمنح التطبيق صلاحية آمنة لإنشاء النموذج نيابة عنك فقط.
                    </p>
                  </div>
                </div>
              )}

              {/* Submit Trigger */}
              <div className="mt-8">
                <button
                  onClick={handleAnalyze}
                  disabled={isLoading || (inputMode === 'image' ? uploadedImages.length === 0 : !rawText.trim())}
                  className="w-full py-4 rounded-2xl bg-[#673ab7] hover:bg-[#5e35b1] text-white font-black text-base border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Sparkles className="h-5 w-5" />
                  <span>تحليل واستخراج الأسئلة بالذكاء الاصطناعي ✨</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUESTIONS PREVIEW & CUSTOMIZATION STEP */}
        {hasExtracted && !createdFormId && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            
            {/* Form Metadata Section */}
            <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-[#673ab7]" />
                    <span>تخصيص النموذج وتعديل الأسئلة</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-bold">راجع وقم بتعديل الأسئلة المستخرجة قبل إرسالها لـ Google Forms.</p>
                </div>
                <button 
                  onClick={() => {
                    if (window.confirm('هل تريد العودة وإعادة تحميل المستند؟ سيتم فقد أي تغييرات قمت بها.')) {
                      setQuestions([]);
                      setFormTitle('');
                      setFormDescription('');
                      setHasExtracted(false);
                    }
                  }}
                  className="py-1.5 px-3 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-50 text-xs text-slate-800 font-bold transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  إعادة المحاولة ↺
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 text-right">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase block mb-1.5">عنوان النموذج (Title)</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl py-2.5 px-4 text-sm font-bold focus:border-[#673ab7] focus:outline-none transition-colors text-right text-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    placeholder="مثال: اختبار لمادة العلوم"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 uppercase block mb-1.5">وصف النموذج (Description)</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl py-2 px-4 text-xs font-bold focus:border-[#673ab7] focus:outline-none transition-colors text-right text-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    placeholder="اكتب وصفاً قصيراً أو تعليمات للطلاب هنا..."
                  />
                </div>
              </div>
            </div>

            {/* Questions List Header */}
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-black text-slate-600">الأسئلة المستخرجة ({questions.length})</span>
              <button 
                onClick={addNewQuestion}
                className="py-1.5 px-3 bg-[#673ab7] hover:bg-[#5e35b1] text-white border-2 border-slate-900 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة سؤال جديد</span>
              </button>
            </div>

            {/* Questions Cards */}
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div 
                  key={idx}
                  className="bg-white rounded-2xl border-2 border-slate-900 p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-right relative hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="text-xs text-white font-black bg-slate-900 px-2.5 py-1 rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">سؤال {idx + 1}</span>
                    <button
                      onClick={() => deleteQuestion(idx)}
                      title="حذف هذا السؤال"
                      className="p-1.5 rounded-xl border-2 border-transparent text-slate-500 hover:text-red-500 hover:border-slate-900 hover:bg-slate-50 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4 pt-4">
                    {/* Question Text */}
                    <div>
                      <label className="text-xs font-black text-slate-500 block mb-1">نص السؤال</label>
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => handleQuestionTextChange(idx, e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl py-2.5 px-4 text-sm font-bold focus:border-[#673ab7] focus:outline-none transition-colors text-right text-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      />
                    </div>

                    {/* Question Type and Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Select type */}
                      <div>
                        <label className="text-xs font-black text-slate-500 block mb-1">نوع السؤال</label>
                        <div className="relative">
                          <select
                            value={q.type}
                            onChange={(e) => handleQuestionTypeChange(idx, e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:border-[#673ab7] focus:outline-none transition-colors appearance-none pr-3 pl-8 text-right cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          >
                            <option value="short_answer">إجابة قصيرة (Short Answer)</option>
                            <option value="paragraph">فقرة إجابة طويلة (Paragraph)</option>
                            <option value="multiple_choice">اختيار من متعدد (Multiple Choice)</option>
                            <option value="checkbox">مربعات اختيار (Checkbox)</option>
                            <option value="dropdown">قائمة منسدلة (Dropdown)</option>
                          </select>
                          <ChevronDown className="h-4 w-4 text-slate-700 absolute left-3 top-3 pointer-events-none" />
                        </div>
                      </div>

                      {/* Required Toggle */}
                      <div className="flex items-center justify-end md:justify-start gap-3 pt-6 md:pt-4">
                        <label className="text-xs font-black text-slate-600">مطلوب الإجابة عليه (إجباري)</label>
                        <button
                          type="button"
                          onClick={() => handleRequiredToggle(idx)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-slate-900 transition-colors duration-200 ease-in-out focus:outline-none ${
                            q.required ? 'bg-[#673ab7]' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white border border-slate-900 shadow transition duration-200 ease-in-out ${
                              q.required ? '-translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Choice Options (Only for Choice-based Questions) */}
                    {['multiple_choice', 'checkbox', 'dropdown'].includes(q.type) && (
                      <div className="bg-[#f3e5f5]/30 p-4 rounded-xl border-2 border-slate-900 space-y-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <span className="text-xs font-black text-slate-600 block border-b border-slate-200 pb-1.5 mb-2">خيارات السؤال:</span>
                        
                        <div className="space-y-2">
                          {q.options?.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <span className="text-xs text-slate-600 font-bold">{optIdx + 1}-</span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleOptionChange(idx, optIdx, e.target.value)}
                                className="flex-1 bg-white border-2 border-slate-900 rounded-lg py-1.5 px-3 text-xs font-semibold focus:border-[#673ab7] text-slate-950 focus:outline-none"
                              />
                              <button
                                onClick={() => deleteOption(idx, optIdx)}
                                className="p-1 text-slate-500 hover:text-red-500 hover:bg-slate-100 rounded"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => addOption(idx)}
                          className="py-1 px-3 border-2 border-dashed border-slate-900 hover:bg-slate-50 rounded-lg text-xs font-black text-slate-700 hover:text-[#673ab7] flex items-center gap-1 mt-2 transition-all active:scale-95"
                        >
                          <Plus className="h-3 w-3" />
                          <span>إضافة خيار</span>
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>

            {/* Form Creation Action Area */}
            <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-right">
                <span className="text-xs text-slate-500 block font-bold">جاهز للنشر على حسابك!</span>
                <span className="text-sm font-black text-slate-900">سيتم إنشاء نموذج Google Form بـ {questions.length} سؤال.</span>
              </div>
              
              {needsAuth ? (
                <button
                  onClick={handleLogin}
                  className="py-3 px-6 rounded-xl bg-white text-slate-900 font-black text-xs border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>سجل دخول بالـ Google لإنشاء النموذج 🔐</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="py-3 px-6 rounded-xl bg-[#673ab7] hover:bg-[#5e35b1] text-white font-black text-xs border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>📋 إنشاء نموذج Google Form الآن</span>
                </button>
              )}
            </div>

          </motion.div>
        )}

      </main>

      {/* CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 text-center"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border-4 border-slate-900 rounded-3xl max-w-md w-full p-6 text-right shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-5"
            >
              <div className="h-12 w-12 rounded-xl bg-[#f3e5f5] text-[#673ab7] flex items-center justify-center border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <FileSpreadsheet className="h-6 w-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-900">تأكيد إنشاء نموذج Google Form؟</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-bold">
                  هل أنت متأكد من رغبتك في إنشاء نموذج جديد باسم <strong className="text-slate-900">"[{formTitle}]"</strong> على حساب Google Drive الخاص بك؟ سيتم إضافة <strong className="text-[#673ab7] font-black">{questions.length} أسئلة</strong> إليه تلقائياً.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={executeCreateForm}
                  className="flex-1 py-3 bg-green-400 hover:bg-green-500 text-slate-950 border-2 border-slate-900 rounded-xl font-black text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                >
                  نعم، أنشئ النموذج
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-900 rounded-xl font-bold text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
