import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardOverview from "./pages/DashboardOverview";
import Tasks from "./pages/Tasks";
import Criativos from "./pages/Criativos";
import Educacional from "./pages/Educacional";
import Swipe from "./pages/Swipe";
import Arquivos from "./pages/Arquivos";
import MobileToday from "./pages/MobileToday";
import MobileUpcoming from "./pages/MobileUpcoming";
import MobileBrowse from "./pages/MobileBrowse";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import { TabGuard } from "./components/TabGuard";
import { ThemeProvider } from "./contexts/ThemeContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<TabGuard tab="dashboard"><DashboardOverview /></TabGuard>} />
            <Route path="tasks" element={<TabGuard tab="tasks"><Tasks /></TabGuard>} />
            <Route path="criativos" element={<TabGuard tab="criativos"><Criativos /></TabGuard>} />
            <Route path="educacional" element={<TabGuard tab="educacional"><Educacional /></TabGuard>} />
            <Route path="swipe" element={<TabGuard tab="swipe"><Swipe /></TabGuard>} />
            <Route path="arquivos" element={<TabGuard tab="arquivos"><Arquivos /></TabGuard>} />
            <Route path="hoje" element={<MobileToday />} />
            <Route path="em-breve" element={<MobileUpcoming />} />
            <Route path="navegar" element={<MobileBrowse />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
