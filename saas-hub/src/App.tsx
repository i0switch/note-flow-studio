import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { lazy, Suspense } from "react";
import { AppDataProvider } from "@/context/AppDataContext";
import NotFound from "./pages/NotFound.tsx";

const GeneratePage = lazy(() => import("./pages/GeneratePage"));
const ArticlesPage = lazy(() => import("./pages/ArticlesPage"));
const ArticleDetailPage = lazy(() => import("./pages/ArticleDetailPage"));
const ManualArticlePage = lazy(() => import("./pages/ManualArticlePage"));
const PromptsPage = lazy(() => import("./pages/PromptsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DiagnosticsPage = lazy(() => import("./pages/DiagnosticsPage"));

const queryClient = new QueryClient();

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppDataProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<GeneratePage />} />
                <Route path="/articles" element={<ArticlesPage />} />
                <Route path="/articles/new" element={<ManualArticlePage />} />
                <Route path="/articles/:id" element={<ArticleDetailPage />} />
                <Route path="/prompts" element={<PromptsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/diagnostics" element={<DiagnosticsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AppDataProvider>
  </QueryClientProvider>
);

export default App;
