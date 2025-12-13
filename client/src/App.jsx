import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

// Components
import Login from './pages/Login';
import MainLayout from './components/MainLayout';
import NewSale from './pages/NewSale';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import SalesHistory from './pages/SalesHistory';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts'; // <--- Import is correct
import Recovery from './pages/Recovery'; // Import
import PreSales from './pages/PreSales';
import Users from './pages/Users';



export default function App() {
    const [user, setUser] = useState(null);

    // Check if user is already logged in when app starts
    useEffect(() => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (token && savedUser) {
            setUser(JSON.parse(savedUser));
            // Attach token to all future axios requests
            axios.defaults.headers.common['Authorization'] = token;
        }
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
        window.location.reload(); 
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/';
    };

    // If not logged in, show Login Page
    if (!user) {
        return <Login onLogin={handleLogin} />;
    }

    // If logged in, show the App
    return (
        <Router>
            <MainLayout user={user} onLogout={handleLogout}>
                <Routes>
	 <Route path="/presales" element={<PreSales />} />
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/new-sale" element={<NewSale />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/sales-history" element={<SalesHistory />} />
                    <Route path="/accounts" element={<Accounts />} /> {/* <--- Placed here safely */}
                    <Route path="/recovery" element={<Recovery />} />
	<Route path="/users" element={<Users />} />


                    {/* Catch-All Route (Must be last) */}
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </MainLayout>
        </Router>
    );
}