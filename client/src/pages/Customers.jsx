import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Row, Col, Upload, message, Typography, Space, Tag, Select, Timeline, InputNumber, DatePicker, Tabs, Drawer, Descriptions, Divider, Tooltip, Avatar, AutoComplete } from 'antd';
import { 
    UserOutlined, UserAddOutlined, UploadOutlined, EditOutlined, DeleteOutlined, 
    PhoneOutlined, SearchOutlined, EnvironmentOutlined, HistoryOutlined, 
    CarOutlined, ShoppingCartOutlined, RocketOutlined, AuditOutlined, 
    IdcardOutlined, MailOutlined, SafetyCertificateOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;

export default function Customers() {
    const navigate = useNavigate();
    const location = useLocation();

    // STATE
    const [customers, setCustomers] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [userRole, setUserRole] = useState('');
    
    // UI
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [journeyDrawer, setJourneyDrawer] = useState(false);
    const [locationOptions, setLocationOptions] = useState([]); 
    
    // Data
    const [editingCust, setEditingCust] = useState(null);
    const [selectedCust, setSelectedCust] = useState(null);
    const [journeyData, setJourneyData] = useState([]);
    
    const [form] = Form.useForm();
    const relationWatch = Form.useWatch('nomineeRelation', form);

    // 1. Initial Fetch
    useEffect(() => { 
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) setUserRole(user.role);
        fetchCustomers(); 
    }, []);

    // 2. Auto-Open Logic
    useEffect(() => {
        if (customers.length > 0 && location.state?.editCustId) {
            const target = customers.find(c => c['Cust ID'] === location.state.editCustId);
            if (target) {
                handleEdit(target); 
                setFilteredData([target]);
                message.info(location.state.message || "Please complete details");
                window.history.replaceState({}, document.title);
            }
        }
    }, [location.state, customers]);

    const fetchCustomers = () => {
        setLoading(true);
        axios.get('http://localhost:5000/api/customers')
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [];
                setCustomers(data);
                filterData(data, activeTab, searchText);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    const filterData = (data, tabKey, searchVal) => {
        let result = data;
        if (tabKey === 'new') result = result.filter(c => c.Customer_Status === 'New');
        else if (tabKey === 'booked') result = result.filter(c => c.Customer_Status === 'Booked');
        else if (tabKey === 'sold') result = result.filter(c => c.Customer_Status === 'Sold');

        if (searchVal) {
            const low = searchVal.toLowerCase();
            result = result.filter(c => 
                (c.Name && c.Name.toLowerCase().includes(low)) || 
                (c['Mobile No'] && c['Mobile No'].includes(low)) || 
                (c.Tehsil && c.Tehsil.toLowerCase().includes(low))
            );
        }
        setFilteredData(result);
    };

    const handleTabChange = (key) => { setActiveTab(key); filterData(customers, key, searchText); };
    const handleSearch = (e) => { const val = e.target.value; setSearchText(val); filterData(customers, activeTab, val); };

    // --- LOCATION LOGIC ---
    const handlePincodeSearch = async (e) => {
        const val = e.target.value;
        if (val.length === 6) {
            try {
                const res = await axios.get(`http://localhost:5000/api/master/locations/${val}`);
                if(res.data.length > 0) { 
                    const opts = res.data.map(l => ({ value: l.Post_Office, label: l.Post_Office, ...l }));
                    setLocationOptions(opts); 
                    message.success(`Found ${res.data.length} Post Offices`);
                }
            } catch (err) { console.error(err); }
        }
    };
    
    const handlePostSelect = (val, option) => {
        if(option) form.setFieldsValue({district:option.District, tehsil:option.Tehsil});
    };

    const showJourney = (record) => {
        setSelectedCust(record);
        axios.get(`http://localhost:5000/api/customers/journey/${record['Cust ID']}`)
            .then(res => {
                const items = (Array.isArray(res.data) ? res.data : []).map(item => ({
                    color: item.color,
                    label: dayjs(item.date).format('DD MMM YYYY'),
                    children: (
                        <>
                            <Text strong>{item.type}</Text>
                            <div style={{fontSize:12, color:'#666'}}>{item.desc}</div>
                        </>
                    )
                }));
                setJourneyData(items);
                setJourneyDrawer(true);
            });
    };

    const handleEdit = (r) => {
        setEditingCust(r);
        const isOther = r["Nominee's Relation"] && !['Father','Mother','Spouse','Son','Daughter','Brother'].includes(r["Nominee's Relation"]);
        
        form.setFieldsValue({
            name: r.Name, fatherName: r["Father's Name"], mobile: r["Mobile No"], altMobile: r["Alt Mobille"],
            email: r.Email, dob: r.DOB ? dayjs(r.DOB) : null,
            address: r.Address, post: r.Post, tehsil: r.Tehsil, district: r.District, pinCode: r["Pin Code"], 
            nomineeName: r["Nomine Name"], nomineeAge: r["Nominee's Age"], 
            nomineeRelation: isOther ? 'Other' : r["Nominee's Relation"],
            nomineeRelOther: isOther ? r["Nominee's Relation"] : '',
            drivingLicense: r["Driving License"], consent: r.wish 
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if(window.confirm("Permanently delete customer?")) {
            axios.delete(`http://localhost:5000/api/customers/${id}`).then(() => { message.success("Deleted"); fetchCustomers(); });
        }
    };

    const onFinish = (values) => {
        const formData = new FormData();
        Object.keys(values).forEach(k => {
            if(values[k] !== undefined && values[k] !== null) {
                if(k==='dob') formData.append(k, values[k].format('YYYY-MM-DD'));
                else if(['photo', 'aadhar', 'pan'].includes(k)) {
                    if (values[k].fileList && values[k].fileList.length > 0) {
                        formData.append(k, values[k].fileList[0].originFileObj);
                    } else if (values[k].file) {
                        formData.append(k, values[k].file.originFileObj);
                    }
                } 
                else formData.append(k, values[k]);
            }
        });
        const req = editingCust ? axios.put(`http://localhost:5000/api/customers/${editingCust['Cust ID']}`, formData) : axios.post('http://localhost:5000/api/customers', formData);
        req.then(() => { setIsModalOpen(false); fetchCustomers(); message.success("Saved Successfully"); }).catch(err => message.error("Save Failed"));
    };

    // Helper for File Upload Props
    const normFile = (e) => {
        if (Array.isArray(e)) return e;
        return e?.fileList;
    };

    const tabItems = [
        { key: 'all', label: <span><UserAddOutlined /> All</span> },
        { key: 'new', label: <span><RocketOutlined /> New</span> },
        { key: 'booked', label: <span><AuditOutlined /> Booked</span> },
        { key: 'sold', label: <span><CarOutlined /> Sold</span> },
    ];

    const columns = [
        { 
            title: 'Customer Profile', 
            dataIndex: 'Name', 
            width: 250,
            render: (t, r) => (
                <div style={{display:'flex', gap:12, alignItems:'center'}}>
                    <Avatar style={{backgroundColor: r.Customer_Status === 'Sold' ? '#52c41a' : '#1890ff'}} size="large" icon={<UserOutlined />}>
                        {t?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <div>
                        <Text strong style={{fontSize:15}}>{t}</Text>
                        <div style={{fontSize:12, color:'#888'}}>S/o {r["Father's Name"] || 'N/A'}</div>
                        <div style={{marginTop:2}}>
                            {r.Customer_Status === 'Sold' && <Tag color="green">Sold</Tag>}
                            {r.Customer_Status === 'Booked' && <Tag color="gold">Booked</Tag>}
                            {r.Customer_Status === 'New' && <Tag color="blue">New</Tag>}
                        </div>
                    </div>
                </div>
            )
        },
        { title: 'Contact', dataIndex: 'Mobile No', render: (t) => <a href={`tel:${t}`}><PhoneOutlined /> {t}</a> },
        { title: 'Location', render: (_, r) => <div>{r.Tehsil} {r["Pin Code"] && <Tag>{r["Pin Code"]}</Tag>}</div> },
        { 
            title: 'Actions', 
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="View Full Profile & History"><Button icon={<HistoryOutlined />} onClick={() => showJourney(record)} /></Tooltip>
                    {(userRole === 'Admin' || userRole === 'Manager') && <Tooltip title="Edit Profile"><Button icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>}
                    {record.Customer_Status !== 'Sold' && <Tooltip title="Sell Vehicle"><Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate('/new-sale', { state: { prefill: { custId: record['Cust ID'], name: record.Name, mobile: record['Mobile No'] } } })} /></Tooltip>}
                    {userRole === 'Admin' && <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record['Cust ID'])} />}
                </Space>
            )
        }
    ];

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Title level={2}>Customer Directory</Title>
                <div style={{ display:'flex', gap:10 }}>
                    <Input prefix={<SearchOutlined />} placeholder="Search Name, Mobile..." onChange={handleSearch} style={{ width: 250 }} />
                    <Button type="primary" icon={<UserAddOutlined />} onClick={() => { setEditingCust(null); form.resetFields(); setIsModalOpen(true); }}>Add New</Button>
                </div>
            </div>

            <Tabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} type="card" style={{marginBottom: 16}} />

            <Card>
                <Table dataSource={filteredData} columns={columns} rowKey="Cust ID" loading={loading} pagination={{ pageSize: 8 }} />
            </Card>

            <Modal title={editingCust ? "Edit Customer Profile" : "New Customer"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} width={850}>
                <Form layout="vertical" form={form} onFinish={onFinish}>
                    <Divider orientation="left" style={{marginTop:0}}><UserOutlined /> Personal Details</Divider>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="name" label="Full Name" rules={[{required:true}]}><Input style={{textTransform:'capitalize'}} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="fatherName" label="Father Name"><Input style={{textTransform:'capitalize'}} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="dob" label="Date of Birth"><DatePicker style={{width:'100%'}}/></Form.Item></Col>
                        <Col span={8}><Form.Item name="consent" label="Msg Consent" initialValue="Yes"><Select><Option value="Yes">Yes</Option><Option value="No">No</Option></Select></Form.Item></Col>
                        <Col span={8}><Form.Item name="drivingLicense" label="License" initialValue="Yes"><Select><Option value="Yes">Yes</Option><Option value="No">No</Option></Select></Form.Item></Col>
                    </Row>

                    <Divider orientation="left"><EnvironmentOutlined /> Contact & Address</Divider>
                    {/* RESTORED EMAIL FIELD HERE */}
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="mobile" label="Mobile No" rules={[{required:true, pattern:/^\d{10}$/}]}><Input maxLength={10} prefix="+91" /></Form.Item></Col>
                        <Col span={8}><Form.Item name="altMobile" label="Alt Mobile"><Input maxLength={10} prefix="+91" /></Form.Item></Col>
                        <Col span={8}><Form.Item name="email" label="Email"><Input prefix={<MailOutlined />} type="email" /></Form.Item></Col>
                    </Row>
                    
                    <div style={{ background:'#f9f9f9', padding:'15px', borderRadius:8, marginBottom:15 }}>
                        <Row gutter={16}>
                            <Col span={6}>
                                <Form.Item name="pinCode" label="Pincode"><Input onChange={handlePincodeSearch} maxLength={6} /></Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="post" label="Post">
                                    <AutoComplete options={locationOptions} onSelect={handlePostSelect} placeholder="Type/Select" />
                                </Form.Item>
                            </Col>
                            <Col span={6}><Form.Item name="tehsil" label="Tehsil"><Input /></Form.Item></Col>
                            <Col span={6}><Form.Item name="district" label="District"><Input /></Form.Item></Col>
                        </Row>
                        <Form.Item name="address" label="Address"><Input /></Form.Item>
                    </div>

                    <Divider orientation="left"><IdcardOutlined /> Nominee & Docs</Divider>
                    <Row gutter={16}>
                        <Col span={10}><Form.Item name="nomineeName" label="Nominee"><Input style={{textTransform:'capitalize'}} /></Form.Item></Col>
                        <Col span={6}><Form.Item name="nomineeAge" label="Age"><InputNumber style={{width:'100%'}} /></Form.Item></Col>
                        <Col span={8}>
                            <Form.Item name="nomineeRelation" label="Relation">
                                <Select>
                                    <Option value="Father">Father</Option><Option value="Spouse">Spouse</Option><Option value="Other">Other...</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    {relationWatch === 'Other' && <Form.Item name="nomineeRelOther" label="Specify Relation"><Input /></Form.Item>}

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="photo" label="Photo" valuePropName="fileList" getValueFromEvent={normFile}>
                                <Upload beforeUpload={()=>false} maxCount={1}><Button icon={<UploadOutlined />}>Photo</Button></Upload>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="aadhar" label="Aadhar" valuePropName="fileList" getValueFromEvent={normFile}>
                                <Upload beforeUpload={()=>false} maxCount={1}><Button icon={<UploadOutlined />}>Aadhar</Button></Upload>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="pan" label="PAN" valuePropName="fileList" getValueFromEvent={normFile}>
                                <Upload beforeUpload={()=>false} maxCount={1}><Button icon={<UploadOutlined />}>PAN</Button></Upload>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Button type="primary" htmlType="submit" block size="large">Save Profile</Button>
                </Form>
            </Modal>

            {/* CUSTOMER 360 DRAWER (FULL PROFILE RESTORED) */}
            <Drawer title="Customer 360 Profile" open={journeyDrawer} onClose={() => setJourneyDrawer(false)} width={600}>
                {selectedCust && (
                    <>
                        <Descriptions title="Personal Info" bordered column={1} size="small" style={{marginBottom:20}}>
                            <Descriptions.Item label="Name">{selectedCust.Name}</Descriptions.Item>
                            <Descriptions.Item label="Father">{selectedCust["Father's Name"]}</Descriptions.Item>
                            <Descriptions.Item label="Mobile">{selectedCust['Mobile No']}</Descriptions.Item>
                            <Descriptions.Item label="Email">{selectedCust.Email || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Address">{selectedCust.Address}, {selectedCust.Post}, {selectedCust.Tehsil}, {selectedCust.District} ({selectedCust["Pin Code"]})</Descriptions.Item>
                        </Descriptions>

                        <Descriptions title="KYC & Nominee" bordered column={2} size="small">
                            <Descriptions.Item label="License">{selectedCust["Driving License"]}</Descriptions.Item>
                            <Descriptions.Item label="Consent">{selectedCust.wish}</Descriptions.Item>
                            <Descriptions.Item label="Nominee">{selectedCust["Nomine Name"]}</Descriptions.Item>
                            <Descriptions.Item label="Relation">{selectedCust["Nominee's Relation"]}</Descriptions.Item>
                        </Descriptions>

                        <Divider />
                        
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <Title level={5} style={{margin:0}}><HistoryOutlined /> Interaction History</Title>
                        </div>
                        <br/>
                        
                        {journeyData.length > 0 ? (
                            <Timeline mode="left" items={journeyData} />
                        ) : <Text type="secondary">No interaction history found.</Text>}
                    </>
                )}
            </Drawer>
        </div>
    );
}