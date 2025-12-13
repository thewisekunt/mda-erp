import { useState, useEffect } from 'react';
import { Table, Card, Input, Button, Tag, Space, Typography, Modal, Upload, message, Steps, Select, Form, Row, Col, Tabs, DatePicker, Divider, Tooltip } from 'antd';
import { SearchOutlined, FilePdfOutlined, UploadOutlined, EyeOutlined, SafetyCertificateOutlined, CarOutlined, BankOutlined, ArrowRightOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom'; // Import Navigate

const { Title, Text } = Typography;
const { Option } = Select;

export default function SalesHistory() {
    const navigate = useNavigate(); // Hook for redirection
    const [data, setData] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Manage Modal State
    const [manageModal, setManageModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [form] = Form.useForm();

    useEffect(() => { fetchHistory(); }, []);

    const fetchHistory = () => {
        setLoading(true);
        axios.get('http://localhost:5000/api/sales/history')
            .then(res => {
                setData(res.data);
                setLoading(false);
            });
    };

    // --- ACTIONS ---
    const handleOpenManage = (record) => {
        setSelectedSale(record);
        // Pre-fill form with existing data
        form.setFieldsValue({
            invoiceNo: record.Invoice_No,
            invoiceDate: record.Invoice_Date ? dayjs(record.Invoice_Date) : null,
            policyNo: record.Policy_No,
            insuranceCo: record.Insurance_Co,
            insuranceAmt: record.Insurance_Amt,
            policyDate: record.Policy_Date ? dayjs(record.Policy_Date) : null,
            regNo: record.Registration_No,
            rtoDate: record.RTO_Date ? dayjs(record.RTO_Date) : null,
            rtoCost: record.RTO_Cost,
            hsrpStatus: record.HSRP_Status || 'Pending'
        });
        setManageModal(true);
    };

    const handleUpdateDetails = (values) => {
        const payload = {
            ...values,
            frameNo: selectedSale['Frame No'],
            invoiceDate: values.invoiceDate?.format('YYYY-MM-DD'),
            policyDate: values.policyDate?.format('YYYY-MM-DD'),
            rtoDate: values.rtoDate?.format('YYYY-MM-DD')
        };

        axios.put('http://localhost:5000/api/sales/update-details', payload)
            .then(() => {
                message.success("Records Updated");
                setManageModal(false);
                fetchHistory();
            })
            .catch(() => message.error("Update Failed"));
    };

    const handleUpload = (file, docType) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('frameNo', selectedSale['Frame No']);
        formData.append('docType', docType);

        axios.post('http://localhost:5000/api/sales/upload', formData)
            .then(() => {
                message.success("File Uploaded");
                fetchHistory(); 
            });
        return false;
    };

    // Navigate to Accounts Page with Search Filter
    const goToAccounts = (frameNo) => {
        // We pass state so Accounts page can auto-search
        navigate('/accounts', { state: { searchFrame: frameNo } });
    };

    // --- UI HELPERS ---
    const UploadSection = ({ type, path }) => (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background:'#f9f9f9', padding:8, borderRadius:4 }}>
            <Text type="secondary"><FilePdfOutlined /> {type} Document</Text>
            <Space>
                {path && <Button size="small" icon={<EyeOutlined />} onClick={() => window.open(`http://localhost:5000/${path}`, '_blank')}>View</Button>}
                <Upload showUploadList={false} beforeUpload={(file) => handleUpload(file, type)}>
                    <Button size="small" icon={<UploadOutlined />}>Upload</Button>
                </Upload>
            </Space>
        </div>
    );

    const columns = [
        { 
            title: 'Date', 
            dataIndex: 'Date', 
            render: d => dayjs(d).format('DD MMM'),
            sorter: (a, b) => new Date(a.Date) - new Date(b.Date)
        },
        { 
            title: 'Customer', 
            dataIndex: 'Customer',
            render: (t, r) => <div><b>{t}</b><br/><span style={{fontSize:11, color:'#666'}}>{r['Cust ID']}</span></div>
        },
        { 
            title: 'Vehicle', 
            dataIndex: 'Model Variant', 
            render: (t, r) => (
                <div>
                    <Tag color="blue">{t}</Tag>
                    <div style={{fontSize:11, marginTop:4}}>{r.Color} | {r['Frame No'].slice(-6)}</div>
                </div>
            )
        },
        {
            title: 'Status', // RESTORED STATUS COLUMN
            dataIndex: 'Status',
            render: (status, r) => {
                const isDelivered = status === 'Delivered';
                return (
                    <Space direction="vertical" size={0}>
                        <Tag color={isDelivered ? 'green' : 'gold'}>{status}</Tag>
                        {/* Action Link if Pending */}
                        {!isDelivered && (
                            <Button 
                                type="link" 
                                size="small" 
                                style={{ padding: 0, fontSize: 11 }} 
                                icon={<ArrowRightOutlined />}
                                onClick={() => goToAccounts(r['Frame No'])}
                            >
                                Complete & Gate Pass
                            </Button>
                        )}
                    </Space>
                );
            }
        },
        {
            title: 'RTO Status',
            dataIndex: 'HSRP_Status',
            render: (s, r) => {
                let color = s === 'Fitted' ? 'green' : s === 'Received' ? 'cyan' : s === 'Ordered' ? 'orange' : 'default';
                return (
                    <div>
                        <Tag color={color}>{s || 'Pending'}</Tag>
                        {r.Registration_No && <div style={{fontSize:11, fontWeight:'bold'}}>{r.Registration_No}</div>}
                    </div>
                );
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, r) => <Button size="small" onClick={() => handleOpenManage(r)}>Manage Ops</Button>
        }
    ];

    const filteredData = data.filter(item => 
        item.Customer.toLowerCase().includes(searchText.toLowerCase()) || 
        item['Frame No'].toLowerCase().includes(searchText.toLowerCase()) ||
        (item.Registration_No && item.Registration_No.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Title level={2}>Sales & Operations</Title>
                <Input placeholder="Search..." prefix={<SearchOutlined />} style={{ width: 300 }} onChange={e => setSearchText(e.target.value)} />
            </div>

            <Card>
                <Table dataSource={filteredData} columns={columns} rowKey="Frame No" loading={loading} pagination={{ pageSize: 8 }} />
            </Card>

            {/* OPERATIONS MODAL */}
            <Modal 
                title={`Manage: ${selectedSale?.Customer} (${selectedSale?.['Model Variant']})`} 
                open={manageModal} 
                onCancel={() => setManageModal(false)} 
                footer={null}
                width={700}
            >
                <Form layout="vertical" form={form} onFinish={handleUpdateDetails}>
                    <Tabs type="card">
                        {/* TABS (Identical to before) */}
                        <Tabs.TabPane tab={<span><FilePdfOutlined /> Invoice</span>} key="1">
                            <Row gutter={16}>
                                <Col span={12}><Form.Item name="invoiceNo" label="Invoice Number"><Input /></Form.Item></Col>
                                <Col span={12}><Form.Item name="invoiceDate" label="Invoice Date"><DatePicker style={{width:'100%'}}/></Form.Item></Col>
                            </Row>
                            <UploadSection type="Invoice" path={selectedSale?.Invoice_Path} />
                        </Tabs.TabPane>

                        <Tabs.TabPane tab={<span><SafetyCertificateOutlined /> Insurance</span>} key="2">
                            <Row gutter={16}>
                                <Col span={12}><Form.Item name="insuranceCo" label="Company Name"><Select><Option value="ICICI Lombard">ICICI Lombard</Option><Option value="Digit">Digit</Option><Option value="SBI General">SBI General</Option></Select></Form.Item></Col>
                                <Col span={12}><Form.Item name="policyNo" label="Policy Number"><Input /></Form.Item></Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}><Form.Item name="insuranceAmt" label="Amount"><Input prefix="₹" type="number" /></Form.Item></Col>
                                <Col span={12}><Form.Item name="policyDate" label="Start Date"><DatePicker style={{width:'100%'}}/></Form.Item></Col>
                            </Row>
                            <UploadSection type="Insurance" path={selectedSale?.Insurance_Path} />
                        </Tabs.TabPane>

                        <Tabs.TabPane tab={<span><CarOutlined /> RTO & Plate</span>} key="3">
                            <Divider orientation="left">1. RTO Registration Details</Divider>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="regNo" label="Registration No (Official)" rules={[{required:true, message:'Reg No Required'}]}>
                                        <Input placeholder="CG-XX-XX-XXXX" style={{ textTransform: 'uppercase', fontWeight: 'bold' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={6}><Form.Item name="rtoCost" label="RTO Fees"><Input prefix="₹" type="number" /></Form.Item></Col>
                                <Col span={6}><Form.Item name="rtoDate" label="Date"><DatePicker style={{width:'100%'}}/></Form.Item></Col>
                            </Row>
                            <UploadSection type="RTO" path={selectedSale?.RTO_File_Path} />

                            <Divider orientation="left">2. HSRP (Number Plate) Status</Divider>
                            <div style={{ background: '#f0f5ff', padding: 15, borderRadius: 6 }}>
                                <Form.Item name="hsrpStatus" label="Current Status">
                                    <Select>
                                        <Option value="Pending">Pending (Registration Not Done)</Option>
                                        <Option value="Ordered">Ordered (Waiting for Plate)</Option>
                                        <Option value="Received">Received (In Stock)</Option>
                                        <Option value="Fitted">Fitted (Delivered to Customer)</Option>
                                    </Select>
                                </Form.Item>
                                <Text type="secondary" style={{fontSize:12}}>* Ensure "Registration No" is entered above before marking as Received.</Text>
                            </div>
                        </Tabs.TabPane>
                    </Tabs>
                    <Divider />
                    <Button type="primary" htmlType="submit" block icon={<BankOutlined />}>Save All Details</Button>
                </Form>
            </Modal>
        </div>
    );
}