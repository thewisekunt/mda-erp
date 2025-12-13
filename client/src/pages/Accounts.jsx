import { useState, useEffect } from 'react';
import { Card, Input, Button, Table, Typography, Row, Col, Statistic, Divider, Tag, Form, DatePicker, Select, message, Modal, Alert, Space, Tabs, Descriptions, Tooltip } from 'antd';
import { SearchOutlined, SafetyCertificateOutlined, PrinterOutlined, ClockCircleOutlined, WalletOutlined, HistoryOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useLocation } from 'react-router-dom'; // IMPORT USE LOCATION
import { generateGatePassPDF } from '../utils/generateGatePass';

const { Title, Text } = Typography;
const { Option } = Select;

export default function Accounts() {
    const location = useLocation(); // USE LOCATION HOOK
    const [searchFrame, setSearchFrame] = useState('');
    const [data, setData] = useState(null); 
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState(''); 
    
    // Modals
    const [payModal, setPayModal] = useState(false);
    const [financeModal, setFinanceModal] = useState(false);
    const [creditModal, setCreditModal] = useState(false);
    
    const [form] = Form.useForm();

    // Get User Role & Auto Search on Load
    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) setUserRole(user.role);

        // AUTO SEARCH LOGIC
        if (location.state && location.state.searchFrame) {
            setSearchFrame(location.state.searchFrame);
            // Trigger fetch immediately
            fetchSummary(location.state.searchFrame);
        }
    }, [location.state]);

    // Separate fetch function to reuse
    const fetchSummary = (frameNo) => {
        setLoading(true);
        setData(null); 
        
        axios.get(`http://localhost:5000/api/accounts/summary/${frameNo}`)
            .then(res => {
                setData(res.data);
                setLoading(false);
            })
            .catch(() => {
                message.error("Vehicle not found or not sold.");
                setLoading(false);
            });
    };

    const handleSearch = () => {
        if (!searchFrame) return;
        fetchSummary(searchFrame);
    };

    // --- ACTIONS ---
    const handlePayment = (values) => {
        if (!data?.sale) return;
        const payload = {
            ...values,
            custId: data.customer.custId,
            frameNo: data.sale['Frame No'], 
            date: values.date.format('YYYY-MM-DD')
        };
        axios.post('http://localhost:5000/api/accounts/pay', payload).then(() => {
            message.success("Payment Recorded");
            setPayModal(false);
            handleSearch(); 
        });
    };

    const handleFinance = (values) => {
        if (!data?.sale) return;
        axios.post('http://localhost:5000/api/accounts/finance', { ...values, frameNo: data.sale['Frame No'] })
            .then(() => {
                message.success("Finance DO Recorded");
                setFinanceModal(false);
                handleSearch();
            });
    };

    const handleCredit = (values) => {
        if (!data?.sale) return;
        axios.post('http://localhost:5000/api/accounts/credit', {
            frameNo: data.sale['Frame No'],
            custId: data.customer.custId,
            amount: values.creditAmount,
            promiseDate: values.promiseDate.format('YYYY-MM-DD'),
            note: values.note
        }).then(() => {
            message.success("Credit Approved & Recorded");
            setCreditModal(false);
            handleSearch();
        });
    };

    const generateGatePass = () => {
        axios.post('http://localhost:5000/api/gatepass/generate', { frameNo: data.sale['Frame No'] })
            .then(() => {
                message.success("Gate Pass Generated!");
                handleSearch();
            });
    };

    const handlePrint = () => {
        if (!data) return;
        const printData = {
            sale: data.sale,
            customer: { Name: data.sale.Customer, "Mobile No": data.customer.custId },
            finance: data.financeInfo
        };
        generateGatePassPDF(printData);
    };

    // --- CALCULATIONS ---
    const getDealStatus = () => {
        if (!data || !data.sale) return { balance: 0, status: 'Error' };

        const totalDebit = Number(data.customer.totalDebit) || 0; 
        const totalPaid = Number(data.customer.totalPaid) || 0;   
        const financeCover = (data.sale['Pay Method'] === 'Finance' && data.financeInfo) ? Number(data.financeInfo.Disburse_Amt) : 0;
        
        const creditApproved = (data.promises || [])
            .filter(p => p.Status === 'Pending')
            .reduce((sum, p) => sum + Number(p.Amount), 0);

        const totalCovered = totalPaid + financeCover + creditApproved;
        const globalBalance = totalDebit - totalCovered;

        return { 
            globalBalance,
            isFullyPaid: globalBalance <= 10,
            financePending: (data.sale['Pay Method'] === 'Finance' && financeCover <= 0)
        };
    };

    const status = getDealStatus();
    const canApproveCredit = ['Admin', 'Manager', 'Owner'].includes(userRole);

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 50 }}>
            {/* SEARCH */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <Title level={2}>Account & Gate Pass</Title>
                <Space>
                    <Input placeholder="Scan Chassis No..." size="large" style={{ width: 300 }} value={searchFrame} onChange={e => setSearchFrame(e.target.value)} onPressEnter={handleSearch} />
                    <Button type="primary" size="large" icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>Search</Button>
                </Space>
            </div>

            {data && data.sale && (
                <Row gutter={24}>
                    {/* LEFT MAIN CONTENT */}
                    <Col span={16}>
                        <Tabs defaultActiveKey="1" type="card">
                            
                            {/* TAB 1: CURRENT DEAL (Focused View) */}
                            <Tabs.TabPane tab={<span><WalletOutlined /> Current Deal</span>} key="1">
                                <Card>
                                    <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 8, marginBottom: 20 }}>
                                        <Row gutter={16} style={{ textAlign: 'center' }}>
                                            <Col span={8}>
                                                <Statistic title="Deal Amount" value={data.sale['Grand Total']} prefix="₹" />
                                                <Text type="secondary">{data.sale['Model Variant']}</Text>
                                            </Col>
                                            <Col span={8}>
                                                <Statistic title="Finance/Adj" value={(data.financeInfo ? Number(data.financeInfo.Disburse_Amt) : 0) + Number(data.sale.Exchange_Val) + Number(data.sale.Offer_Amt)} prefix="₹" valueStyle={{ color: '#faad14' }} />
                                                <Text type="secondary">Non-Cash Coverage</Text>
                                            </Col>
                                            <Col span={8}>
                                                <Statistic 
                                                    title="Customer Net Due" 
                                                    value={status.globalBalance} 
                                                    prefix="₹" 
                                                    valueStyle={{ color: status.globalBalance > 10 ? '#cf1322' : '#3f8600' }} 
                                                />
                                                <Text type="secondary">{status.globalBalance > 10 ? "Payment Required" : "Fully Covered"}</Text>
                                            </Col>
                                        </Row>
                                    </div>

                                    {/* Actions Grid */}
                                    <Row gutter={[16, 16]}>
                                        <Col span={12}>
                                            <Button type="primary" block size="large" onClick={() => setPayModal(true)}>
                                                Receive Payment (Cash/UPI)
                                            </Button>
                                        </Col>
                                        {data.sale['Pay Method'] === 'Finance' && (
                                            <Col span={12}>
                                                <Button block size="large" onClick={() => setFinanceModal(true)}>
                                                    {data.financeInfo ? "Update Finance Info" : "Record Finance DO"}
                                                </Button>
                                            </Col>
                                        )}
                                    </Row>

                                    <Divider orientation="left">Transaction Details</Divider>
                                    <Descriptions size="small" column={2} bordered>
                                        <Descriptions.Item label="Customer">{data.sale.Customer}</Descriptions.Item>
                                        <Descriptions.Item label="Payment Mode">{data.sale['Pay Method']}</Descriptions.Item>
                                        <Descriptions.Item label="Exchange Value">₹ {data.sale.Exchange_Val || 0}</Descriptions.Item>
                                        <Descriptions.Item label="Offer Applied">₹ {data.sale.Offer_Amt || 0}</Descriptions.Item>
                                        {data.financeInfo && (
                                            <>
                                                <Descriptions.Item label="Financer">{data.financeInfo.Financer_Name}</Descriptions.Item>
                                                <Descriptions.Item label="DO Amount">₹ {data.financeInfo.Disburse_Amt}</Descriptions.Item>
                                            </>
                                        )}
                                    </Descriptions>
                                </Card>
                            </Tabs.TabPane>

                            {/* TAB 2: FULL LEDGER (History View) */}
                            <Tabs.TabPane tab={<span><HistoryOutlined /> Customer Ledger (History)</span>} key="2">
                                <Card>
                                    <Alert message={`Customer ID: ${data.customer.custId}`} type="info" style={{marginBottom:15}} />
                                    <Row gutter={16} style={{ marginBottom: 20 }}>
                                        <Col span={8}><Statistic title="Total Purchases" value={data.customer.totalDebit} prefix="₹" /></Col>
                                        <Col span={8}><Statistic title="Total Paid" value={data.customer.totalPaid} prefix="₹" valueStyle={{color: 'green'}} /></Col>
                                        <Col span={8}><Statistic title="Pending Balance" value={data.customer.totalDebit - data.customer.totalPaid} prefix="₹" valueStyle={{color: 'red'}} /></Col>
                                    </Row>
                                    
                                    <Table 
                                        dataSource={data.customer.payments} 
                                        rowKey="Payment_ID"
                                        size="small"
                                        pagination={{pageSize:5}}
                                        columns={[
                                            { title: 'Date', dataIndex: 'Payment_Date', render: d => dayjs(d).format('DD-MM-YY') },
                                            { title: 'Type', dataIndex: 'Mode' },
                                            { title: 'Amount', dataIndex: 'Amount', render: a => `₹${Number(a).toLocaleString()}` },
                                            { title: 'Ref', dataIndex: 'Note' },
                                        ]}
                                    />
                                </Card>
                            </Tabs.TabPane>
                        </Tabs>
                    </Col>

                    {/* RIGHT SIDEBAR: GATE PASS & CREDIT */}
                    <Col span={8}>
                        <Card title="Gate Pass & Approval" bordered={false} style={{ height: '100%' }}>
                            {/* STATUS INDICATORS */}
                            <div style={{ marginBottom: 20 }}>
                                <Alert 
                                    message={status.isFullyPaid ? "Payment Clear" : "Balance Due"} 
                                    type={status.isFullyPaid ? "success" : "error"} 
                                    showIcon 
                                    style={{ marginBottom: 10 }}
                                />
                                {status.financePending && (
                                    <Alert message="Finance DO Missing" type="warning" showIcon style={{ marginBottom: 10 }} />
                                )}
                            </div>

                            {/* CREDIT SECTION - PERMISSION PROTECTED */}
                            {!status.isFullyPaid && (
                                <div style={{ marginBottom: 20, padding: 15, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6 }}>
                                    <Text strong><LockOutlined /> Credit Approval</Text>
                                    <p style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
                                        Customer needs credit of <b>₹{status.globalBalance}</b> to clear gate pass.
                                    </p>
                                    {canApproveCredit ? (
                                        <Button danger block onClick={() => setCreditModal(true)}>Approve Credit</Button>
                                    ) : (
                                        <Tooltip title="Only Managers/Admins can approve credit">
                                            <Button disabled block>Manager Approval Required</Button>
                                        </Tooltip>
                                    )}
                                </div>
                            )}

                            {/* GATE PASS BUTTON */}
                            {data.sale.Gate_Pass_ID ? (
                                <div style={{ textAlign: 'center' }}>
                                    <SafetyCertificateOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                                    <Title level={5} style={{ color: '#52c41a' }}>Gate Pass Active</Title>
                                    <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} block>Reprint Gate Pass</Button>
                                </div>
                            ) : (
                                <Button 
                                    type="primary" 
                                    size="large" 
                                    block 
                                    style={{ height: 50, fontSize: 16 }}
                                    disabled={!status.isFullyPaid || status.financePending}
                                    onClick={generateGatePass}
                                >
                                    GENERATE GATE PASS
                                </Button>
                            )}
                        </Card>
                    </Col>
                </Row>
            )}

            {/* MODALS */}
            <Modal title="Add Payment" open={payModal} onCancel={() => setPayModal(false)} footer={null}>
                <Form layout="vertical" onFinish={handlePayment}>
                    <Form.Item name="amount" label="Amount" rules={[{required:true}]}><Input type="number" prefix="₹" /></Form.Item>
                    <Form.Item name="date" label="Date" initialValue={dayjs()}><DatePicker style={{width:'100%'}}/></Form.Item>
                    <Form.Item name="mode" label="Mode" initialValue="Cash"><Select><Option value="Cash">Cash</Option><Option value="UPI">UPI</Option></Select></Form.Item>
                    <Form.Item name="note" label="Remark"><Input /></Form.Item>
                    <Button type="primary" htmlType="submit" block>Save Payment</Button>
                </Form>
            </Modal>

            <Modal title="Finance Disbursement" open={financeModal} onCancel={() => setFinanceModal(false)} footer={null}>
                <Form layout="vertical" onFinish={handleFinance} initialValues={{ financer: data?.sale?.Financer }}>
                    <Form.Item name="financer" label="Financer"><Input readOnly /></Form.Item>
                    <Form.Item name="disburseAmt" label="DO Amount" rules={[{required:true}]}><Input type="number" prefix="₹" /></Form.Item>
                    <Form.Item name="doNumber" label="DO Number"><Input /></Form.Item>
                    <Button type="primary" htmlType="submit" block>Save</Button>
                </Form>
            </Modal>

            <Modal title="Manager Approval: Credit" open={creditModal} onCancel={() => setCreditModal(false)} footer={null}>
                <Alert message="You are authorizing the release of this vehicle on credit." type="warning" showIcon style={{marginBottom:15}} />
                <Form layout="vertical" onFinish={handleCredit}>
                    <Form.Item name="creditAmount" label="Approved Amount" rules={[{required:true}]}><Input type="number" prefix="₹" /></Form.Item>
                    <Form.Item name="promiseDate" label="Due Date" rules={[{required:true}]}><DatePicker style={{width:'100%'}}/></Form.Item>
                    <Form.Item name="note" label="Condition / Remark" rules={[{required:true}]}><Input.TextArea rows={2} /></Form.Item>
                    <Button type="primary" htmlType="submit" block danger>Confirm Approval</Button>
                </Form>
            </Modal>
        </div>
    );
}