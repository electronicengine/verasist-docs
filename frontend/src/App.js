import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import DocsLayout from "@/components/DocsLayout";
import HomePage from "@/pages/HomePage";
import VideoPage from "@/pages/VideoPage";
import DocPage from "@/pages/DocPage";
import DocsIndexPage from "@/pages/DocsIndexPage";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminEditor from "@/pages/AdminEditor";
import ProtectedRoute from "@/components/ProtectedRoute";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<DocsLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/docs" element={<DocsIndexPage />} />
              <Route path="/docs/:tabSlug" element={<DocsIndexPage />} />
              <Route path="/docs/:tabSlug/:docSlug" element={<DocPage />} />
              <Route path="/docs/:slug" element={<DocPage />} />
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
