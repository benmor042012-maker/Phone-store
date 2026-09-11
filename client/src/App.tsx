/** Original PHONE STORE structure, restyled only with the black-and-gold brand system. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

/**
 * Content administration is the shop owner's screen, not the shop's. Loading it on demand
 * keeps the product panel, the media library and their forms out of the bundle every
 * customer downloads, which is most of what the storefront was shipping unused.
 */
const Admin = lazy(() => import("./pages/Admin"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return <Switch><Route path="/" component={Home} /><Route path="/products/:id" component={Home} /><Route path="/admin">{() => <Suspense fallback={<main dir="rtl" style={{ minHeight: "100vh", background: "#080807", color: "#b6afa4", display: "grid", placeItems: "center" }}>טוען את ניהול התוכן…</main>}><Admin /></Suspense>}</Route><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster position="bottom-left" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
