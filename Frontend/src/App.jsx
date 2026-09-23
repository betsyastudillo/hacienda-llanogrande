import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout/Layout"
import Login from "./pages/Login/Login"
import Orders from "./pages/Orders/Orders"
import OrderNew from "./pages/Orders/OrderNew/OrderNew"
import OrderDetail from "./pages/Orders/OrderDetail/OrderDetail"


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
            >
            <Route index element={<Orders />} />
            <Route path="new" element={<OrderNew />} />
            <Route path=":orderId" element={<OrderDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
