// server/index.js - HONDA ERP FINAL COMPLETE VERSION
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = "HONDA_ERP_SECRET_KEY_2025"; 

// ==========================================
// 1. FILE UPLOAD CONFIGURATION
// ==========================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});

const upload = multer({ storage: storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 2. AUTHENTICATION MIDDLEWARE
// ==========================================
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send("Token required");
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
    } catch (err) { return res.status(401).send("Invalid Token"); }
    return next();
};

// ==========================================
// 3. AUTH API
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query("SELECT * FROM `Users` WHERE `Username` = ?", [username]);
        if (users.length === 0) return res.status(401).json({ error: "User not found" });

        const user = users[0];
        // Production: const isMatch = await bcrypt.compare(password, user.Password);
        const isMatch = (password === user.Password); 
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user.User_ID, role: user.Role, name: user.Full_Name }, SECRET_KEY, { expiresIn: '12h' });
        res.json({ token, user: { name: user.Full_Name, role: user.Role } });
    } catch (err) { res.status(500).json({ error: "Login failed" }); }
});

// ==========================================
// 4. MASTER DATA APIs
// ==========================================
app.get('/api/models', authenticate, async (req, res) => {
    try { const [rows] = await db.query("SELECT * FROM `Models List`"); res.json(rows); } 
    catch (err) { res.status(500).send("Error fetching models"); }
});
app.get('/api/parties/amd', authenticate, async (req, res) => {
    try { const [rows] = await db.query("SELECT * FROM `Parties` WHERE `Party Type` = 'AMD'"); res.json(rows); } 
    catch (err) { res.status(500).send("Error fetching parties"); }
});
app.get('/api/parties/financers', authenticate, async (req, res) => {
    try { const [rows] = await db.query("SELECT * FROM `Parties` WHERE `Party Type` = 'Financer'"); res.json(rows); } 
    catch (err) { res.status(500).send("Error fetching financers"); }
});
app.get('/api/model-colors', authenticate, async (req, res) => {
    try { const [rows] = await db.query("SELECT * FROM `Model Colors`"); res.json(rows); } 
    catch (err) { res.status(500).send("Error fetching colors"); }
});
app.get('/api/offers', authenticate, async (req, res) => {
    try { const [rows] = await db.query("SELECT * FROM `Offers` WHERE `Status` = 'Active'"); res.json(rows); } 
    catch (err) { res.status(500).send("Error fetching offers"); }
});

// ==========================================
// 5. INVENTORY & VEHICLE APIs
// ==========================================
app.get('/api/vehicles', authenticate, async (req, res) => {
    try { const [rows] = await db.query("SELECT * FROM `Purchase` ORDER BY `Purchase Date` DESC"); res.json(rows); } 
    catch (err) { res.status(500).send("Database Error"); }
});

app.get('/api/vehicles/:frameNo', authenticate, async (req, res) => {
    const { frameNo } = req.params;
    try {
        const connection = await db.getConnection();
        const [purchaseData] = await connection.query("SELECT * FROM `Purchase` WHERE `Frame No` = ?", [frameNo]);
        const [salesData] = await connection.query("SELECT * FROM `Delivery` WHERE `Frame No` = ?", [frameNo]);
        connection.release();
        if (purchaseData.length === 0) return res.status(404).json({ error: "Vehicle not found" });
        res.json({ stockInfo: purchaseData[0], salesInfo: salesData.length > 0 ? salesData[0] : null });
    } catch (err) { res.status(500).send("Database Error"); }
});

app.post('/api/vehicles', authenticate, async (req, res) => {
    const { frameNo, engineNo, modelVariant, color, purchaseDate, basicPrice, discount, partyName, keyNo, batteryNo, batteryType } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const rowId = 'PUR-' + Date.now();
        await connection.query(
            "INSERT INTO `Purchase` (`Row ID`, `Frame No`, `Engine No`, `Model Variant`, `Color`, `Purchase Date`, `ExSrp`, `Discount`, `Party Name`, `Key No`, `Status`, `timestamp`, `Warehouse`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Stock In', NOW(), 'Showroom')",
            [rowId, frameNo, engineNo, modelVariant, color, purchaseDate, basicPrice, discount || 0, partyName, keyNo]
        );
        if (batteryNo) {
            await connection.query(
                "INSERT INTO `Batteries` (`Row ID`, `Battery No`, `Battery Type`, `Status`, `Date`) VALUES (?, ?, ?, 'In Stock', ?)",
                ['BAT-'+Date.now(), batteryNo, batteryType || '4LB', purchaseDate]
            );
        }
        await connection.commit();
        res.status(201).json({ message: "Vehicle & Battery Stock Added!" });
    } catch (err) {
        await connection.rollback();
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "Duplicate Entry" });
        res.status(500).json({ error: "Database Error" });
    } finally { connection.release(); }
});

