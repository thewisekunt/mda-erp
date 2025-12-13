import { useState, useEffect, useMemo } from 'react';
import { Table, Card, Input, Tag, Button, Space, Typography, Tabs, Modal, Divider, Form, DatePicker, Select, message, Statistic, Row, Col, Descriptions, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined, CarOutlined, AppstoreOutlined, PlusCircleOutlined, ThunderboltOutlined, DatabaseOutlined, EyeOutlined, EditOutlined, ShopOutlined, ClockCircleOutlined, UnorderedListOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function Inventory() {
    // Data States
    const [vehicles, setVehicles] = useState([]);
    const [batteries, setBatteries] = useState([]); 
    const [parties, setParties] = useState([]);
    const [models, setModels] = useState([]);
    const [colors, setColors] = useState([]);
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    
    // Modal States
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isPassportOpen, setIsPassportOpen] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    
    // Battery Modal States
    const [isBatEditOpen, setIsBatEditOpen] = useState(false);
    const [isBatViewOpen, setIsBatViewOpen] = useState(false);
    const [selectedBattery, setSelectedBattery] = useState(null);

    // Form Logic
    const [form] = Form.useForm();
    const [batForm] = Form.useForm(); // Separate form for Battery Edit
    const [availableColors, setAvailableColors] = useState([]);

    const fetchMasterData = () => {
        setLoading(true);
        const getData = async () => {
            try {
                const [vehRes, batRes, partyRes, modelRes, colorRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/vehicles'),
                    axios.get('http://localhost:5000/api/batteries'),
                    axios.get('http://localhost:5000/api/parties/amd'),
                    axios.get('http://localhost:5000/api/models'),
                    axios.get('http://localhost:5000/api/model-colors')
                ]);
                setVehicles(vehRes.data);
                setBatteries(batRes.data);
                setParties(partyRes.data);
                setModels(modelRes.data);
                setColors(colorRes.data);
                setLoading(false);
            } catch (err) {
                console.error("Data Load Error:", err);
                message.error("Failed to load data.");
                setLoading(false);
            }
        };
        getData();
    };

    useEffect(() => { fetchMasterData(); }, []);

    // ---------------------------------------------
    // FILTER LOGIC (Fixed)
    // ---------------------------------------------
    const normalizeStatus = (status) => (status || '').toString().toLowerCase().trim();

    // Vehicles
    const physicalStock = useMemo(() => vehicles.filter(v => ['stock in', 'in stock', 'available', 'new'].includes(normalizeStatus(v.Status))), [vehicles]);
    const soldStock = useMemo(() => vehicles.filter(v => !['stock in', 'in stock', 'available', 'new'].includes(normalizeStatus(v.Status))), [vehicles]);

    // Batteries (Bug Fix: Explicitly check for 'In Stock')
    const batteryInStock = useMemo(() => batteries.filter(b => ['in stock', 'available', 'new'].includes(normalizeStatus(b.Status))), [batteries]);
    const batteryOutStock = useMemo(() => batteries.filter(b => !['in stock', 'available', 'new'].includes(normalizeStatus(b.Status))), [batteries]);

    // ---------------------------------------------
    // ADD VEHICLE LOGIC
    // ---------------------------------------------
    const handleModelChange = (modelVariant) => {
        const selectedModel = models.find(m => m['Model Variant'] === modelVariant);
        if (selectedModel) {
            form.setFieldsValue({ basicPrice: selectedModel.ExSRP });
            const modelID = selectedModel['Model ID'];
            setAvailableColors(colors.filter(c => c['Model ID'] === modelID));
            form.setFieldsValue({ color: undefined });
        }
    };

    const handleAddStock = (values) => {
        const payload = { ...values, purchaseDate: values.purchaseDate.format('YYYY-MM-DD') };
        axios.post('http://localhost:5000/api/vehicles', payload)
            .then(() => {
                message.success("Entry Added Successfully!");
                form.resetFields();
                fetchMasterData();
            })
            .catch(err => message.error(err.response?.data?.error || "Failed to add"));
    };

    // ---------------------------------------------
    // BATTERY ACTIONS
    // ---------------------------------------------
    const handleBatteryView = (battery) => {
        setSelectedBattery(battery);
        setIsBatViewOpen(true);
    };

    const handleBatteryEdit = (battery) => {
        setSelectedBattery(battery);
        batForm.setFieldsValue({
            batteryType: battery['Battery Type'],
            status: battery.Status
        });
        setIsBatEditOpen(true);
    };

    const submitBatteryEdit = (values) => {
        axios.put(`http://localhost:5000/api/batteries/${selectedBattery['Battery No']}`, values)
            .then(() => {
                message.success("Battery Updated");
                setIsBatEditOpen(false);
                fetchMasterData();
            })
            .catch(() => message.error("Update Failed"));
    };

    // ---------------------------------------------
    // COLUMNS
    // ---------------------------------------------
    const getVehicleColumns = (type) => [
        {
            title: 'Model Info',
            dataIndex: 'Model Variant',
            render: (text, record) => <div><Text strong>{text}</Text><br/><Text type="secondary" style={{fontSize:11}}>{record.Color}</Text></div>
        },
        { title: 'Chassis No', dataIndex: 'Frame No', render: t => <Text copyable>{t}</Text> },
        { 
            title: 'Status', 
            dataIndex: 'Status', 
            render: s => <Tag color={normalizeStatus(s) === 'sold' ? 'red' : 'green'}>{s}</Tag> 
        },
        { title: 'Action', render: (_, r) => <Button icon={<EyeOutlined />} onClick={() => handleViewVehicle(r['Frame No'])} /> }
    ];

    const batteryColumns = [
        { title: 'Battery No', dataIndex: 'Battery No', render: t => <Text copyable strong>{t}</Text> },
        { title: 'Type', dataIndex: 'Battery Type', render: t => <Tag color="blue">{t}</Tag> },
        { title: 'Inward Date', dataIndex: 'Date', render: d => d ? dayjs(d).format('DD MMM YY') : '-' },
        { title: 'Status', dataIndex: 'Status', render: s => <Tag color={normalizeStatus(s) === 'in stock' ? 'green' : 'red'}>{s}</Tag> },
        { 
            title: 'Action', 
            key: 'act',
            render: (_, r) => (
                <Space>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => handleBatteryView(r)} />
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleBatteryEdit(r)} />
                </Space>
            )
        }
    ];

    const filterList = (list) => list.filter(item => JSON.stringify(item).toLowerCase().includes(searchText.toLowerCase()));

    const handleViewVehicle = (frameNo) => {
        const hide = message.loading("Loading...", 0);
        axios.get(`http://localhost:5000/api/vehicles/${frameNo}`)
            .then(res => { hide(); setSelectedVehicle(res.data); setIsPassportOpen(true); })
            .catch(() => { hide(); message.error("Failed to load"); });
    };

    // Summary Calculation
    const summaryData = useMemo(() => {
        const modelMap = {};
        physicalStock.forEach(v => {
            const m = v['Model Variant'] || 'Unknown';
            const c = v['Color'] || 'Unknown';
            if (!modelMap[m]) modelMap[m] = { total: 0, colors: {} };
            modelMap[m].total += 1;
            modelMap[m].colors[c] = (modelMap[m].colors[c] || 0) + 1;
        });
        return Object.keys(modelMap).map((m, i) => ({
            key: i, model: m, qty: modelMap[m].total,
            colorBreakdown: Object.keys(modelMap[m].colors).map((c, j) => ({ key: j, color: c, qty: modelMap[m].colors[c] }))
        }));
    }, [physicalStock]);

    return (
        <div style={{ paddingBottom: 50 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div><Title level={2} style={{ margin: 0 }}>Stock Manager</Title></div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchMasterData}>Refresh</Button>
                    <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => setIsAddOpen(true)} style={{ background: '#E4002B', borderColor: '#E4002B' }}>Inward Entry</Button>
                </Space>
            </div>

            <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col span={6}><Card bodyStyle={{ padding: 15 }}><Statistic title="Physical Vehicles" value={physicalStock.length} prefix={<CarOutlined style={{color:'#E4002B'}} />} /></Card></Col>
                <Col span={6}><Card bodyStyle={{ padding: 15 }}><Statistic title="Total Vehicles (All)" value={vehicles.length} prefix={<DatabaseOutlined />} /></Card></Col>
                <Col span={6}><Card bodyStyle={{ padding: 15 }}><Statistic title="Stock Value" value={physicalStock.reduce((acc, curr) => acc + (Number(curr['ExSrp']) || 0), 0)} prefix="₹" precision={0} /></Card></Col>
            </Row>

            <Card bodyStyle={{ padding: 0 }}>
                <Tabs defaultActiveKey="2" size="large" tabBarStyle={{ paddingLeft: 20 }}>
                    <Tabs.TabPane tab={<span><AppstoreOutlined /> Summary</span>} key="1">
                        <div style={{ padding: 20 }}>
                            <Table dataSource={summaryData} columns={[{ title: 'Model', dataIndex: 'model' }, { title: 'Qty', dataIndex: 'qty', render: q => <Tag color="green">{q}</Tag> }]} expandable={{ expandedRowRender: (rec) => <Table columns={[{ title: 'Color', dataIndex: 'color' }, { title: 'Qty', dataIndex: 'qty', render: q => <b>{q}</b> }]} dataSource={rec.colorBreakdown} pagination={false} size="small" /> }} pagination={false} bordered />
                        </div>
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><CarOutlined /> Physical Stock</span>} key="2">
                        <div style={{ padding: 16 }}><Input placeholder="Search..." prefix={<SearchOutlined />} onChange={e => setSearchText(e.target.value)} style={{ maxWidth: 300 }} /></div>
                        <Table columns={getVehicleColumns('physical')} dataSource={filterList(physicalStock)} rowKey="Frame No" />
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><ThunderboltOutlined /> Batteries</span>} key="4">
                        <div style={{ padding: 16 }}>
                            <Tabs type="card">
                                <Tabs.TabPane tab={`In Stock (${batteryInStock.length})`} key="b1">
                                    <Table columns={batteryColumns} dataSource={filterList(batteryInStock)} rowKey="Battery No" pagination={{pageSize:8}} />
                                </Tabs.TabPane>
                                <Tabs.TabPane tab={`Out / Installed (${batteryOutStock.length})`} key="b2">
                                    <Table columns={batteryColumns} dataSource={filterList(batteryOutStock)} rowKey="Battery No" pagination={{pageSize:8}} />
                                </Tabs.TabPane>
                            </Tabs>
                        </div>
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><DatabaseOutlined /> Sold History</span>} key="3">
                        <div style={{ padding: 16 }}><Input placeholder="Search History..." prefix={<SearchOutlined />} onChange={e => setSearchText(e.target.value)} style={{ maxWidth: 300 }} /></div>
                        <Table columns={getVehicleColumns('archive')} dataSource={filterList(soldStock)} rowKey="Frame No" size="small" />
                    </Tabs.TabPane>
                </Tabs>
            </Card>

            {/* MODAL: ADD VEHICLE + BATTERY */}
            <Modal title="Inward Stock Entry" open={isAddOpen} onCancel={() => setIsAddOpen(false)} footer={null} width={700} centered>
                <Form layout="vertical" form={form} onFinish={handleAddStock}>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="frameNo" label="Chassis No" rules={[{ required: true, len: 16 }]}><Input maxLength={16} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="engineNo" label="Engine No" rules={[{ required: true, len: 12 }]}><Input maxLength={12} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="modelVariant" label="Model" rules={[{ required: true }]}><Select onChange={handleModelChange} showSearch optionFilterProp="children">{models.map(m => <Option key={m['Model ID']} value={m['Model Variant']}>{m['Model Variant']}</Option>)}</Select></Form.Item></Col>
                        <Col span={12}><Form.Item name="color" label="Color" rules={[{ required: true }]}><Select disabled={availableColors.length === 0}>{availableColors.map((c, i) => <Option key={i} value={c.Color}>{c.Color}</Option>)}</Select></Form.Item></Col>
                    </Row>
                    <Divider orientation="left">Purchase & Battery</Divider>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="partyName" label="Supplier" rules={[{ required: true }]}><Select showSearch optionFilterProp="children">{parties.map(p => <Option key={p['Party ID']} value={p['Party Name']}>{p['Party Name']}</Option>)}</Select></Form.Item></Col>
                        <Col span={12}><Form.Item name="purchaseDate" label="Date" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="basicPrice" label="ExSRP"><Input type="number" prefix="₹" /></Form.Item></Col>
                        <Col span={8}>
                            <Form.Item name="batteryNo" label="Battery No"><Input placeholder="Enter Serial No" /></Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="batteryType" label="Battery Type" initialValue="4LB">
                                <Select>
                                    <Option value="4LB">4LB</Option>
                                    <Option value="5LB">5LB</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}><Col span={12}><Form.Item name="keyNo" label="Key No"><Input /></Form.Item></Col></Row>
                    <Button type="primary" htmlType="submit" block style={{ background: '#E4002B', marginTop: 10 }}>Save Stock</Button>
                </Form>
            </Modal>
            
            {/* MODAL: BATTERY EDIT */}
            <Modal title="Update Battery" open={isBatEditOpen} onCancel={() => setIsBatEditOpen(false)} footer={null}>
                <Form layout="vertical" form={batForm} onFinish={submitBatteryEdit}>
                    <Form.Item name="batteryType" label="Type">
                        <Select><Option value="4LB">4LB</Option><Option value="5LB">5LB</Option></Select>
                    </Form.Item>
                    <Form.Item name="status" label="Status">
                        <Select><Option value="In Stock">In Stock</Option><Option value="Stock Out">Stock Out</Option><Option value="Sold">Sold</Option></Select>
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block>Update</Button>
                </Form>
            </Modal>

            {/* MODAL: BATTERY VIEW */}
            <Modal title="Battery Details" open={isBatViewOpen} onCancel={() => setIsBatViewOpen(false)} footer={null}>
                {selectedBattery && (
                    <Descriptions column={1} bordered>
                        <Descriptions.Item label="Serial No">{selectedBattery['Battery No']}</Descriptions.Item>
                        <Descriptions.Item label="Type">{selectedBattery['Battery Type']}</Descriptions.Item>
                        <Descriptions.Item label="Status"><Tag color={normalizeStatus(selectedBattery.Status) === 'in stock' ? 'green' : 'red'}>{selectedBattery.Status}</Tag></Descriptions.Item>
                        <Descriptions.Item label="Inward Date">{selectedBattery.Date ? dayjs(selectedBattery.Date).format('DD MMMM YYYY') : 'N/A'}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            {/* MODAL: VEHICLE PASSPORT */}
            <Modal open={isPassportOpen} onCancel={() => setIsPassportOpen(false)} footer={null} title="Vehicle Passport">
                {selectedVehicle && selectedVehicle.stockInfo ? (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: 20, padding: 15, background: '#f9f9f9', borderRadius: 8 }}>
                            <Title level={4} style={{ margin: 0 }}>{selectedVehicle.stockInfo['Model Variant']}</Title>
                            <Tag color="blue">{selectedVehicle.stockInfo.Status}</Tag>
                        </div>
                        <Descriptions title={<Space><ShopOutlined /> Purchase Details</Space>} bordered size="small" column={1}>
                            <Descriptions.Item label="Supplier"><b>{selectedVehicle.stockInfo['Party Name']}</b></Descriptions.Item>
                            <Descriptions.Item label="Date">{dayjs(selectedVehicle.stockInfo['Purchase Date']).format('DD MMM YYYY')}</Descriptions.Item>
                            <Descriptions.Item label="ExSRP">₹ {Number(selectedVehicle.stockInfo['ExSrp'] || 0).toLocaleString()}</Descriptions.Item>
                        </Descriptions>
                        <br/>
                        <Descriptions title="Identity" bordered size="small" column={2}>
                            <Descriptions.Item label="Chassis">{selectedVehicle.stockInfo['Frame No']}</Descriptions.Item>
                            <Descriptions.Item label="Engine">{selectedVehicle.stockInfo['Engine No']}</Descriptions.Item>
                            <Descriptions.Item label="Key">{selectedVehicle.stockInfo['Key No']}</Descriptions.Item>
                            <Descriptions.Item label="Warehouse">{selectedVehicle.stockInfo.Warehouse}</Descriptions.Item>
                        </Descriptions>
                        {selectedVehicle.salesInfo && (
                             <Descriptions title="Sales Info" bordered size="small" column={1} style={{marginTop:20}}>
                                <Descriptions.Item label="Customer">{selectedVehicle.salesInfo.Customer}</Descriptions.Item>
                                <Descriptions.Item label="Date">{dayjs(selectedVehicle.salesInfo.Date).format('DD MMM YYYY')}</Descriptions.Item>
                            </Descriptions>
                        )}
                    </div>
                ) : <div style={{padding:20, textAlign:'center'}}><Spin tip="Loading..." /></div>}
            </Modal>
        </div>
    );
}