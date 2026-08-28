import { useEffect } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootLayout } from "./layouts/RootLayout";
import { LandingPage } from "./pages/LandingPage";
import { ProcessingPage } from "./pages/ProcessingPage";
import { TranscriptPage } from "./pages/TranscriptPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage, NotFoundPage, RegisterPage } from "./pages/AuthPages";
import { Toaster } from "./components/Toaster";
import { useAuth } from "./store/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/t/:jobId/processing", element: <ProcessingPage /> },
      { path: "/t/:id", element: <TranscriptPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
