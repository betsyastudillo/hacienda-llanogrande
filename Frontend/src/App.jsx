import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout/Layout"
import Login from "./pages/Login/Login"
import Orders from "./pages/Orders/Orders"
import OrderNew from "./pages/Orders/OrderNew/OrderNew"
import OrderDetail from "./pages/Orders/OrderDetail/OrderDetail"
import Products from "./pages/Products/Products"
import ProductForm from "./pages/Products/ProductForm/ProductForm"
import ProductInventory from "./pages/Products/ProductInventory/ProductInventory"
import LinkLogic from "./pages/LinkLogin/LinkLogin"
import Companies from "./pages/Companies/Companies"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<OrderNew />} />
            <Route path="/orders/:orderId" element={<OrderDetail />} />

            <Route path="/products" element={<Products />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:productId/edit" element={<ProductForm />} />
            <Route path="/products/:productId/inventory" element={<ProductInventory />} />
            <Route path="/link-login" element={<LinkLogic/>}/>     

            <Route path="/companies" element={<Companies />} />    
          </Route> 
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
