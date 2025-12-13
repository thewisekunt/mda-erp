import { Layout, Menu, Avatar, Dropdown, theme } from 'antd';
import { 
    DashboardOutlined, ShoppingCartOutlined, UserOutlined, LogoutOutlined, 
    CarOutlined, UsergroupAddOutlined, HistoryOutlined, WalletOutlined, 
    AuditOutlined, PhoneOutlined 
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

export default function MainLayout({ children, user, onLogout }) {
    const { token } = theme.useToken();
    const location = useLocation();

    const menuItems = [
        { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
        { key: '/presales', icon: <PhoneOutlined />, label: <Link to="/presales">Pre-Sales</Link> },
        { key: '/new-sale', icon: <ShoppingCartOutlined />, label: <Link to="/new-sale">New Sale</Link> },
        { key: '/inventory', icon: <CarOutlined />, label: <Link to="/inventory">Inventory</Link> },
        { key: '/customers', icon: <UsergroupAddOutlined />, label: <Link to="/customers">Customers</Link> },
        { key: '/accounts', icon: <WalletOutlined />, label: <Link to="/accounts">Accounts</Link> },
        { key: '/recovery', icon: <AuditOutlined />, label: <Link to="/recovery">Recovery</Link> },
        { key: '/sales-history', icon: <HistoryOutlined />, label: <Link to="/sales-history">History</Link> },
        user?.role === 'Admin' ? { key: '/users', icon: <UserOutlined />, label: <Link to="/users">Staff</Link> } : null,
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* SIDEBAR: Honda Dark Grey */}
            <Sider width={250} style={{ background: '#1F1F1F' }}> 
                <div style={{ 
                    height: 64, 
                    margin: 16, 
                    background: 'rgba(255,255,255,0.1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: 6 
                }}>
                    {/* Red Text for Contrast */}
                    <h2 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                        HONDA <span style={{color:'#E4002B'}}>ERP</span>
                    </h2>
                </div>
                <Menu 
                    theme="dark" 
                    mode="inline" 
                    selectedKeys={[location.pathname]} 
                    items={menuItems} 
                    style={{ background: '#1F1F1F' }} // Match Sider
                />
            </Sider>
            <Layout>
                <Header style={{ 
                    padding: '0 24px', 
                    background: 'white', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
                    height: 64
                }}>
                    <h3 style={{ margin: 0, color: '#333' }}>Maa Durga Honda</h3>
                    <Dropdown menu={{ items: [{ key: '1', label: 'Logout', icon: <LogoutOutlined />, onClick: onLogout }] }}>
                        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Red Avatar */}
                            <Avatar style={{ backgroundColor: '#E4002B' }} icon={<UserOutlined />} />
                            <span style={{ color: '#333' }}>{user?.name || 'Staff'} ({user?.role})</span>
                        </div>
                    </Dropdown>
                </Header>
                <Content style={{ margin: '24px 16px', padding: 24, background: token.colorBgContainer, borderRadius: 8 }}>
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
}