app.get('/api/batteries', authenticate, async (req, res) => {
    try { const [rows] = await db.query("SELECT * FROM `Batteries` ORDER BY `Date` DESC"); res.json(rows); } 
    catch (err) { res.status(500).send("Database Error"); }
});

app.put('/api/batteries/:batteryNo', authenticate, async (req, res) => {
    const { batteryNo } = req.params;
    const { batteryType, status } = req.body;
    try {
        await db.query("UPDATE `Batteries` SET `Battery Type` = ?, `Status` = ? WHERE `Battery No` = ?", [batteryType, status, batteryNo]);
        res.json({ message: "Battery Updated" });
    } catch (err) { res.status(500).send("Update Failed"); }
});

// ==========================================
// 6. CUSTOMER MANAGEMENT APIs
// ==========================================
app.get('/api/customers', authenticate, async (req, res) => {
    try { const [rows] = await db.query("SELECT * FROM `Customers` ORDER BY `timestamp` DESC"); res.json(rows); } 
    catch (err) { res.status(500).send("Error fetching customers"); }
});

app.get('/api/customers/:custId', authenticate, async (req, res) => {
    const { custId } = req.params;
    try {
        const connection = await db.getConnection();
        const [customer] = await connection.query("SELECT * FROM `Customers` WHERE `Cust ID` = ?", [custId]);
        const [history] = await connection.query("SELECT * FROM `Delivery` WHERE `Cust ID` = ? ORDER BY `Date` DESC", [custId]);
        connection.release();
        if (customer.length === 0) return res.status(404).json({ error: "Customer not found" });
        res.json({ profile: customer[0], history: history });
    } catch (err) { res.status(500).send("Database Error"); }
});

app.post('/api/customers', authenticate, upload.fields([{ name: 'photo' }, { name: 'aadhar' }, { name: 'pan' }]), async (req, res) => {
    const { name, fatherName, mobile, altMobile, email, dob, address, post, tehsil, district, pinCode, nomineeName, nomineeAge, nomineeRelation, drivingLicense, wish } = req.body;
    const photoPath = req.files['photo'] ? req.files['photo'][0].path.replace(/\\/g, "/") : null;
    const aadharPath = req.files['aadhar'] ? req.files['aadhar'][0].path.replace(/\\/g, "/") : null;
    const panPath = req.files['pan'] ? req.files['pan'][0].path.replace(/\\/g, "/") : null;
    const rowId = 'ROW-' + Date.now();
    const custId = 'CUST-' + Date.now();
    const createdBy = req.user.name;

    try {
        const query = "INSERT INTO `Customers` (`Row ID`, `Cust ID`, `Name`, `Father's Name`, `Mobile No`, `Alt Mobille`, `Email`, `DOB`, `Address`, `Post`, `Tehsil`, `District`, `Pin Code`, `Nomine Name`, `Nominee's Age`, `Nominee's Relation`, `Driving License`, `wish`, `Photo`, `Aadhar_Path`, `PAN_Path`, `Created By`, `timestamp`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        await db.query(query, [rowId, custId, name, fatherName, mobile, altMobile, email, dob, address, post, tehsil, district, pinCode, nomineeName, nomineeAge, nomineeRelation, drivingLicense, wish, photoPath, aadharPath, panPath, createdBy]);
        res.status(201).json({ message: "Customer Created", custId });
    } catch (err) { res.status(500).json({ error: "Failed to create customer" }); }
});

