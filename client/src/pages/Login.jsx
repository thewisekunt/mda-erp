import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

export default function Login({ onLogin }) {
    const [loading, setLoading] = useState(false);

    const handleLogin = async (values) => {
        setLoading(true);
        try {
            const res = await axios.post('/api/login', values);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            message.success(`Welcome back, ${res.data.user.name}`);
            onLogin(res.data.user);
        } catch (err) {
            message.error("Invalid Username or Password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ 
            height: '100vh', 
            background: '#1F1F1F', // Dark Background
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
        }}>
            <Card style={{ width: 400, borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderTop: '4px solid #E4002B' }}>
                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <Title level={2} style={{ color: '#E4002B', margin: 0, fontWeight:'bold' }}>HONDA</Title>
                    <Text type="secondary" style={{letterSpacing: 1, textTransform:'uppercase', fontSize:12}}>Dealer Management System</Text>
                </div>
                
                <Form onFinish={handleLogin} size="large" layout="vertical">
                    <Form.Item name="username" rules={[{ required: true, message: 'Required' }]}>
                        <Input prefix={<UserOutlined style={{color:'#E4002B'}} />} placeholder="Username" />
                    </Form.Item>
                    <Form.Item name="password" rules={[{ required: true, message: 'Required' }]}>
                        <Input.Password prefix={<LockOutlined style={{color:'#E4002B'}} />} placeholder="Password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading} style={{ background: '#E4002B', borderColor: '#E4002B', fontWeight:'bold' }}>
                        SECURE LOGIN
                    </Button>
                </Form>
            </Card>
        </div>
    );
}
