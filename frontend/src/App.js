import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import DocsLayout from "@/components/DocsLayout";
import HomePage from "@/pages/HomePage";
import VideoPage from "@/pages/VideoPage";
import DocPage from "@/pages/DocPage";
import DocsIndexPage from "@/pages/DocsIndexPage";
import ApiReferenceIndexPage from "@/pages/ApiReferenceIndexPage";
import ApiReferencePage from "@/pages/ApiReferencePage";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminEditor from "@/pages/AdminEditor";
import ProtectedRoute from "@/components/ProtectedRoute";

const TelephonyLabPage = lazy(() => import("@/pages/TelephonyLabPage"));

function WorkshopLoading() {
  const { lang } = useLanguage();
  return <p role="status">{lang === "en" ? "Loading workshop…" : "Atölye yükleniyor…"}</p>;
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/verasistLAB" element={<Suspense fallback={<WorkshopLoading />}><TelephonyLabPage /></Suspense>} />
            <Route path="/verasistLAB/:animation" element={<Suspense fallback={<WorkshopLoading />}><TelephonyLabPage /></Suspense>} />
            <Route path="/ogren/telefon-santrali" element={<Suspense fallback={<WorkshopLoading />}><TelephonyLabPage /></Suspense>} />
            <Route element={<DocsLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/docs" element={<DocsIndexPage />} />
              <Route path="/docs/:tabSlug" element={<DocsIndexPage />} />
              <Route path="/docs/:tabSlug/:docSlug" element={<DocPage />} />
              <Route path="/docs/:slug" element={<DocPage />} />
              <Route path="/api-referansi" element={<ApiReferenceIndexPage />} />
              <Route path="/api-referansi/:groupSlug" element={<ApiReferenceIndexPage />} />
              <Route path="/api-referansi/:groupSlug/*" element={<ApiReferencePage />} />
              <Route path="/videos" element={<VideoPage />} />
              {/* Catch-all: Mintlify-style paths like /voice-agent/start-call */}
              <Route path="*" element={<DocPage />} />
            </Route>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/edit/:id"
              element={
                <ProtectedRoute>
                  <AdminEditor />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
