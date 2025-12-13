import { useState, useEffect, useMemo } from 'react';
import { Card, Table, Typography, Row, Col, Statistic, Button, Tag, Space, Modal, Form, Select, DatePicker, Input, Timeline, message, Tooltip } from 'antd';
import { PhoneOutlined, UserOutlined, ClockCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined, TeamOutlined, ScheduleOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function Recovery() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal States
    const [logModal, setLogModal] = useState(false);
    const [historyModal, setHistoryModal] = useState(false);
    
    // Selected Data for Modals
    const [selectedItem, setSelectedItem] = useState(null);
    const [historyLogs, setHistoryLogs] = useState([]);

    useEffect(() => {
        fetchDues();
    }, []);

    const fetchDues = () => {
        setLoading(true);
        axios.get('http://localhost:5000/api/recovery/dues')
            .then(res => {
                setList(res.data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    const fetchHistory = (custId) => {
        axios.get(`http://localhost:5000/api/recovery/history/${custId}`)
            .then(res => setHistoryLogs(res.data));
    };

    // --- ACTIONS ---
    const openLogModal = (record) => {
        setSelectedItem(record);
        setLogModal(true);
    };

    const openHistoryModal = (record) => {
        setSelectedItem(record);
        fetchHistory(record['Cust ID']);
        setHistoryModal(true);
    };

    const handleLogSubmit = (values) => {
        axios.post('http://localhost:5000/api/recovery/log', {
            ...values,
            custId: selectedItem['Cust ID'],
            frameNo: selectedItem['Frame No'],
            nextDate: values.nextDate ? values.nextDate.format('YYYY-MM-DD') : null
        }).then(() => {
            message.success("Follow-up Logged");
            setLogModal(false);
            fetchDues(); // Refresh list to see new dates
        });
    };

    // --- CALCULATIONS ---
    const stats = useMemo(() => {
        const totalDue = list.reduce((sum, item) => sum + item.Balance, 0);
        const overdueCount = list.filter(item => item.Promise_Date && dayjs().isAfter(dayjs(item.Promise_Date), 'day')).length;
        return { totalDue, overdueCount };
    }, [list]);

    // --- COLUMNS ---
    const columns = [
        {
            title: 'Status',
            key: 'status',
            render: (_, r) => {
                if (!r.Promise_Date) return <Tag color="orange">No Date</Tag>;
                const diff = dayjs(r.Promise_Date).diff(dayjs(), 'day');
                if (diff < 0) return <Tag color="red">Overdue {Math.abs(diff)} Days</Tag>;
                if (diff === 0) return <Tag color="blue">Due Today</Tag>;
                return <Tag color="green">Due in {diff} Days</Tag>;
            }
        },
        { 
            title: 'Customer', 
            dataIndex: 'Customer', 
            render: (t, r) => (
                <div>
                    <b>{t}</b><br/>
                    <a href={`tel:${r['Mobile No']}`}><PhoneOutlined /> {r['Mobile No']}</a>
                </div>
            ) 
        },
        { 
            title: 'Pending Amount', 
            dataIndex: 'Balance', 
            render: b => <Text type="danger" strong>₹ {b.toLocaleString()}</Text>,
            sorter: (a, b) => a.Balance - b.Balance,
        },
        { 
            title: 'Promise Date', 
            dataIndex: 'Promise_Date', 
            render: d => d ? dayjs(d).format('DD MMM YYYY') : '-' 
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, r) => (
                <Space>
                    <Tooltip title="Log Call/Visit">
                        <Button type="primary" size="small" icon={<PhoneOutlined />} onClick={() => openLogModal(r)}>Log</Button>
                    </Tooltip>
                    <Tooltip title="View History">
                        <Button size="small" icon={<ClockCircleOutlined />} onClick={() => openHistoryModal(r)} />
                    </Tooltip>
                </Space>
            )
        }
    ];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 50 }}>
            <div style={{ marginBottom: 20 }}>
                <Title level={2}>Recovery & Credit Management</Title>
                <Text type="secondary">Track outstanding dues and follow-ups</Text>
            </div>

            {/* STATS CARDS */}
            <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col span={8}>
                    <Card>
                        <Statistic 
                            title="Total Market Outstanding" 
                            value={stats.totalDue} 
                            prefix="₹" 
                            valueStyle={{ color: '#cf1322', fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic 
                            title="Overdue Accounts" 
                            value={stats.overdueCount} 
                            prefix={<ExclamationCircleOutlined />} 
                            valueStyle={{ color: '#faad14' }} 
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic 
                            title="Active Debtors" 
                            value={list.length} 
                            prefix={<TeamOutlined />} 
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="Outstanding Dues List">
                <Table 
                    dataSource={list} 
                    columns={columns} 
                    rowKey="Frame No" 
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    rowClassName={(record) => {
                        // Highlight overdue rows subtly
                        if (record.Promise_Date && dayjs().isAfter(dayjs(record.Promise_Date), 'day')) return 'bg-red-50';
                        return '';
                    }}
                />
            </Card>

            {/* MODAL 1: LOG INTERACTION */}
            <Modal 
                title={`Log Follow-up: ${selectedItem?.Customer}`} 
                open={logModal} 
                onCancel={() => setLogModal(false)} 
                footer={null}
            >
                <Form layout="vertical" onFinish={handleLogSubmit}>
                    <Form.Item name="type" label="Action Type" initialValue="Call">
                        <Select>
                            <Option value="Call">Phone Call</Option>
                            <Option value="Visit">Home Visit</Option>
                            <Option value="Message">WhatsApp/SMS</Option>
                            <Option value="Legal Notice">Legal Notice Sent</Option>
                        </Select>
                    </Form.Item>
                    
                    <Form.Item name="response" label="Customer Response" rules={[{required:true}]}>
                        <Input.TextArea placeholder="e.g. He promised to pay by Monday" rows={2} />
                    </Form.Item>

                    <Form.Item name="nextDate" label="Reschedule Promise Date (Optional)">
                        <DatePicker style={{width:'100%'}} />
                    </Form.Item>

                    <Button type="primary" htmlType="submit" block>Save Log & Update Date</Button>
                </Form>
            </Modal>

            {/* MODAL 2: HISTORY TIMELINE */}
            <Modal 
                title="Interaction History" 
                open={historyModal} 
                onCancel={() => setHistoryModal(false)} 
                footer={null}
            >
                {historyLogs.length === 0 ? <p>No history found.</p> : (
                    <Timeline mode="left">
                        {historyLogs.map(log => (
                            <Timeline.Item 
                                key={log.Log_ID} 
                                label={dayjs(log.Created_At).format('DD MMM, HH:mm')}
                                color={log.Action_Type === 'Visit' ? 'red' : 'blue'}
                            >
                                <b>{log.Action_Type}</b> ({log.Logged_By})
                                <p>{log.Response}</p>
                                {log.Next_Follow_Up && <Tag color="orange">Next: {dayjs(log.Next_Follow_Up).format('DD MMM')}</Tag>}
                            </Timeline.Item>
                        ))}
                    </Timeline>
                )}
            </Modal>
        </div>
    );
}