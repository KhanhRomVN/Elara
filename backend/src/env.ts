import path from 'path';
import dotenv from 'dotenv';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
