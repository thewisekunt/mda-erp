import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, DatePicker, Row, Col, Statistic, message, Space, Typography, Tabs, Timeline, Tooltip, Switch, Drawer, Descriptions, Divider, Alert } from 'antd';
import { PlusOutlined, PhoneOutlined, EditOutlined, UserAddOutlined, PieChartOutlined, HistoryOutlined, FilterOutlined, DollarOutlined, ArrowRightOutlined, FireOutlined, ClockCircleOutlined, CheckCircleOutlined, TeamOutlined, StopOutlined, SyncOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useNavigate } from 'react-router-dom';

dayjs.extend(isBetween);

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export default function PreSales() {
    const navigate = useNavigate();
    
    // --- 1. STATE DECLARATIONS (MUST BE TOP) ---
    const [allLeads, setAllLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [stats, setStats] = useState({ tempStats: [], leakage: [] });
    const [activeTab, setActiveTab] = useState('active');
    
    // Filter State
    const [searchText, setSearchText] = useState('');
    const [modelFilter, setModelFilter] = useState(null);
    const [dateRange, setDateRange] = useState(null);

    // Master Data
    const [models, setModels] = useState([]);
    const [allColors, setAllColors] = useState([]);
    const [currentColors, setCurrentColors] = useState([]); 

    // Modals
    const [addModal, setAddModal] = useState(false);
    const [editModal, setEditModal] = useState(false);
    const [logModal, setLogModal] = useState(false);
    const [bookingModal, setBookingModal] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [summaryModal, setSummaryModal] = useState(false);
    
    const [selectedLead, setSelectedLead] = useState(null);
    const [leadLogs, setLeadLogs] = useState([]);
    
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    const [logForm] = Form.useForm();

    const isFinance = Form.useWatch('isFinance', form);
    const isExchange = Form.useWatch('isExchange', form);

    // --- 2. INITIAL FETCH ---
    useEffect(() => { 
        fetchLeads(); fetchStats(); fetchMasterData();
    }, []);

    // --- 3. FILTER ENGINE (DEPENDS ON STATE) ---
    useEffect(() => {
        let data = allLeads;

        // A. Filter by Tab
        switch(activeTab) {
            case 'active': data = data.filter(l => l.Status === 'Open'); break;
            case 'n7': 
                data = data.filter(l => {
                    if(l.Status !== 'Open' || !l.Next_FollowUp) return false;
                    return dayjs(l.Next_FollowUp).isBefore(dayjs().add(7, 'day'));
                });
                break;
            case 'converted': data = data.filter(l => l.Status === 'Converted' || l.Status === 'Booked'); break;
            case 'lost': data = data.filter(l => l.Status === 'Lost'); break;
            default: break; 
        }

        // B. Filter by Search
        if(searchText) {
            const low = searchText.toLowerCase();
            data = data.filter(l => l.Customer_Name.toLowerCase().includes(low) || l.Mobile.includes(low));
        }

        // C. Filter by Model
        if(modelFilter) {
            data = data.filter(l => l.Model_Interested === modelFilter);
        }

        // D. Filter by Date
        if(dateRange) {
            data = data.filter(l => dayjs(l.Next_FollowUp).isBetween(dateRange[0], dateRange[1], 'day', '[]'));
        }

        setFilteredLeads(data);

    }, [allLeads, activeTab, searchText, modelFilter, dateRange]);

    // --- 4. API FUNCTIONS ---
    const fetchLeads = () => {
        axios.get('http://localhost:5000/api/enquiries').then(res => setAllLeads(Array.isArray(res.data) ? res.data : []));
    };
    
    const fetchStats = () => axios.get('http://localhost:5000/api/enquiries/stats').then(res => setStats(res.data));
    
    const fetchMasterData = async () => {
        const [m, c] = await Promise.all([
            axios.get('http://localhost:5000/api/models'),
            axios.get('http://localhost:5000/api/model-colors')
        ]);
        setModels(m.data);
        setAllColors(c.data);
    };

    const fetchLogs = (id) => axios.get(`http://localhost:5000/api/enquiries/logs/${id}`).then(res => setLeadLogs(res.data));

    // --- 5. HANDLERS ---
    const handleModelChange = (val, formInstance) => {
        const relevant = allColors.filter(c => c['Model Variant'] === val);
        setCurrentColors(relevant);
        formInstance.setFieldsValue({ color: undefined });
    };

    const handleAdd = (values) => {
        axios.post('http://localhost:5000/api/enquiries', {
            ...values,
            followUp: values.followUp?.format('YYYY-MM-DD')
        }).then(() => {
            message.success("Lead Captured");
            setAddModal(false);
            form.resetFields();
            fetchLeads(); fetchStats();
        });
    };

    const handleEditUpdate = (values) => {
        axios.put(`http://localhost:5000/api/enquiries/${selectedLead.Enquiry_ID}`, values).then(() => {
            message.success("Updated & Logged");
            setEditModal(false);
            fetchLeads();
        });
    };

    const handleLogSubmit = (values) => {
        axios.post('http://localhost:5000/api/enquiries/log', {
            ...values,
            enquiryId: selectedLead.Enquiry_ID,
            nextDate: values.nextDate?.format('YYYY-MM-DD')
        }).then(() => {
            message.success("Log Added");
            setLogModal(false);
            logForm.resetFields();
            fetchLeads();
        });
    };

    const handleBooking = (values) => {
        axios.post('http://localhost:5000/api/presales/book', {
            ...values,
            enquiryId: selectedLead.Enquiry_ID,
            name: selectedLead.Customer_Name,
            mobile: selectedLead.Mobile
        }).then(() => {
            message.success("Token Recorded");
            setBookingModal(false);
            fetchLeads();
        });
    };

    // --- NAVIGATION LOGIC (UPDATED) ---
    const goToProfileCompletion = (r) => {
        console.log("Navigating to profile for:", r.Customer_Name, r.Cust_ID, r.Mobile);
        
        navigate('/customers', { 
            state: { 
                editCustId: r.Cust_ID, // Primary lookup
                editMobile: r.Mobile,  // BACKUP lookup (Fixes the issue)
                message: "Please complete the profile before selling." 
            } 
        });
    };

    const openEdit = (r) => {
        setSelectedLead(r);
        handleModelChange(r.Model_Interested, editForm);
        editForm.setFieldsValue({
            model: r.Model_Interested,
            color: r.Color_Interested,
            isFinance: r.Is_Finance === 1,
            downPayment: r.Down_Payment,
            isExchange: r.Is_Exchange === 1
        });
        setEditModal(true);
    };

    const openHistory = (r) => {
        setSelectedLead(r);
        fetchLogs(r.Enquiry_ID);
        setHistoryVisible(true);
    };

    // Columns
    const columns = [
        { title: 'Temp', dataIndex: 'Temperature', width: 80, render: t => <Tag color={t === 'Hot' ? 'red' : t === 'Warm' ? 'orange' : 'blue'}>{t}</Tag> },
        { title: 'Customer', dataIndex: 'Customer_Name', render: (t, r) => <div><b>{t}</b><br/>{r.Mobile}</div> },
        { title: 'Requirement', render: (_, r) => (
            <div style={{fontSize:12}}>
                <Tag color="cyan">{r.Model_Interested}</Tag> 
                <span style={{fontSize:11, color:'#666'}}>{r.Color_Interested}</span>
                <div style={{marginTop:4}}>
                    {r.Is_Finance === 1 && <Tag color="gold">Finance</Tag>}
                    {r.Is_Exchange === 1 && <Tag color="purple">Exch</Tag>}
                </div>
            </div>
        )},
        { title: 'Follow Up', dataIndex: 'Next_FollowUp', sorter: (a, b) => new Date(a.Next_FollowUp) - new Date(b.Next_FollowUp), render: d => {
            if(!d) return '-';
            const isOverdue = dayjs().isAfter(dayjs(d), 'day');
            return <span style={{color: isOverdue ? 'red' : 'green', fontWeight: isOverdue?600:400}}>{dayjs(d).format('DD MMM')}</span>;
        }},
        { title: 'Status', dataIndex: 'Status', render: s => <Tag color={s==='Booked'?'purple':s==='Converted'?'green':'default'}>{s}</Tag> },
        { title: 'Action', render: (_, r) => (
            <Space size="small">
                {r.Status === 'Open' && (
                    <>
                        <Tooltip title="Log Call"><Button size="small" icon={<PhoneOutlined />} onClick={() => { setSelectedLead(r); setLogModal(true); }} /></Tooltip>
                        <Tooltip title="Edit Req"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
                        <Tooltip title="Book Token"><Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => { setSelectedLead(r); setBookingModal(true); }} /></Tooltip>
                    </>
                )}
                
                {r.Status === 'Booked' && (
                    <Tooltip title="Profile Incomplete. Add Address/KYC">
                        <Button 
                            size="small" 
                            type="primary" 
                            style={{background:'#faad14', borderColor:'#faad14'}} 
                            icon={<FileTextOutlined />} 
                            onClick={() => goToProfileCompletion(r)}
                        >
                            Complete
                        </Button>
                    </Tooltip>
                )}

                <Tooltip title="History"><Button size="small" icon={<HistoryOutlined />} onClick={() => openHistory(r)} /></Tooltip>
            </Space>
        )}
    ];

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Title level={2}>Enquiry Management</Title>
                <Space>
                    <Button icon={<PieChartOutlined />} onClick={() => setSummaryModal(true)}>Summary</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setAddModal(true); }}>New Enquiry</Button>
                </Space>
            </div>

            <Card style={{ marginBottom: 20 }} bodyStyle={{ padding: '15px' }}>
                <Row gutter={16} align="middle">
                    <Col span={8}><Input prefix={<FilterOutlined />} placeholder="Search Name/Mobile..." value={searchText} onChange={e => setSearchText(e.target.value)} /></Col>
                    <Col span={6}><Select placeholder="Filter Model" allowClear style={{ width: '100%' }} onChange={setModelFilter}>{models.map(m => <Option key={m['Model Variant']} value={m['Model Variant']}>{m['Model Variant']}</Option>)}</Select></Col>
                    <Col span={6}><RangePicker placeholder={['Start Date', 'End Date']} onChange={setDateRange} style={{ width: '100%' }} /></Col>
                    <Col span={4} style={{ textAlign: 'right' }}><Text type="secondary">{filteredLeads.length} Records</Text></Col>
                </Row>
            </Card>

            <Tabs defaultActiveKey="active" onChange={setActiveTab} type="card">
                <Tabs.TabPane tab={<span><FireOutlined /> Active</span>} key="active" />
                <Tabs.TabPane tab={<span><ClockCircleOutlined /> N-7 Days</span>} key="n7" />
                <Tabs.TabPane tab={<span><CheckCircleOutlined /> Converted</span>} key="converted" />
                <Tabs.TabPane tab={<span><StopOutlined /> Lost</span>} key="lost" />
                <Tabs.TabPane tab={<span><TeamOutlined /> All</span>} key="all" />
            </Tabs>

            <Table dataSource={filteredLeads} columns={columns} rowKey="Enquiry_ID" pagination={{ pageSize: 10 }} size="small" />

            {/* ADD MODAL */}
            <Modal title="Capture New Lead" open={addModal} onCancel={() => setAddModal(false)} footer={null} width={800}>
                <Form layout="vertical" form={form} onFinish={handleAdd}>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="name" label="Name" rules={[{required:true}]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="mobile" label="Mobile" rules={[{required:true, pattern:/^\d{10}$/, message:'10 digits'}]}><Input prefix="+91" maxLength={10}/></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="model" label="Model" rules={[{required:true}]}><Select showSearch onChange={(v) => handleModelChange(v, form)}>{models.map(m => <Option key={m['Model Variant']} value={m['Model Variant']}>{m['Model Variant']}</Option>)}</Select></Form.Item></Col>
                        <Col span={8}><Form.Item name="color" label="Color"><Select placeholder="Select Model First">{currentColors.map(c => <Option key={c.Color} value={c.Color}>{c.Color}</Option>)}</Select></Form.Item></Col>
                        <Col span={8}><Form.Item name="source" label="Source"><Select><Option value="Walk-in">Walk-in</Option><Option value="Call">Call</Option><Option value="Referral">Referral</Option></Select></Form.Item></Col>
                    </Row>
                    <Row gutter={16} style={{ background: '#f5f5f5', padding: '10px 5px', borderRadius: 6, marginBottom: 15 }}>
                        <Col span={12}>
                            <Form.Item name="isFinance" valuePropName="checked" style={{marginBottom:5}}><Switch checkedChildren="Finance Yes" unCheckedChildren="Cash" /></Form.Item>
                            {isFinance && <Form.Item name="downPayment" label="Planned Down Payment"><Input prefix="₹" type="number" /></Form.Item>}
                        </Col>
                        <Col span={12}>
                            <Form.Item name="isExchange" valuePropName="checked" style={{marginBottom:5}}><Switch checkedChildren="Exchange Yes" unCheckedChildren="No Exchange" /></Form.Item>
                            {isExchange && (
                                <Row gutter={8}>
                                    <Col span={8}><Form.Item name="exModel" label="Old Model"><Input /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="exYear" label="Year"><Input /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="exValue" label="Exp. Value"><Input prefix="₹" /></Form.Item></Col>
                                </Row>
                            )}
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="temperature" label="Temp" initialValue="Warm"><Select><Option value="Hot">Hot</Option><Option value="Warm">Warm</Option><Option value="Cold">Cold</Option></Select></Form.Item></Col>
                        <Col span={8}><Form.Item name="followUp" label="Next Follow Up" rules={[{required:true}]}><DatePicker style={{width:'100%'}} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="remarks" label="Remarks"><TextArea rows={1} /></Form.Item></Col>
                    </Row>
                    <Button type="primary" htmlType="submit" block>Save Enquiry</Button>
                </Form>
            </Modal>

            {/* EDIT REQ MODAL */}
            <Modal title="Update Requirements" open={editModal} onCancel={() => setEditModal(false)} footer={null}>
                <Form layout="vertical" form={editForm} onFinish={handleEditUpdate}>
                    <Alert message="Changes will be automatically logged in timeline." type="info" showIcon style={{marginBottom:15}} />
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="model" label="Change Model"><Select showSearch onChange={(v) => handleModelChange(v, editForm)}>{models.map(m => <Option key={m['Model Variant']} value={m['Model Variant']}>{m['Model Variant']}</Option>)}</Select></Form.Item></Col>
                        <Col span={12}><Form.Item name="color" label="Change Color"><Select>{currentColors.map(c => <Option key={c.Color} value={c.Color}>{c.Color}</Option>)}</Select></Form.Item></Col>
                    </Row>
                    <Form.Item name="remarks" label="Reason for Change"><TextArea rows={2} /></Form.Item>
                    <Button type="primary" htmlType="submit" block>Update & Log</Button>
                </Form>
            </Modal>

            {/* LOG MODAL */}
            <Modal title="Log Call/Visit" open={logModal} onCancel={() => setLogModal(false)} footer={null}>
                <Form layout="vertical" form={logForm} onFinish={handleLogSubmit} initialValues={{ temperature: selectedLead?.Temperature }}>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="actionType" label="Type" initialValue="Call"><Select><Option value="Call">Call</Option><Option value="Visit">Visit</Option></Select></Form.Item></Col>
                        <Col span={12}><Form.Item name="temperature" label="New Temp"><Select><Option value="Hot">Hot</Option><Option value="Warm">Warm</Option><Option value="Cold">Cold</Option></Select></Form.Item></Col>
                    </Row>
                    <Form.Item name="remarks" label="Feedback" rules={[{required:true}]}><TextArea rows={2} /></Form.Item>
                    <Form.Item name="nextDate" label="Next Date" rules={[{required:true}]}><DatePicker style={{width:'100%'}} /></Form.Item>
                    <Button type="primary" htmlType="submit" block>Save Log</Button>
                </Form>
            </Modal>

            {/* BOOKING MODAL */}
            <Modal title="Take Token" open={bookingModal} onCancel={() => setBookingModal(false)} footer={null}>
                <Form layout="vertical" onFinish={handleBooking}>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="amount" label="Amount (₹)" rules={[{required:true}]}><Input type="number" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="mode" label="Mode" initialValue="Cash"><Select><Option value="Cash">Cash</Option><Option value="UPI">UPI</Option></Select></Form.Item></Col>
                    </Row>
                    <Form.Item name="remarks" label="Remarks"><TextArea /></Form.Item>
                    <Button type="primary" htmlType="submit" block style={{background:'#722ed1'}}>Confirm Booking</Button>
                </Form>
            </Modal>

            {/* HISTORY DRAWER */}
            <Drawer title="Timeline" open={historyVisible} onClose={() => setHistoryVisible(false)} width={450}>
                {selectedLead && (
                    <>
                        <Descriptions title="Summary" column={1} size="small" bordered>
                            <Descriptions.Item label="Name">{selectedLead.Customer_Name}</Descriptions.Item>
                            <Descriptions.Item label="Current Req">{selectedLead.Model_Interested} ({selectedLead.Color_Interested})</Descriptions.Item>
                            {selectedLead.Is_Finance === 1 && <Descriptions.Item label="Plan">Finance (DP: ₹{selectedLead.Down_Payment})</Descriptions.Item>}
                        </Descriptions>
                        <Divider />
                        <Title level={5}>Timeline</Title>
                        <Timeline>
                            {leadLogs.map(log => {
                                let color = 'blue';
                                if (log.Action_Type === 'Created') color = 'green';
                                else if (log.Action_Type === 'Preference Change') color = 'purple';
                                else if (log.Action_Type === 'Booking') color = 'gold';
                                
                                const isDateShift = log.Prev_FollowUp && log.New_FollowUp && log.Prev_FollowUp !== log.New_FollowUp && log.Action_Type !== 'Preference Change';

                                return (
                                    <Timeline.Item key={log.Log_ID} color={color}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                                            <Text strong>{log.Action_Type}</Text>
                                            <Text type="secondary" style={{fontSize:11}}>
                                                {dayjs(log.Created_At).format('DD MMM, hh:mm A')}
                                            </Text>
                                        </div>
                                        <div style={{color:'#666', fontSize: 12}}>by {log.Staff_Name}</div>
                                        <div style={{fontSize:13, margin:'6px 0'}}>{log.Remarks}</div>
                                        
                                        {/* Date Shift Indicator */}
                                        {isDateShift && (
                                            <div style={{marginTop:5}}>
                                                <Tag color="orange" style={{margin:0}}>
                                                    <HistoryOutlined /> Pushed: {dayjs(log.Prev_FollowUp).format('DD MMM')} <ArrowRightOutlined /> {dayjs(log.New_FollowUp).format('DD MMM')}
                                                </Tag>
                                            </div>
                                        )}
                                        {/* Preference Change Indicator */}
                                        {log.Action_Type === 'Preference Change' && (
                                            <div style={{marginTop:5}}>
                                                <Tag color="purple" icon={<SyncOutlined />} style={{margin:0}}>Req Updated</Tag>
                                            </div>
                                        )}
                                    </Timeline.Item>
                                );
                            })}
                        </Timeline>
                    </>
                )}
            </Drawer>

            <Modal title="Summary" open={summaryModal} onCancel={() => setSummaryModal(false)} footer={null}>
                <Row gutter={16} style={{ textAlign: 'center' }}>
                    <Col span={8}><Statistic title="Total" value={stats.tempStats?.reduce((a,b)=>a+b.count, 0) || 0} /></Col>
                    <Col span={8}><Statistic title="Hot" value={stats.tempStats?.find(s=>s.Temperature==='Hot')?.count || 0} valueStyle={{color:'red'}} /></Col>
                    <Col span={8}><Statistic title="Lost" value={stats.leakage?.reduce((a,b)=>a+b.count, 0) || 0} valueStyle={{color:'grey'}} /></Col>
                </Row>
            </Modal>
        </div>
    );
}