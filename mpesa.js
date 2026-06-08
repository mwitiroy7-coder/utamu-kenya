import dotenv from 'dotenv';
dotenv.config();

// SAFARICOM STK PUSH METRIC VARIABLES
const MPESA_SHORTCODE = '174379'; // Test shortcode (Replace with your live Till/Paybill number later)
const BANK_ACCOUNT = '1040157416566'; // Your direct target bank account number destination!

// HELPER FUNCTION: Generates OAuth authentication token required by Safaricom Daraja
async function getMpesaToken() {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    try {
        const response = await fetch('https://safaricom.co.ke', {
            method: 'GET',
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const data = await response.json();
        return data.access_token;
    } catch (err) {
        console.error('Safaricom authentication handshake failure:', err.message);
    }
}

// MAIN EXPORT TRIGGER: Forces the popup STK push directly to the provider's screen phone line
export async function triggerStkPush(phoneNumber, amount) {
    const token = await getMpesaToken();
    if (!token) throw new Error('Could not authorize Daraja API credentials.');

    const date = new Date();
    const timestamp = date.getFullYear() +
        ('0' + (date.getMonth() + 1)).slice(-2) +
        ('0' + date.getDate()).slice(-2) +
        ('0' + date.getHours()).slice(-2) +
        ('0' + date.getMinutes()).slice(-2) +
        ('0' + date.getSeconds()).slice(-2);

    // Secure generation hash required by Safaricom endpoints
    const passkey = process.env.MPESA_PASSKEY;
    const password = Buffer.from(`${MPESA_SHORTCODE}${passkey}${timestamp}`).toString('base64');

    const payload = {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // Custom parameters to handle equity/bank routing pushes
        Amount: amount,
        PartyA: phoneNumber.replace('+', ''), // Phone line typing input parameter
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: phoneNumber.replace('+', ''),
        CallBackURL: `${process.env.SERVER_URL}/api/mpesa/callback`, // The ears of our server listening for successful payments
        AccountReference: BANK_ACCOUNT, // Drops cash references into your bank routing pipeline
        TransactionDesc: 'Utamu Premium Renewal Activation'
    };

    const response = await fetch('https://safaricom.co.ke', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    return await response.json();
}
