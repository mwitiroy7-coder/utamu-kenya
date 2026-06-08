import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Import our secure live cloud connection instance
import crypto from 'crypto';
import fileUpload from 'express-fileupload';

import { supabase } from './supabase.js';

// Load environmental keys out of our secure .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());
// DYNAMIC TESTING ROUTE: Ping the cloud database table live
// Serve the frontend landing page directly at the main link
app.get('/', (req, res) => {
    res.sendFile(require('path').join(__dirname, 'index.html'));
});

    } catch (err) {
        res.status(500).json({ 
            message: 'Server error occurred', 
            database_status: 'Connection Failed',
            error_details: err.message 
        });
    }
});
// POST ENDPOINT: Receives and saves a new VVIP Client Matchmaking request
app.post('/api/vvip-request', async (req, res) => {
    // 1. Unpack the custom form data sent from the browser inputs
    const { whatsappNumber, location, message } = req.body;

    // 2. Simple security check: block empty inputs instantly
    if (!whatsappNumber || !location || !message) {
        return res.status(400).json({ error: 'All fields are strictly required!' });
    }

    try {
        // 3. Connect to Supabase and insert the data row into our table
        const { data, error } = await supabase
            .from('vvip_requests')
            .insert([
                { 
                    client_whatsapp: whatsappNumber, 
                    client_location: location, 
                    custom_message: message 
                }
            ]);

        if (error) throw error;

        // 4. Send back a clean notification to the user's screen
        res.status(201).json({ 
            success: true, 
            message: 'Your request has been delivered directly to the Admin. Matchmaking is underway!' 
        });

    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: 'Database transaction failed. Please try again.',
            details: err.message 
        });
    }
});
// HELPER FUNCTION: Securely turns plain text passwords into safe hashes
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// 1. REGISTRATION ENDPOINT: Creates a brand new user or escort account
app.post('/api/auth/register', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'All fields are strictly required!' });
    }

    try {
        const securePassword = hashPassword(password);

        // Save account into the cloud database users table
        const { data, error } = await supabase
            .from('users')
            .insert([{ email, password_hash: securePassword, role }])
            .select();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'This email is already registered!' });
            throw error;
        }

        res.status(201).json({ success: true, message: 'Account successfully created!', user: data });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed', details: err.message });
    }
});

