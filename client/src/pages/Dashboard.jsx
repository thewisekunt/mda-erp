import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Spin, Alert } from 'antd';
import { ShoppingCartOutlined, DollarOutlined, CarOutlined, UsergroupAddOutlined, RiseOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        axios.get('http://localhost:5000/api/dashboard/stats')
            .then(res => {
                setStats(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Could not load data. Check Backend.");
                setLoading(false);
            });
    }, []);

    if (loading) return <div style={{textAlign:'center', marginTop:50}}><Spin size="large" /></div>;
    if (error) return <Alert message="Error" description={error} type="error" showIcon />;

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Title level={2} style={{ marginBottom: 20 }}>Manager Dashboard</Title>

            {/* TOP CARDS */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Total Revenue" 
                            value={stats.revenue} 
                            prefix="₹" 
                            precision={0} 
                            valueStyle={{ color: '#3f8600' }} 
                            icon={<DollarOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Total Sales" 
                            value={stats.salesCount} 
                            prefix={<ShoppingCartOutlined />} 
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Stock In Hand" 
                            value={stats.stockCount} 
                            prefix={<CarOutlined />} 
                            valueStyle={{ color: '#1890ff' }} 
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Active Enquiries" 
                            value={stats.leadCount} 
                            prefix={<UsergroupAddOutlined />} 
                            valueStyle={{ color: '#faad14' }} 
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16}>
                {/* RECENT SALES TABLE */}
                <Col span={16}>
                    <Card title="Recent Sales" bordered={false}>
                        <Table 
                            dataSource={stats.recentSales} 
                            rowKey={(r) => r.Customer + r.Date} // Unique key fallback
                            pagination={false}
                            size="small"
                            columns={[
                                { title: 'Date', dataIndex: 'Date', render: d => dayjs(d).format('DD MMM') },
                                { title: 'Customer', dataIndex: 'Customer' },
                                { title: 'Vehicle', dataIndex: 'Model Variant' },
                                { title: 'Amount', dataIndex: 'Grand Total', render: v => `₹${Number(v).toLocaleString()}` },
                            ]}
                        />
                    </Card>
                </Col>

                {/* ALERTS / DUES */}
                <Col span={8}>
                    <Card title="Market Outstanding" bordered={false} style={{ height: '100%' }}>
                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <Statistic 
                                title="Total Pending Collection" 
                                value={stats.dueAmount} 
                                prefix="₹" 
                                valueStyle={{ color: '#cf1322', fontSize: 32 }} 
                            />
                            <div style={{ marginTop: 10, color: '#888' }}>
                                From {stats.dueCount} Active Credit Accounts
                            </div>
                            <br/>
                            <Alert message="Check Recovery Module" type="warning" showIcon />
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}