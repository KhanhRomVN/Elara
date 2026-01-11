import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const STORE_FILE = path.join(app.getPath('userData'), 'config.json');

// Ensure store file exists
if (!fs.existsSync(STORE_FILE)) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify({}, null, 2));
  } catch (e) {
    console.error('Failed to create config file:', e);
  }
}

export const store = {
  get: (key: string): any => {
    try {
      if (!fs.existsSync(STORE_FILE)) return undefined;
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      return data[key];
    } catch (e) {
      console.error(`Error reading key ${key} from store:`, e);
      return undefined;
    }
  },
  set: (key: string, value: any): void => {
    try {
      let data: any = {};
      if (fs.existsSync(STORE_FILE)) {
        data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      }
      data[key] = value;
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`Error writing key ${key} to store:`, e);
    }
  },
};
