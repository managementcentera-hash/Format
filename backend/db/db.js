// This are my database functions POST GET UPDATE ARCHIVED
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'db.json');
const recordFilePath = path.join(__dirname, 'record.json');


function create(email, id, ip) {
  // This function establishes a new client and creates a profile

  // converts and reads the json file in object data type instead of string
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  data[email] = {};
  data[email].email = email;
  data[email].id = id;
  data[email].ip = ip;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

}

function update(prop, email) {
  // This function updates all other neccesary properties password, otp.

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  
  
  Object.keys(prop).map((key) => {
    data[email][key] = prop[key];
  });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function remove(email) {
  // This function deletes a client details

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  delete data[email]
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function removeProps(prop, email) {
  // This function removes the specified properties from the user record.
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  Object.keys(prop).forEach((key) => {
    if (data[email] && key in data[email]) {
      delete data[email][key];
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getProp(prop, email) {
  // This function returns only the specified property from the user record.
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const user = data[email];

  if (!user || !(prop in user)) {
    return null;
  }

  return user[prop];
}

function adminHandler() {
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return data;
}

function check(email) {
  const record = JSON.parse(fs.readFileSync(recordFilePath, "utf-8"));
  if (!Array.isArray(record.records)) {
    record.records = [];
  }
  if (!record.records.includes(email)) {
    record.records.push(email);
  }
  fs.writeFileSync(recordFilePath, JSON.stringify(record, null, 2));
}

function existing() {
  const record = JSON.parse(fs.readFileSync(recordFilePath, "utf-8"));
  return record.records;
}

export {create, update, remove, getProp, removeProps, adminHandler, check, existing};