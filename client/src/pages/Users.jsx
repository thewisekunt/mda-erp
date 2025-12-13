import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Typography } from 'antd';
import { UserAddOutlined, DeleteOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;
const { Option } = Select;

export default function Users() {
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = () => {
        axios.get('http://localhost:5000/api/users')
            .then(res => setUsers(res.data))
            .catch(err => message.error("Failed to load users"));
    };

    const handleAddUser = (values) => {
        axios.post('http://localhost:5000/api/users', values)
            .then(() => {
                message.success("User Created!");
                setIsModalOpen(false);
                form.resetFields();
                fetchUsers();
            })
            .catch(err => message.error(err.response?.data || "Failed"));
    };

    const handleDelete = (id) => {
        axios.delete(`http://localhost:5000/api/users/${id}`)
            .then(() => {
                message.success("User Deleted");
                fetchUsers();
            });
    };

    const columns = [
        { title: 'Name', dataIndex: 'Full_Name', key: 'name' },
        { title: 'Username', dataIndex: 'Username', key: 'username' },
        { 
            title: 'Role', 
            dataIndex: 'Role', 
            key: 'role',
            render: role => {
                let color = role === 'Admin' ? 'red' : role === 'Manager' ? 'gold' : 'blue';
                return <Tag color={color}>{role.toUpperCase()}</Tag>;
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(record.User_ID)}>
                    <Button danger icon={<DeleteOutlined />} size="small">Remove</Button>
                </Popconfirm>
            )
        }
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Title level={2}><SafetyCertificateOutlined /> Staff Management</Title>
                <Button type="primary" icon={<UserAddOutlined />} onClick={() => setIsModalOpen(true)}>
                    Add New Staff
                </Button>
            </div>

            <Card>
                <Table dataSource={users} columns={columns} rowKey="User_ID" />
            </Card>

            <Modal title="Add New Staff Member" open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null}>
                <Form layout="vertical" form={form} onFinish={handleAddUser}>
                    <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
                        <Input placeholder="e.g. Rahul Sharma" />
                    </Form.Item>
                    
                    <Form.Item name="username" label="Username (Login ID)" rules={[{ required: true }]}>
                        <Input placeholder="e.g. rahul_sales" />
                    </Form.Item>

                    <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                        <Input.Password placeholder="Secret Password" />
                    </Form.Item>

                    <Form.Item name="role" label="Role" initialValue="Salesman">
                        <Select>
                            <Option value="Salesman">Salesman (Basic Access)</Option>
                            <Option value="Manager">Manager (Approvals)</Option>
                            <Option value="Admin">Admin (Full Control)</Option>
                        </Select>
                    </Form.Item>

                    <Button type="primary" htmlType="submit" block>Create User</Button>
                </Form>
            </Modal>
        </div>
    );
}