import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Analytics from "./pages/Analytics";
import History from "./pages/History";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors theme="dark" /><Switch><Route path="/"><DashboardLayout><Home /></DashboardLayout></Route><Route path="/analytics"><DashboardLayout><Analytics /></DashboardLayout></Route><Route path="/history"><DashboardLayout><History /></DashboardLayout></Route><Route><NotFound /></Route></Switch></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
