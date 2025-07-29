import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import POSPage from "../pages/POSPage";
import DashboardPage from "../pages/DashboardPage";
import ReportsPage from "../pages/ReportsPage";
import SettingsPage from "../components/SettingsPage";
import PaymentPage from "../pages/PaymentPage";
import CustomersPage from "../components/CustomersPage";
import CustomerDetailPage from "../components/CustomerDetailPage";
import CartPage from "../components/CartPage";
import MobileCustomersPage from "../components/MobileCustomersPage";
import MobileAddCustomerPage from "../components/MobileAddCustomerPage";
import MobilePaymentPage from "../components/MobilePaymentPage";
import ProtectedRoute from "../components/ProtectedRoute";
import App from "../App";
import HomePage from "../pages/HomePage";
import InvoiceHistoryPage from "../pages/InvoiceHistory";
import InvoiceViewPage from "../pages/InvoiceViewPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />, // This will redirect to /pos or /login
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "pos",
        element: <ProtectedRoute element={<POSPage />} />,
      },
      {
        path: "dashboard",
        element: <ProtectedRoute element={<DashboardPage />} />,
      },
      {
        path: "reports",
        element: <ProtectedRoute element={<ReportsPage />} />,
      },
      {
        path: "invoice",
        element: <ProtectedRoute element={<InvoiceHistoryPage />} />,
      },
      {
        path: "invoice/:id",
        element: <ProtectedRoute element={<InvoiceViewPage />} />,
      },
      {
        path: "customers",
        element: <ProtectedRoute element={<CustomersPage />} />,
      },
      {
        path: "customers/:id",
        element: <ProtectedRoute element={<CustomerDetailPage />} />,
      },
      {
        path: "cart",
        element: <ProtectedRoute element={<CartPage />} />,
      },
      {
        path: "mobile/customers",
        element: <ProtectedRoute element={<MobileCustomersPage />} />,
      },
      {
        path: "mobile/add-customer",
        element: <ProtectedRoute element={<MobileAddCustomerPage />} />,
      },
      {
        path: "mobile/payment",
        element: <ProtectedRoute element={<MobilePaymentPage />} />,
      },
      {
        path: "settings",
        element: <ProtectedRoute element={<SettingsPage />} />,
      },
      {
        path: "payment/:invoiceId",
        element: <ProtectedRoute element={<PaymentPage />} />,
      },
    ],
  },
]);

export default router;