// 2. LOGIN ENDPOINT: Verifies credentials and unlocks access
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required!' });
    }

    try {
        const securePassword = hashPassword(password);

        // Look up the user row by matching their unique email
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || data.password_hash !== securePassword) {
            return res.status(401).json({ error: 'Invalid email or password mismatch!' });
        }

        res.json({
            success: true,
            message: 'Login successful!',
            user: { id: data.id, email: data.email, role: data.role }
        });
    } catch (err) {
        res.status(500).json({ error: 'Login verification failed', details: err.message });
    }
});
// GET ENDPOINT: Serves active public escorts sorted by tier to the frontend matrix
app.get('/api/public-escorts', async (req, res) => {
    try {
        // Read directly out of our automated strict auto-expiry View structure
        const { data, error } = await supabase
            .from('active_public_escorts')
            .select('*')
            .order('subscription_tier', { ascending: false }); // Ensures VIP is always sorted to the absolute top slots!

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve active profiles feed.', details: err.message });
    }
});
// POST ENDPOINT: Receives escort profile setup data and registers her profile card
app.post('/api/escort/create-profile', async (req, res) => {
    const { userId, username, location, phone, incall, outcall, services } = req.body;

    // 1. Strict validation checks
    if (!userId || !username || !location || !phone || !incall || !outcall) {
        return res.status(400).json({ error: 'All primary details are strictly required!' });
    }

    // 2. Strict Pricing Boundary Rule Enforcement (Database protection)
    if (incall < 2000 || outcall < 2000) {
        return res.status(400).json({ error: 'System policy error: Session rates cannot be below 2,000 Ksh!' });
    }

    try {
        // 3. Insert profile record row into your cloud database table
        const { data, error } = await supabase
            .from('escort_profiles')
            .insert([
                {
                    user_id: userId,
                    username: username,
                    location: location,
                    phone_number: phone,
                    incall_price: incall,
                    outcall_price: outcall,
                    services: services || [],
                    virtual_wallet: 10000.00, // Pre-loads the initial 10,000 Ksh balance automatically!
                    subscription_tier: 'free' // Starts on free tier until a plan is purchased
                }
            ])
            .select();

        if (error) {
            // Check if profile record row already exists for this unique login user ID link
            if (error.code === '23505') return res.status(400).json({ error: 'Profile card details have already been initialized for this member account.' });
            throw error;
        }

        // 4. Send back transaction completion status response
        res.status(201).json({
            success: true,
            message: 'Your profile card and virtual wallet with 10,000 Ksh balance have been initialized successfully!',
            profile: data
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Profile initialization routine transaction failed.',
            details: err.message
        });
    }
});
// 1. GET ENDPOINT: Fetches private escort data matching only her logged-in account ID
app.get('/api/escort/private-data/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const { data, error } = await supabase
            .from('escort_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw error;

        // Return her data cleanly so only she sees her wallet and settings
        res.json({ success: true, profile: data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to synchronize private account profile telemetry.', details: err.message });
    }
});

// 2. POST ENDPOINT: Updates her personal selection for the main cover photo index
app.post('/api/escort/update-cover', async (req, res) => {
    const { userId, selectedIndex } = req.body;

    if (!userId || selectedIndex === undefined) {
        return res.status(400).json({ error: 'Missing account tracking attributes.' });
    }

    try {
        // Update her database row with the new chosen index number (0 to 4)
        const { data, error } = await supabase
            .from('escort_profiles')
            .update({ main_image_index: selectedIndex })
            .eq('user_id', userId)
            .select();

        if (error) throw error;

        res.json({ 
            success: true, 
            message: 'Your public main cover photo preference choice has been successfully updated!' 
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update selection settings.', details: err.message });
    }
});
// =========================================================================
// ADMINISTRATIVE CONTROL PANEL ENGINE ENDPOINTS (EXCLUSIVE TO YOU)
// =========================================================================

// 1. GET ENDPOINT: Pulls up a master report feed list of ALL escorts + active/expired metrics
app.get('/api/admin/all-escorts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('escort_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Process profile records dynamically to flag who is expired or bypassed right now
        const formattedProfiles = data.map(profile => {
            const isExpired = !profile.subscription_expires_at || new Date(profile.subscription_expires_at) < new Date();
            return {
                ...profile,
                status: profile.is_admin_approved ? 'Admin Override Live' : (isExpired ? 'Expired' : 'Active Paid')
            };
        });

        res.json({ success: true, escorts: formattedProfiles });
    } catch (err) {
        res.status(500).json({ error: 'Failed to extract administrative metrics profile list.', details: err.message });
    }
});

// 2. ACTION ENDPOINT: Toggles the Admin bypass flag to return expired accounts back to public for free
app.post('/api/admin/override-status', async (req, res) => {
    const { profileId, forcePublic } = req.body; // Expects forcePublic to be a true or false value

    if (!profileId) return res.status(400).json({ error: 'Profile tracking index target required.' });

    try {
        const { data, error } = await supabase
            .from('escort_profiles')
            .update({ is_admin_approved: forcePublic }) // Flips the column switch inside your database row!
            .eq('id', profileId)
            .select();

        if (error) throw error;

        res.json({ 
            success: true, 
            message: forcePublic 
                ? 'Profile bypassed successfully! This escort is now live on the public matrix grid for free.' 
                : 'Admin override removed. Profile fallback active status rules restored.' 
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process bypass command settings toggle.', details: err.message });
    }
});
// Import the STK trigger function we created in mpesa.js
import { triggerStkPush } from './mpesa.js';

// =========================================================================
// M-PESA DARAJA UTILITY AUTOMATION ENDPOINTS
// =========================================================================

// 1. ENDPOINT: Triggers the phone screen prompt for billing renewal top-ups
app.post('/api/mpesa/pay', async (req, res) => {
    const { userId, phone, amount } = req.body;

    if (!userId || !phone || !amount) {
        return res.status(400).json({ error: 'Missing necessary billing attributes.' });
    }

    try {
        // Kick off the Daraja API handshake to push the prompt to their phone line
        const mpesaResponse = await triggerStkPush(phone, amount);
        
        res.json({ 
            success: true, 
            message: 'M-Pesa STK Push prompted successfully! Please enter your PIN on your phone.', 
            details: mpesaResponse 
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to initialize financial transaction request.', details: err.message });
    }
});

// 2. ENDPOINT: The callback listener ears that Safaricom pings on successful payment
app.post('/api/mpesa/callback', async (req, res) => {
    const callbackData = req.body.Body.stkCallback;

    // ResultCode 0 means the user successfully typed their PIN and the money has landed in your account!
    if (callbackData.ResultCode === 0) {
        // Extract the customer phone line number from the Safaricom packet response
        const item = callbackData.CallbackMetadata.Item;
        const phoneItem = item.find(i => i.Name === 'PhoneNumber');
        const customerPhone = `+${phoneItem.Value}`;

        // Calculate a strict 1-Month future due date from right now
        const currentDateTime = new Date();
        const futureExpiryDate = new Date(currentDateTime.setMonth(currentDateTime.getMonth() + 1));

        try {
            // Update her cloud row status: turn off free mode, set tier to VIP, update expiry time!
            const { data, error } = await supabase
                .from('escort_profiles')
                .update({ 
                    subscription_tier: 'vip',
                    subscription_expires_at: futureExpiryDate.toISOString(),
                    is_admin_approved: false // Clear any temporary manual admin overrides safely
                })
                .eq('phone_number', customerPhone);

            if (error) throw error;
            console.log(`[FINANCIAL SUCCESS] Account linked to ${customerPhone} successfully renewed for 1 Month!`);

        } catch (err) {
            console.error('Failed to execute automatic cloud profile activation query:', err.message);
        }
    }

    // Always return a clean success verification response acknowledging receipt to Safaricom's automated servers
    res.json({ ResultCode: 0, ResultDesc: 'Callback accepted and processed successfully.' });
});
// =========================================================================
// MULTI-MEDIA FILE UPLOAD & CLOUD STORAGE ENGINE
// =========================================================================

app.post('/api/escort/upload-photos', async (req, res) => {
    const { userId } = req.body;

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No image files were selected for upload.' });
    }

    if (!userId) return res.status(400).json({ error: 'Missing account validation tracking code.' });

    try {
        let filesToUpload = [];
        if (Array.isArray(req.files.photos)) {
            filesToUpload = req.files.photos;
        } else {
            filesToUpload = [req.files.photos];
        }

        // Strict limit barrier: Max 5 photos per escort profile card
        if (filesToUpload.length > 5) {
            return res.status(400).json({ error: 'System policy alert: You can upload a maximum of 5 photos only.' });
        }

        const standardUploadedUrls = [];

        // Loop through each photo file and stream it straight up to your Supabase Public Storage Bucket
        for (let i = 0; i < filesToUpload.length; i++) {
            const currentFile = filesToUpload[i];
            const fileUniquePath = `${userId}/photo_${Date.now()}_${i}.jpg`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('escort-photos')
                .upload(fileUniquePath, currentFile.data, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Extract the direct public web link path of the cloud photo asset file
            const { data: publicUrlData } = supabase.storage
                .from('escort-photos')
                .getPublicUrl(fileUniquePath);

            standardUploadedUrls.push(publicUrlData.publicUrl);
        }

        // Save the collection list array of image URLs straight into her cloud user data profile card cell row space
        const { data: profileUpdate, error: dbError } = await supabase
            .from('escort_profiles')
            .update({ image_urls: standardUploadedUrls, main_image_index: 0 })
            .eq('user_id', userId)
            .select();

        if (dbError) throw dbError;

        res.json({
            success: true,
            message: `Successfully uploaded ${standardUploadedUrls.length} photos straight to your directory card!`,
            urls: standardUploadedUrls
        });

    } catch (err) {
        res.status(500).json({ error: 'Media framework file execution crash.', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server successfully fired up on port ${PORT}`);
});
