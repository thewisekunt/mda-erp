import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, DatePicker, Row, Col, Typography, Divider, message, AutoComplete, Radio, Switch, Tag } from 'antd';
import { ShoppingCartOutlined, UserOutlined, CalculatorOutlined, CheckCircleOutlined, BankOutlined, RetweetOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;

export default function NewSale() {
    const navigate = useNavigate();
    const location = useLocation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    
    // Data States
    const [customers, setCustomers] = useState([]);
    const [vehicles, setVehicles] = useState([]); 
    const [models, setModels] = useState([]);
    const [financers, setFinancers] = useState([]); 
    const [offers, setOffers] = useState([]);
    const [batteries, setBatteries] = useState([]); 
    
    // UI States
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [grandTotal, setGrandTotal] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash'); 
    const [isExchange, setIsExchange] = useState(false);

    // 1. Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [custRes, vehRes, modelRes, finRes, offRes, batRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/customers'),
                    axios.get('http://localhost:5000/api/vehicles'),
                    axios.get('http://localhost:5000/api/models'),
                    axios.get('http://localhost:5000/api/parties/financers'),
                    axios.get('http://localhost:5000/api/offers'),
                    axios.get('http://localhost:5000/api/batteries')
                ]);

                // Filter Stock
                const availableStock = vehRes.data.filter(v => ['Stock In', 'In Stock', 'Available', 'New'].includes(v.Status));
                const availableBatteries = batRes.data.filter(b => ['In Stock', 'Available', 'New'].includes(b.Status));
                availableBatteries.sort((a, b) => new Date(a.Date) - new Date(b.Date)); // FIFO

                setCustomers(custRes.data);
                setVehicles(availableStock);
                setModels(modelRes.data);
                setFinancers(finRes.data);
                setOffers(offRes.data);
                setBatteries(availableBatteries);

            } catch (err) {
                message.error("Failed to load booking data");
            }
        };
        fetchData();
    }, []);

    // 2. AUTO-FILL FROM PRE-SALES
    useEffect(() => {
        if (location.state && location.state.prefill) {
            const { name, mobile, custId } = location.state.prefill;
            console.log("Auto-filling from PreSales:", name, mobile);
            
            form.setFieldsValue({
                customerName: name,
                mobileNo: mobile,
                searchCust: `${name} - ${mobile}`,
            });

            // If CustID exists (Booked), we can select them if in list
            if (custId) {
                const existing = customers.find(c => c['Cust ID'] === custId);
                if (existing) setSelectedCustomer(existing);
                else {
                    // Create minimal object for submit
                    setSelectedCustomer({ 'Cust ID': custId, Name: name, 'Mobile No': mobile });
                }
            }
            message.success(`Lead Data Loaded: ${name}`);
        }
    }, [location.state, customers, form]);

    // 3. Handlers
    const handleCustomerSelect = (value, option) => {
        const cust = customers.find(c => c['Cust ID'] === option.key);
        if (cust) {
            setSelectedCustomer(cust);
            form.setFieldsValue({ customerName: cust.Name, mobileNo: cust['Mobile No'] });
        }
    };

    const handleVehicleSelect = (value) => {
        const veh = vehicles.find(v => v['Frame No'] === value);
        if (veh) {
            const modelInfo = models.find(m => m['Model Variant'] === veh['Model Variant']);
            
            form.setFieldsValue({
                basePrice: modelInfo?.ExSRP || veh['ExSrp'] || 0,
                engineNo: veh['Engine No'],
                color: veh.Color,
                rto: modelInfo?.RTO || 0,
                insurance: modelInfo?.Insurance || 0,
                accessories: modelInfo?.Accessories || 0,
                other: modelInfo?.['Other Charge'] || 0, 
            });
            calculateTotal();
        }
    };

    const handleOfferChange = (value, option) => {
        form.setFieldsValue({ offerAmount: option.data });
        calculateTotal();
    };

    const handlePaymentModeChange = (e) => {
        const mode = e.target.value;
        setPaymentMode(mode);
        if (mode === 'Finance') {
            form.setFieldsValue({ hypothecation: 3500 });
        } else {
            form.setFieldsValue({ hypothecation: 0, financer: null });
        }
        calculateTotal();
    };

    const calculateTotal = () => {
        const v = form.getFieldsValue();
        const charges = (Number(v.basePrice) || 0) + (Number(v.rto) || 0) + (Number(v.insurance) || 0) + (Number(v.accessories) || 0) + (Number(v.ew) || 0) + (Number(v.tr) || 0) + (Number(v.dp) || 0) + (Number(v.other) || 0) + (Number(v.hypothecation) || 0);
        const deductions = (Number(v.discount) || 0) + (Number(v.exchangeValue) || 0) + (Number(v.offerAmount) || 0);
        setGrandTotal(charges - deductions);
    };

    const onFinish = async (values) => {
        setLoading(true);
        // Use Pre-Sales ID or Selected ID
        const custIdToSend = selectedCustomer ? selectedCustomer['Cust ID'] : null;

        const payload = {
            ...values,
            paymentMode, 
            isExchange, 
            saleDate: values.saleDate.format('YYYY-MM-DD'),
            custId: custIdToSend, 
            totalAmount: grandTotal
        };

        try {
            await axios.post('http://localhost:5000/api/sales', payload);
            message.success("Sale Successful!");
            form.resetFields();
            setGrandTotal(0);
            setTimeout(() => navigate('/sales-history'), 1000);
        } catch (err) {
            message.error("Transaction Failed: " + (err.response?.data?.error || "Unknown Error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 50 }}>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
                <Title level={2} style={{ margin: 0 }}><ShoppingCartOutlined /> Pro Booking Engine</Title>
                <Text type="secondary">Vehicle Sales, Exchange & Finance</Text>
            </div>

            <Row gutter={24}>
                <Col span={16}>
                    <Card bordered={false}>
                        <Form layout="vertical" form={form} onFinish={onFinish} onValuesChange={calculateTotal} initialValues={{ discount: 0, tr: 0, dp: 0, other: 0, exchangeValue: 0, offerAmount: 0 }}>
                            
                            <Divider orientation="left"><UserOutlined /> Customer & Vehicle</Divider>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="searchCust" label="Search Customer (or type New)">
                                        <AutoComplete 
                                            placeholder="Name or Mobile" 
                                            onSelect={handleCustomerSelect} 
                                            filterOption={(inputValue, option) => option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1}
                                        >
                                            {customers.map(c => (
                                                <AutoComplete.Option key={c['Cust ID']} value={`${c.Name} - ${c['Mobile No']}`}>
                                                    {c.Name} ({c['Mobile No']})
                                                </AutoComplete.Option>
                                            ))}
                                        </AutoComplete>
                                    </Form.Item>
                                    <Form.Item name="customerName" hidden><Input /></Form.Item>
                                    <Form.Item name="mobileNo" hidden><Input /></Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="frameNo" label="Select Vehicle (Stock)" rules={[{required:true}]}>
                                        <Select showSearch placeholder="Select Chassis / Model" onChange={handleVehicleSelect} optionFilterProp="children">
                                            {vehicles.map(v => <Option key={v['Frame No']} value={v['Frame No']}>{v['Model Variant']} - {v.Color} ({v['Frame No']})</Option>)}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                            
                            <Row gutter={16}>
                                <Col span={12}><Form.Item name="engineNo" label="Engine No"><Input readOnly /></Form.Item></Col>
                                <Col span={12}>
                                    <Form.Item name="batteryNo" label="Select Battery (FIFO)" rules={[{required:true}]}>
                                        <Select placeholder="Select Serial No" showSearch>
                                            {batteries.map(b => <Option key={b['Battery No']} value={b['Battery No']}>{b['Battery No']} ({b['Battery Type']} - {dayjs(b.Date).format('DD MMM')})</Option>)}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider orientation="left"><BankOutlined /> Payment & Finance</Divider>
                            <Form.Item label="Payment Mode">
                                <Radio.Group onChange={handlePaymentModeChange} value={paymentMode} defaultValue="Cash" buttonStyle="solid">
                                    <Radio.Button value="Cash">Cash / UPI</Radio.Button>
                                    <Radio.Button value="Finance">Finance (Loan)</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            {paymentMode === 'Finance' && (
                                <Row gutter={16} style={{ background: '#f6ffed', padding: '10px 10px 0 10px', borderRadius: 8, marginBottom: 20, border: '1px solid #b7eb8f' }}>
                                    <Col span={12}>
                                        <Form.Item name="financer" label="Select Financer" rules={[{required:true}]}>
                                            <Select placeholder="Select Bank">{financers.map(f => <Option key={f['Party ID']} value={f['Party Name']}>{f['Party Name']}</Option>)}</Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}><Form.Item name="hypothecation" label="Hypothecation Charge"><Input type="number" prefix="₹" /></Form.Item></Col>
                                </Row>
                            )}

                            <Divider orientation="left"><RetweetOutlined /> Exchange & Offers</Divider>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Old Vehicle Exchange?"><Switch checked={isExchange} onChange={setIsExchange} checkedChildren="Yes" unCheckedChildren="No" /></Form.Item>
                                    {isExchange && (
                                        <div style={{ background: '#fff2f0', padding: 10, borderRadius: 8, border: '1px solid #ffccc7' }}>
                                            <Form.Item name="oldModel" label="Old Model" rules={[{required:true}]}><Input /></Form.Item>
                                            <Form.Item name="oldRegNo" label="Reg No" rules={[{required:true}]}><Input /></Form.Item>
                                            <Row gutter={8}>
                                                <Col span={12}><Form.Item name="oldEngine" label="Engine No"><Input /></Form.Item></Col>
                                                <Col span={12}><Form.Item name="oldChassis" label="Chassis No"><Input /></Form.Item></Col>
                                            </Row>
                                            <Form.Item name="exchangeValue" label="Exchange Value (₹)" rules={[{required:true}]}><Input type="number" prefix="-" style={{color:'red'}} /></Form.Item>
                                        </div>
                                    )}
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="offerName" label="Apply Offer">
                                        <Select placeholder="Select Offer" onChange={handleOfferChange} allowClear>{offers.map(o => <Option key={o.Offer_ID} value={o.Offer_Name} data={o.Amount}>{o.Offer_Name} (₹{o.Amount})</Option>)}</Select>
                                    </Form.Item>
                                    <Form.Item name="offerAmount" label="Offer Discount"><Input type="number" readOnly prefix="-" style={{color:'red'}} /></Form.Item>
                                </Col>
                            </Row>

                            <Divider orientation="left"><CalculatorOutlined /> Charges Breakdown</Divider>
                            <Row gutter={16}>
                                <Col span={8}><Form.Item name="basePrice" label="Ex-Showroom"><Input prefix="₹" type="number" /></Form.Item></Col>
                                <Col span={8}><Form.Item name="rto" label="RTO / Reg"><Input prefix="₹" type="number" /></Form.Item></Col>
                                <Col span={8}><Form.Item name="insurance" label="Insurance"><Input prefix="₹" type="number" /></Form.Item></Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={8}><Form.Item name="accessories" label="Accessories"><Input prefix="₹" type="number" /></Form.Item></Col>
                                <Col span={8}><Form.Item name="ew" label="Ext. Warranty"><Input prefix="₹" type="number" /></Form.Item></Col>
                                <Col span={8}><Form.Item name="tr" label="TR Charge"><Input prefix="₹" type="number" /></Form.Item></Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={8}><Form.Item name="dp" label="DP Charge"><Input prefix="₹" type="number" /></Form.Item></Col>
                                <Col span={8}><Form.Item name="other" label="Other Charges"><Input prefix="₹" type="number" /></Form.Item></Col>
                                <Col span={8}><Form.Item name="discount" label="Manual Discount"><Input prefix="-" type="number" style={{ color: 'red' }} /></Form.Item></Col>
                            </Row>

                            <Form.Item name="saleDate" label="Booking Date" initialValue={dayjs()}><DatePicker style={{width:'100%'}}/></Form.Item>
                            
                            <Button type="primary" htmlType="submit" block size="large" loading={loading} icon={<CheckCircleOutlined />} style={{background:'#E4002B', marginTop:10}}>
                                Confirm Sale
                            </Button>
                        </Form>
                    </Card>
                </Col>

                <Col span={8}>
                    <Card title="Payment Summary" bordered={false} style={{ position: 'sticky', top: 20 }}>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <Text type="secondary">Net Payable Amount</Text>
                            <Title level={2} style={{ color: '#E4002B', margin: 0 }}>₹ {grandTotal.toLocaleString()}</Title>
                        </div>
                        <div style={{ marginTop: 20, textAlign: 'left', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom:5 }}><Text>Hypothecation:</Text> <Text>+ ₹{form.getFieldValue('hypothecation')||0}</Text></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'red', marginBottom:5 }}><Text type="danger">Discount:</Text> <Text type="danger">- ₹{form.getFieldValue('discount') || 0}</Text></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'green', marginBottom:5 }}><Text type="success">Offer:</Text> <Text type="success">- ₹{form.getFieldValue('offerAmount') || 0}</Text></div>
                            {isExchange && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff', fontWeight:'bold', borderTop:'1px dashed #ddd', paddingTop:5 }}>
                                    <Text style={{color:'#1890ff'}}>Exchange Value:</Text> <Text>- ₹{form.getFieldValue('exchangeValue') || 0}</Text>
                                </div>
                            )}
                        </div>
                        {location.state?.prefill && <Tag color="orange" style={{marginTop:10, width:'100%', textAlign:'center'}}>Auto-Filled from Enquiry</Tag>}
                    </Card>
                </Col>
            </Row>
        </div>
    );
}