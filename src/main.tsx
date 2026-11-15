import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "@/auth/Auth";
import { ToastProvider } from "@/components/ui";
import { I18nProvider } from "@/i18n/I18n";
import AppShell from "@/layout/AppShell";
import "./index.css";

const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.Register })));
const Forgot = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.Forgot })));
const Reset = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.Reset })));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const TagQuestion = lazy(() => import("@/pages/TagQuestion"));
const Bulk = lazy(() => import("@/pages/Bulk"));
const QuestionBank = lazy(() => import("@/pages/QuestionBank"));
const QuestionDetail = lazy(() => import("@/pages/QuestionDetail"));
const Papers = lazy(() => import("@/pages/Papers"));
const PaperBuilder = lazy(() => import("@/pages/PaperBuilder"));
const Review = lazy(() => import("@/pages/Review"));
const Practice = lazy(() => import("@/pages/Practice"));
const PracticePlay = lazy(() => import("@/pages/PracticePlay"));
const PracticeResult = lazy(() => import("@/pages/PracticeResult"));
const Progress = lazy(() => import("@/pages/Progress"));
const Children = lazy(() => import("@/pages/Children"));
const Admin = lazy(() => import("@/pages/admin/Admin"));
const Profile = lazy(() => import("@/pages/Profile"));
const Tests = lazy(() => import("@/pages/Tests"));
const TestTake = lazy(() => import("@/pages/Tests").then((m) => ({ default: m.TestTake })));
const TestResult = lazy(() => import("@/pages/Tests").then((m) => ({ default: m.TestResult })));
const WeeklyReport = lazy(() => import("@/pages/WeeklyReport"));
const AiModel = lazy(() => import("@/pages/AiModel"));
const TagReview = lazy(() => import("@/pages/School").then((m) => ({ default: m.TagReview })));
const OmrOverview = lazy(() => import("@/pages/School").then((m) => ({ default: m.OmrOverview })));
const ClassReports = lazy(() => import("@/pages/School").then((m) => ({ default: m.ClassReports })));
const Groups = lazy(() => import("@/pages/School").then((m) => ({ default: m.Groups })));
const FeedbackPage = lazy(() => import("@/pages/School").then((m) => ({ default: m.FeedbackPage })));
const Settings = lazy(() => import("@/pages/Settings"));

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const Loader = () => (
  <div className="grid min-h-[50vh] place-items-center">
    <img src="/logo-mark.webp" alt="" className="h-14 animate-pulse" />
  </div>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={<Loader />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<Forgot />} />
                  <Route path="/reset-password" element={<Reset />} />
                  <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
                    <Route index element={<Suspense fallback={<Loader />}><Dashboard /></Suspense>} />
                    <Route path="tag" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><TagQuestion /></RequireAuth>} />
                    <Route path="bulk" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><Bulk /></RequireAuth>} />
                    <Route path="questions" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><QuestionBank /></RequireAuth>} />
                    <Route path="questions/:id" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><QuestionDetail /></RequireAuth>} />
                    <Route path="papers" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><Papers /></RequireAuth>} />
                    <Route path="papers/:id" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><PaperBuilder /></RequireAuth>} />
                    <Route path="review" element={<RequireAuth roles={["admin", "moderator"]}><Review /></RequireAuth>} />
                    <Route path="practice" element={<RequireAuth roles={["student"]}><Practice /></RequireAuth>} />
                    <Route path="practice/:id" element={<RequireAuth roles={["student"]}><PracticePlay /></RequireAuth>} />
                    <Route path="practice/:id/result" element={<RequireAuth roles={["student"]}><PracticeResult /></RequireAuth>} />
                    <Route path="progress" element={<RequireAuth roles={["student"]}><Progress /></RequireAuth>} />
                    <Route path="students/:sid/progress" element={<Progress />} />
                    <Route path="children" element={<RequireAuth roles={["parent"]}><Children /></RequireAuth>} />
                    <Route path="admin" element={<RequireAuth roles={["admin"]}><Admin /></RequireAuth>} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="tests" element={<RequireAuth roles={["admin", "teacher", "moderator", "student"]}><Tests /></RequireAuth>} />
                    <Route path="tests/:id/take" element={<RequireAuth roles={["student"]}><TestTake /></RequireAuth>} />
                    <Route path="tests/:id/result" element={<RequireAuth roles={["student"]}><TestResult /></RequireAuth>} />
                    <Route path="report" element={<RequireAuth roles={["student"]}><WeeklyReport /></RequireAuth>} />
                    <Route path="tag-review" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><TagReview /></RequireAuth>} />
                    <Route path="omr" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><OmrOverview /></RequireAuth>} />
                    <Route path="class-reports" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><ClassReports /></RequireAuth>} />
                    <Route path="groups" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><Groups /></RequireAuth>} />
                    <Route path="feedback" element={<RequireAuth roles={["parent", "student"]}><FeedbackPage /></RequireAuth>} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="ai" element={<RequireAuth roles={["admin", "teacher", "moderator"]}><AiModel /></RequireAuth>} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