app.put('/api/customers/:custId', authenticate, upload.fields([{ name: 'photo' }, { name: 'aadhar' }, { name: 'pan' }]), async (req, res) => {
    const { custId } = req.params;
    const { name, fatherName, mobile, altMobile, email, dob, address, post, tehsil, district, pinCode, nomineeName, nomineeAge, nomineeRelation, drivingLicense, wish } = req.body;
    try {
        const query = "UPDATE `Customers` SET `Name`=?, `Father's Name`=?, `Mobile No`=?, `Alt Mobille`=?, `Email`=?, `DOB`=?, `Address`=?, `Post`=?, `Tehsil`=?, `District`=?, `Pin Code`=?, `Nomine Name`=?, `Nominee's Age`=?, `Nominee's Relation`=?, `Driving License`=?, `wish`=? WHERE `Cust ID`=?";
        await db.query(query, [name, fatherName, mobile, altMobile, email, dob, address, post, tehsil, district, pinCode, nomineeName, nomineeAge, nomineeRelation, drivingLicense, wish, custId]);
        if (req.files['photo']) await db.query("UPDATE `Customers` SET `Photo`=? WHERE `Cust ID`=?", [req.files['photo'][0].path.replace(/\\/g, "/"), custId]);
        if (req.files['aadhar']) await db.query("UPDATE `Customers` SET `Aadhar_Path`=? WHERE `Cust ID`=?", [req.files['aadhar'][0].path.replace(/\\/g, "/"), custId]);
        if (req.files['pan']) await db.query("UPDATE `Customers` SET `PAN_Path`=? WHERE `Cust ID`=?", [req.files['pan'][0].path.replace(/\\/g, "/"), custId]);
        res.json({ message: "Updated" });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.delete('/api/customers/:custId', authenticate, async (req, res) => {
    try { await db.query("DELETE FROM `Customers` WHERE `Cust ID` = ?", [req.params.custId]); res.json({ message: "Deleted" }); } 
    catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ==========================================
// 7. SALES & TRANSACTIONS API
// ==========================================
app.get('/api/sales/history', authenticate, async (req, res) => {
    try { 
        const connection = await db.getConnection();
        const query = `
            SELECT d.*, p.\`Model Variant\`, p.Color, p.\`Engine No\`
            FROM \`Delivery\` d
            LEFT JOIN \`Purchase\` p ON d.\`Frame No\` = p.\`Frame No\`
            ORDER BY d.\`Date\` DESC
        `;
        const [rows] = await connection.query(query);
        connection.release();
        res.json(rows); 
    } 
    catch (err) { res.status(500).send("Database Error"); }
});

// CREATE SALE (Auto-Detects/Creates Customer + Battery + Exchange)
app.post('/api/sales', authenticate, async (req, res) => {
    const { 
        customerName, mobileNo, frameNo, saleDate, totalAmount,
        paymentMode, financer, hypothecation,
        rto, insurance, accessories, ew, tr, dp, other, discount,
        isExchange, oldModel, oldRegNo, oldEngine, oldChassis, exchangeValue,
        offerName, offerAmount, batteryNo, custId 
    } = req.body;

    const staffName = req.user.name; 
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        let finalCustId = custId;
        // Auto-Create Customer if missing
        if (!finalCustId) {
            const [existing] = await connection.query("SELECT `Cust ID` FROM `Customers` WHERE `Mobile No` = ?", [mobileNo]);
            if (existing.length > 0) {
                finalCustId = existing[0]['Cust ID'];
            } else {
                finalCustId = 'CUST-' + Date.now();
                await connection.query(
                    "INSERT INTO `Customers` (`Row ID`, `Cust ID`, `Name`, `Mobile No`, `timestamp`, `Created By`) VALUES (?, ?, ?, ?, NOW(), ?)",
                    ['ROW-'+Date.now(), finalCustId, customerName, mobileNo, staffName]
                );
            }
        }

        const rowID = 'SALE-' + Date.now(); 
        const query = `
            INSERT INTO \`Delivery\` 
            (\`Row ID\`, \`Date\`, \`Customer\`, \`Cust ID\`, \`Frame No\`, 
             \`Pay Method\`, \`Financer\`, \`Hypothecation\`,
             \`RTO_Amt\`, \`Ins_Amt\`, \`Acc_Amt\`, \`EW\`, \`TR\`, 
             \`Exchange_Val\`, \`Offer_Name\`, \`Offer_Amt\`,
             \`Grand Total\`, \`Discount\`, \`Status\`, \`Created By\`, \`Battery_No\`) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Booked', ?, ?)
        `;
        await connection.query(query, [
            rowID, saleDate, customerName, finalCustId, frameNo, 
            paymentMode, financer, hypothecation || 0,
            rto || 0, insurance || 0, accessories || 0, ew || 0, tr || 0,
            exchangeValue || 0, offerName, offerAmount || 0,
            totalAmount, discount || 0, staffName, batteryNo
        ]);

        if (isExchange && exchangeValue > 0) {
            const exID = 'EXCH-' + Date.now();
            await connection.query(
                "INSERT INTO `Exchange_Inventory` (`Exchange_ID`, `New_Frame_No`, `Old_Model`, `Old_Reg_No`, `Old_Engine_No`, `Old_Chassis_No`, `Exchange_Value`, `Received_Date`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [exID, frameNo, oldModel, oldRegNo, oldEngine, oldChassis, exchangeValue, saleDate]
            );
        }

        await connection.query("UPDATE `Purchase` SET `Status` = 'Sold' WHERE `Frame No` = ?", [frameNo]);
        if (batteryNo) {
            await connection.query("UPDATE `Batteries` SET `Status` = 'Sold' WHERE `Battery No` = ?", [batteryNo]);
        }

        await connection.commit();
        res.status(200).json({ message: "Sale Recorded Successfully!" });
    } catch (err) {
        await connection.rollback();
        console.error("Sale Error:", err);
        res.status(500).json({ error: "Database Error: " + err.message });
    } finally { connection.release(); }
});

// UPLOAD DOCUMENTS
app.post('/api/sales/upload', authenticate, upload.single('file'), async (req, res) => {
    const { frameNo, docType } = req.body;
    const filePath = req.file.path.replace(/\\/g, "/");
    if (!['Invoice', 'Insurance', 'RTO'].includes(docType)) return res.status(400).send("Invalid Doc Type");
    const columnMap = { 'Invoice': 'Invoice_Path', 'Insurance': 'Insurance_Path', 'RTO': 'RTO_File_Path' };
    try {
        await db.query(`UPDATE \`Delivery\` SET \`${columnMap[docType]}\` = ? WHERE \`Frame No\` = ?`, [filePath, frameNo]);
        res.json({ message: "File Uploaded Successfully", path: filePath });
    } catch (err) { res.status(500).send("Upload Failed"); }
});

// UPDATE POST-SALES DETAILS
app.put('/api/sales/update-details', authenticate, async (req, res) => {
    const { frameNo, invoiceNo, invoiceDate, policyNo, insuranceCo, insuranceAmt, policyDate, regNo, rtoDate, rtoCost, hsrpStatus } = req.body;
    try {
        let expiryDate = null;
        if(policyDate) {
            const d = new Date(policyDate);
            d.setFullYear(d.getFullYear() + 5);
            expiryDate = d.toISOString().slice(0, 10);
        }
        const query = `
            UPDATE \`Delivery\` SET 
            \`Invoice_No\`=?, \`Invoice_Date\`=?,
            \`Policy_No\`=?, \`Insurance_Co\`=?, \`Insurance_Amt\`=?, \`Policy_Date\`=?, \`Policy_Expiry\`=?,
            \`Registration_No\`=?, \`RTO_Date\`=?, \`RTO_Cost\`=?, \`HSRP_Status\`=?
            WHERE \`Frame No\`=?
        `;
        await db.query(query, [invoiceNo, invoiceDate, policyNo, insuranceCo, insuranceAmt, policyDate, expiryDate, regNo, rtoDate, rtoCost, hsrpStatus, frameNo]);
        res.json({ message: "Details Updated" });
    } catch (err) { res.status(500).send("Update Failed"); }
});

// ==========================================
// 8. ACCOUNTS (LEDGER & CREDIT SYSTEM)
// ==========================================
app.get('/api/accounts/summary/:frameNo', authenticate, async (req, res) => {
    const { frameNo } = req.params;
    try {
        const connection = await db.getConnection();
        const [sale] = await connection.query("SELECT * FROM `Delivery` WHERE `Frame No` = ?", [frameNo]);
        if (sale.length === 0) { connection.release(); return res.status(404).json({ error: "Not Sold" }); }
        
        const custId = sale[0]['Cust ID'];
        const [finance] = await connection.query("SELECT * FROM `Finance_Business` WHERE `Cust_ID` = ?", [custId]);
        
        // Ledger Logic
        const [purchases] = await connection.query("SELECT * FROM `Delivery` WHERE `Cust ID` = ?", [custId]);
        let totalDebit = 0;
        purchases.forEach(p => { totalDebit += (Number(p['Grand Total']) || 0); }); 

        const [payments] = await connection.query("SELECT * FROM `Customer_Payments` WHERE `Cust_ID` = ?", [custId]);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.Amount), 0);
        const [promises] = await connection.query("SELECT * FROM `Credit_Promises` WHERE `Cust_ID` = ?", [custId]);

        connection.release();
        res.json({ sale: sale[0], financeInfo: finance[0], customer: { custId, totalDebit, totalPaid, payments }, promises });
    } catch (err) { res.status(500).send("Database Error"); }
});

app.post('/api/accounts/pay', authenticate, async (req, res) => {
    const { custId, frameNo, amount, date, mode, note } = req.body;
    try {
        await db.query("INSERT INTO `Customer_Payments` (`Cust_ID`, `Frame_No`, `Amount`, `Payment_Date`, `Mode`, `Note`) VALUES (?, ?, ?, ?, ?, ?)", [custId, frameNo, amount, date, mode, note]);
        res.json({ message: "Payment Recorded" });
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/api/accounts/finance', authenticate, async (req, res) => {
    const { custId, frameNo, financer, doNumber, disburseAmt } = req.body;
    try {
        const [exists] = await db.query("SELECT * FROM `Finance_Business` WHERE `Cust_ID` = ?", [custId]);
        if (exists.length > 0) {
            await db.query("UPDATE `Finance_Business` SET `Financer_Name`=?, `DO_Number`=?, `Disburse_Amt`=?, `Frame_No`=? WHERE `Cust_ID`=?", [financer, doNumber, disburseAmt, frameNo, custId]);
        } else {
            await db.query("INSERT INTO `Finance_Business` (`Cust_ID`, `Frame_No`, `Financer_Name`, `DO_Number`, `Disburse_Amt`) VALUES (?, ?, ?, ?, ?)", [custId, frameNo, financer, doNumber, disburseAmt]);
        }
        res.json({ message: "Finance Details Updated" });
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/api/accounts/credit', authenticate, async (req, res) => {
    const { frameNo, custId, amount, promiseDate, note } = req.body;
    const approvedBy = req.user.name;
    try {
        await db.query("INSERT INTO `Credit_Promises` (`Frame_No`, `Cust_ID`, `Amount`, `Promise_Date`, `Note`, `Approved_By`, `Status`) VALUES (?, ?, ?, ?, ?, ?, 'Pending')", [frameNo, custId, amount, promiseDate, note, approvedBy]);
        await db.query("UPDATE `Delivery` SET `Promise_Date`=?, `Credit_Note`=? WHERE `Frame No`=?", [promiseDate, note, frameNo]);
        res.json({ message: "Credit Recorded" });
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/api/gatepass/generate', authenticate, async (req, res) => {
    const { frameNo } = req.body;
    const gatePassId = 'GP-' + Date.now();
    try {
        await db.query("UPDATE `Delivery` SET `Gate_Pass_ID`=?, `Gate_Pass_Date`=NOW(), `Status`='Delivered' WHERE `Frame No`=?", [gatePassId, frameNo]);
        await db.query("UPDATE `Purchase` SET `Status`='Stock Out' WHERE `Frame No`=?", [frameNo]);
        
        // Auto-Close Enquiry
        const [del] = await db.query("SELECT `Cust ID` FROM `Delivery` WHERE `Frame No`=?", [frameNo]);
        if(del.length > 0) {
            await db.query("UPDATE `Enquiries` SET `Status`='Converted' WHERE `Cust_ID`=? AND `Status`='Booked'", [del[0]['Cust ID']]);
        }
        res.json({ message: "Gate Pass Generated!", gpId: gatePassId });
    } catch (err) { res.status(500).send("Failed"); }
});

// ==========================================
// 9. CREDIT & RECOVERY MANAGEMENT
// ==========================================
app.get('/api/recovery/dues', authenticate, async (req, res) => {
    try {
        const connection = await db.getConnection();
        const query = `
            SELECT d.\`Frame No\`, d.\`Date\` as Sale_Date, d.\`Grand Total\`, d.\`Customer\`, d.\`Cust ID\`, c.\`Mobile No\`, cp.\`Promise_Date\`,
                (SELECT COALESCE(SUM(p.Amount), 0) FROM \`Customer_Payments\` p WHERE p.\`Cust_ID\` = d.\`Cust ID\`) as Paid_Cash,
                (SELECT COALESCE(SUM(f.Disburse_Amt), 0) FROM \`Finance_Business\` f WHERE f.\`Cust_ID\` = d.\`Cust ID\`) as Finance_DO,
                d.\`Exchange_Val\`, d.\`Offer_Amt\`
            FROM \`Delivery\` d
            JOIN \`Customers\` c ON d.\`Cust ID\` = c.\`Cust ID\`
            LEFT JOIN \`Credit_Promises\` cp ON d.\`Frame No\` = cp.\`Frame_No\` AND cp.Status = 'Pending'
            ORDER BY cp.Promise_Date ASC
        `;
        const [rows] = await connection.query(query);
        connection.release();
        const recoveryList = rows.map(row => {
            const totalCovered = Number(row.Paid_Cash) + Number(row.Finance_DO) + Number(row.Exchange_Val) + Number(row.Offer_Amt);
            return { ...row, Balance: Number(row['Grand Total']) - totalCovered };
        }).filter(r => r.Balance > 10);
        res.json(recoveryList);
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/api/recovery/log', authenticate, async (req, res) => {
    const { custId, frameNo, type, response, nextDate } = req.body;
    const staff = req.user.name;
    try {
        await db.query("INSERT INTO `Recovery_Logs` (`Cust_ID`, `Frame_No`, `Action_Type`, `Response`, `Next_Follow_Up`, `Logged_By`) VALUES (?, ?, ?, ?, ?, ?)", [custId, frameNo, type, response, nextDate, staff]);
        if (nextDate) {
            await db.query("UPDATE `Credit_Promises` SET `Promise_Date`=? WHERE `Frame_No`=? AND `Status`='Pending'", [nextDate, frameNo]);
            await db.query("UPDATE `Delivery` SET `Promise_Date`=? WHERE `Frame No`=?", [nextDate, frameNo]);
        }
        res.json({ message: "Log Saved" });
    } catch (err) { res.status(500).send("Error"); }
});

app.get('/api/recovery/history/:custId', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM `Recovery_Logs` WHERE `Cust_ID` = ? ORDER BY `Created_At` DESC", [req.params.custId]);
        res.json(rows);
    } catch (err) { res.status(500).send("Error"); }
});

// ==========================================
// 10. PRE-SALES (LEAD MANAGEMENT - ADVANCED)
// ==========================================

// GET ALL ENQUIRIES
app.get('/api/enquiries', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM `Enquiries` ORDER BY `Status` ASC, `Next_FollowUp` ASC");
        res.json(rows);
    } catch (err) { res.status(500).send("Error fetching enquiries"); }
});

// CREATE NEW LEAD (With Finance/Exchange Flags)
app.post('/api/enquiries', authenticate, async (req, res) => {
    const { 
        name, mobile, model, color, source, temperature, followUp, remarks, 
        isFinance, downPayment, isExchange, exModel, exYear, exValue 
    } = req.body;
    
    const staff = req.user.name; 

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert Enquiry
        const [result] = await connection.query(
            "INSERT INTO `Enquiries` (`Customer_Name`, `Mobile`, `Model_Interested`, `Color_Interested`, `Source`, `Temperature`, `Next_FollowUp`, `Remarks`, `Created_By`, `Assigned_To`, `Is_Finance`, `Down_Payment`, `Is_Exchange`, `Exchange_Model`, `Exchange_Year`, `Exchange_Value`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [name, mobile, model, color, source, temperature, followUp, remarks, staff, staff, isFinance, downPayment, isExchange, exModel, exYear, exValue]
        );

        // 2. Create Initial Log
        await connection.query(
            "INSERT INTO `Enquiry_Logs` (`Enquiry_ID`, `Staff_Name`, `Action_Type`, `Remarks`, `New_FollowUp`) VALUES (?, ?, 'Created', ?, ?)",
            [result.insertId, staff, `Enquiry Created for ${model} (${color || 'No Color'})`, followUp]
        );

        await connection.commit();
        res.json({ message: "Enquiry Captured" });
    } catch (err) { 
        await connection.rollback();
        console.error(err);
        res.status(500).send("Failed to save enquiry"); 
    } finally { connection.release(); }
});

// SMART UPDATE: Handles Status, Logs, and Requirement Changes
app.put('/api/enquiries/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { status, temperature, followUp, remarks, lostReason, model, color, isFinance, isExchange } = req.body;
    const staff = req.user.name;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch Previous Data (To detect changes)
        const [oldData] = await connection.query("SELECT * FROM `Enquiries` WHERE `Enquiry_ID` = ?", [id]);
        const prev = oldData[0];

        let logRemarks = remarks || 'Status Update';
        let actionType = 'Update';

        // 2. Detect Preference Change (Model/Color)
        if (model && (prev.Model_Interested !== model || prev.Color_Interested !== color)) {
            const changeMsg = `Changed Preference: ${prev.Model_Interested} (${prev.Color_Interested}) ➝ ${model} (${color})`;
            
            await connection.query(
                "INSERT INTO `Enquiry_Logs` (`Enquiry_ID`, `Staff_Name`, `Action_Type`, `Remarks`, `Prev_FollowUp`, `New_FollowUp`) VALUES (?, ?, 'Preference Change', ?, ?, ?)",
                [id, staff, changeMsg, prev.Next_FollowUp, followUp || prev.Next_FollowUp]
            );
            actionType = 'Preference Change'; // Prevent double logging below
        }

        // 3. Detect Status Change
        if (status && status !== prev.Status) {
            logRemarks = `Status changed to ${status}. ${lostReason ? 'Reason: ' + lostReason : ''}`;
            actionType = 'Status Change';
        }

        // 4. Update Main Record
        await connection.query(`
            UPDATE \`Enquiries\` SET 
            \`Status\`=COALESCE(?, \`Status\`), 
            \`Temperature\`=COALESCE(?, \`Temperature\`), 
            \`Next_FollowUp\`=COALESCE(?, \`Next_FollowUp\`), 
            \`Model_Interested\`=COALESCE(?, \`Model_Interested\`),
            \`Color_Interested\`=COALESCE(?, \`Color_Interested\`),
            \`Is_Finance\`=COALESCE(?, \`Is_Finance\`),
            \`Is_Exchange\`=COALESCE(?, \`Is_Exchange\`),
            \`Lost_Reason\`=?, 
            \`Remarks\`=CONCAT(IFNULL(\`Remarks\`,''), '\n[', NOW(), '] ', ?) 
            WHERE \`Enquiry_ID\`=?`,
            [status, temperature, followUp, model, color, isFinance, isExchange, lostReason, logRemarks, id]
        );

        // 5. General Log (if not just a preference change)
        if (actionType !== 'Preference Change') {
             await connection.query(
                "INSERT INTO `Enquiry_Logs` (`Enquiry_ID`, `Staff_Name`, `Action_Type`, `Remarks`, `Prev_FollowUp`, `New_FollowUp`) VALUES (?, ?, ?, ?, ?, ?)",
                [id, staff, actionType, logRemarks, prev.Next_FollowUp, followUp]
            );
        }

        await connection.commit();
        res.json({ message: "Enquiry Updated" });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).send("Update Failed");
    } finally {
        connection.release();
    }
});

