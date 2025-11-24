-- Migration: create users and info tables + olongapo_barangay enum
-- Generated: add users and info schema for Olongapo Barangays

CREATE TYPE IF NOT EXISTS olongapo_barangay AS ENUM (
    'Barretto',
    'East Bajac-Bajac',
    'East Tapinac',
    'Gordon Heights',
    'Kalaklan',
    'Mabayuan',
    'New Asinan',
    'New Banicain',
    'New Cabalan',
    'New Ilalim',
    'New Kababae',
    'New Kalalake',
    'Old Cabalan',
    'Pag-Asa',
    'Santa Rita',
    'West Bajac-Bajac',
    'West Tapinac'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    firstname VARCHAR(50) NOT NULL,
    middlename VARCHAR(50),
    lastname VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Resident',
    isverified BOOLEAN DEFAULT false,
    avatar_url TEXT DEFAULT '/default-avatar.png',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    current_token TEXT,
    deleted_at TIMESTAMPTZ,
    onpremium BOOLEAN DEFAULT false,

    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS info (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID,
    birthdate DATE,
    phone VARCHAR(11),
    address_barangay olongapo_barangay,
    address_province VARCHAR(50) DEFAULT 'Zambales',
    address_city VARCHAR(50) DEFAULT 'Olongapo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    bio TEXT,
    address_street TEXT,
    verified BOOLEAN DEFAULT false,

    CONSTRAINT info_pkey PRIMARY KEY (id),
    CONSTRAINT info_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_info_barangay ON info(address_barangay);
