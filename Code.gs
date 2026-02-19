// ฟังก์ชันนี้จะถูกเรียกจากฝั่ง Frontend (HTML)
function saveTransaction(orderData) {
  // orderData หน้าตาประมาณนี้: 
  // { type: "INCOME", total: 500, method: "CASH", note: "ลูกค้าโอน", items: [{id: "P001", qty: 2, subtotal: 200}, ...] }
  
  // 🚨 ตำรวจลง! กูใส่ LockService ป้องกันคนกดเซฟบิลพร้อมกันแล้วข้อมูลพัง
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // รอคิวรันสคริปต์สูงสุด 30 วินาที

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const txSheet = ss.getSheetByName("Transactions");
    const detailsSheet = ss.getSheetByName("Transaction_Details");

    // 1. สร้าง Transaction ID (ใช้ ตัว T + ปีเดือนวันเวลา จะได้ไม่ซ้ำ)
    const timestamp = new Date();
    const txId = "T" + Utilities.formatDate(timestamp, "GMT+7", "yyMMddHHmmss");

    // 2. บันทึกหัวบิลลง Sheet 'Transactions'
    txSheet.appendRow([
      txId, 
      timestamp, 
      orderData.type, 
      orderData.total, 
      orderData.method, 
      orderData.note
    ]);

    // 3. เตรียมข้อมูลไส้ในบิล (Details)
    const detailsData = [];
    orderData.items.forEach(item => {
      // สร้าง ID ให้แต่ละบรรทัด
      const detailId = "D" + Utilities.getUuid().split('-')[0]; 
      // เรียงคอลัมน์: Detail_ID, Tx_ID, Product_ID, Qty, Subtotal
      detailsData.push([detailId, txId, item.id, item.qty, item.subtotal]);
    });

    // 💡 ทริคคนฉลาด: ใช้ setValues บันทึกข้อมูลทีละหลายบรรทัดรวดเดียว เร็วกว่าใช้ appendRow ใน Loop เยอะ
    if (detailsData.length > 0) {
      const startRow = detailsSheet.getLastRow() + 1;
      detailsSheet.getRange(startRow, 1, detailsData.length, detailsData[0].length).setValues(detailsData);
    }

    return { success: true, message: `บันทึกเรียบร้อย! รหัสบิล: ${txId}` };

  } catch (error) {
    // ถ้าบั๊กแตก ก็ส่ง Error กลับไปบอกหน้าเว็บ
    return { success: false, message: `พังว่ะเพื่อน Error: ${error.message}` };
  } finally {
    // รันจบก็ปลดล็อกคิวให้คนอื่นใช้ต่อ
    lock.releaseLock();
  }
}

// ฟังก์ชันนี้จำเป็นมาก ไว้สำหรับ Render หน้าเว็บ HTML
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ระบบ POS ของแปง')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1'); // ทำให้ดูบนมือถือได้
}

// ฟังก์ชันดึงรายการสินค้าจาก Sheet
function getProducts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Products");
  
  // ดึงข้อมูลมาทั้งหมดเลย (มันจะมาเป็น Array 2 มิติ)
  const data = sheet.getDataRange().getValues();
  const products = [];
  
  // ลูปข้ามแถวแรก (Header) ไปเริ่มที่ i = 1
  for (let i = 1; i < data.length; i++) {
    // เช็คว่าแถวนั้นมีรหัสสินค้าไหม จะได้ไม่ดึงบรรทัดว่างมา
    if (data[i][0]) {
      products.push({
        id: data[i][0],    // คอลัมน์ A (Product_ID)
        name: data[i][1],  // คอลัมน์ B (Name)
        price: data[i][4]  // คอลัมน์ E (Price)
      });
    }
  }
  
  return products;
}