// LOG INTERACTION (Call/Visit)
app.post('/api/enquiries/log', authenticate, async (req, res) => {
    const { enquiryId, actionType, remarks, nextDate, temperature } = req.body;
    const staff = req.user.name;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [curr] = await connection.query("SELECT `Next_FollowUp` FROM `Enquiries` WHERE `Enquiry_ID` = ?", [enquiryId]);
        const oldDate = curr[0]['Next_FollowUp'];

        await connection.query(
            "INSERT INTO `Enquiry_Logs` (`Enquiry_ID`, `Staff_Name`, `Action_Type`, `Remarks`, `Prev_FollowUp`, `New_FollowUp`) VALUES (?, ?, ?, ?, ?, ?)",
            [enquiryId, staff, actionType, remarks, oldDate, nextDate]
        );

        await connection.query(
            "UPDATE `Enquiries` SET `Temperature`=?, `Next_FollowUp`=? WHERE `Enquiry_ID`=?",
            [temperature, nextDate, enquiryId]
        );

        await connection.commit();
        res.json({ message: "Interaction Logged" });
    } catch (err) {
        await connection.rollback();
        res.status(500).send("Log Failed");
    } finally { connection.release(); }
});

// BOOKING API (TOKEN PAYMENT + STATUS UPDATE)
app.post('/api/presales/book', authenticate, async (req, res) => {
    const { enquiryId, name, mobile, amount, mode, remarks } = req.body;
    const staff = req.user.name;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Create/Find Customer
        let custId;
        const [existing] = await connection.query("SELECT `Cust ID` FROM `Customers` WHERE `Mobile No` = ?", [mobile]);
        if (existing.length > 0) {
            custId = existing[0]['Cust ID'];
        } else {
            custId = 'CUST-' + Date.now();
            await connection.query(
                "INSERT INTO `Customers` (`Row ID`, `Cust ID`, `Name`, `Mobile No`, `timestamp`, `Created By`) VALUES (?, ?, ?, ?, NOW(), ?)",
                ['ROW-'+Date.now(), custId, name, mobile, staff]
            );
        }

        // 2. Record Token Payment
        await connection.query(
            "INSERT INTO `Customer_Payments` (`Cust_ID`, `Amount`, `Payment_Date`, `Mode`, `Note`) VALUES (?, ?, CURDATE(), ?, ?)",
            [custId, amount, mode, `Booking Advance / Token for Enquiry #${enquiryId}`]
        );

        // 3. Update Enquiry
        const updateNote = `[${new Date().toLocaleDateString()}] BOOKED: Paid Token ₹${amount} (${mode}). Remarks: ${remarks}`;
        await connection.query(
            "UPDATE `Enquiries` SET `Status`='Booked', `Cust_ID`=?, `Remarks`=CONCAT(IFNULL(`Remarks`,''), '\n', ?) WHERE `Enquiry_ID`=?",
            [custId, updateNote, enquiryId]
        );

        // 4. Log the Booking Event in Timeline
        await connection.query(
            "INSERT INTO `Enquiry_Logs` (`Enquiry_ID`, `Staff_Name`, `Action_Type`, `Remarks`) VALUES (?, ?, 'Booking', ?)",
            [enquiryId, staff, `Customer Paid Token ₹${amount} via ${mode}`]
        );

        await connection.commit();
        res.json({ message: "Booking Confirmed! Token Recorded.", custId });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).send("Booking Failed");
    } finally {
        connection.release();
    }
});

