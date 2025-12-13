import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Correct implicit import
import dayjs from 'dayjs';

export const generateGatePassPDF = (data) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // --- HELPER: HEADER ---
    const drawHeader = (y, title) => {
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("MAA DURGA HONDA", pageWidth / 2, y, { align: "center" });
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Main Road, Sakti, Chhattisgarh - 495689", pageWidth / 2, y + 6, { align: "center" });
        doc.text("Mob: 98271-12345 | Email: sales@maadurgahonda.com", pageWidth / 2, y + 11, { align: "center" });
        
        doc.setLineWidth(0.5);
        doc.line(10, y + 14, pageWidth - 10, y + 14);
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, pageWidth / 2, y + 22, { align: "center" }); 
    };

    // --- HELPER: DETAILS ---
    const drawDetails = (y, customer, vehicle) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        // Left Column (Customer)
        doc.text(`Name: ${customer.Name || '-'}`, 15, y);
        doc.text(`Mobile: ${customer["Mobile No"] || '-'}`, 15, y + 6);
        doc.text(`Address: ${customer.Address || 'See Profile'}`, 15, y + 12);

        // Right Column (Vehicle)
        const xRight = 110;
        doc.text(`Invoice No: ${vehicle.Gate_Pass_ID || 'PENDING'}`, xRight, y);
        doc.text(`Date: ${dayjs().format('DD-MMM-YYYY')}`, xRight, y + 6);
        doc.text(`Model: ${vehicle['Model Variant']}`, xRight, y + 12);
        doc.text(`Color: ${vehicle.Color}`, xRight, y + 18);
        
        // Box for Chassis/Engine
        doc.setDrawColor(0);
        doc.rect(10, y + 24, pageWidth - 20, 15);
        doc.setFont("helvetica", "bold");
        doc.text(`Frame No: ${vehicle['Frame No']}`, 15, y + 30);
        doc.text(`Engine No: ${vehicle['Engine No']}`, 110, y + 30);
        doc.text(`Key No: ${vehicle['Key No'] || '-'}`, 15, y + 36);
        
        // BATTERY PRINT LOGIC
        const batNo = vehicle.Battery_No || vehicle['Battery No'] || '-';
        doc.text(`Battery No: ${batNo}`, 110, y + 36);
    };

    // --- HELPER: SERVICE SCHEDULE ---
    const drawServiceSchedule = (yStart) => {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Free Service Schedule", 15, yStart);
        
        const purchaseDate = dayjs(); 
        
        const services = [
            { name: "1st Service", days: "15-30 Days", date: purchaseDate.add(30, 'day').format('DD-MMM-YYYY') },
            { name: "2nd Service", days: "165-180 Days", date: purchaseDate.add(180, 'day').format('DD-MMM-YYYY') },
            { name: "3rd Service", days: "350-365 Days", date: purchaseDate.add(365, 'day').format('DD-MMM-YYYY') },
        ];

        autoTable(doc, {
            startY: yStart + 3,
            head: [['Service', 'Time Frame', 'Due Date (Approx)']],
            body: services.map(s => [s.name, s.days, s.date]),
            theme: 'grid',
            headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            margin: { left: 10, right: 10 }
        });
    };

    const drawFooter = (y) => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Customer Signature", 30, y);
        doc.text("Authorized Signatory", 150, y);
        doc.setLineWidth(0.2);
        doc.line(15, y - 5, 60, y - 5); 
        doc.line(130, y - 5, 180, y - 5);
        doc.setFontSize(8);
        doc.text("* Goods once sold will not be taken back.", 105, y + 10, { align: "center" });
    };

    // --- DEALER COPY ---
    drawHeader(15, "GATE PASS (DEALER COPY)");
    drawDetails(45, data.customer, data.sale);
    
    // Summary
    autoTable(doc, {
        startY: 90,
        head: [['Description', 'Amount']],
        body: [
            ['Vehicle On-Road Price', `Rs. ${Number(data.sale['Grand Total']).toLocaleString()}`],
            ['Total Paid (Cash/UPI/Fin)', `Rs. ${Number(data.sale['Grand Total']).toLocaleString()}`], 
            ['Balance Due', 'Rs. 0.00']
        ],
        theme: 'plain',
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 100 }
    });

    drawFooter(130);

    // Separator
    doc.setLineDash([3, 3], 0);
    doc.line(5, 145, pageWidth - 5, 145);
    doc.setLineDash([]);

    // --- CUSTOMER COPY ---
    const offset = 150;
    drawHeader(15 + offset, "GATE PASS (CUSTOMER COPY)");
    drawDetails(45 + offset, data.customer, data.sale);
    drawServiceSchedule(90 + offset); 
    drawFooter(130 + offset);

    doc.save(`GatePass_${data.sale['Frame No']}.pdf`);
};