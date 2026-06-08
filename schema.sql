-- 1. CREATE THE USERS TABLE (Handles Authentication & Logins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('client', 'escort', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. CREATE THE ESCORT PROFILES TABLE
CREATE TABLE escort_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    location TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    incall_price NUMERIC NOT NULL CHECK (incall_price >= 2000),
    outcall_price NUMERIC NOT NULL CHECK (outcall_price >= 2000),
    services TEXT[] NOT NULL, -- Array holding list items like ['Oral', 'Anal']
    virtual_wallet NUMERIC DEFAULT 10000.00,
    
    -- Subscription Metrics
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'vip')),
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Photo Media Grid Configurations
    image_urls TEXT[] NOT NULL DEFAULT '{}', -- List holding up to 5 file URLs
    main_image_index INT DEFAULT 0 CHECK (main_image_index >= 0 AND main_image_index <= 4),
    
    ratings_average NUMERIC DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CREATE THE VVIP REQUESTS TABLE (Your Admin Feed Inbox)
CREATE TABLE vvip_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_whatsapp TEXT NOT NULL,
    client_location TEXT NOT NULL,
    custom_message TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CREATE THE AUTO-EXPIRY VIEW FOR THE PUBLIC FRONT END GRID
CREATE OR REPLACE VIEW active_public_escorts AS
SELECT 
    id,
    username,
    location,
    incall_price,
    outcall_price,
    services,
    subscription_tier,
    -- Pull out only the single main image chosen by the escort
    image_urls[main_image_index + 1] AS main_cover_image, 
    ratings_average
FROM escort_profiles
WHERE 
    -- EXCLUSION FILTER: Escort profile vanishes instantly if due date is passed
    subscription_expires_at > CURRENT_TIMESTAMP;