// GET LOGS (TIMELINE)
app.get('/api/enquiries/logs/:id', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM `Enquiry_Logs` WHERE `Enquiry_ID` = ? ORDER BY `Created_At` DESC", [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).send("Error"); }
});

// GET STATS
app.get('/api/enquiries/stats', authenticate, async (req, res) => {
    try {
        const connection = await db.getConnection();
        const [tempStats] = await connection.query("SELECT `Temperature`, COUNT(*) as count FROM `Enquiries` WHERE `Status`='Open' GROUP BY `Temperature`");
        const [leakage] = await connection.query("SELECT `Lost_Reason`, COUNT(*) as count FROM `Enquiries` WHERE `Status`='Lost' GROUP BY `Lost_Reason`");
        connection.release();
        res.json({ tempStats, leakage });
    } catch (err) { res.status(500).send("Error getting stats"); }
});

// ==========================================
// 11. STAFF MANAGEMENT
// ==========================================
app.get('/api/users', authenticate, async (req, res) => {
    if (req.user.role === 'Salesman') return res.status(403).send("Access Denied");
    try { const [rows] = await db.query("SELECT User_ID, Full_Name, Username, Role, Created_At FROM `Users`"); res.json(rows); } 
    catch (err) { res.status(500).send("Error"); }
});

