// client/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // <--- This line imports the CSS file above
import axios from 'axios';
import { message } from 'antd';

// --- GLOBAL AXIOS CONFIGURATION ---
axios.defaults.baseURL = 'http://localhost:5000';

// 1. Attach Token to every request
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) config.headers['Authorization'] = token;
        return config;
    },
    (error) => Promise.reject(error)
);

// 2. Handle Session Expiry
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            // Only redirect if not already on login page
            if (window.location.pathname !== '/login') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                message.error("Session Expired. Please Login.");
                window.location.href = '/login'; 
            }
        }
        return Promise.reject(error);
    }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);