app.post('/api/users', authenticate, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).send("Only Admins can create users");
    const { fullName, username, password, role } = req.body;
    try { await db.query("INSERT INTO `Users` (`Full_Name`, `Username`, `Password`, `Role`) VALUES (?, ?, ?, ?)", [fullName, username, password, role]); res.json({ message: "User Created" }); } 
    catch (err) { res.status(500).send("Error"); }
});

app.delete('/api/users/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).send("Only Admins can delete users");
    try { await db.query("DELETE FROM `Users` WHERE `User_ID` = ?", [req.params.id]); res.json({ message: "User Deleted" }); } 
    catch (err) { res.status(500).send("Error"); }
});

// ==========================================
// 12. DASHBOARD ANALYTICS API (FIXED)
// ==========================================
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
    try {
        const connection = await db.getConnection();

        // 1. Total Sales & Revenue
        const [sales] = await connection.query("SELECT COUNT(*) as count, SUM(`Grand Total`) as revenue FROM `Delivery`");
        
        // 2. Stock Count
        const [stock] = await connection.query("SELECT COUNT(*) as count FROM `Purchase` WHERE `Status` IN ('Stock In', 'In Stock', 'Available', 'New')");
        
        // 3. Active Leads
        const [leads] = await connection.query("SELECT COUNT(*) as count FROM `Enquiries` WHERE `Status`='Open'");
        
        // 4. Pending Recoveries
        const [dues] = await connection.query("SELECT COUNT(*) as count, SUM(`Amount`) as total FROM `Credit_Promises` WHERE `Status`='Pending'");

        // 5. Recent 5 Sales (FIXED: Added JOIN to get Model Variant)
        const [recentSales] = await connection.query(`
            SELECT d.\`Date\`, d.\`Customer\`, p.\`Model Variant\`, d.\`Grand Total\` 
            FROM \`Delivery\` d
            LEFT JOIN \`Purchase\` p ON d.\`Frame No\` = p.\`Frame No\`
            ORDER BY d.\`Date\` DESC LIMIT 5
        `);

        connection.release();

        res.json({
            salesCount: sales[0].count || 0,
            revenue: sales[0].revenue || 0,
            stockCount: stock[0].count || 0,
            leadCount: leads[0].count || 0,
            dueCount: dues[0].count || 0,
            dueAmount: dues[0].total || 0,
            recentSales: recentSales
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Dashboard Error");
    }
});



const PORT = 5000;
app.listen(PORT, () => { console.log(`Honda ERP Server running on port ${PORT}`); });